use ed25519_dalek::{Signer, Verifier};

pub struct AuthChallenge {
    pub signature: String,
    pub timestamp: u64,
    pub message: String,
}

/// Derives the Ed25519 key from a hex-encoded seed, signs a challenge
/// (form_id || ":" || timestamp), self-verifies, and returns the result.
pub fn sign_challenge(seed_hex: &str, form_id: &str, pubkey_hex: &str) -> AuthChallenge {
    let mut seed = [0u8; 64];
    hex::decode_to_slice(seed_hex, &mut seed).expect("valid hex seed");

    let secret = crate::identity::derive_slip10_ed25519(&seed, 0);
    let signing_key = ed25519_dalek::SigningKey::from_bytes(&secret);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("valid time")
        .as_secs();
    let message = format!("{}:{}", form_id, now);
    let signature = sign(&signing_key, message.as_bytes());

    let verifying_key_bytes = hex::decode(pubkey_hex).expect("valid hex pubkey");
    let verifying_key =
        ed25519_dalek::VerifyingKey::from_bytes(&verifying_key_bytes.try_into().unwrap())
            .expect("valid ed25519 pubkey");

    assert!(verify(&verifying_key, message.as_bytes(), &signature));
    assert!(timestamp_fresh(now));

    AuthChallenge {
        signature,
        timestamp: now,
        message,
    }
}

pub fn sign(signing_key: &ed25519_dalek::SigningKey, message: &[u8]) -> String {
    let signature = signing_key.sign(message);
    hex::encode(signature.to_bytes())
}

pub fn verify(
    verifying_key: &ed25519_dalek::VerifyingKey,
    message: &[u8],
    signature_hex: &str,
) -> bool {
    let sig_bytes = hex::decode(signature_hex).expect("valid hex");
    let signature = ed25519_dalek::Signature::from_slice(&sig_bytes).expect("valid signature");
    verifying_key.verify(message, &signature).is_ok()
}

pub fn timestamp_fresh(ts_secs: u64) -> bool {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("valid time")
        .as_secs();

    let diff = if ts_secs > now {
        ts_secs - now
    } else {
        now - ts_secs
    };

    diff <= 30
}
