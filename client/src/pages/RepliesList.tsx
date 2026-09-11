import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { SERVER_URL } from '../config'
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
  IonSegment,
  IonSegmentButton,
  IonCard,
  IonCardContent,
  IonInput,
  IonText,
  IonFooter,
} from '@ionic/react'
import { trashOutline, arrowBack, mailOutline, createOutline, shareOutline, copyOutline } from 'ionicons/icons'

interface ReplyInfo {
  msg_id: string
  sender_name: string
  received_at: string
}

interface FormInfo {
  form_id: string
  display_name: string
  key_index: number
  age_recipient: string
  created_at: string
}

export default function RepliesList() {
  const { formId } = useParams<{ formId: string }>()
  const navigate = useNavigate()
  const [replies, setReplies] = useState<ReplyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<ReplyInfo | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [password, setPassword] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [selectedTab, setSelectedTab] = useState('inbox')
  const [formInfo, setFormInfo] = useState<FormInfo | null>(null)
  const [editName, setEditName] = useState('')
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [deletingForm, setDeletingForm] = useState(false)
  const [copiedEmbed, setCopiedEmbed] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const serverUrl = SERVER_URL

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
      .then((url) => {
        setFormUrl(url)
        const hashIdx = url.indexOf('#')
        if (hashIdx !== -1) setPassword(url.slice(hashIdx + 1))
      })
      .catch(() => { })
    invoke<FormInfo>('get_form', { formId })
      .then((info) => {
        setFormInfo(info)
        setEditName(info.display_name)
      })
      .catch(() => { })
  }, [formId, serverUrl])

  async function handleDeleteReply() {
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

  async function handleRename() {
    if (!formInfo || !editName.trim()) return
    try {
      await invoke('rename_form', { formId, displayName: editName.trim() })
      setFormInfo({ ...formInfo, display_name: editName.trim() })
      setToastMsg('Form renamed')
    } catch (e) {
      setToastMsg(`Failed: ${e}`)
    }
  }

  async function handleDeleteForm() {
    if (!serverUrl) return
    setDeletingForm(true)
    try {
      await invoke('delete_form', { formId, serverUrl })
      navigate('/forms', { replace: true })
    } catch (e) {
      setToastMsg(`Failed: ${e}`)
    }
    setDeletingForm(false)
  }

  function handleRefresh(e: CustomEvent) {
    loadReplies().then(() => (e as any).detail.complete())
  }

  async function handleCopyEmbed() {
    if (!serverUrl || !formId || !password) return
    const base = serverUrl.replace(/\/+$/, '')
    const snippet = `<script src="${base}/embed.js"></script>\n<button class="msgpunk-form" data-form="${formId}" data-password="${password}">Send me a message</button>`
    try {
      await navigator.clipboard.writeText(snippet)
      setCopiedEmbed(true)
      setTimeout(() => setCopiedEmbed(false), 2000)
    } catch (e) {
      setToastMsg(`Failed: ${e}`)
    }
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(formUrl)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch (e) {
      setToastMsg(`Failed: ${e}`)
    }
  }

  const embedCode = serverUrl && formId && password
    ? `<script src="${serverUrl.replace(/\/+$/, '')}/embed.js"></script>\n<button class="msgpunk-form" data-form="${formId}" data-password="${password}">Send me a message</button>`
    : ''

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => navigate('/forms')}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>{formInfo?.display_name ?? 'Replies'}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {selectedTab === 'inbox' && (
          <>
            <IonLoading isOpen={loading} message="Loading replies..." />
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
                { text: 'Delete', role: 'destructive', handler: handleDeleteReply },
              ]}
            />
          </>
        )}

        {selectedTab === 'edit' && (
          <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '16px' }}>
            <IonText>
              <h2>Edit Form</h2>
            </IonText>
            <IonInput
              label="Display Name"
              labelPlacement="stacked"
              value={editName}
              onIonInput={(e) => setEditName(e.detail.value ?? '')}
            />
            <IonButton onClick={handleRename} disabled={!editName.trim() || editName.trim() === formInfo?.display_name}>
              Save Name
            </IonButton>

            <div style={{ borderTop: '1px solid var(--ion-color-step-200)', paddingTop: '24px' }}>
              <IonButton
                onClick={() => setShowDeleteAlert(true)}
                color="danger"
                fill="outline"
                disabled={deletingForm}
              >
                <IonIcon icon={trashOutline} slot="start" />
                Delete Form
              </IonButton>
            </div>

            <IonAlert
              isOpen={showDeleteAlert}
              onDidDismiss={() => setShowDeleteAlert(false)}
              header="Delete Form?"
              message={`Delete "${formInfo?.display_name}" and all its messages? This cannot be undone.`}
              buttons={[
                { text: 'Cancel', role: 'cancel' },
                { text: 'Delete', role: 'destructive', handler: handleDeleteForm },
              ]}
            />
          </div>
        )}

        {selectedTab === 'share' && (
          <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '16px' }}>
            <IonText>
              <h2>Share Form</h2>
            </IonText>

            <IonCard>
              <IonCardContent>
                <IonText>
                  <strong>Embed Code</strong>
                </IonText>
                <div style={{ position: 'relative', marginTop: '8px' }}>
                  <pre style={{
                    fontSize: '12px',
                    lineHeight: '1.5',
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    background: 'var(--ion-color-step-100)',
                    padding: '12px',
                    borderRadius: '8px',
                    margin: 0,
                    paddingRight: '44px',
                  }}>
                    {embedCode || 'Loading...'}
                  </pre>
                  <IonButton
                    onClick={handleCopyEmbed}
                    fill="clear"
                    size="small"
                    disabled={!embedCode}
                    style={{ position: 'absolute', top: '8px', right: '8px', margin: 0 }}
                  >
                    <IonIcon icon={copyOutline} slot="icon-only" />
                  </IonButton>
                </div>
                {copiedEmbed && (
                  <IonText color="success" style={{ fontSize: '13px' }}>
                    Embed code copied!
                  </IonText>
                )}
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardContent>
                <IonText>
                  <strong>Form URL</strong>
                </IonText>
                <div style={{ position: 'relative', marginTop: '8px' }}>
                  <pre style={{
                    fontSize: '12px',
                    lineHeight: '1.5',
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    background: 'var(--ion-color-step-100)',
                    padding: '12px',
                    borderRadius: '8px',
                    margin: 0,
                    paddingRight: '44px',
                  }}>
                    {formUrl || 'Loading...'}
                  </pre>
                  <IonButton
                    onClick={handleCopyUrl}
                    fill="clear"
                    size="small"
                    disabled={!formUrl}
                    style={{ position: 'absolute', top: '8px', right: '8px', margin: 0 }}
                  >
                    <IonIcon icon={copyOutline} slot="icon-only" />
                  </IonButton>
                </div>
                {copiedUrl && (
                  <IonText color="success" style={{ fontSize: '13px' }}>
                    URL copied!
                  </IonText>
                )}
              </IonCardContent>
            </IonCard>
          </div>
        )}

        <IonToast
          isOpen={!!toastMsg}
          message={toastMsg}
          duration={6000}
          buttons={[{ text: 'Dismiss', role: 'cancel' }]}
          onDidDismiss={() => setToastMsg('')}
        />
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <IonSegment value={selectedTab} onIonChange={(e) => setSelectedTab(e.detail.value as string)}>
            <IonSegmentButton value="inbox">
              <IonIcon icon={mailOutline} />
              <IonLabel>Inbox</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="edit">
              <IonIcon icon={createOutline} />
              <IonLabel>Edit</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="share">
              <IonIcon icon={shareOutline} />
              <IonLabel>Share</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  )
}