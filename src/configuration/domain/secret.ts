/**
 * CONFIG-005 — Secret references.
 *
 * Configuration never stores secrets directly. It stores a `SecretReference`
 * (an opaque pointer) that a Credential/Secret store resolves at use time.
 */

export const SECRET_REF_PREFIX = 'secret://';

export interface SecretReference {
  readonly kind: 'secret-reference';
  readonly ref: string; // e.g. secret://database/primary/password
  readonly store: string; // e.g. database
  readonly path: string; // e.g. primary/password
}

export function isSecretReference(value: unknown): value is SecretReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'secret-reference' &&
    typeof (value as { ref?: unknown }).ref === 'string'
  );
}

export function secretReference(store: string, path: string): SecretReference {
  return { kind: 'secret-reference', ref: `${SECRET_REF_PREFIX}${store}/${path}`, store, path };
}

export function parseSecretRef(ref: string): { store: string; path: string } | null {
  if (!ref.startsWith(SECRET_REF_PREFIX)) return null;
  const rest = ref.slice(SECRET_REF_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return { store: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

export function isSecretRefString(ref: string): boolean {
  return ref.startsWith(SECRET_REF_PREFIX);
}

export function redactSecrets(value: unknown): unknown {
  if (isSecretReference(value)) return { kind: 'secret-reference', ref: value.ref };
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/secret|password|token|key|credential/i.test(k)) out[k] = '[REDACTED]';
      else out[k] = redactSecrets(v);
    }
    return out;
  }
  return value;
}
