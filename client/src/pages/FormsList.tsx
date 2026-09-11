import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { SERVER_URL } from '../config'
import { generateAvatar } from '../utils/avatar'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonModal,
  IonInput,
  IonToast,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  IonCard,
  IonCardContent,
  IonText,
} from '@ionic/react'
import { settingsOutline, openOutline, add, copyOutline, closeOutline } from 'ionicons/icons'
import type { RefresherEventDetail } from '@ionic/react'

interface FormInfo {
  form_id: string
  display_name: string
  key_index: number
  age_recipient: string
  created_at: string
}

export default function FormsList() {
  const navigate = useNavigate()
  const [forms, setForms] = useState<FormInfo[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [identityTarget, setIdentityTarget] = useState<FormInfo | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  const avatars = useMemo(() => {
    const map = new Map<string, ReturnType<typeof generateAvatar>>()
    for (const form of forms) {
      map.set(form.form_id, generateAvatar(form.age_recipient))
    }
    return map
  }, [forms])


  const serverUrl = SERVER_URL

  const loadForms = useCallback(async () => {
    try {
      const result = await invoke<FormInfo[]>('list_forms')
      setForms(result)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadForms()
  }, [loadForms])

  async function handleAddForm() {
    if (!newName.trim()) return
    if (!serverUrl) {
      setToastMsg('VITE_MSGPUNK_SERVER_URL not set')
      return
    }
    try {
      const url = await invoke<string>('create_form', { displayName: newName.trim(), serverUrl })
      setShowAddModal(false)
      setNewName('')
      await loadForms()
      setToastMsg(url)
    } catch (e) {
      setToastMsg(`Failed: ${e}`)
    }
  }

  function handleRefresh(e: CustomEvent<RefresherEventDetail>) {
    loadForms().then(() => e.detail.complete())
  }

  async function handleCopyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>My Forms</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => navigate('/settings')}>
              <IonIcon icon={settingsOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {!loading && forms.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', gap: '16px' }}>
            <p style={{ color: 'var(--ion-color-medium)', textAlign: 'center' }}>
              No forms yet. Tap + to create your first form.
            </p>
          </div>
        ) : (
          <IonList>
            {forms.map((form) => {
              const avatar = avatars.get(form.form_id)!
              return (
              <IonItem
                key={form.form_id}
                onClick={() => navigate(`/forms/${form.form_id}/replies`)}
                style={{ cursor: 'pointer' }}
              >
                <div
                  slot="start"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIdentityTarget(form)
                  }}
                  dangerouslySetInnerHTML={{ __html: avatar.svg }}
                />
                <IonLabel>
                  <h2>{form.display_name}</h2>
                  <p>{avatar.slug}</p>
                </IonLabel>
                <IonButton
                  slot="end"
                  fill="clear"
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      const url = await invoke<string>('get_form_url', { formId: form.form_id, serverUrl })
                      await openUrl(url)
                    } catch (err) {
                      setToastMsg(`Failed to open: ${err}`)
                    }
                  }}
                >
                  <IonIcon icon={openOutline} />
                </IonButton>
              </IonItem>
              )
            })}
          </IonList>
        )}

        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          <IonFabButton onClick={() => setShowAddModal(true)}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <IonModal isOpen={showAddModal} onDidDismiss={() => { setShowAddModal(false); setNewName('') }}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>New Form</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowAddModal(false)}>Cancel</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px' }}>
              <IonInput
                label="Display Name"
                labelPlacement="stacked"
                placeholder="e.g. Contact Me"
                value={newName}
                onIonInput={(e) => setNewName(e.detail.value ?? '')}
              />
              <IonButton onClick={handleAddForm} disabled={!newName.trim()}>
                Publish to Server
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={!!toastMsg}
          message={toastMsg}
          duration={6000}
          buttons={[{ text: 'Dismiss', role: 'cancel' }]}
          onDidDismiss={() => setToastMsg('')}
        />

        <IonModal
          isOpen={!!identityTarget}
          onDidDismiss={() => { setIdentityTarget(null); setCopiedKey(false) }}
        >
          {identityTarget && (() => {
            const av = generateAvatar(identityTarget.age_recipient)
            return (
              <>
                <IonHeader>
                  <IonToolbar>
                    <IonButtons slot="end">
                      <IonButton onClick={() => { setIdentityTarget(null); setCopiedKey(false) }}>
                        <IonIcon icon={closeOutline} />
                      </IonButton>
                    </IonButtons>
                    <IonTitle>Identity</IonTitle>
                  </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', paddingTop: '24px' }}>
                    <div
                      style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                      }}
                      dangerouslySetInnerHTML={{ __html: av.svg }}
                    />
                    <IonText>
                      <h2 style={{ textAlign: 'center', margin: 0 }}>{av.slug}</h2>
                    </IonText>
                    <IonCard style={{ width: '100%' }}>
                      <IonCardContent style={{ position: 'relative' }}>
                        <pre style={{
                          fontSize: '13px',
                          lineHeight: '1.5',
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace',
                          margin: 0,
                          paddingRight: '32px',
                        }}>
                          {identityTarget.age_recipient}
                        </pre>
                        <IonButton
                          onClick={() => handleCopyKey(identityTarget.age_recipient)}
                          fill="clear"
                          size="small"
                          style={{ position: 'absolute', top: '4px', right: '4px', margin: 0 }}
                        >
                          <IonIcon icon={copyOutline} slot="icon-only" />
                        </IonButton>
                      </IonCardContent>
                    </IonCard>
                    {copiedKey && (
                      <IonText color="success" style={{ fontSize: '13px' }}>
                        Age key copied to clipboard!
                      </IonText>
                    )}
                    <IonText color="medium" style={{ textAlign: 'center', fontSize: '13px' }}>
                      This is the public encryption key for <strong>{identityTarget.display_name}</strong>.
                      Share it so others can send you encrypted messages.
                    </IonText>
                  </div>
                </IonContent>
              </>
            )
          })()}
        </IonModal>
      </IonContent>
    </IonPage>
  )
}
