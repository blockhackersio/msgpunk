use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let keys_dir = PathBuf::from(env::args().nth(1).expect("usage: decrypt-form-structure <keys-dir> <setup-dir> <out-dir>"));
    let setup_dir = PathBuf::from(env::args().nth(2).expect("usage: decrypt-form-structure <keys-dir> <setup-dir> <out-dir>"));
    let out_dir = PathBuf::from(env::args().nth(3).expect("usage: decrypt-form-structure <keys-dir> <setup-dir> <out-dir>"));

    let identity_str = fs::read_to_string(keys_dir.join("age-identity.txt")).unwrap();
    let identity: age::x25519::Identity = identity_str.trim().parse().expect("valid age identity");

    let encrypted_password = fs::read_to_string(setup_dir.join("encrypted-password.txt")).unwrap();
    let encrypted_structure_b64 = fs::read_to_string(setup_dir.join("encrypted-structure.b64")).unwrap();
    let password = fs::read_to_string(setup_dir.join("password.txt")).unwrap();

    let decrypted_password = String::from_utf8(msgpunk_crypto::encryption::age_decrypt(&identity, &encrypted_password)).unwrap();

    if decrypted_password.trim() != password.trim() {
        fs::write(out_dir.join("result"), "FAIL").unwrap();
        eprintln!("password mismatch: got {:?}, expected {:?}", decrypted_password.trim(), password.trim());
        return;
    }

    let encrypted_structure = base64_simd::STANDARD.decode_to_vec(encrypted_structure_b64.trim()).unwrap();

    let key = sha2_hash_password(password.trim());
    let nonce = &encrypted_structure[..12];
    let ciphertext = &encrypted_structure[12..];
    let mut nonce_arr = [0u8; 12];
    nonce_arr.copy_from_slice(nonce);
    let mut key_arr = [0u8; 32];
    key_arr.copy_from_slice(&key);

    let decrypted = msgpunk_crypto::encryption::aes_gcm_decrypt(&key_arr, ciphertext, &nonce_arr);
    let structure: serde_json::Value = serde_json::from_slice(&decrypted).unwrap();

    if structure["title"] == "Contact Me" {
        fs::write(out_dir.join("result"), "PASS").unwrap();
    } else {
        fs::write(out_dir.join("result"), "FAIL").unwrap();
    }
}

fn sha2_hash_password(password: &str) -> Vec<u8> {
    use sha2::Digest;
    sha2::Sha256::digest(password.as_bytes()).to_vec()
}
