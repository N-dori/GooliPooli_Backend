// Excludes ambiguous characters (0/O, 1/I) for human readability
const PROJECT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateProjectCode(length = 6): string {
  let out = '';
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint32Array(length);
    cryptoObj.getRandomValues(arr);
    for (let i = 0; i < length; i++) {
      out += PROJECT_CODE_ALPHABET[arr[i]! % PROJECT_CODE_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      out += PROJECT_CODE_ALPHABET[Math.floor(Math.random() * PROJECT_CODE_ALPHABET.length)];
    }
  }
  return out;
}
