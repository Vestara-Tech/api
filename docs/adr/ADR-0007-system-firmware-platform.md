# ADR-0007 — System/Firmware Platform (SYS-001..014)

- Status: accepted
- Date: 2026-08-15
- Applies to: SYS-001 — SYS-014

## Context

Vestara will eventually control firmware, boot, recovery, power, hardware
monitoring, and OS updates. The API must never gain unrestricted root access.
A privileged system capability layer is the boundary: the API calls narrowly
scoped capabilities; a system service performs the privileged operations.

## Decision

### 1. The API never touches firmware/hardware directly

All privileged writes, initramfs regeneration, bootloader changes, and firmware
operations pass through the System capability layer — never the API process or
a React application.

### 2. Narrow capabilities, risk-classified

- **READ** — low risk, no approval (firmware/hardware/boot/TPM reads)
- **WRITE / control** — high risk, approval required (next-boot target, slot
  switch, recovery scheduling, reboot, shutdown)
- **CRITICAL** — special policy (firmware update, firmware-logo replace,
  Secure Boot key changes, bootloader replacement)

### 3. Arbitrary root is deliberately absent

`system.shell.root`, `system.firmware.writeArbitrary`,
`system.efivar.writeArbitrary` are never declared. A Marketplace package can
never auto-gain these.

### 4. A/B slots + recovery are first-class

`activeSlot/bootedSlot/nextSlot/previousKnownGoodSlot/slotHealth/bootAttempts`
underpin safe OS updates and rollback. Recovery boot is a governed capability
(`system.recovery.scheduleBoot`), never an arbitrary GRUB edit.

### 5. Discovery degrades gracefully

Adapters report `supported`/`unsupported`/`unknown` honestly. On hardware
without privileged access, discovery returns what it can and marks the rest.

### 6. SYS-015+ (boot presentation) follows this boundary

Plymouth/GRUB customization and firmware-logo replacement build on SYS-001..014,
with firmware-logo treated as an optional hardware-specific capability
(CRITICAL risk, vendor-adapter gated).

### 7. Boot presentation (SYS-015..025)

- **Managed assets only.** The API never accepts raw filesystem paths; assets
  become content-addressed `BootAssetRef`s via the `BootAssetStore` (sha256),
  validated for MIME/size/target.
- **Plymouth + GRUB are first-class OS-supported.** The privileged service
  installs assets, updates the theme, regenerates initramfs/grub.cfg (Vestara
  owns a drop-in fragment, never arbitrary `/etc/default/grub` edits), and
  verifies.
- **Rollback across reboot.** `applied → pending-reboot-verification →
  reboot → boot-success marker → verified`; failed boots increment
  `bootAttempts` and restore known-good at a threshold, connecting to A/B and
  recovery.
- **Firmware-logo is a separate, optional, CRITICAL capability.** Requires
  UEFI, a supported vendor/platform adapter, an available backup, and
  special-policy approval. Never falls back to generic firmware flashing.
- **Config, not assets, drives behavior.** `vestara.system.boot.*` config keys
  select profiles/behavior; binary assets stay in the BootAssetStore.

### 8. GRUB configuration is governed, not raw-text (SYS-019..022)

- Vestara exposes a typed `GrubConfiguration` model — never arbitrary
  `/etc/default/grub` or `grub.cfg` editing.
- Kernel parameters are governed: known args modeled individually, dangerous
  params rejected, unknown params require escalation.
- Vestara manages drop-ins/config inputs and invokes the distribution's
  supported generation mechanism (`update-grub`/`grub-mkconfig`); it does not
  directly maintain generated `grub.cfg`.
- Every change follows: validate → approval → snapshot known-good → apply →
  regenerate → verify → pending-reboot-verification, with rollback at a
  `bootAttempts` threshold.
- `setDefault`/`setNext` operate through the A/B/recovery boot-entry
  abstractions, never manual GRUB text.
- Deliberately absent: `writeArbitrary`, `executeArbitrary`, `rawConfigWrite`.

## Consequences

- Onboarding (ONB) and the future UI orchestrate the System layer; they never
  gain root.
- A/B rollback and OS updates have a governed foundation.
- Boot presentation profiles can become packageable Marketplace assets later.
- Boot branding works across hardware, degrading gracefully when the OEM logo
  is not replaceable.
- The future `vestara-apps/system-settings` UI can configure the complete OS
  boot experience (firmware / GRUB / Plymouth) through three independent
  governed layers.
