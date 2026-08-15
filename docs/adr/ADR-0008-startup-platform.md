# ADR-0008 — Startup Platform (DESK-001..008)

- Status: accepted
- Date: 2026-08-15
- Applies to: DESK-001 — DESK-008

## Context

The OS startup experience must be a projection of a backend state machine, not
a client-side guess. The startup screen determines whether the machine can run;
Login determines who may establish the session; Auth determines what that
identity may do inside Vestara; Desktop hosts the resulting experience.

## Decision

### 1. Startup state is backend-owned

`StartupState` transitions `booting → initializing → starting-services →
verifying → ready`, with `uninitialized → onboarding`, `degraded → desktop`,
and `failed → diagnostics/recovery`. The startup UI renders this state.

### 2. Readiness + dependency graph + progress are first-class

Each service reports readiness through a registry; a dependency graph orders
startup; a weighted aggregate produces one coherent progress percentage.

### 3. Classification distinguishes healthy / degraded / failed

Required service failure → failed; optional failure or degraded → degraded;
blocked (unresolved required dependency) services are reported separately.

### 4. Destination routing is explicit

The startup screen becomes the router between system boot and the user
experience: firstBoot → onboarding, unauthenticated → login, session-ready →
desktop, boot-stage failure → recovery, service-stage failure → diagnostics.

### 5. Startup events are observable

Transitions, readiness updates, and terminal states publish on the EventBus so
the UI and diagnostics react without polling.

## Consequences

- The `vestara-apps/startup` UI is a thin projection of backend state.
- Login and the desktop shell build on top of a defined startup boundary.
- The OS Image Builder can wire the startup coordinator into systemd and the
  display manager deterministically.
