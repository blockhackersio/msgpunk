import { useState, useEffect } from 'react'
import { deriveKey, decrypt } from '@msgpunk/toolkit/aes-gcm'
import { encryptSubmissionPayload } from '@msgpunk/toolkit'
import { FormPlayer } from './components/FormPlayer'
import type { Form, Json } from './types'

function parseFormId(): string | null {
  const match = window.location.pathname.match(/^\/f\/(.+)$/)
  return match ? match[1] : null
}

function parsePassword(): string | null {
  const hash = window.location.hash
  return hash ? hash.slice(1) : null
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const TEST_FORM: Form = {
  id: 'test',
  title: 'Test Form',
  description: 'A test form for development',
  slug: 'test',
  theme: 'high-contrast',
  thank_you_message: 'Thank you for testing!',
  questions: [
    { id: 'name', type: 'short_text', title: 'What is your name?', required: true, placeholder: 'Enter your name' },
    { id: 'email', type: 'email', title: 'What is your email?', required: true, placeholder: 'you@example.com' },
    { id: 'message', type: 'long_text', title: 'Your Message', required: true, placeholder: 'Write something...' },
    {
      id: 'rating', type: 'dropdown', title: 'How did you hear about us?', required: true,
      options: ['Social Media', 'Friend', 'Search Engine'],
    },
    { id: 'agree', type: 'yes_no', title: 'Do you consent?', required: true },
  ],
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'no-password' }
  | { status: 'loaded'; form: Form; ageRecipient: string; formId: string }
  | { status: 'submit-error'; message: string }

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    const formId = parseFormId()
    const password = parsePassword()

    if (!formId) {
      setState({ status: 'error', message: 'Invalid URL: no form ID found.' })
      return
    }

    if (!password) {
      setState({ status: 'no-password' })
      return
    }

    if (password === 'test') {
      setState({ status: 'loaded', form: TEST_FORM, ageRecipient: '', formId })
      return
    }

    fetch(`/f/${formId}/data`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        return res.json() as Promise<{
          encrypted_structure: string
          age_recipient: string
          encrypted_password: string
        }>
      })
      .then((data) => {
        const key = deriveKey(password)
        const encrypted = base64ToBytes(data.encrypted_structure)
        const decrypted = decrypt(key, encrypted)
        const formObj = JSON.parse(decrypted) as Form
        console.log({ formObj });
        setState({ status: 'loaded', form: formObj, ageRecipient: data.age_recipient, formId })
      })
      .catch((err: unknown) => {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }, [])

  const handleSubmit = async (answers: Record<string, Json>) => {
    if (state.status !== 'loaded') return

    const stringAnswers: Record<string, string> = {}
    for (const [key, value] of Object.entries(answers)) {
      stringAnswers[key] = value === null || value === undefined ? '' : String(value)
    }

    if (!state.ageRecipient) return

    const { armored } = await encryptSubmissionPayload(state.ageRecipient, stringAnswers)
    const res = await fetch(`/s/${state.formId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: armored,
    })
    if (!res.ok) throw new Error(`Submission failed: ${res.status}`)
  }

  if (state.status === 'loading') {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        Loading...
      </div>
    )
  }

  if (state.status === 'no-password') {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        This form requires a password. Add #your-password to the URL.
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', color: 'red' }}>
        Error: {state.message}
      </div>
    )
  }

  if (state.status === 'submit-error') {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', color: 'red' }}>
        Submission error: {state.message}
      </div>
    )
  }

  return <FormPlayer form={state.form} onSubmit={handleSubmit} />
}
