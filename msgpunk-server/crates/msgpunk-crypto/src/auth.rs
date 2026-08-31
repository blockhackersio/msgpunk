use ed25519_dalek::{Signer, Verifier};

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
