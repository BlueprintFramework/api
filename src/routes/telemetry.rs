use super::{ApiError, GetState, State};
use crate::telemetry::TelemetryData;
use axum::{
    http::{HeaderMap, StatusCode},
    routing::post,
};
use serde_json::json;
use utoipa_axum::router::OpenApiRouter;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .route(
            "/",
            post(
                |state: GetState, headers: HeaderMap, axum::Json::<TelemetryData>(data)| async move {
                    let ip = headers.get("x-real-ip")
                    .or_else(|| headers.get("x-forwarded-for"))
                    .map(|ip| ip.to_str().unwrap_or_default())
                    .unwrap_or_default();

                    let telemetry = state.telemetry.log(ip, data).await;
                    if telemetry.is_none() {
                        return (
                            StatusCode::TOO_MANY_REQUESTS,
                            axum::Json(ApiError::new(&["too many requests"]).to_value()),
                        );
                    }

                    (StatusCode::OK, axum::Json(json!({})))
                },
            ),
        )
        .with_state(state.clone())
}
