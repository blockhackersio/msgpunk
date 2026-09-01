use bip39::Mnemonic;
use ed25519_dalek::SigningKey;
use hmac::{Hmac, Mac};
use sha2::Sha512;

type HmacSha512 = Hmac<Sha512>;

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
