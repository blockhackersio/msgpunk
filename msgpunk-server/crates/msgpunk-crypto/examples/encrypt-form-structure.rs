use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let keys_dir = PathBuf::from(
        env::args()
            .nth(1)
            .expect("usage: encrypt-form-structure <keys-dir> <out-dir>"),
    );
    let out_dir = PathBuf::from(
        env::args()
            .nth(2)
            .expect("usage: encrypt-form-structure <keys-dir> <out-dir>"),
    );

    let recipient = fs::read_to_string(keys_dir.join("age-recipient.txt"))
        .unwrap()
        .trim()
        .to_string();

    let structure = r#"{"title":"Contact Me","fields":[{"id":"name","type":"text","label":"Your Name","required":true},{"id":"msg","type":"textarea","label":"Message","required":true}]}"#;

    let (encrypted_b64, encrypted_password, password) =
        msgpunk_crypto::encryption::encrypt_form_structure(structure, &recipient);

    fs::write(out_dir.join("encrypted-structure.b64"), &encrypted_b64).unwrap();
    fs::write(out_dir.join("password.txt"), &password).unwrap();
    fs::write(out_dir.join("encrypted-password.txt"), &encrypted_password).unwrap();

    eprintln!("wrote encrypted form structure to {}", out_dir.display());
}
