# MSGPUNK — Specification v0.2

## 1. Purpose

Msgpunk is an end-to-end encrypted form service. It enables private data collection without either the form creator or the form respondent trusting a third-party hosting provider.

## 2. The Pitch

### The Problem

Static websites need a way to accept form submissions, but every existing solution forces you to trust a third party with your leads. Free contact-form providers can monetize by harvesting respondent data and selling it to data brokers. For businesses, this means losing control of their leads. For respondents, it means their contact details end up with unknown third parties. Even email, the fallback, offers no guarantees: once sent, you have no visibility into how your address is stored, shared, or resold.

### The Solution

Msgpunk is an end-to-end encrypted form service for static sites. Form data is encrypted in the browser before it ever reaches a server. Only the form owner, holding the private key on their device — can decrypt responses. No middleman, no data harvesting, no email required. Submissions arrive directly via push notification to the owner's messenger of choice.

### Why Msgpunk

- **Zero-trust architecture**: the API server never sees plaintext data.
- **Works with any static site** via a shareable form URL.
- **Eliminates email** from the contact-form loop entirely.
- **Open-source** with a self-sovereign key model.

## 3. Use Cases

### 3.1 Contact Form (Primary)

A business wants a contact form on their static website. Neither the business nor the lead wants their details shared with third-party form providers. With Msgpunk, the business shares a form URL. The lead's submission is encrypted in the browser so the hosting provider never sees plaintext.

### 3.2 Conference Registration

A privacy conference promoting digital rights should not rely on Google Forms for attendee registration but I have seen this many many times. Attendees should not have their details shared with third parties. Msgpunk provides an embeddable form that respects privacy.

### 3.3 Job Applications

Employers can publish their form URL and public key on their website. Applicants can verify they're submitting to the real employer by checking the key fingerprint. This proves the person interviewing you is actually a representative of the organisation.

### 3.4 Whistleblower Submission

Anonymous information destined for a single recipient. If the server is hosted as a Tor onion service, IP metadata is anonymised by the Tor network, the server never sees the respondent's real IP. This makes the whistleblower use case viable when self-hosted over Tor.

## 4. Core Principles

- **Zero-trust hosting**: The API server never has access to plaintext form responses.
- **Client-side encryption**: All form data is encrypted in the browser before transmission.
- **Self-sovereign keys**: Form creators generate and hold their own key pairs; the server never sees private keys.
- **Seed-based identity**: A single BIP-39 seed phrase controls all forms. No accounts, no passwords.

## 5. Repositories

### msgpunk-server

Actix-web server that serves form pages and the storage API.

```
msgpunk-server/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── routes/
│   │   ├── mod.rs
│   │   ├── form.rs          # GET /f/{form_id}
│   │   └── api.rs           # POST/GET/DELETE /s/{form_id}
│   ├── storage/
│   │   ├── mod.rs           # Storage trait
│   │   └── fs.rs            # FilesystemStorage impl
│   └── auth.rs              # Ed25519 signature verification
├── static/                  # Built React form page assets
│   └── index.html
├── form-page/               # React app (QuillForms renderer)
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── FormPage.tsx
│       └── encrypt.ts       # age encryption via age-encryption
└── templates/               # Tera 2 templates
    └── form.html
```

### msgpunk-app

Tauri v2 Android application with React frontend and core Rust library.

```
msgpunk-app/
├── Cargo.toml               # workspace: [core, src-tauri]
├── core/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── identity.rs       # Identity (BIP-39 → SLIP-10 → age)
│       ├── decrypt.rs
│       ├── relay.rs          # Relay trait + HttpRelay impl
│       └── cli.rs            # pitch-cli binary
├── src-tauri/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── commands.rs       # Tauri commands
│       └── state.rs          # Managed state (Mutex<Option<Identity>>)
├── src/                      # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── screens/
│   │   ├── Unlock.tsx
│   │   ├── Inbox.tsx
│   │   ├── FormDetail.tsx
│   │   ├── MessageDetail.tsx
│   │   └── FormBuilder.tsx   # QuillForms builder
│   └── components/
└── package.json
```

## 6. Key Derivation

### BIP-39 → SLIP-10 → age X25519

1. User has a BIP-39 seed phrase (12 or 24 words).
2. `bip39::Mnemonic::to_seed("")` → 64-byte seed.
3. SLIP-10 Ed25519 derivation at path `m/44'/9731'/{form_index}'/0'` → 32-byte secret key.
4. The same 32-byte secret is used for both:
   - `age::x25519::Identity::from(secret)` — for encryption (age recipient)
   - `ed25519_dalek::SigningKey::from_bytes(&secret)` — for authentication (Ed25519 public key)

### form_id

```
form_id = SHA-256(age_recipient_string || ":" || index)
```

The form_id is deterministic from the key and index. No server-side listing needed — the app iterates indices until it hits a gap.

## 7. API

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/f/{form_id}` | None | Serve form page (React + QuillForms renderer) |
| `POST` | `/s/{form_id}` | None* | Create form (register keys + encrypted structure) |
| `POST` | `/s/{form_id}` | None* | Submit encrypted message |
| `GET` | `/s/{form_id}` | Ed25519 sig | List message metadata |
| `GET` | `/s/{form_id}/{msg_id}` | Ed25519 sig | Download armored ciphertext |
| `DELETE` | `/s/{form_id}/{msg_id}` | Ed25519 sig | Delete a message |

Form page POSTs are protected by Origin header check + IP rate limiting (10/hour).

### Form creation (POST /s/{form_id})

```json
{
  "age_recipient": "age1...",
  "ed25519_pubkey": "hex-encoded 32 bytes",
  "encrypted_structure": "base64...",
  "encrypted_password": "age1... (armored)"
}
```

Server verifies the Ed25519 public key converts to the age recipient via Montgomery conversion (`edwards_point.to_montgomery()`). Returns 201.

### Submission (POST /s/{form_id})

Body: raw armored age ciphertext (`text/plain`).

Headers: `Origin` must match server origin. Rate limited to 10/hour per IP. Body limited to 64 KB (413 on exceed).

Returns `202 {"msg_id": "<ulid>"}`.

### Authenticated reads (GET /s/{form_id})

Query params: `since={cursor}&ts={unix_timestamp}&sig={hex_signature}`

The signature is Ed25519(`form_id || ":" || timestamp`). Server verifies against the stored Ed25519 public key and rejects timestamps older than 30 seconds.

Returns:
```json
{
  "messages": [
    {"msg_id": "<ulid>", "size": 1234, "received_at": "2026-08-29T12:00:00Z"}
  ],
  "cursor": "..."
}
```

### Get message (GET /s/{form_id}/{msg_id})

Same auth as listing. Returns raw armored ciphertext (`text/plain`).

### Delete message (DELETE /s/{form_id}/{msg_id})

Same auth. Returns 204.

## 8. Form Page

The form page at `/f/{form_id}` is a React app (built with Vite, served as static assets by Actix).

### URL format

```
https://msgpunk.com/f/{form_id}#{password}
```

The password lives in the URL hash fragment — never sent to the server.

### Page flow

1. Client reads `window.location.hash` for the password.
2. Fetches the encrypted form structure from the server.
3. Decrypts it with the password using Web Crypto API (AES-GCM).
4. Renders the form using QuillForms renderer.
5. On submit, builds the submission payload, pads it, encrypts with age to the form's public key, and POSTs the armored ciphertext to `/s/{form_id}`.
6. Shows a generic success confirmation.

### Form structure (encrypted)

```json
{
  "blocks": [
    {"id": "name", "name": "short-text", "attributes": {"label": "Your Name", "required": true}},
    {"id": "msg", "name": "long-text", "attributes": {"label": "Message", "required": true}}
  ],
  "settings": {
    "disableProgressBar": false,
    "disableWheelSwiping": false,
    "disableNavigationArrows": false,
    "animationDirection": "vertical"
  }
}
```

Encrypted with AES-GCM using the password as the raw key.

### Submission payload (encrypted to age recipient)

```json
{
  "v": 1,
  "fields": {"name": "John", "msg": "Hello"},
  "submitted_at": "2026-08-29T12:00:00Z",
  "pad": "    "
}
```

**Padding:** Serialize the object without `pad`, compute byte length, set `pad` to enough spaces so the final JSON length rounds up to the next multiple of 4096. Then encrypt with age.

### Password recovery

The password is encrypted to the age public key during form creation and stored on the server as `encrypted_password`. The form owner can download and decrypt it in the app to reconstruct the URL.

## 9. App (Tauri v2 Android)

### Screens

1. **Unlock** — Enter seed phrase. First-run flow: generate seed, display, verify backup.
2. **Inbox** — List of forms with unread counts. Polls every 4000ms.
3. **Form detail** — Submissions for a specific form (msg_id, received_at, read/unread).
4. **Message detail** — Decrypted field values. Signal button if signal_username was submitted.
5. **Form builder** — QuillForms builder to create/edit form structures. Publishes to server.

### Tauri commands

```rust
unlock(phrase: String) -> Result<Fingerprint>     // Derives keys, holds Identity in state
lock() -> ()
create_form(structure: String) -> Result<FormUrl>  // Encrypts structure, registers with server
sync() -> Result<u32>                              // Returns new message count
list_messages(form_id: String) -> Result<Vec<MessageMeta>>
read_message(form_id: String, msg_id: String) -> Result<Payload>
delete_message(form_id: String, msg_id: String) -> Result<()>
open_signal(username: String) -> Result<()>
```

Identity held in `Mutex<Option<Identity>>` in Tauri managed state. Dropped on `lock()` and window close.

### Identity storage

The identity is ephemeral — derived from the seed phrase on each unlock. No persistent key file. The seed phrase IS the backup.

## 10. Encryption

- **Format:** age (X25519 + ChaCha20-Poly1305), ASCII-armored.
- **Browser:** `age-encryption` npm package.
- **Rust:** `age` crate.
- **Submission body:** Raw armored ciphertext, `Content-Type: text/plain`. No wrapping envelope, no base64 layer.

## 11. Storage

```rust
#[async_trait]
trait Storage: Send + Sync {
    async fn store_form(&self, form_id: &str, data: &FormData) -> Result<()>;
    async fn get_form(&self, form_id: &str) -> Result<Option<FormData>>;
    async fn store_blob(&self, form_id: &str, msg_id: &str, ciphertext: &str, received_at: &str) -> Result<()>;
    async fn list_blobs(&self, form_id: &str, since: Option<&str>) -> Result<(Vec<BlobMeta>, String)>;
    async fn get_blob(&self, form_id: &str, msg_id: &str) -> Result<String>;
    async fn delete_blob(&self, form_id: &str, msg_id: &str) -> Result<()>;
}
```

### FilesystemStorage (MVP)

```
data/{form_id}/
├── form.json          # FormData (keys, encrypted_structure, encrypted_password)
└── msgs/
    └── {msg_id}.age   # Armored ciphertext (file mtime = received_at)
```

### Future backends

`RedisStorage`, `SledStorage` — same trait, swap at startup via config.

## 12. Authentication

### Form page submissions

- Origin header must match server origin.
- IP rate limited: 10 submissions per hour.

### App API reads

Stateless Ed25519 challenge-response. Each request includes:

- `ts`: Unix timestamp (seconds)
- `sig`: Ed25519 signature of `form_id || ":" || ts`

Server verifies:
1. Signature against stored Ed25519 public key for the form.
2. Timestamp is within 30 seconds of server time (replay protection).

No session tokens, no server-side state.

## 13. Non-Goals (MVP)

- Desktop builds (Tauri Android only; platform-specific code behind traits for future desktop support).
- Push notifications (app polls when open).
- Hardware-backed key storage (Keychain / Keystore / Secure Enclave).
- Reply-from-app (replies happen in Signal, outside the system).
- Attachments, rich text, threading, multiple inboxes, accounts, admin UI.
- Analytics of any kind.
- Submission receipts (generic confirmation only).

