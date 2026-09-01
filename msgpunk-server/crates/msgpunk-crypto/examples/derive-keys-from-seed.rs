use secrecy::ExposeSecret;
use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let out_dir = PathBuf::from(env::args().nth(1).expect("usage: derive-keys-from-seed <out-dir>"));

    let phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    let seed = msgpunk_crypto::identity::seed_from_phrase(phrase);
    let secret = msgpunk_crypto::identity::derive_slip10_ed25519(&seed, 0);
    let signing_key = msgpunk_crypto::identity::ed25519_signing_key_from_secret(&secret);
    let age_identity = msgpunk_crypto::identity::age_identity_from_secret(&secret);
    let age_recipient = age_identity.to_public();
    let form_id = msgpunk_crypto::form_id::compute_form_id(&age_recipient.to_string(), 0);

    fs::write(out_dir.join("age-recipient.txt"), age_recipient.to_string()).unwrap();
    fs::write(out_dir.join("age-identity.txt"), age_identity.to_string().expose_secret()).unwrap();
    fs::write(out_dir.join("ed25519-pubkey.txt"), hex::encode(signing_key.verifying_key().to_bytes())).unwrap();
    fs::write(out_dir.join("form-id.txt"), form_id).unwrap();
    fs::write(out_dir.join("seed.txt"), hex::encode(seed)).unwrap();

    eprintln!("wrote keys to {}", out_dir.display());
}
