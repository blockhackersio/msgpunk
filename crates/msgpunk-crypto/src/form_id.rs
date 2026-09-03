use sha2::{Digest, Sha256};

pub fn compute_form_id(recipient_str: &str, index: u32) -> String {
    let input = format!("{}:{}", recipient_str, index);
    let hash = Sha256::digest(input.as_bytes());
    hex::encode(&hash[..4])
}
