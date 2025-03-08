use crate::env::RedisMode;
use colored::Colorize;
use rustis::client::Client;
use rustis::resp::cmd;
use std::sync::Arc;

pub struct Cache {
    pub client: Client,
}

impl Cache {
    pub async fn new(env: Arc<crate::env::Env>) -> Self {
        let start = std::time::Instant::now();

        let instance = Self {
            client: match env.redis_mode {
                RedisMode::Redis => Client::connect(env.redis_url.as_ref().unwrap().clone())
                    .await
                    .unwrap(),
                RedisMode::Sentinel => Client::connect(
                    format!(
                        "redis-sentinel://{}/mymaster/0",
                        env.redis_sentinels.as_ref().unwrap().clone().join(",")
                    )
                    .as_str(),
                )
                .await
                .unwrap(),
            },
        };

        let version = String::from_utf8(
            instance
                .client
                .send(cmd("INFO"), None)
                .await
                .unwrap()
                .as_bytes()
                .into(),
        )
        .unwrap()
        .lines()
        .find(|line| line.starts_with("redis_version:"))
        .unwrap()
        .split(':')
        .collect::<Vec<&str>>()[1]
            .to_string();

        crate::logger::log(
            crate::logger::LoggerLevel::Info,
            format!(
                "{} connected {}",
                "cache".bright_yellow(),
                format!("(redis@{}, {}ms)", version, start.elapsed().as_millis()).bright_black()
            ),
        );

        instance
    }
}
