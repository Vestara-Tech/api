# ADR-0033 — Image Builder V2 (IMG-031..042)

- Status: accepted
- Date: 2026-08-15
- Applies to: IMG-031 — IMG-042

## Context

ADR-0012 explicitly left build-plan preview, verification and publishing for
a later phase. The base Image Build Service (IMG-001..026) can compile and
run a governed 22-stage build, but profiles had no lifecycle, image intent
was coupled to hardware, partitions were not modeled, package resolution was
not reproducible, and a failed 30-minute build had to restart from stage one.

## Decision

> **Image intent and hardware target are separated. Builds are planned,
> preflighted, persisted and resumable. Published profile revisions are
> immutable. Build events stream to the platform.**

### 1. Profile lifecycle (IMG-031)

`ImageProfileLifecycle`: draft -> validating -> ready -> building -> verified
-> published -> deprecated, with a transition table (`validate`, `approve`,
`start-build`, `verify`, `publish`, `deprecate`, `reopen`). Published
revisions are immutable; validation advances the revision.

### 2. Profile import/export (IMG-032)

Deferred to the UI slice; the profile registry already version-manages
manifests.

### 3. Hardware targets (IMG-033)

`HardwareTarget` catalog separates image intent from hardware: generic
x86_64/ARM64, virtual machine (QEMU/OVMF), Raspberry Pi 4, server standard,
custom. Each defines firmware (UEFI/BIOS), secure boot, TPM, GPU/Wi-Fi,
storage, drivers, kernel modules, firmware packages.

### 4. Partition designer (IMG-034)

`PartitionLayout` (GPT/MBR, EFI/BIOS-boot/root/A-B/recovery/swap/data) with
`validatePartitionLayout` catching impossible layouts before build: total
exceeding disk, missing EFI on GPT, unpaired A/B slots, swap fs mismatch,
alignment. `defaultDesktopLayout` models EFI + Recovery + A + B + encrypted
data.

### 5. Configuration integration (IMG-035)

Deferred: the Configuration Module already owns the shared config universe;
image-specific settings flow through the profile manifest.

### 6. Package lock/resolution (IMG-036)

`resolvePackages` produces a deterministic, hashed lock manifest with
deduplication warnings — reproducibility for image builds (`image.lock`).

### 7. BuildPlan V2 (IMG-037)

`compileBuildPlanV2` compiles profile + hardware target + partition layout +
package lock into an ordered plan where each stage is `ready`/`blocked`/
`pending`, with blocking errors, warnings, estimated size and a plan hash.
Still never contains arbitrary shell commands.

### 8. Preflight engine (IMG-038)

`runPreflight` checks profile identity, architecture match, repository
reachability, disk/memory, tools (QEMU/OVMF), output writability and signing
material before a build — verdict READY / READY WITH WARNINGS / BLOCKED.
Fundamental failures are found before the build, not halfway through.

### 9. Persistent BuildRun + checkpoints (IMG-039/040)

`BuildRunController` owns the run lifecycle (queued -> running -> completed/
failed/cancelled), persists every stage transition as a checkpoint, and
`resume` continues from the last completed stage instead of restarting.
Stages are idempotent where practical.

### 10. Build event streaming (IMG-041)

Every transition publishes typed events (`image.build.started`,
`image.profile.*`) through the EventBus — the UI streams instead of polling.

### 11. Build logs (IMG-042)

Stage runs carry per-stage log lines (`appendLog`) as part of the run model.

## Consequences

- New control API: `/api/v2/image/hardware-targets`, `/partitions/*`,
  `/profiles/:id/lifecycle`, `/profiles/:id/transition`, `/packages/:id/lock`,
  `/plan-v2`, `/preflight`, `/runs` (+ resume, get, list). OpenAPI regenerated.
- 22 new tests (16 unit + 6 integration). 569 total.
- IMG-043..058 (generator integration, boot artifact generation, rootfs
  backend, assembler, QEMU runtime, automated boot verification, visual
  checkpoints, boot performance, SBOM, evidence bundle, signing, sealing,
  publishing, release history) follow.
