import { encrypt as ageEncrypt, decrypt as ageDecrypt } from './age.js';
import { decrypt as aesGcmDecrypt, deriveKey as aesGcmDeriveKey } from './aes-gcm.js';
import { pad } from './padding.js';

export async function decryptFormStructure(
  identity: string,
  encryptedPassword: string,
  encryptedStructureB64: string,
): Promise<string> {
  const decryptedPassword = (await ageDecrypt(identity, encryptedPassword)).trim();
  const key = aesGcmDeriveKey(decryptedPassword);
  const encrypted = Buffer.from(encryptedStructureB64, 'base64');
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
