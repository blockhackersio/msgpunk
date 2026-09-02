import crypto from 'node:crypto';
export function verify(pubkeyHex, message, signatureHex) {
    const pubkeyBytes = Buffer.from(pubkeyHex, 'hex');
    const sigBytes = Buffer.from(signatureHex, 'hex');
    try {
        const publicKey = crypto.createPublicKey({
            key: { kty: 'OKP', crv: 'Ed25519', x: pubkeyBytes.toString('base64url') },
            format: 'jwk'
        });
        return crypto.verify(null, Buffer.from(message), publicKey, sigBytes);
    }
    catch {
        return false;
    }
}
export function timestampFresh(tsSecs, maxAge = 30) {
    const now = Math.floor(Date.now() / 1000);
    return Math.abs(now - tsSecs) <= maxAge;
}
export function verifyAuthChallenge(pubkeyHex, formId, timestamp, signature) {
    const message = `${formId}:${timestamp}`;
    return verify(pubkeyHex, message, signature) && timestampFresh(parseInt(timestamp));
}
