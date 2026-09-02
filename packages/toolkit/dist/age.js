import { Encrypter, Decrypter, armor } from 'age-encryption';
export async function encrypt(recipient, plaintext) {
    const encrypter = new Encrypter();
    encrypter.addRecipient(recipient);
    const ciphertext = await encrypter.encrypt(plaintext);
    return armor.encode(new Uint8Array(ciphertext));
}
export async function decrypt(identity, armored) {
    const decrypter = new Decrypter();
    decrypter.addIdentity(identity);
    const ciphertext = armor.decode(armored);
    return await decrypter.decrypt(ciphertext, 'text');
}
