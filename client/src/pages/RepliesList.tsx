import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonIcon,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonToast,
  IonAlert,
  IonRefresher,
  IonRefresherContent,
  IonLoading,
} from '@ionic/react'
import { trashOutline, arrowBack, copyOutline } from 'ionicons/icons'

interface ReplyInfo {
  msg_id: string
  sender_name: string
  received_at: string
}

export default function RepliesList() {
  const { formId } = useParams<{ formId: string }>()
  const navigate = useNavigate()
  const [replies, setReplies] = useState<ReplyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<ReplyInfo | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [formUrl, setFormUrl] = useState('')

  const serverUrl = import.meta.env.VITE_MSGPUNK_SERVER_URL

  const loadReplies = useCallback(async () => {
    if (!serverUrl) {
      setToastMsg('VITE_MSGPUNK_SERVER_URL not set')
      setLoading(false)
      return
    }
    try {
      const result = await invoke<ReplyInfo[]>('list_replies', { formId, serverUrl })
      setReplies(result)
    } catch (e) {
      setToastMsg(`Failed to load: ${e}`)
    }
    setLoading(false)
  }, [formId, serverUrl])

  useEffect(() => {
    loadReplies()
  }, [loadReplies])

  useEffect(() => {
    if (!serverUrl || !formId) return
    invoke<string>('get_form_url', { formId, serverUrl })
      .then(setFormUrl)
      .catch(() => {})
  }, [formId, serverUrl])

  async function handleDelete() {
    if (!deleteTarget || !serverUrl) return
    try {
      await invoke('delete_reply', { formId, msgId: deleteTarget.msg_id, serverUrl })
      setDeleteTarget(null)
      await loadReplies()
      setToastMsg('Reply deleted')
    } catch (e) {
      setToastMsg(`Failed: ${e}`)
    }
  }

  function handleRefresh(e: CustomEvent) {
    loadReplies().then(() => (e as any).detail.complete())
  }

  async function handleCopyUrl() {
    if (!serverUrl || !formId) return
    try {
      const url = await invoke<string>('get_form_url', { formId, serverUrl })
      await navigator.clipboard.writeText(url)
      setToastMsg(url)
    } catch (e) {
      setToastMsg(`Failed: ${e}`)
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => navigate('/forms')}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Replies</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleCopyUrl}>
              <IonIcon icon={copyOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonLoading isOpen={loading} message="Loading replies..." />

        {formUrl && (
          <div style={{
            background: 'var(--ion-color-light)',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '0.8em',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
          }}>
            {formUrl}
          </div>
        )}

        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {replies.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%' }}>
            <p style={{ color: 'var(--ion-color-medium)' }}>No replies yet.</p>
          </div>
        ) : (
          <IonList>
            {replies.map((reply) => (
              <IonItem
                key={reply.msg_id}
                onClick={() => navigate(`/forms/${formId}/replies/${reply.msg_id}`)}
                style={{ cursor: 'pointer' }}
              >
                <IonLabel>
                  <h2>Response from '{reply.sender_name}'</h2>
                  <p>{new Date(reply.received_at).toLocaleString()}</p>
                </IonLabel>
                <IonButton
                  slot="end"
                  fill="clear"
                  color="danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(reply)
                  }}
                >
                  <IonIcon icon={trashOutline} />
                </IonButton>
              </IonItem>
            ))}
          </IonList>
        )}

        <IonAlert
          isOpen={!!deleteTarget}
          onDidDismiss={() => setDeleteTarget(null)}
          header="Delete Reply?"
          message="This cannot be undone."
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            { text: 'Delete', role: 'destructive', handler: handleDelete },
          ]}
        />

        <IonToast
          isOpen={!!toastMsg}
          message={toastMsg}
          duration={6000}
          buttons={[{ text: 'Dismiss', role: 'cancel' }]}
          onDidDismiss={() => setToastMsg('')}
        />
      </IonContent>
    </IonPage>
  )
}
