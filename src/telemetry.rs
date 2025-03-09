use chrono::DateTime;
use rustis::commands::{ExpireOption, GenericCommands, StringCommands};
use serde::{Deserialize, Serialize};
use sha2::Digest;
use sqlx::types::Uuid;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::Mutex;

nestify::nest! {
    #[derive(Deserialize, Serialize)] pub struct TelemetryData {
        #[serde(skip_serializing)]
        id: Uuid,

        #[serde(skip_serializing)]
        telemetry_version: u16,

        blueprint: #[derive(Deserialize, Serialize)] struct Blueprint {
            version: String,
            docker: bool,

            flags: #[derive(Deserialize, Serialize)] struct Flags {
                disable_attribution: bool,
                is_developer: bool,
                show_in_sidebar: bool
            },

            extensions: Vec<#[derive(Deserialize, Serialize)] struct Extension {
                identifier: String,
                version: String,
                author: Option<String>,
                target: String
            }>
        },
        panel: #[derive(Deserialize, Serialize)] struct Panel {
            version: String,
            #[serde(rename = "phpVersion")]
            php_version: String,

            drivers: #[derive(Deserialize, Serialize)] struct Drivers {
                backup: #[derive(Deserialize, Serialize)] struct Backup {
                    r#type: String
                },

                cache: #[derive(Deserialize, Serialize)] struct Cache {
                    r#type: String
                },

                database: #[derive(Deserialize, Serialize)] struct Database {
                    r#type: String,
                    version: String
                }
            }
        }
    }
}

#[derive(Deserialize, Serialize)]
pub struct Telemetry {
    panel_id: Uuid,
    telemetry_version: i16,
    ip: String,
    continent: Option<String>,
    country: Option<String>,
    data: TelemetryData,
    created: DateTime<chrono::Utc>,
}

pub struct TelemetryLogger {
    processing: Mutex<Vec<Telemetry>>,
    database: Arc<crate::database::Database>,
    cache: Arc<crate::cache::Cache>,
    env: Arc<crate::env::Env>,
}

impl TelemetryLogger {
    pub fn new(
        database: Arc<crate::database::Database>,
        cache: Arc<crate::cache::Cache>,
        env: Arc<crate::env::Env>,
    ) -> Self {
        Self {
            processing: Mutex::new(Vec::new()),
            database,
            cache,
            env,
        }
    }

    pub async fn log(&self, ip: &str, telemetry: TelemetryData) -> Option<()> {
        let mut processing = self.processing.lock().await;

        let ratelimit_key = format!("blueprint_api::ratelimit::{}", ip);

        let count = self.cache.client.incr(&ratelimit_key).await.unwrap();
        if count == 1 {
            self.cache
                .client
                .expire(&ratelimit_key, 86400, ExpireOption::None)
                .await
                .unwrap();
        }

        if count > self.env.telemetry_ratelimit_per_day {
            return None;
        }

        let data = Telemetry {
            panel_id: telemetry.id,
            telemetry_version: telemetry.telemetry_version as i16,
            ip: ip.to_string(),
            continent: None,
            country: None,
            data: telemetry,
            created: chrono::Utc::now(),
        };

        processing.push(data);

        Some(())
    }

    async fn lookup_ips(&self, ips: &[String]) -> HashMap<String, (String, String)> {
        let mut result = HashMap::new();

        let data = reqwest::Client::new()
            .post("http://ip-api.com/batch")
            .header("Content-Type", "application/json")
            .header("User-Agent", "Blueprint API/1.0.0 https://blueprint.zip")
            .json(
                &ips.iter()
                    .map(|ip| {
                        serde_json::json!({
                            "query": ip,
                            "fields": "continentCode,countryCode,query"
                        })
                    })
                    .collect::<Vec<_>>(),
            )
            .send()
            .await
            .unwrap()
            .json::<Vec<serde_json::Value>>()
            .await
            .unwrap();

        for entry in data {
            result.insert(
                entry["query"].as_str().unwrap().to_string(),
                (
                    entry["continentCode"].as_str().unwrap().to_string(),
                    entry["countryCode"].as_str().unwrap().to_string(),
                ),
            );
        }

        result
    }

    pub async fn process(&self) {
        let mut processing = self.processing.lock().await;
        let length = processing.len();

        let mut telemetry = processing
            .splice(0..std::cmp::min(30, length), Vec::new())
            .collect::<Vec<_>>();

        if telemetry.is_empty() {
            return;
        }

        let ips = self
            .lookup_ips(
                telemetry
                    .iter()
                    .map(|t| t.ip.clone())
                    .collect::<Vec<_>>()
                    .as_slice(),
            )
            .await;

        for t in telemetry.iter_mut() {
            if let Some((continent, country)) = ips.get(&t.ip) {
                t.continent = Some(continent.clone());
                t.country = Some(country.clone());
            }

            t.ip = format!("{:x}", sha2::Sha256::digest(t.ip.as_bytes()));
        }

        let panels = telemetry
            .iter()
            .map(|t| t.panel_id)
            .collect::<std::collections::HashSet<_>>();

        for id in panels {
            sqlx::query!(
                "
                INSERT INTO telemetry_panels (id)
                VALUES ($1)
                ON CONFLICT (id) DO UPDATE SET last_update = GREATEST(
                    telemetry_panels.last_update,
                    (SELECT created FROM telemetry_data WHERE panel_id = $1 ORDER BY created DESC LIMIT 1)
                )
                ",
                id
            )
            .execute(self.database.write())
            .await
            .unwrap();
        }

        for t in telemetry.iter() {
            sqlx::query!(
                "
                INSERT INTO telemetry_data (panel_id, telemetry_version, ip, continent, country, data, created)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT DO NOTHING
                ",
                t.panel_id,
                t.telemetry_version,
                t.ip,
                t.continent,
                t.country,
                serde_json::to_value(&t.data).unwrap(),
                t.created.naive_utc()
            )
            .execute(self.database.write())
            .await
            .unwrap();
        }
    }
}
