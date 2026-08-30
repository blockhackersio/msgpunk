import { useState } from 'react'
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
          </div>
        </IonContent>
      </IonPage>
    </IonApp>
  )
}

export default App
