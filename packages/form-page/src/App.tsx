import { useState, useEffect, useCallback } from 'react';
import { deriveKey, decrypt } from '@msgpunk/toolkit/aes-gcm';
import { encryptSubmissionPayload } from '@msgpunk/toolkit';

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
  | { status: 'loaded'; formObj: Record<string, unknown>; ageRecipient: string; formId: string }
  | { status: 'submitting' }
  | { status: 'submitted' }
  | { status: 'submit-error'; message: string };

interface Block {
  id: string;
  name: string;
  attributes?: Record<string, unknown>;
  innerBlocks?: Block[];
}

const TEST_FORM: Record<string, unknown> = {
  blocks: [
    { id: "name", name: "short-text", attributes: { label: "Your Name", required: true, placeholder: "Enter your name" } },
    { id: "email", name: "email", attributes: { label: "Email", required: true, placeholder: "you@example.com" } },
    { id: "message", name: "long-text", attributes: { label: "Message", required: true, placeholder: "Write something..." } },
    {
      id: "rating", name: "multiple-choice",
      attributes: {
        label: "How did you hear about us?", required: true,
        choices: [
          { value: "social", label: "Social Media" },
          { value: "friend", label: "Friend" },
          { value: "search", label: "Search Engine" },
        ],
      },
    },
    { id: "agree", name: "legal", attributes: { label: "Consent", required: true, yesLabel: "I agree", noLabel: "I disagree" } },
  ],
  settings: { disableProgressBar: false, disableWheelSwiping: false, disableNavigationArrows: false, animationDirection: "vertical" },
};

function BlockField({ block, value, onChange, error }: {
  block: Block;
  value: string;
  onChange: (id: string, val: string) => void;
  error?: string;
}) {
  const attrs = block.attributes ?? {};
  const label = (attrs.label as string) ?? block.id;
  const required = !!attrs.required;
  const placeholder = (attrs.placeholder as string) || '';

  const shared = { id: block.id, value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(block.id, e.target.value) };

  const renderInput = () => {
    switch (block.name) {
      case 'long-text':
        return <textarea {...shared} placeholder={placeholder} rows={4} style={inputStyle} />;
      case 'email':
        return <input {...shared} type="email" placeholder={placeholder} style={inputStyle} />;
      case 'number':
        return <input {...shared} type="number" placeholder={placeholder} style={inputStyle} />;
      case 'website':
        return <input {...shared} type="url" placeholder={placeholder} style={inputStyle} />;
      case 'date':
        return <input {...shared} type="date" style={inputStyle} />;
      case 'dropdown':
        return (
          <select {...shared} style={inputStyle}>
            <option value="">Select...</option>
            {((attrs.choices as Array<{ value: string; label: string }>) ?? []).map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        );
      case 'multiple-choice':
        return (
          <div style={{ marginTop: 8 }}>
            {((attrs.choices as Array<{ value: string; label: string }>) ?? []).map((c) => (
              <label key={c.value} style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={block.id}
                  value={c.value}
                  checked={value === c.value}
                  onChange={() => onChange(block.id, c.value)}
                  style={{ marginRight: 8 }}
                />
                {c.label}
              </label>
            ))}
          </div>
        );
      case 'legal':
        return (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }}>
              <input
                type="radio"
                name={block.id}
                value="yes"
                checked={value === 'yes'}
                onChange={() => onChange(block.id, 'yes')}
                style={{ marginRight: 8 }}
              />
              {(attrs.yesLabel as string) ?? 'Yes'}
            </label>
            <label style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }}>
              <input
                type="radio"
                name={block.id}
                value="no"
                checked={value === 'no'}
                onChange={() => onChange(block.id, 'no')}
                style={{ marginRight: 8 }}
              />
              {(attrs.noLabel as string) ?? 'No'}
            </label>
          </div>
        );
      case 'statement':
        return null;
      default:
        return <input {...shared} type="text" placeholder={placeholder} style={inputStyle} />;
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <label htmlFor={block.id} style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#e53e3e', marginLeft: 4 }}>*</span>}
      </label>
      {renderInput()}
      {error && <div style={{ color: '#e53e3e', fontSize: 13, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d0d0d0',
  borderRadius: 6,
  fontSize: 15,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const containerStyle: React.CSSProperties = {
  maxWidth: 600,
  margin: '40px auto',
  padding: '0 20px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    if (password === 'test') {
      setState({ status: 'loaded', formObj: TEST_FORM, ageRecipient: '', formId });
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
        const formObj = JSON.parse(decrypted);
        setState({ status: 'loaded', formObj, ageRecipient: data.age_recipient, formId });
      })
      .catch((err: unknown) => {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }, []);

  const blocks: Block[] = (state.status === 'loaded' ? (state.formObj as any).blocks : []) ?? [];

  const handleChange = useCallback((id: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [id]: val }));
    setErrors((prev) => ({ ...prev, [id]: '' }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (state.status !== 'loaded') return;

      const newErrors: Record<string, string> = {};
      for (const block of blocks) {
        if (block.attributes?.required && !answers[block.id]) {
          newErrors[block.id] = 'This field is required';
        }
      }
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setState({ status: 'submitting' });

      if (!state.ageRecipient) {
        setState({ status: 'submitted' });
        return;
      }

      try {
        const { armored } = await encryptSubmissionPayload(state.ageRecipient, answers);
        const res = await fetch(`/s/${state.formId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: armored,
        });
        if (!res.ok) throw new Error(`Submission failed: ${res.status}`);
        setState({ status: 'submitted' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setState({ status: 'submit-error', message: msg });
      }
    },
    [state, answers, blocks],
  );

  if (state.status === 'loading') {
    return <div style={containerStyle}>Loading...</div>;
  }

  if (state.status === 'no-password') {
    return <div style={containerStyle}>This form requires a password. Add #your-password to the URL.</div>;
  }

  if (state.status === 'error') {
    return <div style={{ ...containerStyle, color: 'red' }}>Error: {state.message}</div>;
  }

  if (state.status === 'submitted') {
    return <div style={containerStyle}>Your submission has been received. Thank you!</div>;
  }

  if (state.status === 'submit-error') {
    return <div style={{ ...containerStyle, color: 'red' }}>Submission error: {state.message}</div>;
  }

  return (
    <div style={containerStyle}>
      <form onSubmit={handleSubmit}>
        {blocks.map((block) => (
          <BlockField
            key={block.id}
            block={block}
            value={answers[block.id] ?? ''}
            onChange={handleChange}
            error={errors[block.id]}
          />
        ))}
        <button
          type="submit"
          disabled={state.status === 'submitting'}
          style={{
            padding: '12px 32px',
            fontSize: 16,
            fontWeight: 600,
            color: '#fff',
            background: state.status === 'submitting' ? '#999' : '#2563eb',
            border: 'none',
            borderRadius: 6,
            cursor: state.status === 'submitting' ? 'not-allowed' : 'pointer',
          }}
        >
          {state.status === 'submitting' ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
