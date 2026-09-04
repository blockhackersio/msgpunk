{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: {
  packages = [
    pkgs.nodejs_22
    pkgs.pnpm
  ];

  languages.typescript.enable = true;

  enterShell = ''
    node --version
    pnpm --version
  '';
}
