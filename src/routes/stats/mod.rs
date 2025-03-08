mod flags;
mod panels;

use super::State;
use utoipa_axum::router::OpenApiRouter;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/flags", flags::router(state))
        .nest("/panels", panels::router(state))
        .with_state(state.clone())
}
