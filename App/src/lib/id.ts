import * as Crypto from 'expo-crypto';

export function createId() {
  return Crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
