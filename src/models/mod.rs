use serde::{Serialize, de::DeserializeOwned};
use sqlx::postgres::PgRow;
use std::collections::BTreeMap;

pub mod author;
pub mod extension;

pub trait BaseModel: Serialize + DeserializeOwned {
    fn columns(prefix: Option<&str>, table: Option<&str>) -> BTreeMap<String, String>;
    fn columns_sql(prefix: Option<&str>, table: Option<&str>) -> String {
        Self::columns(prefix, table)
            .iter()
            .map(|(key, value)| format!("{} as {}", key, value))
            .collect::<Vec<String>>()
            .join(", ")
    }

    fn map(prefix: Option<&str>, row: &PgRow) -> Self;
}
