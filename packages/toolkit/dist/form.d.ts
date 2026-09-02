export declare function decryptFormStructure(identity: string, encryptedPassword: string, encryptedStructureB64: string): Promise<string>;
export declare function encryptSubmissionPayload(recipient: string, fields: Record<string, string>): Promise<{
    original: string;
    armored: string;
}>;
