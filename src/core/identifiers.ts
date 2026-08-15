import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function randomId(prefix: string, length = 24): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    out += ALPHABET[byte % ALPHABET.length];
  }
  return `${prefix}_${out}`;
}

export const newRequestId = (): string => randomId('req');
export const newCorrelationId = (): string => randomId('cor');
export const newTraceId = (): string => randomId('trc');
export const newOperationId = (): string => randomId('op');
export const newClientId = (): string => randomId('cli');
