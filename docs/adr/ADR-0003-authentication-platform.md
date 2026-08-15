# ADR-0003 — Authentication Platform (AUTH-001..006)

- Status: accepted
- Date: 2026-08-15
- Applies to: AUTH-001 — AUTH-006

## Context

Vestara needs authentication before agents, generators, modules, and external
applications begin invoking the API. External providers must not accidentally
define Vestara's identity architecture, and Vestara OS must remain usable
offline (OAuth cannot be the only mechanism).

## Decision

### 1. Vestara owns identity; integration module owns connectivity

- `Authentication` owns identity, credentials, sessions, tokens, account
  linking, authorization context.
- `Integration` owns OAuth/OIDC connectivity, provider config/secrets, callback
  exchange, provider health.
- The auth module never imports provider SDKs; it consumes the
  `ExternalIdentityProvider` port (AUTH-006).

### 2. Durable external identity is `(integration, providerSubject)`, not email

`ExternalIdentity` is keyed by `integrationId + providerSubject`. Linking an
account requires authentication/reauthentication; accounts are never merged
merely because two providers return the same email.

### 3. `Principal` not `User`

`PrincipalKind = human | agent | service | application | module | device`.
Authentication is not modeled around humans only.

### 4. Methods are capability-driven

`auth.password`, `auth.passkey`, `auth.oauth`, `auth.oidc`,
`auth.service-token`, `auth.api-key`, `auth.machine`. The first release
implements local password + service/session credentials; OAuth/OIDC arrives via
integration adapters (AUTH-007+). Offline local auth always remains.

### 5. `AuthenticationContext` is the app-facing contract

The API receives an `AuthenticationContext` (principal, session, method,
scopes, roles, permissions, assurance, correlation), never provider-specific
claims, and never re-decodes tokens in application code.

### 6. Authentication and authorization are separate

Authentication answers "who are you?" → `Identity`. Authorization answers "what
may you do?" → policy engine over capabilities, plugging into the API Builder's
endpoint policy model.

### 7. Sessions are a first-class abstraction

`Session` carries authentication method, assurance level, expiry, device,
revocation, and last-seen. Centralized active-session management and revocation
are supported.

## Consequences

- External providers (Google/GitHub/Facebook, or Marketplace-contributed
  Entra/Apple/Keycloak/Auth0/Okta/LDAP) become installable integrations with no
  auth-module changes.
- Machine/agent/service identities (AUTH-014) build on the same principal model.
- API Builder endpoint security references auth requirements (AUTH-009/012)
  rather than embedding provider logic.
