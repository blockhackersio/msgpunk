import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  IonToast,
  IonText,
} from '@ionic/react'
import { arrowBack } from 'ionicons/icons'

interface ReplyDetail {
  msg_id: string
  fields: Record<string, string>
  submitted_at: string
  received_at: string
}

const FIELD_LABELS: Record<string, string> = {
  signal: 'Signal Account',
  name: 'What should I call you?',
  message: 'Your Message',
}

export default function ReplyDetail() {
  const { formId, msgId } = useParams<{ formId: string; msgId: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ReplyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')

  const serverUrl = import.meta.env.VITE_MSGPUNK_SERVER_URL

  useEffect(() => {
    if (!serverUrl) {
      setToastMsg('VITE_MSGPUNK_SERVER_URL not set')
      setLoading(false)
      return
    }
    invoke<ReplyDetail>('get_reply', { formId, msgId, serverUrl })
      .then(setDetail)
      .catch((e) => setToastMsg(`Failed: ${e}`))
      .finally(() => setLoading(false))
  }, [formId, msgId, serverUrl])

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => navigate(-1)}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Reply</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonLoading isOpen={loading} message="Loading reply..." />

        {detail && (
          <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {detail.submitted_at && (
              <IonText color="medium" style={{ textAlign: 'right', fontSize: '13px' }}>
                Submitted: {new Date(detail.submitted_at).toLocaleString()}
              </IonText>
            )}
            {Object.entries(FIELD_LABELS).map(([key, label]) => (
              <IonCard key={key}>
                <IonCardContent>
                  <IonText color="medium" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {label}
                  </IonText>
                  <p style={{ fontSize: '16px', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                    {detail.fields[key] || ''}
                  </p>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <IonToast
          isOpen={!!toastMsg}
          message={toastMsg}
          duration={3000}
          onDidDismiss={() => setToastMsg('')}
        />
      </IonContent>
    </IonPage>
  )
}
