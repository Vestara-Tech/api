# ADR-0010 — OS Image Builder Platform (IMG-001..026)

- Status: accepted
- Date: 2026-08-15
- Applies to: IMG-001 — IMG-026

## Context

The pieces (System, Configuration, Generator, Authentication, Onboarding,
Startup, Login, application packaging) must become a single OS image pipeline.
The image builder must not become another implementation of Vestara OS — it is
a compiler/assembler of platform capabilities into an immutable, verifiable
bootable artifact.

## Decision

### 1. ImageProfile is the source of truth

Profiles are versioned manifests describing intent — never arbitrary shell
commands. `base`, `boot`, `system`, `applications`, `onboarding`, `login`,
`desktop`, `packages`, `security`, `recovery`, and architecture. A deterministic
profile hash binds the manifest.

### 2. Deterministic BuildPlan

A profile compiles into an ordered 22-stage plan (resolve → validate →
packages → bootstrap → kernel → runtime → apps → systemd → login → GRUB →
Plymouth → A/B → recovery → first-boot → initramfs → bootloader → sanitize →
verify → SBOM → evidence → seal → export) with a plan hash. Same profile ⇒
same plan.

### 3. Reuse platform contracts; don't reimplement

The builder consumes SYS/Config/Auth/Generator/Onboarding/Startup/Login
contracts. Image construction targets an image rootfs (`ImageRootfsPort` /
Debian bootstrap adapter), not the running host — the same domain config serves
both an image build chroot and an installed machine.

### 4. Images are unowned at build time

No user password, no Vestara owner, no OAuth credentials, no API secret, no
machine identity baked in. First boot runs onboarding to create and link the
owner and generate machine-specific secrets.

### 5. Governed, observable, evidence-backed

`Generate ≠ Write`: the Generator produces artifacts; the image apply port
owns writes into the image root. Every stage is observable; verification,
SBOM, and evidence are produced; the artifact is sealed.

### 6. Firmware-logo stays hardware-dependent

The generic image never bakes an OEM/firmware logo. It ships adapters; the
installed OS discovers hardware and only replaces the logo when supported and
approved.

## Consequences

- `vestara-os-<version>.img/.iso` can be produced from profiles and verified.
- Startup → Login → Desktop → vestara-apps installs deterministically.
- QEMU boot verification and recovery/A-B integration are enabled.
- The builder is a compiler, so the same contracts govern the image being
  created and the machine after it boots.
