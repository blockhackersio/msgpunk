import { encrypt as ageEncrypt, decrypt as ageDecrypt } from './age.js';
import { decrypt as aesGcmDecrypt, deriveKey as aesGcmDeriveKey } from './aes-gcm.js';
import { pad } from './padding.js';

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function decryptFormStructure(
  identity: string,
  encryptedPassword: string,
  encryptedStructureB64: string,
): Promise<string> {
  const decryptedPassword = (await ageDecrypt(identity, encryptedPassword)).trim();
  const key = aesGcmDeriveKey(decryptedPassword);
  const encrypted = base64ToBytes(encryptedStructureB64);
  return aesGcmDecrypt(key, encrypted);
}

export async function encryptSubmissionPayload(
  recipient: string,
  fields: Record<string, string>,
): Promise<{ original: string; armored: string }> {
  const payload = {
    v: 1,
    fields,
    submitted_at: new Date().toISOString().replace('Z', 'Z'),
  };
  const payloadStr = JSON.stringify(payload);
  const padded = pad(payloadStr);
  const armored = await ageEncrypt(recipient, padded);
  return { original: payloadStr, armored };
}
