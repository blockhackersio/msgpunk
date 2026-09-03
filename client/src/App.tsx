import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  IonApp,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
} from '@ionic/react'

function App() {
  const [count, setCount] = useState(0)
  const [healthResult, setHealthResult] = useState<string | null>(null)

  async function handleHealthcheck() {
    try {
      const serverUrl = import.meta.env.VITE_MSGPUNK_SERVER_URL
      if (!serverUrl) {
        setHealthResult('Error: VITE_MSGPUNK_SERVER_URL not set')
        return
      }
      const result = await invoke<string>('check_health', { serverUrl })
      setHealthResult(result)
    } catch (e) {
      setHealthResult(`Error: ${e}`)
    }
  }

  return (
    <IonApp>
      <IonPage>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>Counter App</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '24px',
            }}
          >
            <IonCard style={{ width: '100%', maxWidth: '400px' }}>
              <IonCardHeader>
                <IonCardTitle style={{ textAlign: 'center' }}>
                  Count is {count}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '16px',
                }}
              >
                <IonButton
                  color="primary"
                  onClick={() => setCount((c) => c - 1)}
                >
                  -
                </IonButton>
                <IonButton
                  color="primary"
                  onClick={() => setCount((c) => c + 1)}
                >
                  +
                </IonButton>
              </IonCardContent>
            </IonCard>
            <IonButton
              color="danger"
              fill="outline"
              onClick={() => setCount(0)}
            >
              Reset
            </IonButton>

            <IonCard style={{ width: '100%', maxWidth: '400px' }}>
              <IonCardHeader>
                <IonCardTitle style={{ textAlign: 'center' }}>
                  Server Health
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ textAlign: 'center' }}>
                <IonButton onClick={handleHealthcheck}>
                  Check Health
                </IonButton>
                {healthResult && (
                  <p style={{ marginTop: '12px', fontSize: '14px' }}>
                    {healthResult}
                  </p>
                )}
              </IonCardContent>
            </IonCard>
          </div>
        </IonContent>
      </IonPage>
    </IonApp>
  )
}

export default App
