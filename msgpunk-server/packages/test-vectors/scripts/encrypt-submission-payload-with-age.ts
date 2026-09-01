import { ageEncrypt, pad } from '@msgpunk/toolkit';
import fs from 'node:fs';

const [keysDir, submissionDir] = process.argv.slice(2);

const recipient = fs.readFileSync(`${keysDir}/age-recipient.txt`, 'utf-8').trim();

const payload = {
  v: 1,
  fields: { name: "John", msg: "Hello" },
  submitted_at: new Date().toISOString().replace('Z', 'Z')
};

const payloadStr = JSON.stringify(payload);
const padded = pad(payloadStr);

fs.writeFileSync(`${submissionDir}/original-payload.json`, payloadStr);

const armored = await ageEncrypt(recipient, padded);
fs.writeFileSync(`${submissionDir}/armored-ciphertext.txt`, armored);
