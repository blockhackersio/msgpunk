export declare function generatePassword(): string;
export declare function encrypt(key: Buffer, plaintext: string): Buffer;
export declare function decrypt(key: Buffer, ciphertext: Buffer): string;
export declare function deriveKey(password: string): Buffer;
