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
import { arrowBack } from 'ionicons/icons'

export default function Settings() {
  const navigate = useNavigate()
  const [phrase, setPhrase] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    invoke<string>('get_seed_phrase')
      .then(setPhrase)
      .catch((e) => {
        console.error('get_seed_phrase failed:', e)
        navigate('/', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [])

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
              <IonCardContent>
                <pre
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    userSelect: 'all',
                    margin: 0,
                  }}
                >
                  {phrase}
                </pre>
              </IonCardContent>
            </IonCard>
            </div>
        )}
      </IonContent>
    </IonPage>
  )
}
