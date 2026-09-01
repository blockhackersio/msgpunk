import crypto from 'node:crypto';

export function verify(pubkeyHex: string, message: string, signatureHex: string): boolean {
  const pubkeyBytes = Buffer.from(pubkeyHex, 'hex');
  const sigBytes = Buffer.from(signatureHex, 'hex');
  try {
    const publicKey = crypto.createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: pubkeyBytes.toString('base64url') },
      format: 'jwk'
    });
    return crypto.verify(null, Buffer.from(message), publicKey, sigBytes);
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
