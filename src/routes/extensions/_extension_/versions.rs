use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod index {
    use crate::{models::Extension, routes::ApiError, routes::GetState};
    use axum::{extract::Path, http::StatusCode};
    use indexmap::IndexMap;
    use sqlx::Row;

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = HashMap<String, f64>),
        (status = NOT_FOUND, body = inline(ApiError)),
    ), params(
        ("extension" = String, Path, description = "the extension identifier or id")
    ))]
    pub async fn route(
        state: GetState,
        Path(extension): Path<String>,
    ) -> (StatusCode, axum::Json<serde_json::Value>) {
        let extension = state
            .cache
            .cached(&format!("extensions::{}", extension), 300, || async {
                match extension.parse::<i32>() {
                    Ok(id) => {
                        if id < 1 {
                            None
                        } else {
                            Extension::by_id(&state.database, id).await
                        }
                    }
                    Err(_) => Extension::by_identifier(&state.database, &extension).await,
                }
            })
            .await;

        if extension.is_none() {
            return (
                StatusCode::NOT_FOUND,
                axum::Json(serde_json::to_value(ApiError::new(&["extension not found"])).unwrap()),
            );
        }

        let mut versions: IndexMap<String, f64> = IndexMap::new();

        let data = sqlx::query(
            r#"
            SELECT
                ext->>'version' AS version,
                (COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::float8 AS percentage
            FROM
                (
                    SELECT jsonb_array_elements(data->'blueprint'->'extensions') AS ext
                    FROM telemetry_data
                    WHERE
                        id IN (
                            SELECT telemetry_data.id
                            FROM telemetry_panels_with_latest
                            WHERE latest_telemetry_data_id = (
                                SELECT latest_telemetry_data_id
                                FROM telemetry_panels_with_latest
                                ORDER BY created DESC
                                LIMIT 1
                            )
                        )
                        AND created > NOW() - INTERVAL '2 days'
                ) AS subq
            WHERE ext->>'identifier' = $1
            GROUP BY ext->>'version'
            ORDER BY percentage DESC
            "#,
        )
        .bind(&extension.unwrap().identifier)
        .fetch_all(state.database.read())
        .await
        .unwrap();

        for row in data {
            versions.insert(
                row.get("version"),
                (row.get::<f64, &str>("percentage") * 100.0).round() / 100.0,
            );
        }

        (
            StatusCode::OK,
            axum::Json(serde_json::to_value(&versions).unwrap()),
        )
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(index::route))
        .with_state(state.clone())
}
