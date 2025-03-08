use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod index {
    use crate::routes::GetState;
    use serde::Serialize;
    use utoipa::ToSchema;

    #[derive(Serialize, ToSchema)]
    struct Response {
        name: String,
        history: Vec<String>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response))
    ))]
    pub async fn route(state: GetState) -> axum::Json<serde_json::Value> {
        axum::Json(
            serde_json::to_value(Response {
                name: state.github_releases.read().await.first().unwrap().clone(),
                history: state.github_releases.read().await[1..].to_vec(),
            })
            .unwrap(),
        )
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(index::route))
        .with_state(state.clone())
}
