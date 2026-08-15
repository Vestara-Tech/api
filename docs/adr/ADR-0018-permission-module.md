# ADR-0018 — Permission Module (PERM foundation)

- Status: accepted
- Date: 2026-08-15
- Applies to: PERM foundation

## Context

Vestara has outgrown authentication-scoped authorization. Principals are not
only humans: agents, services, applications, modules and devices need governed
authority. The existing `AuthorizationService` checks permissions from
`AuthenticationContext` and supports policy rules, but ownership of authority
and policy must become a first-class cross-platform contract.

## Decision

The security boundary is locked:

```text
AUTHENTICATION  "Who are you?"
PRINCIPAL
PERMISSION      "What may you request?"
POLICY          "Under what conditions?"
APPROVAL        "Does this action require consent?"
CAPABILITY      "What operation is exposed?"
MODULE/SERVICE  "Execute only the governed operation."
EVIDENCE/AUDIT  "What actually happened?"
```

### 1. Capability-oriented permissions, not RBAC-only

`PermissionDefinition` (resource, action, risk, approval, constraints).
RBAC exists but is one mechanism alongside direct grants, capability grants,
policies, conditions, scope, delegation, approval, risk and runtime
constraints.

### 2. Structured decisions, not booleans

`PermissionDecision` (effect: allow | deny | approval-required | constrained,
reason, matchedPolicies, constraints, risk, evidence). Rest of Vestara
understands *why* something is allowed.

### 3. Deny precedence + risk + approval

Policy denies always win. Risk classification (low/medium/high/critical) maps
to auto/approval-required/denied. Explicit-approval permissions require
approval before execution; the Permission Module and an Approval Runtime are
separate concepts.

### 4. Scoped inheritance

Permissions inherit System → Organization → Workspace → Project → Workflow →
Agent → Run → Task; lower scopes narrow, never silently escalate.

### 5. Bounded delegation + temporary grants

`delegated permissions ⊆ delegator effective permissions`. Temporary grants
(leases) carry scope, expiry, max uses and an approver — agents get bounded
capability tokens rather than permanent escalation.

### 6. Modules contribute permissions

`PermissionContributor` per module (file, agent, workflow, generator, system,
integration). Marketplace packages declare required capabilities with a
grant/restrict/reject install flow.

### 7. Context and File gate on Permission

Context can discover something ≠ an agent may see it; the collector applies the
authorization filter. File operations flow through the Permission Module
before reaching a provider.

## Consequences

- PERM foundation complete: definitions, registry (definitions/roles/grants/
  contributors), policy engine (deny precedence, risk, approval, constraints),
  effective-permission resolver, bounded delegation, temporary grants, module
  contributions, an Auth → Permission adapter, and a control API
  (`/api/v2/permissions/*`). 124 OpenAPI paths total, capability `permissions`.
- 16 tests (10 unit + 6 integration). ADR-0018.
- `AuthorizationService` remains for the auth scoped path; the adapter keeps
  the existing contract. PERM-020 (Permission Manager/Builder UI) and deeper
  Auth integration follow.
