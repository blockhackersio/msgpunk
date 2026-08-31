use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let keys_dir = PathBuf::from(env::args().nth(1).expect("usage: decrypt-submission-payload <keys-dir> <submission-dir> <out-dir>"));
    let submission_dir = PathBuf::from(env::args().nth(2).expect("usage: decrypt-submission-payload <keys-dir> <submission-dir> <out-dir>"));
    let out_dir = PathBuf::from(env::args().nth(3).expect("usage: decrypt-submission-payload <keys-dir> <submission-dir> <out-dir>"));

    let identity_str = fs::read_to_string(keys_dir.join("age-identity.txt")).unwrap();
    let identity: age::x25519::Identity = identity_str.trim().parse().expect("valid age identity");

    let armored = fs::read_to_string(submission_dir.join("armored-ciphertext.txt")).unwrap();
    let original = fs::read_to_string(submission_dir.join("original-payload.json")).unwrap();

    let decrypted = msgpunk_crypto::encryption::age_decrypt(&identity, &armored);
    let decrypted_str = String::from_utf8(decrypted).unwrap();

    let unpadded = msgpunk_crypto::padding::unpad(&decrypted_str);
    let original_parsed: serde_json::Value = serde_json::from_str(&original).unwrap();
    let unpadded_parsed: serde_json::Value = serde_json::from_str(&unpadded).unwrap();

    if unpadded_parsed["fields"] == original_parsed["fields"] {
        fs::write(out_dir.join("result"), "PASS").unwrap();
    } else {
        fs::write(out_dir.join("result"), "FAIL").unwrap();
    }
}
