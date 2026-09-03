import { ed25519 } from '@noble/curves/ed25519';

export function verify(pubkeyHex: string, message: string, signatureHex: string): boolean {
  try {
    const pubkey = hexToBytes(pubkeyHex);
    const sig = hexToBytes(signatureHex);
    return ed25519.verify(sig, new TextEncoder().encode(message), pubkey);
  } catch {
    return false;
  }
}

export function timestampFresh(tsSecs: number, maxAge = 30): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - tsSecs) <= maxAge;
}

export function verifyAuthChallenge(
  pubkeyHex: string,
  formId: string,
  timestamp: string,
  signature: string,
): boolean {
  const message = `${formId}:${timestamp}`;
  return verify(pubkeyHex, message, signature) && timestampFresh(parseInt(timestamp));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
