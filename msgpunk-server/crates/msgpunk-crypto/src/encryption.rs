use std::io::Write;

pub fn age_encrypt(recipient: &age::x25519::Recipient, plaintext: &[u8]) -> String {
    let recipients: Vec<&dyn age::Recipient> = vec![recipient as &dyn age::Recipient];
    let encryptor =
        age::Encryptor::with_recipients(recipients.into_iter()).expect("valid recipients");

    let mut ciphertext = Vec::new();
    let mut writer = encryptor.wrap_output(&mut ciphertext).expect("wrap output");

    writer.write_all(plaintext).expect("write plaintext");
    writer.finish().expect("finish encryption");

    String::from_utf8(ciphertext).expect("valid utf-8")
}

pub fn age_decrypt(identity: &age::x25519::Identity, armored: &str) -> Vec<u8> {
    age::decrypt(identity, armored.as_bytes()).expect("age decrypt")
}

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};

pub fn aes_gcm_encrypt(key: &[u8; 32], plaintext: &[u8]) -> (Vec<u8>, [u8; 12]) {
    let cipher = Aes256Gcm::new_from_slice(key).expect("valid key");
    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, plaintext).expect("aes-gcm encrypt");
    (ciphertext, nonce_bytes)
}
