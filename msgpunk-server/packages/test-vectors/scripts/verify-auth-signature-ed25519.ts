import { ed25519Verify, timestampFresh } from '@msgpunk/toolkit';
import fs from 'node:fs';

const [inDir, outDir] = process.argv.slice(2);

const formId = fs.readFileSync(`${inDir}/form-id.txt`, 'utf-8').trim();
const timestamp = fs.readFileSync(`${inDir}/timestamp.txt`, 'utf-8').trim();
const signature = fs.readFileSync(`${inDir}/signature.txt`, 'utf-8').trim();
const pubkeyHex = fs.readFileSync(`${inDir}/pubkey.txt`, 'utf-8').trim();

const message = `${formId}:${timestamp}`;

const valid = ed25519Verify(pubkeyHex, message, signature) && timestampFresh(parseInt(timestamp));
fs.writeFileSync(`${outDir}/result`, valid ? 'PASS' : 'FAIL');
