import { useEffect, useRef, useState } from 'react'
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
  IonTextarea,
  IonIcon,
} from '@ionic/react'
import { copyOutline } from 'ionicons/icons'

export default function Onboarding() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [phrase, setPhrase] = useState('')
  const [generating, setGenerating] = useState(false)
  const [importMode, setImportMode] = useState(false)
  const [importPhrase, setImportPhrase] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLIonTextareaElement>(null)

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

  async function handleImport() {
    setImportError('')
    setImporting(true)
    try {
      const result = await invoke<string>('import_seed', { phrase: importPhrase.trim() })
      setPhrase(result)
    } catch (e) {
      setImportError(String(e))
    }
    setImporting(false)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(phrase)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
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
              !importMode ? (
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
                  <IonButton onClick={() => setImportMode(true)} fill="clear" size="small">
                    I already have a seed phrase
                  </IonButton>
                </>
              ) : (
                <>
                  <IonText>
                    <h2 style={{ textAlign: 'center' }}>Import Existing Seed Phrase</h2>
                    <p style={{ textAlign: 'center', color: 'var(--ion-color-medium)' }}>
                      Paste your 12, 18, or 24-word BIP-39 seed phrase below.
                    </p>
                  </IonText>
                  <IonTextarea
                    ref={textareaRef}
                    placeholder="Paste your seed phrase here..."
                    value={importPhrase}
                    onIonInput={(e) => { setImportPhrase(e.detail.value ?? ''); setImportError('') }}
                    rows={4}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '14px' }}
                    autoGrow
                  />
                  {importError && (
                    <IonText color="danger" style={{ fontSize: '13px', textAlign: 'center' }}>
                      {importError}
                    </IonText>
                  )}
                  <IonButton onClick={handleImport} disabled={importing || !importPhrase.trim()} size="large">
                    {importing ? 'Importing...' : 'Import Seed Phrase'}
                  </IonButton>
                  <IonButton onClick={() => setImportMode(false)} fill="clear" size="small">
                    Back to generate
                  </IonButton>
                </>
              )
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
                  <IonCardContent style={{ position: 'relative' }}>
                    <pre style={{
                      fontSize: '14px',
                      lineHeight: '1.6',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      userSelect: 'all',
                      margin: 0,
                      paddingRight: '32px',
                    }}>
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
                  <IonText color="success" style={{ fontSize: '13px', textAlign: 'center' }}>
                    Copied to clipboard!
                  </IonText>
                )}
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
