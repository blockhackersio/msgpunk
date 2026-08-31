#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLOW="$ROOT/.test-output/flow"
rm -rf "$FLOW"
mkdir -p "$FLOW/"{01-keys,02-form-setup,03-form-read,04-submission,05-submission-read,06-auth-rust,06-auth-ts}

echo "=== derive-keys-from-seed ==="
cargo run -p msgpunk-crypto --example derive-keys-from-seed -- "$FLOW/01-keys"

echo "=== encrypt-form-structure-with-aes-gcm-and-age-encrypt-password ==="
node packages/test-vectors/scripts/encrypt-form-structure-with-aes-gcm.js "$FLOW/01-keys" "$FLOW/02-form-setup"

echo "=== decrypt-form-structure-with-age-then-aes-gcm ==="
cargo run -p msgpunk-crypto --example decrypt-form-structure -- "$FLOW/01-keys" "$FLOW/02-form-setup" "$FLOW/03-form-read"
grep -qx 'PASS' "$FLOW/03-form-read/result"

echo "=== encrypt-submission-payload-with-age ==="
node packages/test-vectors/scripts/encrypt-submission-payload-with-age.js "$FLOW/01-keys" "$FLOW/04-submission"

echo "=== decrypt-submission-payload-with-age ==="
cargo run -p msgpunk-crypto --example decrypt-submission-payload -- "$FLOW/01-keys" "$FLOW/04-submission" "$FLOW/05-submission-read"
grep -qx 'PASS' "$FLOW/05-submission-read/result"

echo "=== sign-auth-challenge-with-ed25519 ==="
cargo run -p msgpunk-crypto --example sign-auth-challenge-ed25519 -- "$FLOW/01-keys" "$FLOW/06-auth-rust"
grep -qx 'PASS' "$FLOW/06-auth-rust/result"

echo "=== verify-auth-signature-ed25519 ==="
node packages/test-vectors/scripts/verify-auth-signature-ed25519.js "$FLOW/06-auth-rust" "$FLOW/06-auth-ts"
grep -qx 'PASS' "$FLOW/06-auth-ts/result"

echo "=== done ==="
