import crypto from 'node:crypto';
export function generatePassword() {
    return crypto.randomBytes(16).toString('hex');
}
export function encrypt(key, plaintext) {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    let encrypted = cipher.update(plaintext, 'utf-8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return Buffer.concat([nonce, encrypted, cipher.getAuthTag()]);
}
export function decrypt(key, ciphertext) {
    const nonce = ciphertext.subarray(0, 12);
    const tag = ciphertext.subarray(-16);
    const data = ciphertext.subarray(12, -16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf-8');
}
export function deriveKey(password) {
    return crypto.createHash('sha256').update(password).digest();
}
