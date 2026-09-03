import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonText,
  IonCard,
  IonCardContent,
  IonLoading,
} from '@ionic/react'

export default function Onboarding() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [phrase, setPhrase] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    invoke<boolean>('is_onboarded')
      .then((onboarded) => {
        if (onboarded) {
          navigate('/forms', { replace: true })
        }
      })
      .catch((e) => console.error('is_onboarded failed:', e))
      .finally(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const result = await invoke<string>('generate_seed')
      setPhrase(result)
    } catch (e) {
      console.error(e)
    }
    setGenerating(false)
  }

  async function handleContinue() {
    navigate('/forms', { replace: true })
  }

  return (
    <IonPage>
      <IonLoading isOpen={loading} message="Loading..." />
      {!loading && (
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>MsgPunk</IonTitle>
          </IonToolbar>
        </IonHeader>
      )}
      <IonContent className="ion-padding">
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '24px', maxWidth: '500px', margin: '0 auto' }}>
            {!phrase ? (
              <>
                <IonText>
                  <h2 style={{ textAlign: 'center' }}>Welcome to MsgPunk</h2>
                  <p style={{ textAlign: 'center', color: 'var(--ion-color-medium)' }}>
                    Generate a secret recovery phrase to get started.
                    This phrase is your identity — keep it safe and never share it.
                  </p>
                </IonText>
                <IonButton onClick={handleGenerate} disabled={generating} size="large">
                  {generating ? 'Generating...' : 'Generate Secret Phrase'}
                </IonButton>
              </>
            ) : (
              <>
                <IonText>
                  <h2 style={{ textAlign: 'center' }}>Your Secret Recovery Phrase</h2>
                  <p style={{ textAlign: 'center', color: 'var(--ion-color-danger)' }}>
                    Write this down and store it somewhere safe.
                    If you lose this phrase, you will lose access to your forms and messages.
                  </p>
                </IonText>
                <IonCard style={{ width: '100%' }}>
                  <IonCardContent>
                    <pre style={{
                      fontSize: '14px',
                      lineHeight: '1.6',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      userSelect: 'all',
                      margin: 0,
                    }}>
                      {phrase}
                    </pre>
                  </IonCardContent>
                </IonCard>
                <IonText color="medium" style={{ textAlign: 'center', fontSize: '13px' }}>
                  You can view this phrase again later in Settings.
                </IonText>
                <IonButton onClick={handleContinue} size="large" style={{ marginTop: '8px' }}>
                  I've Saved It — Continue
                </IonButton>
              </>
            )}
          </div>
        )}
      </IonContent>
    </IonPage>
  )
}
