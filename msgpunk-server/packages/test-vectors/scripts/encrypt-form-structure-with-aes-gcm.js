import { Encrypter, armor } from 'age-encryption';
import crypto from 'crypto';
import fs from 'fs';

const [keysDir, setupDir] = process.argv.slice(2);

const recipient = fs.readFileSync(`${keysDir}/age-recipient.txt`, 'utf-8').trim();

const structure = JSON.stringify({
  title: "Contact Me",
  fields: [
    { id: "name", type: "text", label: "Your Name", required: true },
    { id: "msg", type: "textarea", label: "Message", required: true }
  ]
});

const password = crypto.randomBytes(16).toString('hex');
const key = crypto.createHash('sha256').update(password).digest();
const nonce = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
let encrypted = cipher.update(structure, 'utf-8');
encrypted = Buffer.concat([encrypted, cipher.final()]);
encrypted = Buffer.concat([nonce, encrypted, cipher.getAuthTag()]);

fs.writeFileSync(`${setupDir}/encrypted-structure.b64`, encrypted.toString('base64'));
fs.writeFileSync(`${setupDir}/password.txt`, password);

const encrypter = new Encrypter();
encrypter.addRecipient(recipient);
const encryptedPassword = await encrypter.encrypt(password);
const armored = armor.encode(new Uint8Array(encryptedPassword));
fs.writeFileSync(`${setupDir}/encrypted-password.txt`, armored);
