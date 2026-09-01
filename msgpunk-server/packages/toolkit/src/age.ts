import { Encrypter, Decrypter, armor } from 'age-encryption';

export async function encrypt(recipient: string, plaintext: string): Promise<string> {
  const encrypter = new Encrypter();
  encrypter.addRecipient(recipient);
  const ciphertext = await encrypter.encrypt(plaintext);
  return armor.encode(new Uint8Array(ciphertext));
}

export async function decrypt(identity: string, armored: string): Promise<string> {
  const decrypter = new Decrypter();
  decrypter.addIdentity(identity);
  const ciphertext = armor.decode(armored);
  return await decrypter.decrypt(ciphertext, 'text');
}
