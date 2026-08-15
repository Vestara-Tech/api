# ADR-0009 — Login Platform (LOGIN-001..014)

- Status: accepted
- Date: 2026-08-15
- Applies to: LOGIN-001 — LOGIN-014

## Context

The OS-level login screen is a security boundary between system startup and the
Vestara desktop. It must remain separate from API authentication, and the UI
must never validate Linux credentials itself.

## Decision

### 1. OS login is separate from API authentication

OS authentication unlocks the local machine and establishes a Linux session
(PAM, passkey, fingerprint). Vestara Authentication handles Vestara Identity,
API sessions, OAuth, agents, services. They are linked via an OS→Vestara
identity mapping but one never substitutes for the other.

### 2. Never authenticate in React

`vestara-apps/login` is presentation only. It sends an authentication request to
the LoginBroker, which delegates to an OS/PAM adapter. The UI receives only
`LoginResult`; there is no password logging, telemetry, persistence, browser
storage, API request traces, or evidence payloads.

### 3. Display-manager adapter

Vestara integrates a supported display/session manager (LightDM, SDDM, GDM, or
a future Vestara session manager) through a `DisplayManagerAdapter` port; it
does not replace the Linux login stack initially.

### 4. Pre-auth capability boundary

An unauthenticated greeter gets only network status/connect, accessibility,
locale, power (reboot/shutdown), recovery boot, and session select. It never
touches Builder, Generator, Configuration secrets, Marketplace, Filesystem,
Agents, Integrations, or arbitrary System operations.

### 5. Rate limiting + lock

Failed-attempt policy locks an account within a rolling window. LOGIN (create a
new OS session) and LOCK (unlock the existing session) share the platform but
are distinct operations.

### 6. First boot never bakes an owner

Onboarding creates the OS owner and Vestara identity and links them; no default
credentials ever ship in the image.

## Consequences

- The startup screen routes to login when unauthenticated; login routes to the
  desktop.
- The OS Image Builder installs the login/session chain deterministically.
- Single-login (OS principal → Vestara identity) works without coupling the API
  to Linux authentication.
