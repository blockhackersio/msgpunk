use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let keys_dir = PathBuf::from(
        env::args()
            .nth(1)
            .expect("usage: decrypt-submission-payload <keys-dir> <submission-dir> <out-dir>"),
    );
    let submission_dir = PathBuf::from(
        env::args()
            .nth(2)
            .expect("usage: decrypt-submission-payload <keys-dir> <submission-dir> <out-dir>"),
    );
    let out_dir = PathBuf::from(
        env::args()
            .nth(3)
            .expect("usage: decrypt-submission-payload <keys-dir> <submission-dir> <out-dir>"),
    );

    let identity = fs::read_to_string(keys_dir.join("age-identity.txt")).unwrap();
    let armored = fs::read_to_string(submission_dir.join("armored-ciphertext.txt")).unwrap();
    let original = fs::read_to_string(submission_dir.join("original-payload.json")).unwrap();

    let ok = msgpunk_crypto::encryption::verify_submission_payload(&identity, &armored, &original);

    fs::write(out_dir.join("result"), if ok { "PASS" } else { "FAIL" }).unwrap();
}
