import { useState, useEffect } from 'react';
import { deriveKey, decrypt } from '@msgpunk/toolkit/aes-gcm';

function parseFormId(): string | null {
  const match = window.location.pathname.match(/^\/f\/(.+)$/);
  return match ? match[1] : null;
}

function parsePassword(): string | null {
  const hash = window.location.hash;
  return hash ? hash.slice(1) : null;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'no-password' }
  | { status: 'loaded'; structure: unknown };

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const formId = parseFormId();
    const password = parsePassword();

    if (!formId) {
      setState({ status: 'error', message: 'Invalid URL: no form ID found.' });
      return;
    }

    if (!password) {
      setState({ status: 'no-password' });
      return;
    }

    fetch(`/f/${formId}/data`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json() as Promise<{
          encrypted_structure: string;
          age_recipient: string;
          encrypted_password: string;
        }>;
      })
      .then((data) => {
        const key = deriveKey(password);
        const encrypted = base64ToBytes(data.encrypted_structure);
        const decrypted = decrypt(key, encrypted);
        const structure = JSON.parse(decrypted);
        setState({ status: 'loaded', structure });
      })
      .catch((err: unknown) => {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }, []);

  if (state.status === 'loading') {
    return <div style={{ padding: '2rem', fontFamily: 'monospace' }}>Loading...</div>;
  }

  if (state.status === 'no-password') {
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
        This form requires a password. Add #your-password to the URL.
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', color: 'red' }}>
        Error: {state.message}
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <pre>{JSON.stringify(state.structure, null, 2)}</pre>
    </div>
  );
}
