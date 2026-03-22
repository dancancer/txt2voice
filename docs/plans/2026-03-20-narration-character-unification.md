# Narration Character Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make narration a real per-book character so new script writes, manual edits, and audio synthesis all use the same character/speaker/voice pipeline.

**Architecture:** Add a system-role marker to `CharacterProfile`, introduce a small narration-character helper for idempotent lookup/create, then route every new narration write through that helper instead of `characterId = null`. Keep read compatibility for legacy rows, but produce only the new shape going forward.

**Tech Stack:** Next.js, TypeScript, Prisma, Jest

---

### Task 1: Add narration system-role model support

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Modify: `apps/web/src/types/book.ts`
- Create: `apps/web/src/lib/narration-character.ts`
- Test: `apps/web/src/lib/__tests__/narration-character.test.ts`

**Step 1: Write the failing test**
- Cover idempotent narration character creation.
- Cover reuse of an existing narration system role.

**Step 2: Run test to verify it fails**
- Run: `npm test -- --runInBand src/lib/__tests__/narration-character.test.ts`

**Step 3: Write minimal implementation**
- Add `isSystemRole` and `systemRoleType` to Prisma schema.
- Implement `ensureNarrationCharacter()` and `isNarrationCharacter()`.

**Step 4: Run test to verify it passes**
- Run: `npm test -- --runInBand src/lib/__tests__/narration-character.test.ts`

### Task 2: Route new script writes through real narration character

**Files:**
- Modify: `apps/web/src/lib/script-generator/storage/persistence.ts`
- Test: `apps/web/src/lib/__tests__/narration-persistence.test.ts`

**Step 1: Write the failing test**
- Verify narration lines are persisted with a real `characterId`.
- Verify dialogue lines still behave unchanged.

**Step 2: Run test to verify it fails**
- Run: `npm test -- --runInBand src/lib/__tests__/narration-persistence.test.ts`

**Step 3: Write minimal implementation**
- Ensure narration character exists before save.
- Bind narration lines to that character and normalize `rawSpeaker` / `roleType`.

**Step 4: Run test to verify it passes**
- Run: `npm test -- --runInBand src/lib/__tests__/narration-persistence.test.ts`

### Task 3: Make manual script edits create and enforce narration role consistency

**Files:**
- Modify: `apps/web/src/lib/script-sentence-service.ts`
- Modify: `apps/web/src/lib/script-sentence-contract.ts`
- Modify: `apps/web/src/app/books/[id]/script/components/EditSentenceModal.tsx`
- Modify: `apps/web/src/app/books/[id]/studio/script/page-container/hooks/actions/useScriptSentenceActions.ts`
- Test: `apps/web/src/lib/__tests__/script-sentence-narration.test.ts`

**Step 1: Write the failing test**
- Verify updating/creating a narration sentence binds the narration character.
- Verify narration system role is available in the editor without a fake sentinel.

**Step 2: Run test to verify it fails**
- Run: `npm test -- --runInBand src/lib/__tests__/script-sentence-narration.test.ts`

**Step 3: Write minimal implementation**
- Normalize sentence payloads server-side.
- Use real narration character IDs in the UI.

**Step 4: Run test to verify it passes**
- Run: `npm test -- --runInBand src/lib/__tests__/script-sentence-narration.test.ts`

### Task 4: Protect narration system role in character management APIs

**Files:**
- Modify: `apps/web/src/app/api/books/[id]/characters/route.ts`
- Modify: `apps/web/src/app/api/books/[id]/characters/[characterId]/route.ts`
- Modify: `apps/web/src/app/books/[id]/characters/table.tsx`
- Modify: `apps/web/src/hooks/useBookCharacters.ts`
- Test: `apps/web/src/lib/__tests__/character-system-role-policy.test.ts`

**Step 1: Write the failing test**
- Verify narration system role cannot be renamed, disabled, or deleted.
- Verify character list includes real narration role rows only.

**Step 2: Run test to verify it fails**
- Run: `npm test -- --runInBand src/lib/__tests__/character-system-role-policy.test.ts`

**Step 3: Write minimal implementation**
- Remove fake projection helper.
- Enforce API guardrails for system roles.

**Step 4: Run test to verify it passes**
- Run: `npm test -- --runInBand src/lib/__tests__/character-system-role-policy.test.ts`

### Task 5: Verify audio generation prefers real narration bindings

**Files:**
- Modify: `apps/web/src/lib/audio-generator.ts`
- Test: `apps/web/src/lib/__tests__/audio-generator-narration-route.test.ts`

**Step 1: Write the failing test**
- Verify narration with real bindings does not need fallback.
- Verify fallback still works for legacy/null-character narration.

**Step 2: Run test to verify it fails**
- Run: `npm test -- --runInBand src/lib/__tests__/audio-generator-narration-route.test.ts`

**Step 3: Write minimal implementation**
- Keep fallback for legacy rows.
- Prefer bound narration character candidates when present.

**Step 4: Run test to verify it passes**
- Run: `npm test -- --runInBand src/lib/__tests__/audio-generator-narration-route.test.ts`

### Task 6: Regenerate Prisma client and run focused verification

**Files:**
- Modify: `apps/web/src/generated/prisma/*` (generated)
- Create: `apps/web/prisma/migrations/*`

**Step 1: Regenerate schema artifacts**
- Run: `npx prisma migrate dev --name narration-system-role`

**Step 2: Run focused tests**
- Run: `npm test -- --runInBand src/lib/__tests__/narration-character.test.ts src/lib/__tests__/narration-persistence.test.ts src/lib/__tests__/script-sentence-narration.test.ts src/lib/__tests__/character-system-role-policy.test.ts src/lib/__tests__/audio-generator-narration-route.test.ts`

**Step 3: Run typecheck**
- Run: `npm run typecheck`
