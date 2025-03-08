mod author;
mod extensions;
mod latest;
mod stats;
mod telemetry;

use axum::{http::HeaderMap, routing::post};
use reqwest::StatusCode;
use serde::Serialize;
use sqlx::Row;
use std::{sync::Arc, time::Instant};
use tokio::sync::RwLock;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;

#[derive(ToSchema, Serialize)]
pub struct ApiError {
    pub errors: Vec<String>,
}

impl ApiError {
    pub fn new(errors: &[&str]) -> Self {
        Self {
            errors: errors.iter().map(|s| s.to_string()).collect(),
        }
    }

    pub fn to_value(&self) -> serde_json::Value {
        serde_json::to_value(self).unwrap()
    }
}

pub struct AppState {
    pub start_time: Instant,
    pub version: String,

    pub github_releases: RwLock<Vec<String>>,

    pub database: Arc<crate::database::Database>,
    pub telemetry: crate::telemetry::TelemetryLogger,
    pub env: Arc<crate::env::Env>,
}

impl AppState {
    pub fn client(&self) -> reqwest::Client {
        reqwest::Client::builder()
            .user_agent(format!("blueprint api/{}", self.version))
            .build()
            .unwrap()
    }
}

pub type State = Arc<AppState>;
pub type GetState = axum::extract::State<State>;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/telemetry", telemetry::router(state))
        .nest("/latest", latest::router(state))
        .nest("/extensions", extensions::router(state))
        .nest("/stats", stats::router(state))
        .nest("/author", author::router(state))
        .route(
            "/__internal/sql",
            post(
                |state: GetState, headers: HeaderMap, body: String| async move {
                    if headers.get("Authorization")
                        != Some(&state.env.internal_key.parse().unwrap())
                    {
                        return (
                            StatusCode::UNAUTHORIZED,
                            axum::Json(ApiError::new(&["unauthorized"]).to_value()),
                        );
                    }

                    let rows = sqlx::query(
                        format!("SELECT json_agg(t) FROM ({}) t", body.replace(";", "")).as_str(),
                    )
                    .fetch_all(state.database.write())
                    .await
                    .unwrap();

                    let data: serde_json::Value = rows.first().unwrap().get(0);

                    (StatusCode::OK, axum::Json(data))
                },
            ),
        )
        .with_state(state.clone())
}
