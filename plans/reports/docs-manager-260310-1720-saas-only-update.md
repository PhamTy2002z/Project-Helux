# Documentation Update: SaaS-Only, Subscription Billing Model
**Report Date**: 2026-03-10
**Reporter**: docs-manager
**Status**: Completed

## Summary
Updated all project documentation to accurately reflect that Mission Control is a **SaaS-only platform with subscription billing** (trial → pro tiers). Removed all self-hosted deployment references from user-facing documentation. Internal Docker Compose setup remains for development/staging use, clarified as team-only, not customer-deployable.

## Changes Made

### 1. `docs/project-overview-pdr.md` (4 updates)
- **Line 9**: Updated Core Mission to emphasize SaaS platform model with subscription
- **Line 14**: Changed Primary Users from "self-hosted environments" → "SaaS platform"
- **Lines 182-191**: Updated Constraints & Assumptions section
  - Constraint: "Self-hosted deployment model" → "SaaS-only platform (subscription model: trial → pro tiers)"
  - Assumption: "Users have technical expertise to deploy and operate" → "Users subscribe to use the platform (trial or paid tier)"
  - Assumption: "Organizations manage their own infrastructure" → "We manage platform infrastructure and availability"
- **Line 198**: Removed unresolved question #4 "Should we provide managed hosting in addition to self-hosted?" (resolved: SaaS-only)

### 2. `docs/reference/authentication.md` (3 updates)
- **Lines 13-14**: Added clarification that `self_hosted` profile is for development/internal staging only, NOT production
- **Line 20**: Changed "self-hosted or development environments" → "development or internal staging environments"
- **Lines 26, 32, 42, 48**: Added annotations "(development/staging only)" to all `self_hosted` profile references
- Made clear distinction: `saas` profile is for production, `self_hosted` is team-only

### 3. `docs/reference/billing-v1-scope.md` (2 updates)
- **Line 1**: Removed "(Simulated Unlock)" from title — billing is now the real model
- **Lines 4-5**: Updated Goals section
  - New framing: "Ship a SaaS subscription model with trial and paid tiers"
  - Clarified: v1 uses simulated billing to validate flows before v2 integrates real providers
- **Lines 40-44**: Changed "Out Of Scope" to "Out Of Scope (v1)" with roadmap notes
  - Added "(coming in v2 with Stripe/Paddle integration)" to real provider checkout pages
  - Clarified tax, proration, refunds are v2 features

### 4. `docs/deployment/README.md` (1 update)
- **Line 3**: Reframed deployment section purpose
  - Old: "deploying Mission Control in self-hosted environments"
  - New: "internal deployment of Mission Control for development and staging environments. For production SaaS access, users subscribe to our platform at no self-deployment required."
- **Line 6**: Updated Goal to specify "for the development team"

### 5. `docs/project-roadmap.md` (1 update)
- **Lines 583-584**: Removed two resolved unresolved questions:
  - Removed: "Should we offer managed hosting in addition to self-hosted?" (resolved: SaaS-only)
  - Removed: "What is the long-term pricing model (if any)?" (resolved: subscription model)

### 6. `docs/deployment-guide.md` (1 update)
- **Line 85**: Changed deployment context from "self-hosted deployments" → "development and internal staging deployments"

## Files Modified Summary

| File | Changes | Key Points |
|------|---------|-----------|
| project-overview-pdr.md | 4 edits | Core mission, users, constraints, assumptions, removed Q4 |
| reference/authentication.md | 3 edits | Clarified self_hosted is dev-only, saas is production |
| reference/billing-v1-scope.md | 2 edits | Updated goals, clarified v1 scope and v2 roadmap |
| deployment/README.md | 1 edit | Reframed as internal dev deployment, SaaS access for users |
| project-roadmap.md | 1 edit | Removed 2 resolved questions (#4, #5) |
| deployment-guide.md | 1 edit | Changed context from self-hosted to dev/staging |

**Total: 6 files, 12 targeted edits**

## Documentation Narrative Update
- **Before**: Platform supports "self-hosted deployment model" with option for future managed hosting
- **After**: Platform is SaaS-only with subscription billing (free trial → paid pro tiers)
- **Internal Deployment**: Docker Compose setup exists for development/staging team use, not customer-deployable

## Consistency Across Docs
All references now aligned:
- Users access via SaaS subscription (trial or paid)
- Developers use Docker Compose for internal staging (not customer-facing)
- `self_hosted` AUTH_PROFILE is development convenience only
- `saas` AUTH_PROFILE is production standard
- Billing is moving from simulated (v1) to real providers (v2)

## No Changes Required
The following files already correctly reflected SaaS model and required no updates:
- `code-standards.md`
- `system-architecture.md`
- `codebase-summary.md`
- `operations/` folder
- `testing/` folder
- `development/` folder
- `release/` folder

## Validation Notes
- All links and cross-references remain valid (no file renames/moves)
- Formatting and structure preserved (only content changes)
- Changes are backward-compatible with existing deployment scripts
- Internal team workflows unaffected (Docker Compose still works for dev/staging)

## Edge Cases Preserved
1. **Development team**: Can still use `self_hosted` profile for internal staging
2. **Auth flexibility**: Local bearer token mode still available for internal deployments
3. **Simulated billing**: v1 continues with simulated mode, v2 roadmap clear for real providers
4. **No breaking changes**: All existing configurations and deployments remain functional

## Success Criteria Met
- [x] Removed all self-hosted user deployment references
- [x] Clarified SaaS-only business model in core mission and constraints
- [x] Updated assumptions to reflect subscription model
- [x] Removed resolved questions about hosting/pricing model
- [x] Clarified internal vs. production deployment contexts
- [x] Updated billing scope with v2 roadmap clarity
- [x] All edits are minimal and focused (no rewrites)
- [x] Documentation maintains consistent narrative across all files

## Unresolved Questions
None. All documentation changes complete and validated.
