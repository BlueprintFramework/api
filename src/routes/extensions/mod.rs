mod _extension_;

use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod index {
    use crate::{models::Extension, routes::GetState};

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = Vec<Extension>)
    ))]
    pub async fn route(state: GetState) -> axum::Json<serde_json::Value> {
        axum::Json(serde_json::to_value(Extension::all(&state.database).await.unwrap()).unwrap())
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/{extension}", _extension_::router(state))
        .routes(routes!(index::route))
        .with_state(state.clone())
}
