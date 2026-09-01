use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let keys_dir = PathBuf::from(
        env::args()
            .nth(1)
            .expect("usage: sign-auth-challenge-ed25519 <keys-dir> <out-dir>"),
    );
    let out_dir = PathBuf::from(
        env::args()
            .nth(2)
            .expect("usage: sign-auth-challenge-ed25519 <keys-dir> <out-dir>"),
    );

    let form_id = fs::read_to_string(keys_dir.join("form-id.txt"))
        .unwrap()
        .trim()
        .to_string();
    let pubkey_hex = fs::read_to_string(keys_dir.join("ed25519-pubkey.txt"))
        .unwrap()
        .trim()
        .to_string();
    let seed_hex = fs::read_to_string(keys_dir.join("seed.txt"))
        .unwrap()
        .trim()
        .to_string();

    let challenge = msgpunk_crypto::auth::sign_challenge(&seed_hex, &form_id, &pubkey_hex);

    fs::write(out_dir.join("result"), "PASS").unwrap();
    fs::write(out_dir.join("signature.txt"), challenge.signature).unwrap();
    fs::write(out_dir.join("timestamp.txt"), challenge.timestamp.to_string()).unwrap();
    fs::write(out_dir.join("form-id.txt"), form_id).unwrap();
    fs::write(out_dir.join("pubkey.txt"), pubkey_hex).unwrap();

    eprintln!("wrote auth challenge to {}", out_dir.display());
}
