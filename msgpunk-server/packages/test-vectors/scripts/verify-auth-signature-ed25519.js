import crypto from 'crypto';
import fs from 'fs';

const [inDir, outDir] = process.argv.slice(2);

const formId = fs.readFileSync(`${inDir}/form-id.txt`, 'utf-8').trim();
const timestamp = fs.readFileSync(`${inDir}/timestamp.txt`, 'utf-8').trim();
const signature = fs.readFileSync(`${inDir}/signature.txt`, 'utf-8').trim();
const pubkeyHex = fs.readFileSync(`${inDir}/pubkey.txt`, 'utf-8').trim();

const message = `${formId}:${timestamp}`;
const pubkeyBytes = Buffer.from(pubkeyHex, 'hex');
const sigBytes = Buffer.from(signature, 'hex');

const now = Math.floor(Date.now() / 1000);
const diff = Math.abs(now - parseInt(timestamp));

let result;
try {
  const publicKey = crypto.createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: pubkeyBytes.toString('base64url') },
    format: 'jwk'
  });
  const valid = crypto.verify(null, Buffer.from(message), publicKey, sigBytes);
  result = (valid && diff <= 30) ? 'PASS' : 'FAIL';
} catch {
  result = 'FAIL';
}

fs.writeFileSync(`${outDir}/result`, result);
