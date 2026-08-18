# Generated Platform Summary

Generated from the current repository state.

## Overview

| Metric | Value |
|---|---|
| Routes in OpenAPI | 341 |
| Registered capabilities | 35 |
| Enabled capabilities | 35 |
| Source areas | 47 |
| ADRs | 50 |

## Package scripts

| Script | Command |
|---|---|
| `verify` | `tsx scripts/verification/verify.ts affected` |
| `verify:affected` | `tsx scripts/verification/verify.ts affected` |
| `verify:static` | `tsx scripts/verification/verify.ts static` |
| `openapi:generate` | `tsx scripts/generate-openapi.ts` |
| `openapi:check` | `tsx scripts/check-openapi.ts` |
| `contracts:frontend` | `tsx scripts/generate-frontend-contracts.ts` |
| `contracts:frontend:check` | `tsx scripts/check-frontend-contracts.ts` |
| `docs:sync` | `tsx scripts/docs/sync.ts` |
| `docs:check` | `tsx scripts/docs/check.ts` |
| `docs:verify` | `tsx scripts/docs/verify.ts` |
| `docs:commit` | `tsx scripts/git/commit-docs.ts` |
| `docs:push` | `tsx scripts/git/push-docs.ts` |
| `docs:ship` | `tsx scripts/docs/ship.ts` |

## Source areas

| Source area | Category | Files |
|---|---|---|
| `src/activity-room/` | module | 6 |
| `src/agent/` | module | 12 |
| `src/ai/` | module | 27 |
| `src/appbuilder/` | module | 3 |
| `src/auth/` | module | 18 |
| `src/bootstrap/` | support | 73 |
| `src/browser/` | module | 9 |
| `src/builder/` | module | 15 |
| `src/builder-plane/` | module | 8 |
| `src/capabilities/` | module | 1 |
| `src/car/` | module | 17 |
| `src/component/` | module | 6 |
| `src/config/` | support | 3 |
| `src/configuration/` | module | 16 |
| `src/context/` | module | 11 |
| `src/core/` | support | 7 |
| `src/dashboard/` | module | 13 |
| `src/database/` | module | 7 |
| `src/diagnostics/` | module | 6 |
| `src/execution/` | module | 7 |
| `src/file/` | module | 8 |
| `src/generation-plane/` | module | 5 |
| `src/generator/` | module | 14 |
| `src/image/` | module | 21 |
| `src/log/` | module | 6 |
| `src/login/` | module | 8 |
| `src/marketplace/` | module | 22 |
| `src/milestone/` | module | 5 |
| `src/onboarding/` | module | 17 |
| `src/os/` | module | 8 |
| `src/pagebuilder/` | module | 4 |
| `src/permission/` | module | 7 |
| `src/plugins/` | support | 5 |
| `src/routes/` | support | 46 |
| `src/skill/` | module | 7 |
| `src/startup/` | module | 8 |
| `src/system/` | module | 30 |
| `src/task/` | module | 6 |
| `src/template/` | module | 7 |
| `src/test/` | module | 12 |
| `src/theme/` | module | 8 |
| `src/tool/` | module | 8 |
| `src/types/` | support | 1 |
| `src/user/` | module | 7 |
| `src/verification/` | module | 6 |
| `src/worker/` | module | 12 |
| `src/workflow/` | module | 6 |

## Capabilities

| Namespace | Version | Enabled | Permissions | Operations |
|---|---|---:|---|---|
| `agents` | v2 | yes | agent.read, agent.run, agent.tools, agent.skills | agent.list, agent.run.start, agent.run.list, agent.run.cancel, agent.tools.list, agent.skills.list |
| `ai` | v2 | yes | ai.generate, ai.stream, ai.embed, ai.models.read, ai.providers.read, ai.routing.read, ai.usage.read | ai.models.list, ai.providers.list, ai.routing.resolve, ai.generate, ai.stream, ai.usage.list |
| `application-builder` | v2 | yes | application.read, application.write, application.publish | applications.list, application.create, application.get, application.update, application.remove, application.transition, application.model |
| `auth` | v2 | yes | auth.identity.manage, auth.session.manage, auth.credential.manage | auth.login, auth.logout, auth.identity.read, auth.session.list, auth.session.revoke, auth.permission.check |
| `browser` | v2 | yes | browser.read, browser.interact, browser.authenticate, browser.execute-script | browser.profiles.list, browser.session.create, browser.navigate, browser.screenshot, browser.sessions.list, browser.evidence.list |
| `builder` | v2 | yes | builder.definitions.manage | builder.definition.create, builder.definition.read, builder.definition.update, builder.definition.delete, builder.definition.validate, builder.definition.preview, builder.definition.publish, builder.definition.rollback, builder.ai.generate, builder.ai.modify, builder.ai.review, builder.ai.explain, builder.ai.test, builder.ai.document |
| `car` | v2 | yes | car.read, car.runtimes, car.sessions, car.gateway | car.runtimes.list, car.select, car.session.create, car.gateway.execute, car.health |
| `components` | v2 | yes | component.read, component.manage, component.compose | components.list, component.get, component.categories, component.search, component.register, component.trees, component.tree.validate |
| `config` | v2 | yes | config.read, config.write, config.validate, config.resolve, config.watch, config.history, config.rollback, config.schema.register | config.schema.list, config.resolve, config.draft.create, config.draft.validate, config.draft.apply, config.scope.rollback, config.scope.revisions |
| `context` | v2 | yes | context.read, context.provide, context.snapshot | context.collect, context.providers.list, context.snapshots.list |
| `dashboard` | v2 | yes | dashboard.read, dashboard.write, dashboard.publish | dashboards.list, dashboard.create, dashboard.get, dashboard.update, dashboard.remove, dashboard.clone, dashboard.reset, dashboard.publish, dashboard.validate, dashboard.projection, widgets.list |
| `database` | v2 | yes | database.read, database.define, database.migrate, database.query | database.definitions.list, database.definition.create, database.migration.plan, database.connections.list, database.connection.test, database.query |
| `diagnostics` | v2 | yes | diagnostics.read, diagnostics.run | diagnostics.checks.list, diagnostics.run, diagnostics.runs.list, diagnostics.finding |
| `files` | v2 | yes | file.read, file.list, file.stat, file.search, file.write, file.transaction | file.workspaces.list, file.workspace.read, file.workspace.list, file.workspace.search, file.transaction.create, file.transaction.preview, file.transaction.apply |
| `generator` | v2 | yes | generator.run, generator.plan, generator.discover, generator.apply | generator.list, generator.discover, generator.plan, generator.run, generator.preview, generator.apply, generator.compatibility |
| `image` | v2 | yes | image.read, image.plan, image.build | image.profiles.list, image.plan, image.build, image.build.state |
| `login` | v2 | yes | login.read, login.authenticate, login.session | login.capabilities.read, login.users.list, login.authenticate, login.session.start, login.preAuth.check |
| `logs` | v2 | yes | log.read, log.write, log.export | logs.query, logs.tail, logs.stats, logs.sources, logs.emit |
| `marketplace` | v2 | yes | marketplace.read, marketplace.install, marketplace.manage | marketplace.packages.list, marketplace.search, marketplace.categories, marketplace.install, marketplace.enable, marketplace.disable, marketplace.uninstall, marketplace.update, marketplace.rollback, marketplace.installed |
| `marketplace-v2` | v2 | yes | marketplace.read, marketplace.install, marketplace.publish, marketplace.manage | marketplace.contributions, marketplace.resolve, marketplace.bundles, marketplace.distributions, marketplace.publish, marketplace.publishers, marketplace.published |
| `milestones` | v2 | yes | milestone.read, milestone.manage, milestone.verify | milestones.list, milestone.create, milestone.get, milestone.tasks, milestone.progress, milestone.health, milestone.verify, milestone.complete |
| `onboarding` | v2 | yes | onboarding.read, onboarding.plan, onboarding.approve, onboarding.execute | onboarding.state.read, onboarding.begin, onboarding.steps.list, onboarding.environment.discover, onboarding.profile.list, onboarding.plan.build, onboarding.plan.approve, onboarding.execute, onboarding.execution.status, onboarding.execution.resume, onboarding.execution.rollback, onboarding.verify, onboarding.ready |
| `os` | v2 | yes | os.inspect, os.packages.read, os.services.read, os.kernel.read, os.users.read, os.configuration.propose, os.update.plan, os.package.install, os.package.remove, os.package.upgrade, os.package.hold, os.package.repositories, os.user.create, os.user.delete, os.update.apply, os.recovery.execute, os.kernel.apply | os.inspect, os.packages.read, os.services.read, os.kernel.read, os.users.read, os.configuration.propose, os.update.plan, os.package.install, os.package.remove, os.package.upgrade, os.package.hold, os.package.repositories, os.user.create, os.user.delete, os.update.apply, os.recovery.execute, os.kernel.apply |
| `page-builder` | v2 | yes | page.read, page.write, page.publish | pages.list, page.create, page.get, page.update, page.remove, page.validate, page.diff |
| `permissions` | v2 | yes | permission.read, permission.manage, permission.delegate, permission.grant | permission.list, permission.evaluate, permission.effective, permission.roles.list, permission.grant, permission.delegate, permission.temp.issue |
| `startup` | v2 | yes | startup.read, startup.progress, startup.service.update | startup.state.read, startup.progress.read, startup.services.read, startup.service.update, startup.transition |
| `system` | v2 | yes | — | system.status, system.health |
| `system-module` | v2 | yes | system.firmware.read, system.firmware.secureBoot.read, system.hardware.cpu.read, system.hardware.memory.read, system.hardware.storage.read, system.hardware.network.read, system.tpm.read, system.boot.entries.read, system.boot.next.read, system.slot.read, system.boot.next.write, system.slot.switch, system.recovery.scheduleBoot, system.boot.splash.apply, system.boot.presentation.read, system.boot.presentation.preview, system.boot.presentation.apply, system.boot.presentation.restore, system.boot.splash.read, system.boot.splash.restore, system.boot.grubTheme.read, system.boot.grubTheme.apply, system.boot.logo.read, system.boot.logo.capabilities, system.boot.logo.apply, system.boot.logo.restore, system.boot.grub.read, system.boot.grub.preview, system.boot.grub.configuration.apply, system.boot.grub.configuration.rollback, system.boot.grub.regenerate, system.boot.grub.entry.setDefault, system.boot.grub.entry.setNext, system.boot.grub.theme.apply, system.boot.grub.theme.restore, system.power.reboot, system.power.shutdown, system.firmware.update, system.firmware.logo.apply, system.secureBoot.key.write, system.bootloader.replace | system.firmware.read, system.firmware.secureBoot.read, system.hardware.cpu.read, system.hardware.memory.read, system.hardware.storage.read, system.hardware.network.read, system.tpm.read, system.boot.entries.read, system.boot.next.read, system.slot.read, system.boot.next.write, system.slot.switch, system.recovery.scheduleBoot, system.boot.splash.apply, system.boot.presentation.read, system.boot.presentation.preview, system.boot.presentation.apply, system.boot.presentation.restore, system.boot.splash.read, system.boot.splash.restore, system.boot.grubTheme.read, system.boot.grubTheme.apply, system.boot.logo.read, system.boot.logo.capabilities, system.boot.logo.apply, system.boot.logo.restore, system.boot.grub.read, system.boot.grub.preview, system.boot.grub.configuration.apply, system.boot.grub.configuration.rollback, system.boot.grub.regenerate, system.boot.grub.entry.setDefault, system.boot.grub.entry.setNext, system.boot.grub.theme.apply, system.boot.grub.theme.restore, system.power.reboot, system.power.shutdown, system.firmware.update, system.firmware.logo.apply, system.secureBoot.key.write, system.bootloader.replace |
| `tasks` | v2 | yes | task.read, task.manage, task.transition, task.assign | tasks.list, task.create, task.get, task.assign, task.transition, task.dependencies, task.result, task.events |
| `templates` | v2 | yes | template.read, template.write, template.instantiate | templates.list, template.get, template.register, template.instantiate, template.listKinds, template.remove |
| `tests` | v2 | yes | test.read, test.run, test.evidence | tests.suites.list, tests.suite.create, tests.run, tests.runners.list |
| `themes` | v2 | yes | theme.read, theme.write, theme.publish | themes.list, theme.get, theme.register, theme.css, theme.mui, theme.os, theme.resolve |
| `users` | v2 | yes | user.read, user.self.profile, user.self.preferences, user.invite, user.create, user.suspend, user.delete, user.membership | user.read, user.self.profile, user.self.preferences, user.invite, user.create, user.suspend, user.delete, user.membership |
| `verification` | v2 | yes | verification.read, verification.run | verification.latest, verification.run |
| `workflows` | v2 | yes | workflow.read, workflow.define, workflow.publish, workflow.run, workflow.observe | workflow.list, workflow.create, workflow.validate, workflow.publish, workflow.run.start, workflow.run.list, workflow.run.cancel, workflow.run.resume, workflow.run.retry |

## ADR index

| ADR | Status | Title |
|---|---|---|
| `ADR-0002-api-builder-definition-runtime` | accepted | ADR-0002 — API Builder: Definition Runtime & AI Governance |
| `ADR-0003-authentication-platform` | accepted | ADR-0003 — Authentication Platform (AUTH-001..006) |
| `ADR-0004-configuration-platform` | accepted | ADR-0004 — Configuration Platform (CONFIG-001..008) |
| `ADR-0005-generator-platform` | accepted | ADR-0005 — Generator Platform (GEN-001..006) |
| `ADR-0006-onboarding-platform` | accepted | ADR-0006 — Onboarding Platform (ONB-001..009) |
| `ADR-0007-system-firmware-platform` | accepted | ADR-0007 — System/Firmware Platform (SYS-001..014) |
| `ADR-0008-startup-platform` | accepted | ADR-0008 — Startup Platform (DESK-001..008) |
| `ADR-0009-login-platform` | accepted | ADR-0009 — Login Platform (LOGIN-001..014) |
| `ADR-0010-os-image-builder` | accepted | ADR-0010 — OS Image Builder Platform (IMG-001..026) |
| `ADR-0011-api-builder-ui` | accepted | ADR-0011 — API Builder UI and derived frontend contracts (API-UI-001..005) |
| `ADR-0012-os-image-builder-ui` | accepted | ADR-0012 — OS Image Builder UI (IMG-UI-001..004) |
| `ADR-0013-ai-platform` | accepted | ADR-0013 — AI Platform Module (AI-001..006 foundation) |
| `ADR-0014-agent-platform` | accepted | ADR-0014 — Agent Platform (AGENT-001..006 + TOOL-001..005 + SKILL-001..005) |
| `ADR-0015-workflow-module` | accepted | ADR-0015 — Workflow Module (WF-001..015) |
| `ADR-0016-file-module` | accepted | ADR-0016 — File Module (FILE foundation) |
| `ADR-0017-context-module` | accepted | ADR-0017 — Context Module (CTX foundation) |
| `ADR-0018-permission-module` | accepted | ADR-0018 — Permission Module (PERM foundation) |
| `ADR-0019-coding-agent-runtime` | accepted | ADR-0019 — Coding Agent Runtime (CAR foundation) |
| `ADR-0020-marketplace-module` | accepted | ADR-0020 — Marketplace Module (MKT foundation) |
| `ADR-0021-generation-plane` | accepted | ADR-0021 — Generation Plane (GEN-X) |
| `ADR-0022-diagnostics-module` | accepted | ADR-0022 — Diagnostics Module (DIAG-001..009) |
| `ADR-0023-log-module` | accepted | ADR-0023 — Log Module (LOG-001..010) |
| `ADR-0024-database-module` | accepted | ADR-0024 — Database Module (DB-001..007) |
| `ADR-0025-test-module` | accepted | ADR-0025 — Test Module (TEST-001..007) |
| `ADR-0026-browser-module` | accepted | ADR-0026 — Browser Module (BRW-001..009) |
| `ADR-0027-task-module` | accepted | ADR-0027 — Task Module (TASK-001..008) |
| `ADR-0028-milestone-module` | accepted | ADR-0028 — Milestone Module (MS-001..009) |
| `ADR-0029-test-module-expanded` | accepted | ADR-0029 — Expanded Test Module (TEST-001..023) |
| `ADR-0030-config-expanded` | accepted | ADR-0030 — Expanded Configuration (CONFIG-009..016) |
| `ADR-0031-component` | accepted | ADR-0031 — Component Module (COMP-001..013) |
| `ADR-0032-image-connectivity` | accepted | ADR-0032 — OS Image Builder Connectivity & Diagnostics (IMG-027..030) |
| `ADR-0033-image-builder-v2` | accepted | ADR-0033 — Image Builder V2 (IMG-031..042) |
| `ADR-0034-image-execution` | accepted | ADR-0034 — Image Execution, Verification & Publishing (IMG-043..058) |
| `ADR-0035-system-v2` | accepted | ADR-0035 — System Module V2 (SYS-026..056) |
| `ADR-0036-system-daemon` | accepted | ADR-0036 — System Daemon, Approvals & Integrations (SYS-052..064) |
| `ADR-0037-os-module` | accepted | ADR-0037 — OS Module (OS-001..007) |
| `ADR-0038-builder-platform` | accepted | ADR-0038 — Page Builder & Application Builder (PAGE-001..013, APP-001..006) |
| `ADR-0039-user-module` | accepted | ADR-0039 — User Module (USR-001..015) |
| `ADR-0040-dashboard` | accepted | ADR-0040 — Dashboard Module + Builder + Generator (DASH-001..020, DASH-BLD, DASH-GEN) |
| `ADR-0041-theme` | accepted | ADR-0041 — Theme Module (THEME-001..014) |
| `ADR-0042-template` | accepted | ADR-0042 — Template Module (TPL-001..018) |
| `ADR-0043-builder-plane-v2` | accepted | ADR-0043 — Builder Plane v2 (BuilderSession / DefinitionDraft) |
| `ADR-0044-ai-v2-profiles-routing` | accepted | ADR-0044 — AI Module v2: Profiles, Provider States, Routing (AI2-001..010) |
| `ADR-0045-ai-v2-runtime` | accepted | ADR-0045 — AI Module v2: Sessions, Budget, Usage, Trace, Evidence (AI2-011..020) |
| `ADR-0046-ai-v2-evaluation` | accepted | ADR-0046 — AI Module v2: Evaluation, Comparison, Baselines (AI2-021..025) |
| `ADR-0047-marketplace-v2` | accepted | ADR-0047 — Marketplace v2: Universal Capability Distribution (MKT2-001..020) |
| `ADR-0048-admin-first-no-backend-workspace-module` | accepted | ADR-0048 — Admin-first shared UI strategy; no new backend Workspace module |
| `ADR-0049-project-module-deferred` | accepted | ADR-0049 — Defer a standalone Project Module until it owns real invariants |
| `ADR-0050-ai-assisted-theme-generation` | accepted | ADR-0050 — AI-assisted theme generation through prompt-driven drafts |
| `ADR-0051-worker-module-background-jobs-and-scheduling` | accepted | ADR-0051 — Worker module for background jobs and scheduling |
