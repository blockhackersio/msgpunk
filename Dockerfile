FROM rust:alpine AS build
RUN apk add --no-cache musl-dev pkgconfig openssl-dev
WORKDIR /app
COPY . .
RUN cargo build --release --package msgpunk-server

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /app/target/release/msgpunk-server /usr/local/bin/msgpunk-server
EXPOSE 8080
CMD ["msgpunk-server"]
