use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let out_dir = PathBuf::from(
        env::args()
            .nth(1)
            .expect("usage: compute-form-id <out-dir>"),
    );

    let recipient = fs::read_to_string(out_dir.join("age-recipient.txt"))
        .unwrap()
        .trim()
        .to_string();

    let form_id = msgpunk_crypto::form_id::compute_form_id(&recipient, 0);

    fs::write(out_dir.join("form-id.txt"), form_id).unwrap();
    eprintln!("wrote form-id to {}", out_dir.display());
}
