# Msgpunk

**The only contact form for static sites that makes data brokers weep.**

---

## The Problem

Static sites don't have a built-in way to accept form submissions. Existing solutions all require tradeoffs:

- **Google Forms, Typeform, JotForm** - third-party platforms that store and process your respondents' data on their own terms.
- **Netlify Forms, Formspree, Formcarry** - the hosting provider receives and stores every submission in plaintext.
- **Rolling your own backend** - you manage servers, databases, secrets, and hope nothing gets compromised.
- **Email** - respondents' messages land in your inbox alongside everything else, with no structured data and no encryption.

None of these give the form owner control over who can read submission data. The hosting provider, the platform, or anyone who breaches them gets full access.

---

## The Solution

**Msgpunk is end-to-end encryption for web forms.** Zero-trust. Zero-knowledge. Zero-bullshit.

The server never sees plaintext. Not the form structure. Not the password. Not the submission. Not a single byte of user data.

We built a cryptographic wall between your data and the infrastructure that carries it.

---

## How It Works

**1. You create a form** on your phone (Tauri Android app). Enter your BIP-39 seed phrase - the *only* key you'll ever need. Design your form. Hit publish.

The form structure is AES-256-GCM encrypted before it leaves your device. The password lives in the URL hash fragment - the part the browser never sends over the wire.

**2. You share the link.** Your respondent opens it. Their browser fetches the encrypted blob, decrypts it client-side, and renders the form. No server ever touches the plaintext.

**3. They submit.** Their answers are age-encrypted to your public key right there in the browser, padded to 4096 bytes so even the *length* of their response is hidden.

**4. You decrypt.** Pull up the app. Your seed phrase derives your private key on-device. Tap to decrypt. Read your submissions. All offline. All private.

---

## Why This Wins

| Problem | Old Way | Msgpunk |
|---|---|---|
| Data ownership | Theirs | **Encrypted end-to-end** |
| Privacy model | "Trust us" | **Zero trust** |
| Key management | Passwords | **One seed phrase** |
| Auth model | Sessions, cookies | **Stateless Ed25519** |
| Self-hostable | Expensive tiers | **Docker, one command** |
| Respondent data | Harvested | **Encrypted at birth** |

**No accounts.** No databases. No sessions. No data to leak. Your seed phrase is your identity. Lose it? You lose access - but your data stays encrypted forever.

---

## The Stack

- **Rust** (Actix-web) - fast, safe, server
- **Age encryption** - battle-tested, audited, spec-compliant
- **SLIP-10 / Ed25519** - key derivation from BIP-39
- **Web Crypto API** - encryption in the browser, no WASM needed
- **Tauri v2** - native Android app, not a webview wrapper
- **React / Ionic** - clean UI for form creation and submission viewing

---

## Use It

```bash
git clone https://github.com/blockhackersio/msgpunk
cd msgpunk
docker compose up
```

Or grab the Android app from the releases page.

---

## The Pitch

> Every day, millions of people fill out forms on static sites. Every submission is a data point sold to the highest bidder. Msgpunk makes that impossible.
>
> We don't need a privacy policy. We don't need a "we value your privacy" banner. We need cryptography - and we ship it.
>
> This is the form service for the post-Snowden web. Stateless. Server-blind. Client-side keys.
>
> **Your data. Your keys. Your rules.**
