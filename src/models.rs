use chrono::DateTime;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow, types::chrono::NaiveDateTime};
use std::collections::BTreeMap;
use utoipa::ToSchema;

#[derive(ToSchema, Serialize)]
pub enum ExtensionType {
    #[schema(rename = "THEME")]
    #[serde(rename = "THEME")]
    Theme,

    #[schema(rename = "EXTENSION")]
    #[serde(rename = "EXTENSION")]
    Extension,
}

#[derive(ToSchema, Serialize, Clone)]
pub struct Author {
    pub id: i32,

    pub name: String,
    pub website: Option<String>,
    pub support: Option<String>,

    pub created: DateTime<chrono::Utc>,
}

impl Author {
    #[inline]
    fn columns() -> &'static str {
        r#"
        authors.id,
        authors.name,
        authors.website,
        authors.support,
        authors.created
        "#
    }

    #[inline]
    fn map(row: PgRow) -> Self {
        Self {
            id: row.get("id"),

            name: row.get("name"),
            website: row.get("website"),
            support: row.get("support"),

            created: row
                .get::<NaiveDateTime, _>("created")
                .and_local_timezone(chrono::Utc)
                .unwrap(),
        }
    }

    pub async fn by_key(database: &crate::database::Database, key: &str) -> Option<Self> {
        let row = sqlx::query(&format!(
            "SELECT {} FROM authors WHERE authors.key = $1",
            Self::columns()
        ))
        .bind(key)
        .fetch_optional(database.read())
        .await
        .unwrap_or(None);

        row.map(Self::map)
    }
}

#[derive(ToSchema, Serialize, Deserialize)]
pub struct ExtensionPlatform {
    pub url: String,
    pub price: f64,
    pub currency: String,

    pub reviews: Option<u32>,
    pub rating: Option<f64>,
}

#[derive(ToSchema, Serialize)]
pub struct ExtensionStats {
    pub panels: i64,
}

#[derive(ToSchema, Serialize)]
pub struct Extension {
    pub id: i32,
    pub author: Author,

    pub r#type: ExtensionType,
    pub hidden: bool,
    pub pending: bool,

    pub name: String,
    pub identifier: String,
    pub summary: String,

    #[schema(inline)]
    pub platforms: BTreeMap<String, ExtensionPlatform>,
    pub keywords: Vec<String>,
    pub banner: String,

    pub created: DateTime<chrono::Utc>,

    #[schema(inline)]
    pub stats: ExtensionStats,
}

impl Extension {
    #[inline]
    fn columns() -> &'static str {
        r#"
        extensions.id,
        extensions.author_id,

        extensions.type::text,
        extensions.hidden,
        extensions.pending,

        extensions.name,
        extensions.identifier,
        extensions.summary,

        extensions.platforms,
        extensions.keywords,
        extensions.banner,

        extensions.created,
        (SELECT COUNT(*)
            FROM (
                SELECT jsonb_array_elements(data->'blueprint'->'extensions') as ext 
                FROM telemetry_data 
                WHERE id IN (
                    SELECT latest_telemetry_data_id 
                    FROM telemetry_panels_with_latest
                )
                AND created > NOW() - INTERVAL '2 days'
            ) subq
            WHERE subq.ext->>'identifier' = extensions.identifier
        ) as stats_panels,

        authors.name author_name,
        authors.website author_website,
        authors.support author_support,

        authors.created author_created
        "#
    }

    #[inline]
    fn map(row: PgRow) -> Self {
        Self {
            id: row.get("id"),
            author: Author {
                id: row.get("author_id"),

                name: row.get("author_name"),
                website: row.get("author_website"),
                support: row.get("author_support"),

                created: row
                    .get::<NaiveDateTime, _>("author_created")
                    .and_local_timezone(chrono::Utc)
                    .unwrap(),
            },

            r#type: match row.get::<String, _>("type").as_str() {
                "THEME" => ExtensionType::Theme,
                "EXTENSION" => ExtensionType::Extension,
                _ => unreachable!(),
            },
            hidden: row.get("hidden"),
            pending: row.get("pending"),

            name: row.get("name"),
            identifier: row.get("identifier"),
            summary: row.get("summary"),

            platforms: row
                .get::<serde_json::Value, _>("platforms")
                .as_object()
                .unwrap()
                .iter()
                .map(|(k, v)| (k.clone(), serde_json::from_value(v.clone()).unwrap()))
                .collect(),
            keywords: row.get("keywords"),
            banner: row.get("banner"),

            created: row
                .get::<NaiveDateTime, _>("created")
                .and_local_timezone(chrono::Utc)
                .unwrap(),
            stats: ExtensionStats {
                panels: row.get("stats_panels"),
            },
        }
    }

    pub async fn all(database: &crate::database::Database) -> Result<Vec<Self>, sqlx::Error> {
        let rows = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM extensions
            JOIN authors ON extensions.author_id = authors.id
            WHERE
                NOT extensions.hidden
                AND NOT extensions.pending
            "#,
            Self::columns()
        ))
        .fetch_all(database.read())
        .await?;

        Ok(rows.into_iter().map(Self::map).collect())
    }

    pub async fn by_id(database: &crate::database::Database, id: i32) -> Option<Self> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM extensions
            JOIN authors ON extensions.author_id = authors.id
            WHERE
                extensions.id = $1
                AND NOT extensions.hidden
                AND NOT extensions.pending
            "#,
            Self::columns()
        ))
        .bind(id)
        .fetch_optional(database.read())
        .await
        .unwrap_or(None);

        row.map(Self::map)
    }

    pub async fn by_identifier(
        database: &crate::database::Database,
        identifier: &str,
    ) -> Option<Self> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM extensions
            JOIN authors ON extensions.author_id = authors.id
            WHERE
                extensions.identifier = $1
                AND NOT extensions.hidden
                AND NOT extensions.pending
            "#,
            Self::columns()
        ))
        .bind(identifier)
        .fetch_optional(database.read())
        .await
        .unwrap_or(None);

        row.map(Self::map)
    }
}
