# ADR-0034 — Image Execution, Verification & Publishing (IMG-043..058)

- Status: accepted
- Date: 2026-08-15
- Applies to: IMG-043 — IMG-058

## Context

IMG-031..042 made builds planned, preflighted, persisted and resumable. The
remaining ADR-0012 gaps were the actual engineering pipeline: generating the
OS artifacts, assembling the image, boot-verifying it (QEMU), measuring boot
performance, producing SBOM/evidence, signing, sealing and publishing.

## Decision

> **Generate produces artifacts. The image apply port owns writes. A build
> that cannot be boot-verified is not published unless policy explicitly
> permits development artifacts.**

### 1. Generator integration V2 (IMG-043/044)

`generateBootArtifacts` requests artifacts per stage from the Generator
namespace: GRUB config, Plymouth theme, systemd units, login config, desktop/
network config, kernel params, service and application manifests. Maintains
the ADR-0010 invariant: Generate != Write; artifacts are produced here, the
image apply port owns writes.

### 2. Assembler / rootfs backend (IMG-045/046)

`ImageExecutionPipeline` compiles a BuildPlan V2 into concrete artifacts,
assembles and hashes the image (`imageHash` over plan + artifacts + hardware
+ layout), and records every execution result.

### 3. QEMU runtime + automated boot verification (IMG-047/048)

`runBootVerification` verifies the boot sequence (firmware -> GRUB -> kernel
-> initramfs -> systemd -> Vestara services -> login -> desktop) checkpoint
by checkpoint. In the API process QEMU is honestly reported unavailable, so
a build is not boot-verified and therefore not publishable unless dev
builds are permitted.

### 4. Visual boot checkpoints (IMG-049)

`compareVisualCheckpoints` compares observed screenshot hashes at checkpoints
against expected images (Test + Evidence integration).

### 5. Boot performance metrics (IMG-050)

`measureBootPerformance` records per-stage durations (firmware/bootloader/
kernel/userspace/services/login/desktop) plus total and ready latency so OS
optimization is measurable.

### 6. SBOM / evidence / signing / sealing (IMG-053..056)

- `generateSbom` produces an SPDX 2.3 document over locked packages.
- `buildEvidenceBundle` assembles SBOM, verification, performance and
  signatures into a verifiable bundle.
- `signArtifacts` signs payload hashes under a signing policy; policy can
  refuse unsigned builds.
- `sealImage` seals the image with its hash and signatures.

### 7. Publishing + release history (IMG-057/058)

`ReleasePublisher` publishes only verified + signed + sealed builds (unless
policy permits dev artifacts), supersedes prior releases of the same profile,
and records release history.

## Consequences

- New control API: `/api/v2/image/execute`, `/api/v2/image/publish`,
  `/api/v2/image/releases`, `/api/v2/image/releases/:profileId`. OpenAPI
  regenerated and in sync.
- 17 new tests (14 unit + 3 integration). 586 total.
- The OS Image Builder is now a dependable end-to-end pipeline:
  profile -> plan V2 -> preflight -> generation -> assemble -> verify ->
  evidence -> sign -> seal -> publish, with release history.
