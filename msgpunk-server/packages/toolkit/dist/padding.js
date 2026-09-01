const BLOCK = 4096;
export function pad(str) {
    const remainder = str.length % BLOCK;
    if (remainder === 0)
        return str;
    const needed = BLOCK - remainder;
    const trimmed = str.replace(/\}\s*$/, '');
    return trimmed + ',' + ' '.repeat(needed - 1) + '}';
}
export function unpad(padded) {
    return padded.replace(/,\s*\}$/, '}');
}
