import { decryptFormStructure } from '@msgpunk/toolkit';
import fs from 'node:fs';

const [keysDir, setupDir, outDir] = process.argv.slice(2);

const identity = fs.readFileSync(`${keysDir}/age-identity.txt`, 'utf-8').trim();
const encryptedPassword = fs.readFileSync(`${setupDir}/encrypted-password.txt`, 'utf-8').trim();
const encryptedStructureB64 = fs.readFileSync(`${setupDir}/encrypted-structure.b64`, 'utf-8').trim();

const decrypted = await decryptFormStructure(identity, encryptedPassword, encryptedStructureB64);
const structure = JSON.parse(decrypted);

fs.writeFileSync(`${outDir}/result`, structure.title === 'Contact Me' ? 'PASS' : 'FAIL');
