use secrecy::ExposeSecret;
use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let out_dir = PathBuf::from(env::args().nth(1).expect("usage: derive-keys-from-seed <out-dir>"));

    let phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    let keys = msgpunk_crypto::identity::derive_keys(phrase, 0);
    let form_id = msgpunk_crypto::form_id::compute_form_id(&keys.age_recipient.to_string(), 0);

    fs::write(out_dir.join("age-recipient.txt"), keys.age_recipient.to_string()).unwrap();
    fs::write(out_dir.join("age-identity.txt"), keys.age_identity.to_string().expose_secret()).unwrap();
    fs::write(out_dir.join("ed25519-pubkey.txt"), hex::encode(keys.verifying_key.to_bytes())).unwrap();
    fs::write(out_dir.join("form-id.txt"), form_id).unwrap();
    fs::write(out_dir.join("seed.txt"), hex::encode(keys.seed)).unwrap();

    eprintln!("wrote keys to {}", out_dir.display());
}
