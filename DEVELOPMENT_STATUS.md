# ngx-stonescriptphp-client Development Status

**Last Updated:** 2026-01-14 08:30 UTC
**Current Version:** 1.1.2 (published on npm)
**Target Version:** 1.2.0 (in development)

## Project Overview

Angular HTTP client library for StoneScriptPHP backends. Used by production apps:
- `progalaxy-platform/www` - Student platform
- `btechrecruiter-platform/ats` - ATS platform

## Architecture Requirements

**CRITICAL:** This library MUST be:
- ✅ **Fetch-based** (native fetch API, NOT Angular HttpClient)
- ✅ **Promise-based** (NOT RxJS Observables)
- ✅ **Zero RxJS dependency** (as documented in CLAUDE.md)
- ✅ Compatible with Angular 19+ and 20+

## Current Session Goals

### Primary Objectives
1. Test integration with `progalaxy-platform/www` without publishing to npm
2. Verify client works with progalaxy API server (signup, login, create project)
3. Ensure Promise-based architecture (remove RxJS if present)
4. Publish working version to npm once verified
5. Refactor and cleanup based on learnings

### Multi-Session Plan

#### Phase 1: Setup & Cleanup ⏳ IN PROGRESS
- [x] Understand architecture and dependencies
- [x] Analyze progalaxy-platform/www integration
- [x] Identify RxJS/HttpClient contamination in src/lib/
- [ ] **NEXT:** Remove src/lib/ directory (contains Angular HTTP + RxJS)
- [ ] Restore src/index.ts to Promise-based exports
- [ ] Verify no RxJS/HttpClient imports remain

#### Phase 2: Local Development Setup 📋 PENDING
- [ ] Build library: `npm run build`
- [ ] Create npm link: `cd dist && npm link`
- [ ] Link to progalaxy: `cd progalaxy-platform/www && npm link @progalaxyelabs/ngx-stonescriptphp-client`
- [ ] Start progalaxy API server
- [ ] Start progalaxy www with linked client

#### Phase 3: API Server Study 📋 PENDING
- [ ] Explore `/api/src/App/Routes/` for endpoint definitions
- [ ] Document signup endpoint (method, path, request/response)
- [ ] Document login endpoint (method, path, request/response)
- [ ] Document create project endpoint (method, path, request/response)
- [ ] Verify auth flow (cookie vs body mode in v2.1.x)

#### Phase 4: Integration Testing 📋 PENDING
- [ ] Test signup flow with progalaxy
- [ ] Test login flow with progalaxy
- [ ] Test create project flow with progalaxy
- [ ] Verify token refresh works
- [ ] Test error handling scenarios

#### Phase 5: Publish 📋 PENDING
- [ ] Bump version to 1.2.0 in package.json
- [ ] Update CHANGELOG.md
- [ ] Commit working changes
- [ ] Push to GitHub
- [ ] Publish to npm: `npm run publish:npm`
- [ ] Update progalaxy package.json to use ^1.2.0

#### Phase 6: Refactor & Cleanup 📋 PENDING
- [ ] Remove unused code
- [ ] Improve TypeScript types
- [ ] Update documentation
- [ ] Consider features for future versions

## Recent Commits

### Session 2026-01-14 (Current)
- **4da14ef** - `feat: Add Angular HTTP-based auth module with UI components`
  - ⚠️ **WARNING:** This commit introduces RxJS/HttpClient (30 files, 3,919 lines)
  - Contains: AuthService, LoginComponent, Guards, Interceptor
  - **ACTION REQUIRED:** Must be reverted/removed before testing

- **2c4e1fc** - `docs: update documentation for v1.1.2`

## Known Issues & Blockers

### 🚨 Critical Issues
1. **src/lib/ contamination**: Contains Angular HttpClient + RxJS code
   - Files: `src/lib/auth/services/auth.service.ts` (uses HttpClient)
   - Files: `src/lib/auth/interceptors/auth.interceptor.ts` (uses HttpInterceptorFn)
   - **Impact:** Breaks Promise-based architecture
   - **Resolution:** Delete entire `src/lib/` directory

2. **src/index.ts modified**: Now exports `./lib` instead of original services
   - Original exports removed: `auth.service`, `token.service`
   - **Resolution:** Restore original exports

### ⚠️ Warnings
- Progalaxy has **local copy** of ApiConnectionService at `www/src/app/services/api-connection.service.ts`
- Need to verify if local copy should be replaced with library version
- Library version at v1.0.0 in progalaxy, published version is v1.1.2

## File Locations

### This Library
- **Root:** `/ssd2/projects/progalaxy-elabs/divisions/opensource/stonescriptphp/ngx-stonescriptphp-client`
- **Source:** `src/`
- **Build Output:** `dist/` (created by `npm run build`)
- **Published Files:** Content of `dist/` after ng-packagr build

### Progalaxy Platform
- **Frontend:** `/ssd2/projects/progalaxy-elabs/divisions/student-platforms/progalaxy/progalaxy-platform/www`
- **API Server:** `/ssd2/projects/progalaxy-elabs/divisions/student-platforms/progalaxy/progalaxy-platform/api`
- **Package.json:** `www/package.json` (uses `@progalaxyelabs/ngx-stonescriptphp-client": "^1.0.0"`)

### StoneScriptPHP Framework
- **Server Skeleton:** `/ssd2/projects/progalaxy-elabs/divisions/opensource/stonescriptphp/StoneScriptPHP-Server`
- **Core Framework:** `/ssd2/projects/progalaxy-elabs/divisions/opensource/stonescriptphp/StoneScriptPHP`
- **DB Gateway Client:** `/ssd2/projects/progalaxy-elabs/divisions/opensource/stonescriptphp/stonescriptdb-gateway-client`
- **DB Gateway:** `/ssd2/projects/progalaxy-elabs/divisions/opensource/stonescriptdb-gateway/stonescriptdb-gateway` (on devvmlocal)

## Key Files to Monitor

### In This Library
- `src/index.ts` - Public API exports (currently broken)
- `src/api-connection.service.ts` - Main HTTP client (fetch-based, Promise)
- `src/token.service.ts` - Token storage
- `src/auth.service.ts` - Stub auth service
- `src/csrf.service.ts` - CSRF token handling
- `package.json` - Version and dependencies

### In Progalaxy
- `www/src/app/services/api-connection.service.ts` - Local copy (may be outdated)
- `www/src/app/services/auth.service.ts` - Uses ApiConnectionService
- `www/src/app/app.config.ts` - NgxStoneScriptPhpClientModule import
- `www/package.json` - Client library dependency

## Environment & Tools

- **Node Version:** (check with `node --version`)
- **npm Version:** (check with `npm --version`)
- **Angular CLI:** v20.0.0 (in progalaxy)
- **TypeScript:** ~5.8.0
- **ng-packagr:** ^20.0.0 (for building library)

## Session Handoff Checklist

Before ending each session, update this document with:
- [ ] Current phase and completed tasks
- [ ] Any new blockers or issues discovered
- [ ] Next immediate action to take
- [ ] Any important findings or decisions made
- [ ] Git status (committed changes, uncommitted changes)

## Next Session Start Checklist

When starting a new session:
- [ ] Read this document first
- [ ] Check git status: `git status`
- [ ] Verify no uncommitted changes or review them
- [ ] Continue from "NEXT" action in current phase
- [ ] Update "Last Updated" timestamp at top

## Notes & Decisions

### Decision Log
1. **2026-01-14:** Committed src/lib/ code despite RxJS conflict - will delete in next step
   - Rationale: Keep as history, then revert to clean state

2. **2026-01-14:** Decided to use `npm link` for local testing
   - Alternative considered: Direct file copy (rejected - harder to maintain)
   - Alternative considered: npm pack + install from tarball (rejected - slower iteration)

3. **2026-01-14:** Confirmed library MUST be Promise-based
   - Progalaxy uses Promise pattern extensively
   - No RxJS in current working implementation
   - New HttpClient code cannot be used

### Future Considerations
- **Standalone TypeScript Client:** Plan to develop `stonescriptphp-ts-client` next month
- **Framework-agnostic:** Would work with React, Vue, vanilla JS
- **Code sharing:** ngx client could potentially wrap the TS client

## Contact & Resources

- **StoneScriptPHP Docs:** https://stonescriptphp.org
- **npm Package:** https://www.npmjs.com/package/@progalaxyelabs/ngx-stonescriptphp-client
- **GitHub Repo:** https://github.com/progalaxyelabs/ngx-stonescriptphp-client
- **Maintainer:** pradeepkumardesk@gmail.com

---

**Session Status:** 🟡 IN PROGRESS - Phase 1 (Setup & Cleanup)
**Next Action:** Remove src/lib/ directory and restore Promise-based exports
