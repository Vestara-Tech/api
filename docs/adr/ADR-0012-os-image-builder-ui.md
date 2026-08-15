# ADR-0012 — OS Image Builder UI (IMG-UI-001..004)

- Status: accepted
- Date: 2026-08-15
- Applies to: IMG-UI-001 — IMG-UI-004

## Context

The OS Image Builder is a compiler/assembler of Vestara platform capabilities
into a bootable artifact. It needs an engineering workspace, not an installer
wizard: design, validate, build, boot-test, publish. The image wire contract
previously exposed only profile summaries, which could not drive such an
editor.

## Decision

### 1. Three-pane builder workspace

`vestara-apps/os-image-builder` uses **configuration navigation → builder
canvas → live image inspector**. The inspector stays visible across sections so
the consequences of configuration changes are always apparent (target,
architecture, estimated size, boot experience, applications footprint, profile
hash, plan).

### 2. Derived contracts, one source of truth

`src/image/contracts.ts` is the single source of truth; the existing
`scripts/generate-frontend-contracts.ts` serializer also emits the image
contracts into `vestara-apps/os-image-builder/src/api/contracts.ts`. The UI
never hand-models the image.

### 3. Full profile over the wire

The image API was enriched: `GET /api/v2/image/profiles/:id`, and
`PATCH /api/v2/image/profiles/:id` which merges a patch and recomputes the
deterministic profile hash (IMG-001). Profiles remain intent manifests; the UI
edits the manifest, and the build plan compiles from it.

### 4. Presets, not blank forms

Users start from Vestara Desktop / Developer / Server / Recovery / Custom and
modify the result — no Debian image construction knowledge required.

### 5. Boot Experience is a timeline editor

Boot layers (firmware → GRUB → Plymouth → Startup → Login) are presented as an
editable timeline with a per-stage preview canvas. This is the visual surface
for GRUB configuration (SYS-019..022), boot presentation (SYS-015..025),
Startup (DESK-001..008) and Login (LOGIN-001..014) contracts.

### 6. Applications come from the catalog

The selector is registry-driven (an app catalog in the UI), with core
required apps dependency-locked — removing a required app is explained, never
silently allowed. Build remains governed: the Build page runs the approved
22-stage pipeline and surfaces per-stage detail plus sealed evidence.

## Consequences

- A usable vertical slice verified end-to-end against the live API by
  `pnpm test:ui` (profiles, three-pane builder, Boot Experience).
- IMG-UI-005+ remain: full build-plan preview, QEMU verification surface
  (streaming framebuffer), and evidence/artifact publishing screen.
