#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLOW="$ROOT/.test-output/flow"
rm -rf "$FLOW"
mkdir -p "$FLOW/"{01-seed,02-keys,03-form-id,04-form-setup,05-form-read,06-submission,07-submission-read,08-auth-rust,09-auth-ts}

echo "=== 01 generate-seed-from-phrase ==="
# Runs in: Rust (msgpunk-crypto example binary)
# Maps to: The Tauri app's unlock screen. User enters their BIP-39 seed phrase.
#          The phrase is converted to a 64-byte seed via BIP-39 (the standard
#          wallet seed derivation). This seed is the root of all keys.
cargo run -p msgpunk-crypto --example generate-seed-from-phrase -- "$FLOW/01-seed"

echo "=== 02 derive-keys-from-seed ==="
# Runs in: Rust (msgpunk-crypto example binary)
# Maps to: The Tauri app's unlock screen (continued). The seed is fed through
#          SLIP-10 Ed25519 derivation at path m/44'/9731'/0'/0' to get a 32-byte
#          secret. That single secret produces both the age X25519 identity (for
#          decrypting submissions) and the Ed25519 signing key (for authenticated
#          API calls). The age recipient is the public half shared with respondents.
cp "$FLOW/01-seed/seed.txt" "$FLOW/02-keys/"
cargo run -p msgpunk-crypto --example derive-keys-from-seed -- "$FLOW/02-keys"

echo "=== 03 compute-form-id ==="
# Runs in: Rust (msgpunk-crypto example binary)
# Maps to: The Tauri app's form builder when creating a new form. The form_id is
#          SHA-256(age_recipient || ":" || index) — a deterministic identifier
#          derived from the public key. No server-side listing needed: the app
#          iterates indices until it hits a gap. form_id is separate from the keys
#          because you might want the keys without computing an id.
cp "$FLOW/02-keys/age-recipient.txt" "$FLOW/03-form-id/"
cargo run -p msgpunk-crypto --example compute-form-id -- "$FLOW/03-form-id"
# Seed + pubkey staged here for auth step (same logical stage as form-id)
cp "$FLOW/02-keys/seed.txt" "$FLOW/03-form-id/"
cp "$FLOW/02-keys/ed25519-pubkey.txt" "$FLOW/03-form-id/"

echo "=== 04 encrypt-form-structure ==="
# Runs in: Rust (msgpunk-crypto example binary)
# Maps to: The Tauri app's form builder. User designs a form (title + fields) in
#          the TS webview. The form JSON is sent to the Tauri Rust backend via a
#          Tauri command. Rust generates a random password, derives an AES-256 key
#          via SHA-256, AES-GCM encrypts the form structure, then age-encrypts the
#          password to the owner's public key. The encrypted blob goes to the server.
#          The raw password is returned to TS for the shareable URL fragment.
cargo run -p msgpunk-crypto --example encrypt-form-structure -- "$FLOW/02-keys" "$FLOW/04-form-setup"

echo "=== 05 decrypt-form-structure ==="
# Runs in: TypeScript (pnpm tsx, browser-compatible Web Crypto API)
# Maps to: The form respondent's browser. They visit /f/{form_id}#{password}. TS
#          fetches the encrypted structure + encrypted password from the server.
#          It age-decrypts the password (no private key needed — wait, actually the
#          respondent doesn't have the age key; the password comes from the URL
#          hash fragment directly). The TS decrypts AES-GCM with the password to
#          recover the form structure JSON, then renders it with QuillForms.
pnpm tsx packages/test-vectors/scripts/decrypt-form-structure-with-age-then-aes-gcm.ts \
  "$FLOW/02-keys" "$FLOW/04-form-setup" "$FLOW/05-form-read"
grep -qx 'PASS' "$FLOW/05-form-read/result"

echo "=== 06 encrypt-submission-payload ==="
# Runs in: TypeScript (pnpm tsx, browser-compatible crypto)
# Maps to: The form respondent's browser after they fill out and submit the form.
#          TS builds the payload {v, fields, submitted_at}, pads it to a 4096-byte
#          block boundary (to hide which fields have how much content), then
#          age-encrypts it to the form owner's public key. The armored ciphertext
#          is POSTed to the actix-web server. The server never sees plaintext.
pnpm tsx packages/test-vectors/scripts/encrypt-submission-payload-with-age.ts \
  "$FLOW/02-keys" "$FLOW/06-submission"

echo "=== 07 decrypt-submission-payload ==="
# Runs in: Rust (msgpunk-crypto example binary)
# Maps to: The Tauri app's inbox when the form owner opens a submission. Rust
#          downloads the armored ciphertext from the server, age-decrypts it using
#          the owner's identity (derived from seed), unpads the JSON, and displays
#          the field values. The verification step confirms the decrypted fields
#          match the original submission.
cargo run -p msgpunk-crypto --example decrypt-submission-payload -- \
  "$FLOW/02-keys" "$FLOW/06-submission" "$FLOW/07-submission-read"
grep -qx 'PASS' "$FLOW/07-submission-read/result"

echo "=== 08 sign-auth-challenge ==="
# Runs in: Rust (msgpunk-crypto example binary)
# Maps to: The Tauri app when it needs to read messages from the server. Rust
#          signs a challenge (form_id + current timestamp) with the owner's Ed25519
#          key. The server verifies the signature against the stored public key and
#          checks the timestamp is within 30 seconds (replay protection). This is
#          stateless auth — no passwords, no sessions, just a signed timestamp.
cargo run -p msgpunk-crypto --example sign-auth-challenge-ed25519 -- \
  "$FLOW/03-form-id" "$FLOW/08-auth-rust"

echo "=== 09 verify-auth-signature ==="
# Runs in: TypeScript (pnpm tsx, but on the server this would be Rust)
# Maps to: The actix-web server verifying an incoming authenticated request. TS
#          simulates what the server does: parse the timestamp and signature, verify
#          the Ed25519 sig against the stored public key, and check timestamp
#          freshness. The TS version cross-validates the Rust-signed test vectors,
#          confirming both implementations produce compatible signatures.
pnpm tsx packages/test-vectors/scripts/verify-auth-signature-ed25519.ts \
  "$FLOW/08-auth-rust" "$FLOW/09-auth-ts"
grep -qx 'PASS' "$FLOW/09-auth-ts/result"

echo "=== done ==="
