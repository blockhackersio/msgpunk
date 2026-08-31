{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: {
  packages = with pkgs; [
    cargo
    rustc
    openssl
    git
    pkg-config
    nodejs_22
    pnpm
    jq
    curl
    lld
    cloudflared # cloudflared tunnel --url http://localhost:8080
  ];

  profiles.dev.module = {pkgs, ...}: {
    packages = with pkgs; [opencode rust-analyzer];
  };

  tasks = {
    "test:unit" = {
      exec = "cargo test";
    };
    "dev:setup" = {
      exec = "./dev.sh setup";
    };
    "dev:up" = {
      exec = "./dev.sh up";
    };
    "dev:down" = {
      exec = "./dev.sh down";
    };
  };
  scripts = {
    c.exec = ''cargo "$@"'';
    cb.exec = ''cargo build "$@"'';
    ct.exec = ''cargo test "$@"'';
    cr.exec = ''cargo run "$@"'';
    cwt.exec = ''cargo watch -x 'test -- --no-capture' '';
    cwb.exec = ''cargo watch -x 'build -- --no-capture' '';
    dt.exec = ''devenv tasks run --show-output test "$@"'';
    dev.exec = ''devenv tasks run --show-output "dev:$@"'';
  };
}
