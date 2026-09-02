import { ageEncrypt, aesGcmEncrypt, aesGcmDeriveKey, generatePassword } from '@msgpunk/toolkit';
import fs from 'node:fs';

const [keysDir, setupDir] = process.argv.slice(2);

const recipient = fs.readFileSync(`${keysDir}/age-recipient.txt`, 'utf-8').trim();

const structure = JSON.stringify({
  title: "Contact Me",
  fields: [
    { id: "name", type: "text", label: "Your Name", required: true },
    { id: "msg", type: "textarea", label: "Message", required: true }
  ]
});

const password = generatePassword();
const key = aesGcmDeriveKey(password);
const encrypted = aesGcmEncrypt(key, structure);

fs.writeFileSync(`${setupDir}/encrypted-structure.b64`, encrypted.toString('base64'));
fs.writeFileSync(`${setupDir}/password.txt`, password);

const encryptedPassword = await ageEncrypt(recipient, password);
fs.writeFileSync(`${setupDir}/encrypted-password.txt`, encryptedPassword);
