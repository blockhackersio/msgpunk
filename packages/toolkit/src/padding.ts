const BLOCK = 4096;

export function pad(str: string): string {
  const remainder = str.length % BLOCK;
  if (remainder === 0) return str;
  const needed = BLOCK - remainder;
  const trimmed = str.replace(/\}\s*$/, '');
  return trimmed + ',' + ' '.repeat(needed - 1) + '}';
}

export function unpad(padded: string): string {
  return padded.replace(/,\s*\}$/, '}');
}
