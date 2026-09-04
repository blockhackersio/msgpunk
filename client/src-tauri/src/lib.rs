use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;
use tauri::{Manager, State};

struct Db(Mutex<Connection>);

fn init_db(app_data_dir: &std::path::Path) -> Connection {
    std::fs::create_dir_all(app_data_dir).ok();
    let db_path = app_data_dir.join("msgpunk.db");
    let conn = Connection::open(&db_path).expect("open db");
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS forms (
            form_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            key_index INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );",
    )
    .expect("create tables");
    conn
}

fn get_seed(db: &Connection) -> Result<String, String> {
    db.query_row(
        "SELECT value FROM settings WHERE key = 'seed_phrase'",
        [],
        |row| row.get::<_, String>(0),
    )
    .map_err(|_| "not onboarded".to_string())
}

fn get_key_index(db: &Connection) -> Result<u32, String> {
    let result: Result<u32, rusqlite::Error> = db.query_row(
        "SELECT value FROM settings WHERE key = 'last_key_index'",
        [],
        |row| {
            let v: String = row.get(0)?;
            Ok(v.parse::<u32>().unwrap_or(0))
        },
    );
    Ok(result.unwrap_or(0))
}

fn set_key_index(db: &Connection, index: u32) -> Result<(), String> {
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_key_index', ?1)",
        [index.to_string()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn derive_keys_for_form(seed: &[u8; 64], key_index: u32) -> msgpunk_crypto::identity::DerivedKeys {
    msgpunk_crypto::identity::derive_all(seed, key_index)
}

fn compute_form_id(recipient: &str, index: u32) -> String {
    msgpunk_crypto::form_id::compute_form_id(recipient, index)
}

fn sign_auth(
    seed: &[u8; 64],
    form_id: &str,
    key_index: u32,
) -> Result<(String, u64), String> {
    let secret = msgpunk_crypto::identity::derive_slip10_ed25519(seed, key_index);
    let signing_key = msgpunk_crypto::identity::ed25519_signing_key_from_secret(&secret);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let message = format!("{}:{}", form_id, now);
    let sig = msgpunk_crypto::auth::sign(&signing_key, message.as_bytes());
    Ok((sig, now))
}

fn decrypt_submission(identity: &age::x25519::Identity, armored: &str) -> Result<HashMap<String, String>, String> {
    let decrypted = age::decrypt(identity, armored.as_bytes()).map_err(|e| format!("age decrypt: {}", e))?;
    let decrypted_str = String::from_utf8(decrypted).map_err(|e| format!("utf8: {}", e))?;
    let unpadded = msgpunk_crypto::padding::unpad(&decrypted_str);
    let parsed: serde_json::Value =
        serde_json::from_str(&unpadded).map_err(|e| format!("json parse: {}", e))?;
    let fields = parsed["fields"]
        .as_object()
        .ok_or("missing fields")?
        .iter()
        .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
        .collect();
    Ok(fields)
}

#[tauri::command]
async fn is_onboarded(state: State<'_, Db>) -> Result<bool, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    match db.query_row(
        "SELECT 1 FROM settings WHERE key = 'seed_phrase'",
        [],
        |_| Ok(()),
    ) {
        Ok(_) => Ok(true),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn generate_seed(state: State<'_, Db>) -> Result<String, String> {
    let mut entropy = [0u8; 32];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut entropy);
    let mnemonic = bip39::Mnemonic::from_entropy(&entropy).map_err(|e| e.to_string())?;
    let phrase = mnemonic.to_string();

    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('seed_phrase', ?1)",
        [&phrase],
    )
    .map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_key_index', '0')",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(phrase)
}

#[tauri::command]
async fn get_seed_phrase(state: State<'_, Db>) -> Result<String, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    get_seed(&db)
}

#[derive(Serialize)]
struct FormInfo {
    form_id: String,
    display_name: String,
    key_index: u32,
    created_at: String,
}

#[tauri::command]
async fn list_forms(state: State<'_, Db>) -> Result<Vec<FormInfo>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT form_id, display_name, key_index, created_at FROM forms ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(FormInfo {
                form_id: row.get(0)?,
                display_name: row.get(1)?,
                key_index: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut forms = Vec::new();
    for row in rows {
        forms.push(row.map_err(|e| e.to_string())?);
    }
    Ok(forms)
}

#[tauri::command]
async fn rename_form(state: State<'_, Db>, form_id: String, display_name: String) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE forms SET display_name = ?1 WHERE form_id = ?2",
        rusqlite::params![display_name, form_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn create_form(
    state: State<'_, Db>,
    display_name: String,
    server_url: String,
) -> Result<String, String> {
    let (seed, key_index) = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        let seed_phrase = get_seed(&db)?;
        let seed = msgpunk_crypto::identity::seed_from_phrase(&seed_phrase);
        let key_index = get_key_index(&db)?;
        (seed, key_index)
    };

    let keys = derive_keys_for_form(&seed, key_index);
    let recipient_str = keys.age_recipient.to_string();
    let form_id = compute_form_id(&recipient_str, key_index);

    let form_structure = r#"{"id":"form","title":"New Form","description":null,"slug":"new-form","theme":"ocean","thank_you_message":"Thank you for your submission!","questions":[{"id":"signal","type":"short_text","title":"Signal Account","required":true,"placeholder":false},{"id":"name","type":"short_text","title":"What should I call you?","required":true,"placeholder":false},{"id":"message","type":"long_text","title":"Your Message","required":true,"placeholder":false}]}"#;

    let (encrypted_b64, encrypted_password, password) =
        msgpunk_crypto::encryption::encrypt_form_structure(form_structure, &recipient_str);

    let body = serde_json::json!({
        "age_recipient": recipient_str,
        "ed25519_pubkey": hex::encode(keys.ed25519_pubkey),
        "encrypted_structure": encrypted_b64,
        "encrypted_password": encrypted_password,
    });

    let form_url = format!(
        "{}/f/{}",
        server_url.trim_end_matches('/'),
        form_id
    );

    let full_url = format!(
        "{}/f/{}#{}",
        server_url.trim_end_matches('/'),
        form_id,
        password.trim(),
    );

    let client = reqwest::Client::new();
    let resp = client
        .post(&form_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("publish failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("server returned {}: {}", status, body_text));
    }

    let now = chrono::Utc::now().to_rfc3339();
    {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "INSERT INTO forms (form_id, display_name, key_index, created_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![form_id, display_name, key_index, now],
        )
        .map_err(|e| e.to_string())?;
        set_key_index(&db, key_index + 1)?;
    }

    Ok(full_url)
}

#[tauri::command]
async fn delete_form(
    state: State<'_, Db>,
    form_id: String,
    server_url: String,
) -> Result<(), String> {
    let (seed, key_index) = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        let seed_phrase = get_seed(&db)?;
        let seed = msgpunk_crypto::identity::seed_from_phrase(&seed_phrase);
        let key_index: u32 = db
            .query_row(
                "SELECT key_index FROM forms WHERE form_id = ?1",
                [&form_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("form not found: {}", e))?;
        (seed, key_index)
    };

    let (sig, ts) = sign_auth(&seed, &form_id, key_index)?;

    let base = server_url.trim_end_matches('/');
    let list_url = format!("{}/s/{}?ts={}&sig={}", base, form_id, ts, sig);
    let client = reqwest::Client::new();

    if let Ok(resp) = client.get(&list_url).send().await {
        if let Ok(body) = resp.text().await {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(msgs) = parsed["messages"].as_array() {
                    for msg in msgs {
                        if let Some(msg_id) = msg["msg_id"].as_str() {
                            let del_url = format!(
                                "{}/s/{}/{}?ts={}&sig={}",
                                base, form_id, msg_id, ts, sig
                            );
                            client.delete(&del_url).send().await.ok();
                        }
                    }
                }
            }
        }
    }

    {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        db.execute("DELETE FROM forms WHERE form_id = ?1", [&form_id])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[derive(Serialize)]
struct ReplyInfo {
    msg_id: String,
    sender_name: String,
    received_at: String,
}

#[tauri::command]
async fn list_replies(
    state: State<'_, Db>,
    form_id: String,
    server_url: String,
) -> Result<Vec<ReplyInfo>, String> {
    let (seed, key_index) = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        let seed_phrase = get_seed(&db)?;
        let seed = msgpunk_crypto::identity::seed_from_phrase(&seed_phrase);
        let key_index: u32 = db
            .query_row(
                "SELECT key_index FROM forms WHERE form_id = ?1",
                [&form_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("form not found: {}", e))?;
        (seed, key_index)
    };

    let keys = derive_keys_for_form(&seed, key_index);

    let (sig, ts) = sign_auth(&seed, &form_id, key_index)?;

    let base = server_url.trim_end_matches('/');
    let list_url = format!("{}/s/{}?ts={}&sig={}", base, form_id, ts, sig);

    let client = reqwest::Client::new();
    let resp = client
        .get(&list_url)
        .send()
        .await
        .map_err(|e| format!("fetch failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("server returned {}", resp.status()));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("parse failed: {}", e))?;

    let messages = body["messages"]
        .as_array()
        .ok_or("invalid response")?
        .clone();

    let mut replies = Vec::new();
    for msg in &messages {
        let msg_id = msg["msg_id"].as_str().unwrap_or("");
        let received_at = msg["received_at"].as_str().unwrap_or("").to_string();

        let msg_url = format!(
            "{}/s/{}/{}?ts={}&sig={}",
            base, form_id, msg_id, ts, sig
        );

        if let Ok(resp) = client.get(&msg_url).send().await {
            if let Ok(ciphertext) = resp.text().await {
                let sender_name = decrypt_submission(&keys.age_identity, &ciphertext)
                    .ok()
                    .and_then(|f| f.get("name").cloned())
                    .unwrap_or_else(|| "Unknown".to_string());

                replies.push(ReplyInfo {
                    msg_id: msg_id.to_string(),
                    sender_name,
                    received_at,
                });
            }
        }
    }

    Ok(replies)
}

#[derive(Serialize)]
struct ReplyDetail {
    msg_id: String,
    fields: HashMap<String, String>,
    submitted_at: String,
    received_at: String,
}

#[tauri::command]
async fn get_reply(
    state: State<'_, Db>,
    form_id: String,
    msg_id: String,
    server_url: String,
) -> Result<ReplyDetail, String> {
    let (seed, key_index) = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        let seed_phrase = get_seed(&db)?;
        let seed = msgpunk_crypto::identity::seed_from_phrase(&seed_phrase);
        let key_index: u32 = db
            .query_row(
                "SELECT key_index FROM forms WHERE form_id = ?1",
                [&form_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("form not found: {}", e))?;
        (seed, key_index)
    };

    let keys = derive_keys_for_form(&seed, key_index);

    let (sig, ts) = sign_auth(&seed, &form_id, key_index)?;

    let base = server_url.trim_end_matches('/');
    let url = format!(
        "{}/s/{}/{}?ts={}&sig={}",
        base, form_id, msg_id, ts, sig
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("fetch failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("server returned {}", resp.status()));
    }

    let ciphertext = resp.text().await.map_err(|e| format!("read failed: {}", e))?;

    let decrypted = age::decrypt(&keys.age_identity, ciphertext.as_bytes())
        .map_err(|e| format!("decrypt failed: {}", e))?;
    let decrypted_str = String::from_utf8(decrypted).map_err(|e| format!("utf8: {}", e))?;
    let unpadded = msgpunk_crypto::padding::unpad(&decrypted_str);

    let parsed: serde_json::Value =
        serde_json::from_str(&unpadded).map_err(|e| format!("json: {}", e))?;

    let fields = parsed["fields"]
        .as_object()
        .ok_or("missing fields")?
        .iter()
        .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
        .collect();

    let submitted_at = parsed["submitted_at"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let received_at = String::new();

    Ok(ReplyDetail {
        msg_id,
        fields,
        submitted_at,
        received_at,
    })
}

#[tauri::command]
async fn delete_reply(
    state: State<'_, Db>,
    form_id: String,
    msg_id: String,
    server_url: String,
) -> Result<(), String> {
    let (seed, key_index) = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        let seed_phrase = get_seed(&db)?;
        let seed = msgpunk_crypto::identity::seed_from_phrase(&seed_phrase);
        let key_index: u32 = db
            .query_row(
                "SELECT key_index FROM forms WHERE form_id = ?1",
                [&form_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("form not found: {}", e))?;
        (seed, key_index)
    };

    let (sig, ts) = sign_auth(&seed, &form_id, key_index)?;

    let base = server_url.trim_end_matches('/');
    let url = format!(
        "{}/s/{}/{}?ts={}&sig={}",
        base, form_id, msg_id, ts, sig
    );

    let client = reqwest::Client::new();
    let resp = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("delete failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("server returned {}", resp.status()));
    }

    Ok(())
}

#[tauri::command]
async fn check_health(server_url: String) -> Result<String, String> {
    let url = format!("{}/health", server_url.trim_end_matches('/'));
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    let status = resp.status();
    let body = resp.text().await.map_err(|e| format!("Read failed: {}", e))?;
    Ok(format!("{} - {}", status, body))
}

#[tauri::command]
async fn get_form_url(
    state: State<'_, Db>,
    form_id: String,
    server_url: String,
) -> Result<String, String> {
    let (seed, key_index) = {
        let db = state.0.lock().map_err(|e| e.to_string())?;
        let seed_phrase = get_seed(&db)?;
        let seed = msgpunk_crypto::identity::seed_from_phrase(&seed_phrase);
        let key_index: u32 = db
            .query_row(
                "SELECT key_index FROM forms WHERE form_id = ?1",
                [&form_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("form not found: {}", e))?;
        (seed, key_index)
    };

    let keys = derive_keys_for_form(&seed, key_index);

    let base = server_url.trim_end_matches('/');
    let data_url = format!("{}/f/{}/data", base, form_id);

    let client = reqwest::Client::new();
    let resp = client
        .get(&data_url)
        .send()
        .await
        .map_err(|e| format!("fetch failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("server returned {}", resp.status()));
    }

    #[derive(serde::Deserialize)]
    struct FormDataResponse {
        encrypted_structure: String,
        age_recipient: String,
        encrypted_password: String,
    }

    let data: FormDataResponse = resp
        .json()
        .await
        .map_err(|e| format!("parse failed: {}", e))?;

    let decrypted_password =
        age::decrypt(&keys.age_identity, data.encrypted_password.as_bytes())
            .map_err(|e| format!("age decrypt failed: {}", e))?;
    let password =
        String::from_utf8(decrypted_password).map_err(|e| format!("utf8: {}", e))?;

    let url = format!("{}/f/{}#{}", base, form_id, password.trim());
    Ok(url)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir: PathBuf = app
                .path()
                .app_data_dir()
                .expect("app data dir");
            let conn = init_db(&app_data_dir);
            app.manage(Db(Mutex::new(conn)));

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            is_onboarded,
            generate_seed,
            get_seed_phrase,
            list_forms,
            rename_form,
            create_form,
            delete_form,
            list_replies,
            get_reply,
            delete_reply,
            check_health,
            get_form_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
