import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import type { PasswordHashing } from './credential.js';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const ALGORITHM = 'scrypt';

function derive(password: string, salt: string, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEY_LENGTH, { N, r, p }, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/**
 * scrypt password hashing. Local-only and offline-capable; no external
 * dependencies. Storage format: `scrypt$N=16384,r=8,p=1$<salt>$<hash>`.
 */
export class ScryptPasswordHashing implements PasswordHashing {
  constructor(
    private readonly options: { N?: number; r?: number; p?: number } = {},
  ) {}

  async hash(password: string): Promise<string> {
    const N = this.options.N ?? 16384;
    const r = this.options.r ?? 8;
    const p = this.options.p ?? 1;
    const salt = randomBytes(SALT_LENGTH).toString('hex');
    const derived = await derive(password, salt, N, r, p);
    return `${ALGORITHM}$N=${N},r=${r},p=${p}$${salt}$${derived.toString('hex')}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    // Format: scrypt$N=...,r=...,p=...$salt$hash  → 4 parts after split('$')
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== ALGORITHM) return false;
    const params = parts[1]!;
    const salt = parts[2]!;
    const expected = parts[3]!;
    const parsed = Object.fromEntries(params.split(',').map((kv) => kv.split('=') as [string, string]));
    const N = Number(parsed.N ?? 16384);
    const r = Number(parsed.r ?? 8);
    const p = Number(parsed.p ?? 1);
    const derived = await derive(password, salt, N, r, p);
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (derived.length !== expectedBuffer.length) return false;
    return timingSafeEqual(derived, expectedBuffer);
  }
}
