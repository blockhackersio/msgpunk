import { Encrypter, armor } from 'age-encryption';
import fs from 'fs';

const [keysDir, submissionDir] = process.argv.slice(2);

const recipient = fs.readFileSync(`${keysDir}/age-recipient.txt`, 'utf-8').trim();

const payload = {
  v: 1,
  fields: { name: "John", msg: "Hello" },
  submitted_at: new Date().toISOString().replace('Z', 'Z')
};

const payloadStr = JSON.stringify(payload);
const padded = padTo4096(payloadStr);

fs.writeFileSync(`${submissionDir}/original-payload.json`, payloadStr);

const encrypter = new Encrypter();
encrypter.addRecipient(recipient);
const ciphertext = await encrypter.encrypt(padded);
const armored = armor.encode(new Uint8Array(ciphertext));
fs.writeFileSync(`${submissionDir}/armored-ciphertext.txt`, armored);

function padTo4096(str) {
  const block = 4096;
  const remainder = str.length % block;
  if (remainder === 0) return str;
  const needed = block - remainder;
  const trimmed = str.replace(/\}\s*$/, '');
  return trimmed + ',' + ' '.repeat(needed - 1) + '}';
}
