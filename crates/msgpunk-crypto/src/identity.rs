use bip39::Mnemonic;
use ed25519_dalek::SigningKey;
use hmac::{Hmac, Mac};
use sha2::Sha512;

type HmacSha512 = Hmac<Sha512>;

pub struct DerivedKeys {
    pub secret: [u8; 32],
    pub age_identity: age::x25519::Identity,
    pub age_recipient: age::x25519::Recipient,
    pub ed25519_pubkey: [u8; 32],
}

pub fn derive_all(seed: &[u8; 64], index: u32) -> DerivedKeys {
    let secret = derive_slip10_ed25519(seed, index);

    let signing_key = ed25519_signing_key_from_secret(&secret);

    let scalar = expand_ed25519_scalar(&secret);

    let age_identity = age_identity_from_secret(&scalar);
    let age_recipient = age_identity.to_public();
    DerivedKeys {
        secret,
        age_identity,
        age_recipient,
        ed25519_pubkey: signing_key.verifying_key().to_bytes(),
    }
}

/// Expands an Ed25519 seed via SHA-512 and extracts the clamped scalar.
/// This matches what ed25519-dalek does internally in `SigningKey::from_bytes`.
/// The same scalar is used by X25519 (clamping is identical between the two).
fn expand_ed25519_scalar(seed: &[u8; 32]) -> [u8; 32] {
    use sha2::Digest;
    let hash = Sha512::digest(seed);
    let mut scalar = [0u8; 32];
    scalar.copy_from_slice(&hash[..32]);
    scalar[0] &= 248;
    scalar[31] &= 63;
    scalar[31] |= 64;
    scalar
}

pub fn seed_from_phrase(phrase: &str) -> [u8; 64] {
    let mnemonic = Mnemonic::parse(phrase).expect("valid BIP-39 phrase");
    mnemonic.to_seed("")
}

pub fn derive_slip10_ed25519(seed: &[u8; 64], index: u32) -> [u8; 32] {
    let path = slip10_path(index);

    let mut mac = HmacSha512::new_from_slice(b"ed25519 seed").expect("valid key");
    mac.update(seed);
    let result = mac.finalize().into_bytes();
    let mut result_bytes = [0u8; 64];
    result_bytes.copy_from_slice(&result);
    let (mut key, mut chain_code) = split_hmac_result(&result_bytes);

    for &i in &path {
        let mut mac = HmacSha512::new_from_slice(&chain_code).expect("valid key");
        mac.update(&[0u8]);
        mac.update(&key);
        mac.update(&i.to_be_bytes());
        let result = mac.finalize().into_bytes();
        let mut result_bytes = [0u8; 64];
        result_bytes.copy_from_slice(&result);
        let (k, c) = split_hmac_result(&result_bytes);
        key = k;
        chain_code = c;
    }

    key
}

pub fn ed25519_signing_key_from_secret(secret: &[u8; 32]) -> SigningKey {
    SigningKey::from_bytes(secret)
}

pub fn age_identity_from_secret(secret: &[u8; 32]) -> age::x25519::Identity {
    let encoded = encode_age_secret_key(secret);
    encoded.parse().expect("valid age secret key")
}

pub fn encode_age_secret_key(secret: &[u8; 32]) -> String {
    let hrp = bech32::Hrp::parse("age-secret-key-").expect("valid hrp");
    bech32::encode::<bech32::Bech32>(hrp, secret).expect("bech32 encode")
}

fn slip10_path(index: u32) -> Vec<u32> {
    vec![
        44 + 0x80000000,
        9731 + 0x80000000,
        index + 0x80000000,
        0 + 0x80000000,
    ]
}

fn split_hmac_result(result: &[u8; 64]) -> ([u8; 32], [u8; 32]) {
    let mut key = [0u8; 32];
    let mut chain = [0u8; 32];
    key.copy_from_slice(&result[..32]);
    chain.copy_from_slice(&result[32..]);
    (key, chain)
}

pub fn verify_ed25519_matches_age_recipient(
    ed25519_pubkey_hex: &str,
    age_recipient_str: &str,
) -> Result<(), String> {
    use curve25519_dalek::edwards::CompressedEdwardsY;

    let pubkey_bytes =
        hex::decode(ed25519_pubkey_hex).map_err(|_| "invalid ed25519 pubkey hex".to_string())?;
    let pubkey_bytes: [u8; 32] = pubkey_bytes
        .try_into()
        .map_err(|_| "ed25519 pubkey must be 32 bytes".to_string())?;

    let compressed = CompressedEdwardsY(pubkey_bytes);
    let edwards_point = compressed
        .decompress()
        .ok_or("failed to decompress edwards point".to_string())?;

    let montgomery_point = edwards_point.to_montgomery();
    let expected_x: [u8; 32] = montgomery_point.to_bytes();

    let hrp = bech32::Hrp::parse("age").expect("valid hrp");
    let expected_recipient =
        bech32::encode::<bech32::Bech32>(hrp, &expected_x).expect("bech32 encode");

    if expected_recipient == age_recipient_str {
        Ok(())
    } else {
        Err("ed25519 pubkey does not match age recipient".to_string())
    }
}
