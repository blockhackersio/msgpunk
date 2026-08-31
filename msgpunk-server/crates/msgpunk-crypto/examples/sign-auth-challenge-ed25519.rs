use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{env, fs};

fn main() {
    let keys_dir = PathBuf::from(env::args().nth(1).expect("usage: sign-auth-challenge-ed25519 <keys-dir> <out-dir>"));
    let out_dir = PathBuf::from(env::args().nth(2).expect("usage: sign-auth-challenge-ed25519 <keys-dir> <out-dir>"));

    let form_id = fs::read_to_string(keys_dir.join("form-id.txt")).unwrap();
    let form_id = form_id.trim();

    let ed25519_pubkey_hex = fs::read_to_string(keys_dir.join("ed25519-pubkey.txt")).unwrap();
    let ed25519_pubkey_hex = ed25519_pubkey_hex.trim();

    let seed_hex = fs::read_to_string(keys_dir.join("seed.txt")).unwrap();
    let seed_hex = seed_hex.trim();
    let mut seed = [0u8; 64];
    hex::decode_to_slice(seed_hex, &mut seed).unwrap();

    let secret = msgpunk_crypto::identity::derive_slip10_ed25519(&seed, 0);
    let signing_key = ed25519_dalek::SigningKey::from_bytes(&secret);

    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let message = format!("{}:{}", form_id, now);

    let signature = msgpunk_crypto::auth::sign(&signing_key, message.as_bytes());

    let verifying_key_bytes = hex::decode(ed25519_pubkey_hex).unwrap();
    let verifying_key = ed25519_dalek::VerifyingKey::from_bytes(&verifying_key_bytes.try_into().unwrap()).unwrap();

    let valid = msgpunk_crypto::auth::verify(&verifying_key, message.as_bytes(), &signature);
    let fresh = msgpunk_crypto::auth::timestamp_fresh(now);

    if valid && fresh {
        fs::write(out_dir.join("result"), "PASS").unwrap();
    } else {
        fs::write(out_dir.join("result"), "FAIL").unwrap();
    }

    fs::write(out_dir.join("signature.txt"), signature).unwrap();
    fs::write(out_dir.join("timestamp.txt"), now.to_string()).unwrap();
    fs::write(out_dir.join("form-id.txt"), form_id).unwrap();
    fs::write(out_dir.join("pubkey.txt"), ed25519_pubkey_hex).unwrap();
}
