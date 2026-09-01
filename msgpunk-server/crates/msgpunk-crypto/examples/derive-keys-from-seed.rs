use secrecy::ExposeSecret;
use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let out_dir = PathBuf::from(
        env::args()
            .nth(1)
            .expect("usage: derive-keys-from-seed <out-dir>"),
    );

    let seed_hex = fs::read_to_string(out_dir.join("seed.txt"))
        .unwrap();
    let mut seed = [0u8; 64];
    hex::decode_to_slice(seed_hex.trim(), &mut seed).unwrap();

    let keys = msgpunk_crypto::identity::derive_all(&seed, 0);

    fs::write(
        out_dir.join("age-recipient.txt"),
        keys.age_recipient.to_string(),
    )
    .unwrap();
    fs::write(
        out_dir.join("age-identity.txt"),
        keys.age_identity.to_string().expose_secret(),
    )
    .unwrap();
    fs::write(
        out_dir.join("ed25519-pubkey.txt"),
        hex::encode(keys.ed25519_pubkey),
    )
    .unwrap();

    eprintln!("wrote keys to {}", out_dir.display());
}
