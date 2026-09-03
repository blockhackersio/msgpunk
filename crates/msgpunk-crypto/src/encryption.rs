use std::io::Write;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use age::armor::{ArmoredWriter, Format};
use sha2::{Digest, Sha256};

pub fn age_encrypt(recipient: &age::x25519::Recipient, plaintext: &[u8]) -> String {
    let recipients: Vec<&dyn age::Recipient> = vec![recipient as &dyn age::Recipient];
    let encryptor =
        age::Encryptor::with_recipients(recipients.into_iter()).expect("valid recipients");

    let mut ciphertext = Vec::new();
    let writer = ArmoredWriter::wrap_output(&mut ciphertext, Format::AsciiArmor)
        .expect("armor writer");
    let mut writer = encryptor.wrap_output(writer).expect("wrap output");
    writer.write_all(plaintext).expect("write plaintext");
    let armored = writer.finish().expect("finish encryption");
    armored.finish().expect("finish armor");

    String::from_utf8(ciphertext).expect("valid utf-8")
}

pub fn age_decrypt(identity: &age::x25519::Identity, armored: &str) -> Vec<u8> {
    age::decrypt(identity, armored.as_bytes()).expect("age decrypt")
}

pub fn aes_gcm_encrypt(key: &[u8; 32], plaintext: &[u8]) -> (Vec<u8>, [u8; 12]) {
    let cipher = Aes256Gcm::new_from_slice(key).expect("valid key");
    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, plaintext).expect("aes-gcm encrypt");
    (ciphertext, nonce_bytes)
}

fn generate_password() -> String {
    let bytes: [u8; 4] = rand::random();
    hex::encode(bytes)
}

fn derive_key(password: &str) -> [u8; 32] {
    let hash = Sha256::digest(password.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash);
    key
}

/// Encrypts form structure JSON with AES-GCM using a generated password,
/// then age-encrypts the password to the form owner's recipient.
///
/// Returns `(encrypted_structure_b64, encrypted_password_armored, raw_password)`.
pub fn encrypt_form_structure(
    structure_json: &str,
    age_recipient_str: &str,
) -> (String, String, String) {
    let password = generate_password();
    let key = derive_key(&password);

    let (aes_ciphertext, nonce) = aes_gcm_encrypt(&key, structure_json.as_bytes());

    // Format: nonce(12) || ciphertext(including 16-byte tag)
    let mut combined = Vec::with_capacity(12 + aes_ciphertext.len());
    combined.extend_from_slice(&nonce);
    combined.extend_from_slice(&aes_ciphertext);
    let encrypted_structure_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &combined);

    let recipient: age::x25519::Recipient = age_recipient_str
        .parse()
        .expect("valid age recipient");
    let encrypted_password = age_encrypt(&recipient, password.as_bytes());

    (encrypted_structure_b64, encrypted_password, password)
}

/// Age-decrypts a submission payload, unpads it, and verifies its `fields` match
/// the original pre-encryption JSON.
pub fn verify_submission_payload(
    identity_str: &str,
    armored: &str,
    original_json: &str,
) -> bool {
    let identity: age::x25519::Identity = identity_str
        .trim()
        .parse()
        .expect("valid age identity");

    let decrypted = age_decrypt(&identity, armored.trim());
    let decrypted_str = String::from_utf8(decrypted).expect("valid utf-8");
    let unpadded = crate::padding::unpad(&decrypted_str);

    let original: serde_json::Value = serde_json::from_str(original_json).expect("valid json");
    let result: serde_json::Value = serde_json::from_str(&unpadded).expect("valid json");

    result["fields"] == original["fields"]
}
