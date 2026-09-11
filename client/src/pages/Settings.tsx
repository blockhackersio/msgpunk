import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonLoading,
  IonText,
  IonAlert,
} from '@ionic/react'
import { arrowBack, copyOutline, trashOutline } from 'ionicons/icons'

export default function Settings() {
  const navigate = useNavigate()
  const [phrase, setPhrase] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    invoke<string>('get_seed_phrase')
      .then(setPhrase)
      .catch((e) => {
        console.error('get_seed_phrase failed:', e)
        navigate('/', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(phrase)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await invoke('reset_storage')
      navigate('/', { replace: true })
    } catch (e) {
      console.error('reset_storage failed:', e)
    }
    setDeleting(false)
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
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonLoading isOpen={loading} />
        {!loading && (
          <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <IonText>
              <h2>Secret Recovery Phrase</h2>
              <p style={{ color: 'var(--ion-color-danger)' }}>
                This is your secret recovery phrase. Never share it with anyone.
                Keep it stored somewhere safe and offline.
              </p>
            </IonText>

            <IonCard>
              <IonCardContent style={{ position: 'relative' }}>
                <pre
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    userSelect: 'all',
                    margin: 0,
                    paddingRight: '32px',
                  }}
                >
                  {phrase}
                </pre>
                <IonButton
                  onClick={handleCopy}
                  fill="clear"
                  size="small"
                  style={{ position: 'absolute', top: '4px', right: '4px', margin: 0 }}
                >
                  <IonIcon icon={copyOutline} slot="icon-only" />
                </IonButton>
              </IonCardContent>
            </IonCard>
            {copied && (
              <IonText color="success" style={{ fontSize: '13px' }}>
                Copied to clipboard!
              </IonText>
            )}

            <div style={{ marginTop: '32px' }}>
              <IonButton
                onClick={() => setShowDeleteAlert(true)}
                color="danger"
                fill="outline"
                disabled={deleting}
              >
                <IonIcon icon={trashOutline} slot="start" />
                Delete Seed Phrase & Reset
              </IonButton>
            </div>
            </div>
        )}

        <IonAlert
          isOpen={showDeleteAlert}
          onDidDismiss={() => setShowDeleteAlert(false)}
          header="Delete seed phrase?"
          message="This will permanently delete your seed phrase and all saved forms. Make sure you have backed up your seed phrase before proceeding."
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            { text: 'Delete Everything', role: 'destructive', handler: handleDelete },
          ]}
        />
      </IonContent>
    </IonPage>
  )
}
