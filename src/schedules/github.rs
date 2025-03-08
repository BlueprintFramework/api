use crate::routes::State;
use colored::Colorize;

pub async fn run(state: State) {
    loop {
        let start = std::time::Instant::now();

        let releases = state
            .client()
            .get("https://api.github.com/repos/BlueprintFramework/framework/releases")
            .send()
            .await
            .unwrap()
            .json::<serde_json::Value>()
            .await
            .unwrap();

        let releases = releases
            .as_array()
            .unwrap()
            .iter()
            .map(|release| release["tag_name"].as_str().unwrap().to_string())
            .collect::<Vec<String>>();

        *state.github_releases.write().await = releases;

        crate::logger::log(
            crate::logger::LoggerLevel::Info,
            format!(
                "{} releases refreshed {}",
                "github".black(),
                format!(
                    "({} releases, {}ms)",
                    state.github_releases.read().await.len(),
                    start.elapsed().as_millis()
                )
                .bright_black()
            ),
        );

        tokio::time::sleep(tokio::time::Duration::from_secs(60 * 60)).await;
    }
}
