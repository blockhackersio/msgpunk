import { encryptSubmissionPayload } from '@msgpunk/toolkit';
import fs from 'node:fs';

const [keysDir, submissionDir] = process.argv.slice(2);

const recipient = fs.readFileSync(`${keysDir}/age-recipient.txt`, 'utf-8').trim();

const result = await encryptSubmissionPayload(recipient, { name: "John", msg: "Hello" });

fs.writeFileSync(`${submissionDir}/original-payload.json`, result.original);
fs.writeFileSync(`${submissionDir}/armored-ciphertext.txt`, result.armored);
