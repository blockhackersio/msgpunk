import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { SERVER_URL } from '../config'
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
  IonAlert,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
} from '@ionic/react'
import { settingsOutline, createOutline, trashOutline, add } from 'ionicons/icons'
import type { RefresherEventDetail } from '@ionic/react'

interface FormInfo {
  form_id: string
  display_name: string
  key_index: number
  created_at: string
}

export default function FormsList() {
  const navigate = useNavigate()
  const [forms, setForms] = useState<FormInfo[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingForm, setEditingForm] = useState<FormInfo | null>(null)
  const [newName, setNewName] = useState('')
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<FormInfo | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [loading, setLoading] = useState(true)


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

  async function handleRename() {
    if (!editingForm || !editName.trim()) return
    try {
      await invoke('rename_form', { formId: editingForm.form_id, displayName: editName.trim() })
      setShowEditModal(false)
      setEditingForm(null)
      await loadForms()
    } catch (e) {
      setToastMsg(`Failed: ${e}`)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    if (!serverUrl) {
      setToastMsg('VITE_MSGPUNK_SERVER_URL not set')
      return
    }
    try {
      await invoke('delete_form', { formId: deleteTarget.form_id, serverUrl })
      setDeleteTarget(null)
      await loadForms()
      setToastMsg('Form deleted')
    } catch (e) {
      setToastMsg(`Failed: ${e}`)
    }
  }

  function handleRefresh(e: CustomEvent<RefresherEventDetail>) {
    loadForms().then(() => e.detail.complete())
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
            {forms.map((form) => (
              <IonItem
                key={form.form_id}
                onClick={() => navigate(`/forms/${form.form_id}/replies`)}
                style={{ cursor: 'pointer' }}
              >
                <IonLabel>
                  <h2>{form.display_name}</h2>
                  <p>{new Date(form.created_at).toLocaleDateString()}</p>
                </IonLabel>
                <IonButton
                  slot="end"
                  fill="clear"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingForm(form)
                    setEditName(form.display_name)
                    setShowEditModal(true)
                  }}
                >
                  <IonIcon icon={createOutline} />
                </IonButton>
                <IonButton
                  slot="end"
                  fill="clear"
                  color="danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(form)
                  }}
                >
                  <IonIcon icon={trashOutline} />
                </IonButton>
              </IonItem>
            ))}
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

        <IonModal isOpen={showEditModal} onDidDismiss={() => { setShowEditModal(false); setEditingForm(null) }}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Rename Form</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowEditModal(false)}>Cancel</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px' }}>
              <IonInput
                label="Display Name"
                labelPlacement="stacked"
                value={editName}
                onIonInput={(e) => setEditName(e.detail.value ?? '')}
              />
              <IonButton onClick={handleRename} disabled={!editName.trim()}>
                Save
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonAlert
          isOpen={!!deleteTarget}
          onDidDismiss={() => setDeleteTarget(null)}
          header="Delete Form?"
          message={`Delete "${deleteTarget?.display_name}" and all its messages? This cannot be undone.`}
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
