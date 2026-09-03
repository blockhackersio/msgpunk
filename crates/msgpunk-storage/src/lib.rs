use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormData {
    pub age_recipient: String,
    pub ed25519_pubkey: String,
    pub encrypted_structure: String,
    pub encrypted_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlobMeta {
    pub msg_id: String,
    pub size: u64,
    pub received_at: String,
}

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("form not found: {0}")]
    FormNotFound(String),
    #[error("message not found: {0}")]
    MessageNotFound(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, StorageError>;

pub mod fs;

#[async_trait::async_trait]
pub trait Storage: Send + Sync {
    async fn store_form(&self, form_id: &str, data: &FormData) -> Result<()>;
    async fn get_form(&self, form_id: &str) -> Result<Option<FormData>>;
    async fn store_blob(
        &self,
        form_id: &str,
        msg_id: &str,
        ciphertext: &str,
        received_at: &str,
    ) -> Result<()>;
    async fn list_blobs(
        &self,
        form_id: &str,
        since: Option<&str>,
    ) -> Result<(Vec<BlobMeta>, String)>;
    async fn get_blob(&self, form_id: &str, msg_id: &str) -> Result<String>;
    async fn delete_blob(&self, form_id: &str, msg_id: &str) -> Result<()>;
}
