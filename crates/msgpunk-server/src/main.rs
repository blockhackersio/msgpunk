use std::path::PathBuf;
use std::sync::Arc;

use actix_web::{
    delete, get, post,
    web::{self, Data, Json, Path, Query},
    HttpServer, HttpResponse,
};
use chrono::Utc;
use msgpunk_crypto::auth::{timestamp_fresh, verify};
use msgpunk_crypto::identity::verify_ed25519_matches_age_recipient;
use msgpunk_storage::{BlobMeta, FormData, Storage};
use rust_embed::RustEmbed;
use serde::Deserialize;
use serde::Serialize;

#[derive(RustEmbed)]
#[folder = "static"]
struct StaticFiles;

pub struct AppState {
    pub storage: Arc<dyn Storage>,
}

#[derive(Deserialize, Serialize)]
pub struct CreateFormBody {
    pub age_recipient: String,
    pub ed25519_pubkey: String,
    pub encrypted_structure: String,
    pub encrypted_password: String,
}

#[derive(Serialize)]
pub struct CreateFormResponse {
    pub form_id: String,
}

#[derive(Serialize)]
pub struct GetFormDataResponse {
    pub encrypted_structure: String,
    pub age_recipient: String,
    pub encrypted_password: String,
}

#[derive(Deserialize)]
pub struct AuthQuery {
    pub since: Option<String>,
    pub ts: Option<u64>,
    pub sig: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ListResponse {
    pub messages: Vec<BlobMeta>,
    pub cursor: String,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

fn error_response(status: actix_web::http::StatusCode, msg: &str) -> HttpResponse {
    HttpResponse::build(status).json(ErrorResponse {
        error: msg.to_string(),
    })
}

async fn verify_auth(
    storage: &dyn Storage,
    form_id: &str,
    ts: Option<u64>,
    sig: Option<&str>,
) -> Result<(), HttpResponse> {
    let (ts, sig) = match (ts, sig) {
        (Some(ts), Some(sig)) => (ts, sig),
        _ => {
            return Err(error_response(
                actix_web::http::StatusCode::UNAUTHORIZED,
                "missing auth params",
            ))
        }
    };

    if !timestamp_fresh(ts) {
        return Err(error_response(
            actix_web::http::StatusCode::UNAUTHORIZED,
            "timestamp not fresh",
        ));
    }

    let form = match storage.get_form(form_id).await {
        Ok(Some(f)) => f,
        _ => {
            return Err(error_response(
                actix_web::http::StatusCode::UNAUTHORIZED,
                "form not found",
            ))
        }
    };

    let message = format!("{}:{}", form_id, ts);
    let pubkey_bytes = hex::decode(&form.ed25519_pubkey).map_err(|_| {
        error_response(actix_web::http::StatusCode::UNAUTHORIZED, "invalid pubkey")
    })?;
    let pubkey_bytes: [u8; 32] = pubkey_bytes.try_into().map_err(|_| {
        error_response(
            actix_web::http::StatusCode::UNAUTHORIZED,
            "invalid pubkey length",
        )
    })?;
    let verifying_key =
        ed25519_dalek::VerifyingKey::from_bytes(&pubkey_bytes).map_err(|_| {
            error_response(
                actix_web::http::StatusCode::UNAUTHORIZED,
                "invalid verifying key",
            )
        })?;

    if !verify(&verifying_key, message.as_bytes(), sig) {
        return Err(error_response(
            actix_web::http::StatusCode::UNAUTHORIZED,
            "invalid signature",
        ));
    }

    Ok(())
}

#[get("/health")]
async fn healthcheck() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "ok" }))
}

#[post("/f/{form_id}")]
async fn create_form(
    state: Data<AppState>,
    path: Path<String>,
    body: Json<CreateFormBody>,
) -> HttpResponse {
    let form_id = path.into_inner();

    if let Err(e) = verify_ed25519_matches_age_recipient(&body.ed25519_pubkey, &body.age_recipient)
    {
        return error_response(actix_web::http::StatusCode::BAD_REQUEST, &e);
    }

    let data = FormData {
        age_recipient: body.age_recipient.clone(),
        ed25519_pubkey: body.ed25519_pubkey.clone(),
        encrypted_structure: body.encrypted_structure.clone(),
        encrypted_password: body.encrypted_password.clone(),
    };

    match state.storage.store_form(&form_id, &data).await {
        Ok(()) => HttpResponse::Created().json(CreateFormResponse { form_id }),
        Err(e) => {
            error_response(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

#[get("/f/{form_id}/data")]
async fn get_form_data(state: Data<AppState>, path: Path<String>) -> HttpResponse {
    let form_id = path.into_inner();

    match state.storage.get_form(&form_id).await {
        Ok(Some(form)) => HttpResponse::Ok().json(GetFormDataResponse {
            encrypted_structure: form.encrypted_structure,
            age_recipient: form.age_recipient,
            encrypted_password: form.encrypted_password,
        }),
        Ok(None) => error_response(actix_web::http::StatusCode::NOT_FOUND, "form_not_found"),
        Err(e) => {
            error_response(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

#[post("/s/{form_id}")]
async fn submit_message(state: Data<AppState>, path: Path<String>, body: String) -> HttpResponse {
    let form_id = path.into_inner();

    match state.storage.get_form(&form_id).await {
        Ok(Some(_)) => {}
        Ok(None) => {
            return error_response(actix_web::http::StatusCode::NOT_FOUND, "form_not_found")
        }
        Err(e) => {
            return error_response(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }

    let msg_id = ulid::Ulid::new().to_string();
    let received_at = Utc::now().to_rfc3339();

    match state
        .storage
        .store_blob(&form_id, &msg_id, &body, &received_at)
        .await
    {
        Ok(()) => HttpResponse::Accepted().json(serde_json::json!({ "msg_id": msg_id })),
        Err(e) => {
            error_response(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

#[get("/s/{form_id}")]
async fn list_messages(
    state: Data<AppState>,
    path: Path<String>,
    query: Query<AuthQuery>,
) -> HttpResponse {
    let form_id = path.into_inner();

    if let Err(resp) = verify_auth(
        state.storage.as_ref(),
        &form_id,
        query.ts,
        query.sig.as_deref(),
    )
    .await
    {
        return resp;
    }

    let since = query.since.as_deref();

    match state.storage.list_blobs(&form_id, since).await {
        Ok((messages, cursor)) => HttpResponse::Ok().json(ListResponse { messages, cursor }),
        Err(e) => {
            error_response(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

#[get("/s/{form_id}/{msg_id}")]
async fn get_message(
    state: Data<AppState>,
    path: Path<(String, String)>,
    query: Query<AuthQuery>,
) -> HttpResponse {
    let (form_id, msg_id) = path.into_inner();

    if let Err(resp) = verify_auth(
        state.storage.as_ref(),
        &form_id,
        query.ts,
        query.sig.as_deref(),
    )
    .await
    {
        return resp;
    }

    match state.storage.get_blob(&form_id, &msg_id).await {
        Ok(ciphertext) => HttpResponse::Ok()
            .content_type("text/plain")
            .body(ciphertext),
        Err(msgpunk_storage::StorageError::MessageNotFound(_)) => {
            error_response(actix_web::http::StatusCode::NOT_FOUND, "message_not_found")
        }
        Err(e) => {
            error_response(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

#[delete("/s/{form_id}/{msg_id}")]
async fn delete_message(
    state: Data<AppState>,
    path: Path<(String, String)>,
    query: Query<AuthQuery>,
) -> HttpResponse {
    let (form_id, msg_id) = path.into_inner();

    if let Err(resp) = verify_auth(
        state.storage.as_ref(),
        &form_id,
        query.ts,
        query.sig.as_deref(),
    )
    .await
    {
        return resp;
    }

    match state.storage.delete_blob(&form_id, &msg_id).await {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(msgpunk_storage::StorageError::MessageNotFound(_)) => {
            error_response(actix_web::http::StatusCode::NOT_FOUND, "message_not_found")
        }
        Err(e) => {
            error_response(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())
        }
    }
}

#[get("/")]
async fn index() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/html")
        .body(include_str!("../templates/index.html"))
}

#[get("/logo.png")]
async fn logo() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("image/png")
        .body(include_bytes!("../templates/logo.png").to_vec())
}

#[get("/f/{path:.*}")]
async fn serve_static(path: web::Path<String>) -> HttpResponse {
    let path = path.into_inner();
    let path = if path.is_empty() || !StaticFiles::get(&path).is_some() {
        "index.html"
    } else {
        &path
    };
    match StaticFiles::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            HttpResponse::Ok()
                .content_type(mime.as_ref())
                .body(content.data.into_owned())
        }
        None => HttpResponse::NotFound().finish(),
    }
}

fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(healthcheck)
        .service(index)
        .service(logo)
        .service(create_form)
        .service(get_form_data)
        .service(submit_message)
        .service(list_messages)
        .service(get_message)
        .service(delete_message)
        .service(serve_static);
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let data_dir = std::env::var("MSGPUNK_DATA_DIR")
        .unwrap_or_else(|_| ".msgpunk/data".to_string());
    let data_path = PathBuf::from(&data_dir);
    tokio::fs::create_dir_all(&data_path).await.ok();

    let storage = Arc::new(msgpunk_storage::fs::FilesystemStorage::new(data_path));

    println!("Running on port 8080");
    HttpServer::new(move || {
        let state = Data::new(AppState {
            storage: storage.clone(),
        });
        actix_web::App::new()
            .app_data(state)
            .configure(configure)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test;
    use msgpunk_storage::fs::FilesystemStorage;

    fn test_storage() -> Arc<dyn Storage> {
        let dir = std::env::temp_dir().join(format!("msgpunk-test-{}", ulid::Ulid::new()));
        std::fs::create_dir_all(&dir).ok();
        Arc::new(FilesystemStorage::new(dir))
    }

    #[actix_web::test]
    async fn test_healthcheck() {
        let storage = test_storage();
        let state = Data::new(AppState { storage });
        let mut app = test::init_service(
            actix_web::App::new()
                .app_data(state)
                .configure(configure),
        )
        .await;

        let req = test::TestRequest::get().uri("/health").to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 200);
    }

    #[actix_web::test]
    async fn test_create_form_invalid_key_mismatch() {
        let storage = test_storage();
        let state = Data::new(AppState { storage });
        let mut app = test::init_service(
            actix_web::App::new()
                .app_data(state)
                .configure(configure),
        )
        .await;

        let body = CreateFormBody {
            age_recipient: "age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq".to_string(),
            ed25519_pubkey: "0000000000000000000000000000000000000000000000000000000000000000".to_string(),
            encrypted_structure: "dGVzdA==".to_string(),
            encrypted_password: "dGVzdA==".to_string(),
        };

        let req = test::TestRequest::post()
            .uri("/f/test-form")
            .set_json(&body)
            .to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 400);
    }

    #[actix_web::test]
    async fn test_submit_to_nonexistent_form() {
        let storage = test_storage();
        let state = Data::new(AppState { storage });
        let mut app = test::init_service(
            actix_web::App::new()
                .app_data(state)
                .configure(configure),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/s/no-such-form")
            .set_payload("armored ciphertext")
            .to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 404);
    }

    #[actix_web::test]
    async fn test_list_messages_requires_auth() {
        let storage = test_storage();
        let state = Data::new(AppState { storage });
        let mut app = test::init_service(
            actix_web::App::new()
                .app_data(state)
                .configure(configure),
        )
        .await;

        let req = test::TestRequest::get().uri("/s/test-form").to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_web::test]
    async fn test_get_message_requires_auth() {
        let storage = test_storage();
        let state = Data::new(AppState { storage });
        let mut app = test::init_service(
            actix_web::App::new()
                .app_data(state)
                .configure(configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/s/test-form/msg-1")
            .to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_web::test]
    async fn test_delete_message_requires_auth() {
        let storage = test_storage();
        let state = Data::new(AppState { storage });
        let mut app = test::init_service(
            actix_web::App::new()
                .app_data(state)
                .configure(configure),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri("/s/test-form/msg-1")
            .to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_web::test]
    async fn test_full_flow_with_real_crypto() {
        let storage = test_storage();
        let state = Data::new(AppState { storage });
        let mut app = test::init_service(
            actix_web::App::new()
                .app_data(state)
                .configure(configure),
        )
        .await;

        let phrase =
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let seed = msgpunk_crypto::identity::seed_from_phrase(phrase);
        let keys = msgpunk_crypto::identity::derive_all(&seed, 0);
        let form_id =
            msgpunk_crypto::form_id::compute_form_id(&keys.age_recipient.to_string(), 0);

        let body = CreateFormBody {
            age_recipient: keys.age_recipient.to_string(),
            ed25519_pubkey: hex::encode(keys.ed25519_pubkey),
            encrypted_structure: "dGVzdA==".to_string(),
            encrypted_password: "dGVzdA==".to_string(),
        };

        let req = test::TestRequest::post()
            .uri(&format!("/f/{form_id}"))
            .set_json(&body)
            .to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 201);

        let ciphertext = "age-encrypted-data";
        let req = test::TestRequest::post()
            .uri(&format!("/s/{form_id}"))
            .set_payload(ciphertext)
            .to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 202);

        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let message = format!("{}:{}", form_id, ts);
        let signing_key = msgpunk_crypto::identity::ed25519_signing_key_from_secret(&keys.secret);
        let sig = msgpunk_crypto::auth::sign(&signing_key, message.as_bytes());

        let req = test::TestRequest::get()
            .uri(&format!("/s/{form_id}?ts={ts}&sig={sig}"))
            .to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 200);

        let list: ListResponse = test::read_body_json(resp).await;
        assert_eq!(list.messages.len(), 1);
        let msg_id = &list.messages[0].msg_id;

        let req = test::TestRequest::get()
            .uri(&format!("/s/{form_id}/{msg_id}?ts={ts}&sig={sig}"))
            .to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 200);

        let body_bytes = test::read_body(resp).await;
        assert_eq!(body_bytes, "age-encrypted-data");

        let req = test::TestRequest::delete()
            .uri(&format!("/s/{form_id}/{msg_id}?ts={ts}&sig={sig}"))
            .to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 204);

        let req = test::TestRequest::get()
            .uri(&format!("/s/{form_id}?ts={ts}&sig={sig}"))
            .to_request();
        let resp = test::call_service(&mut app, req).await;
        assert_eq!(resp.status(), 200);
        let list: ListResponse = test::read_body_json(resp).await;
        assert_eq!(list.messages.len(), 0);
    }
}
