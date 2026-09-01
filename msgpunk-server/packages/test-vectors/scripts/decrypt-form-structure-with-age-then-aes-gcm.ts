import { ageDecrypt, aesGcmDecrypt, aesGcmDeriveKey } from '@msgpunk/toolkit';
import fs from 'node:fs';

const [keysDir, setupDir, outDir] = process.argv.slice(2);

const identity = fs.readFileSync(`${keysDir}/age-identity.txt`, 'utf-8').trim();

const encryptedPassword = fs.readFileSync(`${setupDir}/encrypted-password.txt`, 'utf-8').trim();
const encryptedStructureB64 = fs.readFileSync(`${setupDir}/encrypted-structure.b64`, 'utf-8').trim();
const expectedPassword = fs.readFileSync(`${setupDir}/password.txt`, 'utf-8').trim();

const decryptedPassword = await ageDecrypt(identity, encryptedPassword);

if (decryptedPassword.trim() !== expectedPassword.trim()) {
  fs.writeFileSync(`${outDir}/result`, 'FAIL');
  console.error('password mismatch');
  process.exit(1);
}

const key = aesGcmDeriveKey(decryptedPassword.trim());
const encrypted = Buffer.from(encryptedStructureB64, 'base64');
const decrypted = aesGcmDecrypt(key, encrypted);
const structure = JSON.parse(decrypted);

if (structure.title === 'Contact Me') {
  fs.writeFileSync(`${outDir}/result`, 'PASS');
} else {
  fs.writeFileSync(`${outDir}/result`, 'FAIL');
}
