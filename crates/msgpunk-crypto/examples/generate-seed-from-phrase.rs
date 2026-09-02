use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let out_dir = PathBuf::from(
        env::args()
            .nth(1)
            .expect("usage: generate-seed-from-phrase <out-dir>"),
    );

    let phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    let seed = msgpunk_crypto::identity::seed_from_phrase(phrase);

    fs::write(out_dir.join("seed.txt"), hex::encode(seed)).unwrap();
    eprintln!("wrote seed to {}", out_dir.display());
}
