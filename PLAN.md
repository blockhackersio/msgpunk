# Msgpunk Development Plan

## Step 1: DONE! Connect client and Server
- Add a healthcheck route to the server
- create a script that runs the server locally and sends it through cfup.sh to get a url and sets this url on the client while running the client through devenv shell with the env var passed in that is the cloudflare url for the server
- Get the client to make a request from the server through it's env var. This can be a button that requests the tauri function which makes an http request to the server healthcheck based on the injected env var.

## Step 2: DONE! Android Interface
- Fixed form structure (NO form builder).
    - Form is a basic contact us form and includes:
      1. Signal Account
      2. What should I call you?
      3. Your Message
- Screens
    - Onboarding Seed generation (Do not test just generate and allow a way to backup later)
    - Add Form (Automatically add the contact form above) -> Publish (deploy form to server)
    - View Responses (Show response list "Response from 'Dirk Digler'")
        - View Response (Show detailed decrypted response)

---

## Step 3: NOW — Form renderer (end-to-end encrypted form page)

### Goal
A user creates a form in the app, gets a URL with a password hash, visits that URL in a browser, and sees the decrypted form structure JSON displayed in a `<pre>` block. This proves the full encryption/decryption pipeline works.

### Architecture decisions

| Decision | Choice |
|----------|--------|
| Form page delivery | Static React SPA served by actix on the same domain |
| Data delivery | `GET /f/{form_id}/data` JSON endpoint (no auth — data is encrypted) |
| Crypto in browser | `@noble/ciphers` + `@noble/hashes` + `@noble/curves` (isomorphic, zero-dependency) |
| Static file serving | `actix-files` crate serves `crates/msgpunk-server/static/` |
| Form-page framework | Vite + React + TypeScript, no router, no CSS framework |
| Form page rendering | Decrypts structure with password from URL hash, renders JSON in `<pre>` |
| App copy URL | Button on replies screen, copies full URL with password hash |

### End-to-end flow

1. App creates form → `POST /f/{form_id}` stores `FormData` (age_recipient, ed25519_pubkey, encrypted_structure, encrypted_password)
2. App constructs URL: `{server_url}/f/{form_id}#{password}`
3. User visits URL in browser → actix serves the React SPA at `/f/{form_id}`
4. React app reads `form_id` from `window.location.pathname`, `password` from `window.location.hash`
5. React app fetches `GET /f/{form_id}/data` → gets `{ encrypted_structure, age_recipient, encrypted_password }`
6. React app derives AES-GCM key: `SHA-256(password)` → 32 bytes
7. React app decrypts `encrypted_structure` (base64 → nonce(12) + ciphertext+tag → AES-GCM decrypt) → form structure JSON
8. React app renders the JSON in a `<pre>` block

### Server changes (`crates/msgpunk-server/`)

**Dependencies:** Add `actix-files` to `Cargo.toml`.

**New route: `GET /f/{form_id}/data`**
- Looks up form in storage
- Returns `{ encrypted_structure, age_recipient, encrypted_password }` as JSON
- Returns 404 if form not found
- No auth required (all fields are encrypted)
- Register BEFORE the static file handler

**Static file serving**
- Mount `actix_files::Files` at `/f/` serving `crates/msgpunk-server/static/`
- Set `index_file("index.html")` so `/f/{form_id}` serves `index.html`
- The API route `GET /f/{form_id}/data` MUST be registered first so it takes priority over the static file catch-all
- The React app references assets as relative paths (e.g., `/f/assets/index-abc123.js`)

**Route registration order in `configure()`:**
```rust
fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(healthcheck)
       .service(create_form)         // POST /f/{form_id}
       .service(get_form_data)       // GET /f/{form_id}/data  ← NEW, before static files
       .service(submit_message)
       .service(list_messages)
       .service(get_message)
       .service(delete_message)
       .service(actix_files::Files::new("/f", "static").index_file("index.html"));
}
```

### Toolkit changes (`packages/toolkit/`)

**Dependencies:** Replace `node:crypto` usage with:
- `@noble/hashes` — SHA-256 for key derivation
- `@noble/ciphers` — AES-256-GCM encrypt/decrypt
- `@noble/curves` — Ed25519 signature verification
- Remove dependency on `@types/node` `Buffer` and `node:crypto`

**`src/aes-gcm.ts`** — Rewrite to use `@noble/ciphers`:
```typescript
export function generatePassword(): string
export function deriveKey(password: string): Uint8Array    // SHA-256 → 32 bytes
export function encrypt(key: Uint8Array, plaintext: string): Uint8Array
export function decrypt(key: Uint8Array, ciphertext: Uint8Array): string
```
- All functions sync (noble is sync)
- Return `Uint8Array` instead of `Buffer`
- Format: nonce(12) || ciphertext || tag(16)

**`src/ed25519.ts`** — Rewrite to use `@noble/curves`:
```typescript
export function verify(pubkeyHex: string, message: string, signatureHex: string): boolean
export function timestampFresh(tsSecs: number, maxAge?: number): boolean
export function verifyAuthChallenge(pubkeyHex: string, formId: string, timestamp: string, signature: string): boolean
```

**`src/form.ts`** — Update `decryptFormStructure`:
- Remove `Buffer.from()` — use `TextEncoder`/`TextDecoder` and `Uint8Array`
- `decryptFormStructure` is already async, keep it async

**`src/padding.ts`** — No changes needed (pure string manipulation).

**`src/age.ts`** — No changes needed (already uses `age-encryption` which is browser-compatible).

### Form-page app (`packages/form-page/`)

**New Vite + React + TypeScript project.**

**`package.json`:**
```json
{
  "name": "form-page",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "@msgpunk/toolkit": "workspace:*",
    "age-encryption": "^0.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4",
    "typescript": "^7",
    "vite": "^6"
  }
}
```

**`vite.config.ts`:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/f/',
  build: {
    outDir: '../../crates/msgpunk-server/static',
    emptyOutDir: true,
  },
});
```

**`src/main.tsx`** — Mount `<App />`.

**`src/App.tsx`** — Component:
1. Parse `form_id` from `window.location.pathname` (strip `/f/` prefix)
2. Parse `password` from `window.location.hash` (strip `#` prefix)
3. States: `loading`, `error`, `loaded`
4. On mount:
   - Fetch `GET /f/{form_id}/data`
   - Derive AES-GCM key from password: `deriveKey(password)`
   - Decode base64 `encrypted_structure` → `Uint8Array`
   - Decrypt: `decrypt(key, encryptedBytes)` → JSON string
   - Parse JSON, store in state
5. Render: `<pre>{JSON.stringify(formStructure, null, 2)}</pre>`
6. Error state: show error message
7. If no password in hash: show "This form requires a password. Add #your-password to the URL."

### App changes (`client/`)

**New Tauri command: `get_form_url(form_id: String, server_url: String) -> Result<String>`**
1. Fetch `GET {server_url}/f/{form_id}/data`
2. Parse response: `{ encrypted_structure, age_recipient, encrypted_password }`
3. Decrypt `encrypted_password` using age identity (derived from seed)
4. Construct URL: `{server_url}/f/{form_id}#{password}`
5. Return the URL

**Register command** in `lib.rs` invoke handler.

**Replies screen (`RepliesList.tsx`):**
- Add a "Copy URL" button (icon button in the header/toolbar)
- On tap: call `invoke('get_form_url', { formId, serverUrl })` then use `navigator.clipboard.writeText()` or Tauri clipboard plugin to copy
- Show a brief toast/feedback when copied

### Build pipeline

```bash
# 1. Build the toolkit
pnpm --filter @msgpunk/toolkit run build

# 2. Build the form-page (outputs to crates/msgpunk-server/static/)
pnpm --filter form-page run build

# 3. Build the server (includes form-page assets)
cargo build -p msgpunk-server
```

The root `package.json` `build` script should be updated to include the form-page build step.
