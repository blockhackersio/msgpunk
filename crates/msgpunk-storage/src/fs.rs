use std::path::PathBuf;

use chrono::Utc;

use crate::{BlobMeta, FormData, Result, Storage, StorageError};

pub struct FilesystemStorage {
    root: PathBuf,
}

impl FilesystemStorage {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn form_dir(&self, form_id: &str) -> PathBuf {
        self.root.join(form_id)
    }

    fn msgs_dir(&self, form_id: &str) -> PathBuf {
        self.form_dir(form_id).join("msgs")
    }

    fn form_path(&self, form_id: &str) -> PathBuf {
        self.form_dir(form_id).join("form.json")
    }

    fn blob_path(&self, form_id: &str, msg_id: &str) -> PathBuf {
        self.msgs_dir(form_id).join(format!("{msg_id}.age"))
    }
}

#[async_trait::async_trait]
impl Storage for FilesystemStorage {
    async fn store_form(&self, form_id: &str, data: &FormData) -> Result<()> {
        let dir = self.form_dir(form_id);
        tokio::fs::create_dir_all(&dir).await?;
        let json = serde_json::to_string_pretty(data)?;
        tokio::fs::write(self.form_path(form_id), json.as_bytes()).await?;
        Ok(())
    }

    async fn get_form(&self, form_id: &str) -> Result<Option<FormData>> {
        let path = self.form_path(form_id);
        if !path.exists() {
            return Ok(None);
        }
        let bytes = tokio::fs::read(&path).await?;
        let data = serde_json::from_slice(&bytes)?;
        Ok(Some(data))
    }

    async fn store_blob(
        &self,
        form_id: &str,
        msg_id: &str,
        ciphertext: &str,
        received_at: &str,
    ) -> Result<()> {
        let dir = self.msgs_dir(form_id);
        tokio::fs::create_dir_all(&dir).await?;

        let meta_path = dir.join(format!("{msg_id}.meta"));
        let meta = format!("received_at={received_at}");
        tokio::fs::write(&meta_path, meta.as_bytes()).await?;

        tokio::fs::write(self.blob_path(form_id, msg_id), ciphertext.as_bytes()).await?;
        Ok(())
    }

    async fn list_blobs(
        &self,
        form_id: &str,
        since: Option<&str>,
    ) -> Result<(Vec<BlobMeta>, String)> {
        let dir = self.msgs_dir(form_id);
        if !dir.exists() {
            return Ok((Vec::new(), String::new()));
        }

        let mut read_dir = tokio::fs::read_dir(&dir).await?;
        let mut blobs = Vec::new();
        let mut cursor = String::new();

        while let Some(entry) = read_dir.next_entry().await? {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("age") {
                continue;
            }

            let msg_id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .map(|s| s.to_string())
                .unwrap();

            if let Some(ref since_id) = since {
                if &msg_id[..] <= *since_id {
                    continue;
                }
            }

            let meta_path = dir.join(format!("{msg_id}.meta"));
            let received_at = if meta_path.exists() {
                let meta_str = tokio::fs::read_to_string(&meta_path).await.unwrap_or_default();
                meta_str
                    .strip_prefix("received_at=")
                    .unwrap_or("")
                    .to_string()
            } else {
                Utc::now().to_rfc3339()
            };

            let size = tokio::fs::metadata(&path).await.map(|m| m.len()).unwrap_or(0);

            cursor = msg_id.clone();
            blobs.push(BlobMeta {
                msg_id,
                size,
                received_at,
            });
        }

        blobs.sort_by(|a, b| a.msg_id.cmp(&b.msg_id));

        Ok((blobs, cursor))
    }

    async fn get_blob(&self, form_id: &str, msg_id: &str) -> Result<String> {
        let path = self.blob_path(form_id, msg_id);
        if !path.exists() {
            return Err(StorageError::MessageNotFound(msg_id.to_string()));
        }
        let bytes = tokio::fs::read_to_string(&path).await?;
        Ok(bytes)
    }

    async fn delete_blob(&self, form_id: &str, msg_id: &str) -> Result<()> {
        let path = self.blob_path(form_id, msg_id);
        if !path.exists() {
            return Err(StorageError::MessageNotFound(msg_id.to_string()));
        }
        tokio::fs::remove_file(&path).await?;

        let meta_path = self.msgs_dir(form_id).join(format!("{msg_id}.meta"));
        if meta_path.exists() {
            tokio::fs::remove_file(&meta_path).await?;
        }

        Ok(())
    }
}
