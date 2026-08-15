# ADR-0039 — User Module (USR-001..015)

- Status: accepted
- Date: 2026-08-15
- Applies to: USR-001 — USR-015

## Context

Authentication owned credentials/sessions/identity; there was no
human-facing account layer. Users were at risk of being modelled as a god
object absorbing credentials, permissions, memberships and file ownership.
The recommendation established:

```
Authentication Module — "Who are you?"
Auth Identity         — "What principal is this?"
User Module           — "Who is this human inside Vestara?"
Permission Module     — "What may this user do?"
Organization/Workspace— "Where does this user belong?"
```

and the invariant: `Credential ≠ Identity ≠ User ≠ Membership ≠ Permission`.

## Decision

> **Authentication owns credentials and authentication. Auth Identity owns
> principal identity. User owns the human account/profile. Permission owns
> authorization. Integration owns external-provider connectivity. OS owns
> local operating-system account mapping. Other modules reference UserId;
> User Module does not absorb their domain objects.**

### 1. User domain (USR-001..005)

`User` links to an identity via `identityId` and owns username, status,
profile, namespaced preferences, settings and memberships. Credentials,
OAuth tokens, API keys, sessions and authorization rules are deliberately
absent. `UserProfile` owns human-facing metadata; `UserPreferences` is
namespaced (`ui.*`, `notifications.*`, `ai.*`, `workspace.*`,
`activityRoom.*`, `accessibility.*`).

### 2. Lifecycle (USR-003)

invited -> pending -> active -> suspended/disabled -> active, with soft
deletion via tombstoning (deleting -> deleted; `deletedAt` retained) so
referencing objects survive.

### 3. Store + service (USR-006/007)

`UserStorePort`/`UserService` dedupe by username and identity, transition
lifecycle, update profile/preferences, and manage memberships. Events
publish on every lifecycle and membership change.

### 4. Capabilities (USR-009)

Read/self-service capabilities (`user.read`, `user.self.profile`,
`user.self.preferences`) are broadly available; lifecycle governance
(`user.invite`, `user.suspend`, `user.delete`, `user.membership`) requires
approval.

### 5. Integrations (USR-010/012/014)

- `UserResolver`: Login -> Authentication -> Identity -> User. Machine/
  service/agent identities do NOT resolve to a user.
- `UserProvisioner`: first login creates the user and triggers Onboarding.
- Memberships reference organizations/workspaces + roles; Permission
  assignment lives outside the User object.

## Consequences

- User Module foundation complete: domain, lifecycle, profile, preferences,
  store, service, events, capabilities and auth/onboarding/membership
  integrations. `users` capability registered.
- New control API: `/api/v2/users` (list/create/get/by-identity/status/
  profile/preferences/memberships). OpenAPI regenerated and in sync.
- 16 new tests (13 unit + 3 integration). 658 total.
- USR-016..035 (Configuration/Notification/File/Workflow/Task/Agent/AI/
  Activity Room/OS/Application Builder/Page Builder/Marketplace/Audit
  integrations, User management UI, Account UI, tests, ADR) follow.
