# builder
FROM rust:alpine AS builder

WORKDIR /build

RUN apk update
RUN apk add --no-cache musl-dev pkgconfig libressl-dev git

# cache dependencies
COPY ./Cargo.toml ./Cargo.toml
COPY ./Cargo.lock ./Cargo.lock

RUN mkdir src
RUN echo "fn main() {println!(\"hello world\")}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/api*

COPY ./.git ./.git
COPY ./.sqlx ./.sqlx
COPY ./src ./src
COPY ./static ./static
COPY ./migrations ./migrations
COPY ./build.rs ./build.rs

RUN cargo build --release
RUN strip target/release/api

# runner
FROM alpine:latest AS runner
LABEL author="Robert Jansen" maintainer="me@rjns.dev"

COPY --from=builder /build/target/release/api /app/server/bin

USER root

COPY ./entrypoint.sh /entrypoint.sh

WORKDIR /app

CMD [ "/bin/ash", "/entrypoint.sh" ]