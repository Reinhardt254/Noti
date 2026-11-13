import { gcm } from '@noble/ciphers/aes.js';
import { scrypt } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import * as Crypto from 'expo-crypto';

const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 };

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  Crypto.getRandomValues(bytes);
  return bytes;
}

export async function deriveKey(passphrase: string, saltHex?: string) {
  const salt = saltHex ? hexToBytes(saltHex) : randomBytes(16);
  const key = scrypt(utf8ToBytes(passphrase), salt, SCRYPT_PARAMS);
  return { key, saltHex: bytesToHex(salt) };
}

export async function encryptNoteBody(plaintext: string, passphrase: string) {
  const { key, saltHex } = await deriveKey(passphrase);
  const iv = randomBytes(12);
  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(utf8ToBytes(plaintext));
  return `v1:${saltHex}:${bytesToHex(iv)}:${bytesToHex(ciphertext)}`;
}

export async function decryptNoteBody(payload: string, passphrase: string) {
  const [version, saltHex, ivHex, cipherHex] = payload.split(':');
  if (version !== 'v1' || !saltHex || !ivHex || !cipherHex) {
    throw new Error('Invalid encrypted payload');
  }
  const { key } = await deriveKey(passphrase, saltHex);
  const cipher = gcm(key, hexToBytes(ivHex));
  const plain = cipher.decrypt(hexToBytes(cipherHex));
  return new TextDecoder().decode(plain);
}
