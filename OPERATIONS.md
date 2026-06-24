# MSFrog n8n Package Release and Handoff Runbook

This document is the operational handoff for releasing and maintaining `n8n-nodes-msfrog`.

## 1) Accounts and Ownership

### 1.1 Create company npm owner account

1. Go to https://www.npmjs.com/signup.
2. Create a dedicated company owner account (shared mailbox, not a personal mailbox).
3. Enable 2FA for this account and use auth-and-writes mode.
4. Store recovery codes in the company password vault.

### 1.2 Optional: create npm organization

1. Create an npm organization if your company prefers team ownership.
2. Transfer package ownership to the org once initial publishing is complete.

### 1.3 Required access

Ensure the release engineer has:

1. Admin or maintainer rights on GitHub repo: `lgauciAiro/msfrog-n8n-community-node`.
2. Publish rights on npm package: `n8n-nodes-msfrog`.
3. Access to edit GitHub Actions settings.

## 2) Repository Baseline

Before any release:

1. Use `main` as the default and release branch.
2. Verify workflow file exists at `.github/workflows/publish.yml`.
3. Verify package metadata in `package.json`:
   - `name` is `n8n-nodes-msfrog`
   - `repository`, `homepage`, and `bugs` point to GitHub
   - `publishConfig` includes `access: public` and `provenance: true`
4. Verify docs:
   - Client docs in `README.md`
   - Developer docs in `dev-readme.md`

## 3) npm Trusted Publisher Setup (Recommended)

In npm package settings for `n8n-nodes-msfrog`:

1. Open Trusted Publishers.
2. Add a GitHub trusted publisher with:
   - Repository owner: `lgauciAiro`
   - Repository: `msfrog-n8n-community-node`
   - Workflow file: `publish.yml`
   - Branch: `main` (if prompted)

Fallback if needed:

1. Create npm granular token with publish access for this package.
2. Add GitHub secret `NPM_TOKEN` in repo settings.

## 4) Local Pre-Release Validation

Run from repo root:

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. Optional: `npm pack`
5. Confirm clean status: `git status`

Do not release if lint or build fails.

## 5) Functional Smoke Testing in n8n

Validate core behavior in an n8n test environment:

1. Install the package (`n8n-nodes-msfrog`) in test n8n.
2. Create MSFrog credential with a valid API token.
3. Run quick operation checks:
   - User -> Get Self
   - Workflow -> Get Many or Get Types
   - Workflow Entry -> Get Many and Create Workflow Entry
   - Task -> Create New Task
4. Import and run examples:
   - `examples/client-email-triage-sample.workflow.json`
   - `examples/client-email-triage-gmail-inbox.workflow.json`

## 6) Release Procedure

### 6.1 Standard release using tags

1. Ensure you are on latest `main`.
2. Bump version in `package.json` (or use `npm version patch|minor|major`).
3. Commit and push version change.
4. Create and push a version tag matching `v*` (example: `v0.1.1`).
5. GitHub Actions `Publish to npm` will run automatically on tag push.

### 6.2 Manual workflow runs

Workflow dispatch supports two modes:

1. Validation-only: set `publish=false`.
2. Actual publish: set `publish=true`.

## 7) Post-Release Verification

After publish:

1. Confirm Actions run is green.
2. Confirm new version appears on npm package page.
3. Confirm provenance is present for the release.
4. In clean n8n test env, install that version and run User -> Get Self.
5. Add or update release notes/changelog.

## 8) n8n Verification Submission

Submit through n8n Creator Portal with:

1. npm package link
2. GitHub repository link
3. Short integration description
4. Any requested testing/support details

Checklist before submitting:

1. Package name starts with `n8n-nodes-`.
2. Keyword includes `n8n-community-node-package`.
3. `n8n` metadata in `package.json` points to built credential/node files.
4. Publish done via GitHub Actions with provenance.
5. Lint/build pass on release branch.

## 9) Operational Notes

1. Use `main` as release source of truth.
2. Keep workflow filename as `.github/workflows/publish.yml`.
3. If Actions fails, first inspect lint/build output before publish auth issues.
4. If manual run succeeds with `publish=false` but fails with publish enabled, check Trusted Publisher or `NPM_TOKEN` setup.
