FROM node:22-alpine AS frontend
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/toolkit/ packages/toolkit/
COPY packages/form-page/ packages/form-page/
RUN pnpm install --frozen-lockfile
RUN pnpm build
COPY crates/msgpunk-server/static/ crates/msgpunk-server/static/

FROM rust:alpine AS build
RUN apk add --no-cache musl-dev pkgconfig openssl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
COPY --from=frontend /app/crates/msgpunk-server/static/ crates/msgpunk-server/static/
RUN cargo build --release --package msgpunk-server

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /app/target/release/msgpunk-server /usr/local/bin/msgpunk-server
EXPOSE 8080
CMD ["msgpunk-server"]
