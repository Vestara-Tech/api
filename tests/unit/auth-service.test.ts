import { describe, expect, it } from 'vitest';
import { ScryptPasswordHashing } from '../../src/auth/domain/password.js';
import { createRequestContext } from '../../src/core/context.js';
import { IdentityService } from '../../src/auth/service/identity-service.js';
import { AuthenticationService } from '../../src/auth/service/authentication-service.js';
import { InMemoryIdentityStore } from '../../src/auth/store/in-memory-identity.js';
import { InMemoryCredentialStore } from '../../src/auth/store/in-memory-credential.js';
import { InMemorySessionStore } from '../../src/auth/store/in-memory-session.js';

const passwords = new ScryptPasswordHashing();

describe('ScryptPasswordHashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await passwords.hash('hunter2');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await passwords.verify('hunter2', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await passwords.hash('right');
    expect(await passwords.verify('wrong', hash)).toBe(false);
  });

  it('rejects a malformed stored value', async () => {
    expect(await passwords.verify('x', 'garbage')).toBe(false);
  });
});

describe('AuthenticationService', () => {
  function build() {
    const identityStore = new InMemoryIdentityStore();
    const credentialStore = new InMemoryCredentialStore();
    const sessionStore = new InMemorySessionStore();
    const identities = new IdentityService({ store: identityStore });
    const authentication = new AuthenticationService({ identityStore, credentialStore, sessionStore, passwords });
    return { identities, authentication, sessionStore };
  }

  it('logs in with a password and validates the session token', async () => {
    const { identities, authentication } = build();
    const identity = await identities.create({ displayName: 'Eddie', primaryEmail: 'eddie@example.com' });
    await authentication.createPasswordCredential(identity.id, 'secret123');

    const login = await authentication.loginWithPassword(identity.id, 'secret123', 'test-device');
    expect(login.session.authenticationMethod).toBe('password');
    expect(login.session.assuranceLevel).toBe('medium');

    const validated = await authentication.validateSessionToken(login.token);
    expect(validated?.id).toBe(login.session.id);
  });

  it('rejects a wrong password', async () => {
    const { identities, authentication } = build();
    const identity = await identities.create();
    await authentication.createPasswordCredential(identity.id, 'secret123');
    await expect(authentication.loginWithPassword(identity.id, 'wrong', undefined)).rejects.toThrow();
  });

  it('revokes a session and rejects its token', async () => {
    const { identities, authentication } = build();
    const identity = await identities.create();
    await authentication.createPasswordCredential(identity.id, 'secret123');
    const login = await authentication.loginWithPassword(identity.id, 'secret123', undefined);

    await authentication.revokeSession(login.session.id);
    expect(await authentication.validateSessionToken(login.token)).toBeNull();
  });

  it('lists sessions for an identity', async () => {
    const { identities, authentication } = build();
    const identity = await identities.create();
    await authentication.createPasswordCredential(identity.id, 'secret123');
    await authentication.loginWithPassword(identity.id, 'secret123', 'device-a');
    await authentication.loginWithPassword(identity.id, 'secret123', 'device-b');
    const sessions = await authentication.listSessions(identity.id);
    expect(sessions).toHaveLength(2);
  });
});
