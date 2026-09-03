import { gcm } from '@noble/ciphers/aes';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

export function generatePassword(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function deriveKey(password: string): Uint8Array {
  return sha256(new TextEncoder().encode(password));
}

export function encrypt(key: Uint8Array, plaintext: string): Uint8Array {
  const nonce = randomBytes(12);
  const cipher = gcm(key, nonce);
  const encrypted = cipher.encrypt(new TextEncoder().encode(plaintext));
  const result = new Uint8Array(12 + encrypted.length);
  result.set(nonce, 0);
  result.set(encrypted, 12);
  return result;
}

export function decrypt(key: Uint8Array, ciphertext: Uint8Array): string {
  const nonce = ciphertext.slice(0, 12);
  const data = ciphertext.slice(12);
  const cipher = gcm(key, nonce);
  const decrypted = cipher.decrypt(data);
  return new TextDecoder().decode(decrypted);
}
