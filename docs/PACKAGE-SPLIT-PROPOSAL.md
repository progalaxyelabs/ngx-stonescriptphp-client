# Package Split Proposal

**Status:** Draft — iterating
**Created:** 2026-04-29
**Problem:** ngx-stonescriptphp-client evolved into a monolithic auth system instead of staying an adapter. Violates SRP. No isolated test harness. Every change triggers publish/integrate/discover cycle.

---

## Current State (~6200 LOC)

### Services (2455 LOC)

| File | LOC | Responsibility | Problem |
|------|-----|----------------|---------|
| auth.service.ts | 529 | OAuth, OTP, session, multi-tenant, multi-server | Does too much |
| provider-registry.service.ts | 312 | Auth provider management | |
| files.service.ts | 309 | File upload/download | Unrelated to auth |
| my-environment.model.ts | 226 | Environment config types | |
| api-connection.service.ts | 184 | HTTP client with token injection | Core adapter |
| auth.plugin.ts | 176 | Plugin interfaces | Core adapter |
| token.service.ts | 139 | Token storage | Core adapter |
| csrf.service.ts | 43 | CSRF token handling | Core adapter |
| Others | ~537 | Misc | |

### Components (3743 LOC)

| File | LOC | Problem |
|------|-----|---------|
| tenant-login.component.ts | 1559 | Monster component — all auth UI in one file |
| tenant-register.component.ts | 777 | |
| register.component.ts | 469 | |
| login-dialog.component.ts | 414 | |
| month-year-picker.component.ts | 196 | **Not auth-related — should not be in this library** |
| auth-page.component.ts | 143 | |
| tenant dialogs | ~185 | |

### Documentation Overhead

12 markdown files for one library:
- AUTH-PROVIDER-CONFIG.md
- CLAUDE.md
- DEVELOPMENT_STATUS.md
- HLD.md
- INTERFACE-SPECIFICATION.md
- MODAL-AUTH-SPEC.md
- MULTI-AUTH-SERVER.md
- MULTI_TENANT_USAGE.md
- README.md
- SPEC.md
- TESTING-GUIDE.md
- docs/AUTH_COMPATIBILITY.md
- docs/CHANGELOG.md

---

## Root Cause Analysis

1. **Designed for medstoreapp** — only owner/employee roles
2. **aasaanwork integration** — discovered client/consultant roles, library too narrow
3. **OAuth testing** — discovered need for local OAuth server, custom provider support
4. **No PDCA cycle** — changes go directly to npm, tested in prod integration
5. **No test harness** — library can only be tested inside a full platform

---

## Proposed Split

### Package 1: @progalaxyelabs/ngx-stonescriptphp-client (ADAPTER)

**Purpose:** Thin HTTP adapter for StoneScriptPHP backends. Stable. Rarely changes.

**Contents (~400 LOC):**
```
src/
├── api-connection.service.ts    # HTTP client with token injection
├── token.service.ts             # Token storage abstraction
├── csrf.service.ts              # CSRF handling
├── auth.plugin.ts               # AuthPlugin interface (contract only)
├── api-response.model.ts        # Response types
└── index.ts                     # Public exports
```

**Exports:**
- `ApiConnectionService` — HTTP client
- `TokenService` — token storage
- `CsrfService` — CSRF handling
- `AUTH_PLUGIN` — injection token
- `AuthPlugin` — interface (no implementation)
- `AuthResult`, `OtpSendResponse`, `OtpVerifyResponse` — types

**Does NOT include:**
- Any UI components
- OAuth flow orchestration
- Multi-tenant logic
- Provider registry
- Files service (move to separate package or platforms)

**Stability:** This package should be frozen after v2.0. Changes only when StoneScriptPHP protocol changes.

---

### Package 2: @progalaxyelabs/ngx-auth-system (SYSTEM)

**Purpose:** Full auth orchestration system. Evolves with platform needs.

**Contents (~5000 LOC):**
```
src/
├── auth.service.ts              # Auth orchestration
├── provider-registry.service.ts # Provider management
├── environment.model.ts         # Config types
├── components/
│   ├── tenant-login.component.ts
│   ├── tenant-register.component.ts
│   ├── login-dialog.component.ts
│   ├── register.component.ts
│   ├── auth-page.component.ts
│   └── dialogs/
└── plugins/
    ├── progalaxyelabs-auth.plugin.ts   # For progalaxyelabs-auth server
    └── stonescriptphp.plugin.ts        # For legacy StoneScriptPHP backends
```

**Features:**
- OAuth popup flow (Google, GitHub, LinkedIn, Apple, Microsoft, Zoho)
- Email OTP flow
- Multi-tenant support (tenant selection, onboarding checks)
- Multi-server switching
- Provider registry with DI
- All auth UI components

**Stability:** Evolves as platforms discover new requirements. Platforms opt-in to upgrades.

---

### Package 3: Platform-specific auth plugins (NOT opensource)

**Purpose:** Custom auth logic that varies per platform. Lives in platform codebase, not npm.

**Example structure in medstoreapp-platform:**
```
docker/portal/src/app/auth/
├── medstoreapp-auth.plugin.ts   # Implements AuthPlugin
├── medstoreapp-roles.ts         # owner, employee role handling
└── medstoreapp-onboarding.ts    # Platform-specific onboarding
```

**Example structure in aasaanwork-platform:**
```
docker/portal/src/app/auth/
├── aasaanwork-auth.plugin.ts    # Implements AuthPlugin
├── aasaanwork-roles.ts          # client, consultant, admin roles
└── aasaanwork-onboarding.ts     # Platform-specific onboarding
```

**Benefits:**
- No "library too narrow" — custom logic lives locally
- No npm publish cycle for platform-specific changes
- Each platform can evolve independently

---

### Removed from library

| Item | Move to |
|------|---------|
| month-year-picker.component.ts | Separate UI kit or inline in platforms |
| files.service.ts | Separate @progalaxyelabs/ngx-files package or inline |

---

## Dependency Graph

```
Platform App
    │
    ├── @progalaxyelabs/ngx-stonescriptphp-client (adapter)
    │       │
    │       └── Provides: ApiConnectionService, TokenService, AUTH_PLUGIN token
    │
    ├── @progalaxyelabs/ngx-auth-system (system)
    │       │
    │       ├── Depends on: ngx-stonescriptphp-client
    │       └── Provides: AuthService, components, built-in plugins
    │
    └── Platform-specific plugin (local)
            │
            └── Implements: AuthPlugin interface from adapter
```

---

## Migration Path

### Phase 1: Extract adapter (v2.0)
1. Create new package structure
2. Move adapter files to Package 1
3. Keep Package 2 as current ngx-stonescriptphp-client minus adapter
4. Update platforms to import from both packages

### Phase 2: Stabilize adapter
1. Write unit tests for adapter (isolated, no auth flows)
2. Freeze adapter API
3. Publish adapter as v2.0

### Phase 3: Test harness for system
1. Create minimal Angular app that imports auth-system
2. Mock backend or use progalaxyelabs-auth in test mode
3. Playwright tests for all auth flows
4. PDCA cycle happens here, not in platforms

### Phase 4: Platform plugin extraction
1. Identify platform-specific auth code in each platform
2. Move to local plugin structure
3. Remove from shared auth-system package

---

## Open Questions

1. Should files.service.ts be a separate package or inline in platforms?
2. Should auth-system be opensource or internal-only?
3. How to handle platforms currently on v1.x during migration?
4. Should we use file: dependency during migration or publish intermediates?

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-29 | Propose split into adapter + system + plugins | SRP violation, no test harness, integration-only testing |
| 2026-04-29 | Use Azure-hosted Verdaccio for private npm | Eliminates localhost Docker issues, single URL for dev+prod, token auth |

---

## Infrastructure: Private npm Registry

**Task #2433** — Setting up Verdaccio on Azure App Service.

### Why Azure App Service (not local)
- localhost:4873 doesn't work inside Docker builds without networking hacks
- Running Verdaccio on both dev machine and swarm manager requires syncing
- Single Azure instance = single source of truth, accessible from anywhere

### Configuration
- **URL:** https://progalaxyelabs-test-packages.azurewebsites.net
- **Auth:** Token-based (`//progalaxyelabs-test-packages.azurewebsites.net/:_authToken=${NPM_TOKEN}`)
- **Scope:** `@progalaxyelabs/*` packages are local-only, others proxied to npmjs
- **Cost:** ~$14/month (B1 App Service + Storage)

### Usage in projects

**.npmrc (all Angular projects):**
```
registry=https://progalaxyelabs-test-packages.azurewebsites.net/
//progalaxyelabs-test-packages.azurewebsites.net/:_authToken=${NPM_TOKEN}
```

**Dockerfile:**
```dockerfile
ARG NPM_TOKEN
RUN echo "//progalaxyelabs-test-packages.azurewebsites.net/:_authToken=${NPM_TOKEN}" > ~/.npmrc \
    && npm ci --omit=dev
```

**docker-compose.yaml:**
```yaml
build:
  args:
    NPM_TOKEN: ${NPM_TOKEN}
```

### Workflow after setup
1. Agent implements feature in ngx-stonescriptphp-client
2. `npm publish` → goes to Verdaccio (no 2FA, no approval needed)
3. Platforms do `npm update` → pulls from Verdaccio
4. Iterate until stable
5. When ready for public: `npm publish --registry https://registry.npmjs.org/`

---

*This document will be iterated. Add notes below.*

## Notes

