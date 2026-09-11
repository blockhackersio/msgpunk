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
} from '@ionic/react'
import { arrowBack, copyOutline } from 'ionicons/icons'

export default function Settings() {
  const navigate = useNavigate()
  const [phrase, setPhrase] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

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
            </div>
        )}
      </IonContent>
    </IonPage>
  )
}
