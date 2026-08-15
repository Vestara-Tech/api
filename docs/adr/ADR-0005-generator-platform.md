# ADR-0005 — Generator Platform (GEN-001..006)

- Status: accepted
- Date: 2026-08-15
- Applies to: GEN-001 — GEN-006

## Context

Vestara needs a general artifact generation platform (API clients, database
schemas, integrations, packages, tests, docs) shared by all builders. It must
be deterministic, evidence-oriented, and AI-optional. It must also be an
independent platform module, not an API submodule.

## Decision

### 1. Generator is a platform module, not an API submodule

Dependency direction is `API → Generator`. Generator consumes
`ConfigurationSnapshot`, never the Configuration service directly. It can later
become a separately installable Vestara package.

### 2. Generation is a governed pipeline

`REQUEST → PLAN → GENERATE → ARTIFACT SET → VALIDATE → PREVIEW/DIFF →
POLICY/APPROVAL → APPLY → VERIFY → EVIDENCE`. `Generate ≠ Write`: generators
produce an `ArtifactSet`; an apply port + policy writes files later (GEN-007+).

### 3. Deterministic by construction

`GenerationEvidence` captures generator version + input hash + configuration
hash + template hashes → output hash → evidenceHash. Same inputs ⇒ same
evidence. Config is snapshotted immutably (snapshotHash) into the context.

### 4. Secrets are references, never handed to generators

Generators see `secret://` references only. A generator must declare
`requiresSecrets` and receive policy approval to be granted anything more; most
code generators never need credentials.

### 5. AI stays above the deterministic core

`Vestara AI → intent/proposal → Generator (deterministic transformation) →
Artifacts`. Vestara runs fully without AI; installing AI adds `Generate with
AI`, `Modify with AI`, planning, and review capabilities.

### 6. Templates are registered, versioned capabilities

The template platform (GEN-004) keeps deterministic rendering separate from
AI-assisted generation.

## Consequences

- All builders (API, Database, Auth, Integration, Workflow, Agent) share one
  generation bus and review/apply model.
- Marketplace generators produce ArtifactSets and go through policy before any
  filesystem write.
- First boot onboarding can discover installed generators and dynamically
  compose the installation experience.
