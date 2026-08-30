FROM rust:alpine AS build
RUN apk add --no-cache musl-dev pkgconfig openssl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
COPY src/ src/
RUN cargo build --release

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /app/target/release/msgpunk-server /usr/local/bin/msgpunk-server
EXPOSE 8080
CMD ["msgpunk-server"]
