use crate::{
    models::{Extension, ExtensionPlatform},
    routes::State,
};
use colored::Colorize;
use serde::Deserialize;

#[derive(Deserialize)]
struct SxcProduct {
    price: f64,
    currency: String,
    url: String,
    rating_avg: Option<f64>,
    review_count: Option<u32>,
}

#[derive(Deserialize)]
struct BbbProduct {
    price: f64,
    currency: String,
    review_average: Option<f64>,
    review_count: u32,
}

pub async fn run(state: State) {
    loop {
        let start = std::time::Instant::now();

        let mut count = 0;
        let mut extensions = Extension::all(&state.database).await.unwrap();
        let mut sxc_products: Vec<SxcProduct> = vec![];

        if let Some(sxc_token) = &state.env.sxc_token {
            sxc_products = serde_json::from_value(
                state
                    .client()
                    .get("https://www.sourcexchange.net/api/products/blueprint")
                    .header("Authorization", format!("Bearer {}", sxc_token))
                    .send()
                    .await
                    .unwrap()
                    .json::<serde_json::Value>()
                    .await
                    .unwrap_or_default()
                    .get("products")
                    .cloned()
                    .unwrap_or_default(),
            )
            .unwrap_or_default()
        }

        for extension in extensions.iter_mut() {
            count += 1;

            crate::logger::log(
                crate::logger::LoggerLevel::Info,
                format!(
                    "updating extension prices of {}",
                    extension.name.bright_cyan()
                ),
            );

            if let Some(key) = extension.platforms.get_mut("SOURCEXCHANGE") {
                if let Some(sxc_product) =
                    sxc_products.iter().find(|product| product.url == key.url)
                {
                    *key = ExtensionPlatform {
                        url: key.url.clone(),
                        price: sxc_product.price,
                        currency: sxc_product.currency.clone(),
                        reviews: sxc_product.review_count,
                        rating: sxc_product.rating_avg,
                    };
                }
            }

            if let Some(key) = extension.platforms.get_mut("BUILTBYBIT") {
                let product: Result<Option<BbbProduct>, _> = serde_json::from_value(
                    state
                        .client()
                        .get(format!(
                            "https://api.builtbybit.com/v1/resources/{}",
                            key.url
                                .split('.')
                                .last()
                                .unwrap()
                                .trim_end_matches(|c: char| !c.is_ascii_digit())
                        ))
                        .send()
                        .await
                        .unwrap()
                        .json::<serde_json::Value>()
                        .await
                        .unwrap_or_default()
                        .get("data")
                        .cloned()
                        .unwrap_or_default(),
                );

                if let Ok(Some(product)) = product {
                    *key = ExtensionPlatform {
                        url: key.url.clone(),
                        price: product.price,
                        currency: product.currency.clone(),
                        reviews: Some(product.review_count),
                        rating: product.review_average,
                    };
                }
            }

            if let Some(key) = extension.platforms.get_mut("GITHUB") {
                *key = ExtensionPlatform {
                    url: key.url.clone(),
                    price: 0.0,
                    currency: "USD".to_string(),
                    reviews: Some(0),
                    rating: None,
                };
            }

            sqlx::query!(
                "UPDATE extensions SET platforms = $1 WHERE id = $2",
                serde_json::to_value(&extension.platforms).unwrap(),
                extension.id
            )
            .execute(state.database.write())
            .await
            .unwrap();
        }

        crate::logger::log(
            crate::logger::LoggerLevel::Info,
            format!(
                "product prices refreshed {}",
                format!("({} prices, {}ms)", count, start.elapsed().as_millis()).bright_black()
            ),
        );

        tokio::time::sleep(tokio::time::Duration::from_secs(60 * 60 * 2)).await;
    }
}
