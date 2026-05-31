# Agentic Auto Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an agentic audiobook production workflow that can run from uploaded text to quality-checked per-sentence audio with minimal human intervention.

**Architecture:** Keep the existing sequential `auto-pipeline` as the execution spine, and add a small deterministic orchestration layer around it. Specialist "agents" are implemented as bounded stage planners/evaluators with explicit input/output contracts, not free-form background prompts.

**Tech Stack:** Next.js API routes, Prisma/PostgreSQL, Bull queues, existing `agent-runtime`, existing `auto-pipeline`, `audio-generation-runner`, `quality-check-runner`, VoxCPM2 provider.

---

## Design Principle

The first version should be an orchestrator workflow, not a swarm.

Current code already has the hard parts: text processing, LLM script production, audio routing, TTS synthesis, quality check, manual review, queue heartbeat, replay. The missing layer is a durable decision contract that decides:

- which stage is next
- whether a stage is already complete enough to skip
- which failures can be retried automatically
- which failures must become manual review items
- when completion is blocked by review or stale evidence

Keep `ProcessingTask` as the source of task visibility. Keep stage execution inside existing runners. Do not put business logic directly into upload routes.

Do not decide stage completeness from row counts alone. Every reusable artifact must be tied to a checkpoint:

- `sourceFingerprint`: source file identity and parsing inputs
- `stageVersion`: code/prompt/provider/options version for the stage
- `artifactHash`: stable hash of the artifact set consumed by the next stage
- `taskId`: child task that produced the checkpoint
- `completedAt`: checkpoint completion timestamp

The pipeline may skip a stage only when the checkpoint matches the current source and current stage inputs.

Checkpoint lifecycle is part of the contract:

- when a stage is scheduled to rerun, mark that stage and all downstream checkpoints invalid before any destructive cleanup
- write a completed checkpoint only after the stage succeeds
- if a destructive stage fails, stale downstream checkpoints must remain absent
- update checkpoint state and artifact cleanup in the same transaction where practical; otherwise record an explicit invalidation marker before cleanup starts
- do not store large artifact id lists in `Book.metadata`; store `artifactHash`, counts, and task ids there, and keep full id lists in the producing `ProcessingTask.taskData.metadata`

## Target Workflow

```text
uploaded
  -> text_processing
  -> script_generation
  -> voice_routing
  -> prosody_planning
  -> audio_generation
  -> quality_check
  -> manual_review_gate
  -> review_ready | manual_review_pending | completed_with_errors
```

MVP deliverable is **not** a merged chapter or whole-book download. MVP means:

- every target `ScriptSentence` has a selected latest completed `AudioFile`
- the selected audio set has quality-check coverage
- there are no blocking manual review items
- the auto-pipeline task can report `review_ready`

Final assembly and automatic repair are phase-2 work. If the product requirement changes to "downloadable whole book", final assembly ownership must move back into MVP.

The selected audio set must have one implementation boundary. Do not let auto-pipeline, quality check, manual review, and future final assembly each define "latest audio" differently.

MVP selected audio rule:

- scope is the target `ScriptSentence` set
- select only `AudioFile.status = "completed"` with non-null `sentenceId`
- for each sentence, choose highest `attemptNo`, then newest `createdAt`, then highest stable `id` as tie breaker
- do not use `SynthesisAttempt.isFinal` in MVP because current successful saves may mark every success as final
- `selectedAudioSetHash` input is fixed: hash `{ targetSentenceIdsHash, selectedTuples, missingSentenceIdsHash, missingCount }`
- `selectedTuples` must be ordered by sentence order and contain `sentenceId`, `selectedAudioFileId`, `attemptNo`, and `audioUpdatedAt`
- expose compact hash/count summary, `targetSentenceIdsHash`, missing count, and optional full selected id list
- store compact hash/count in `Book.metadata`; store full id lists on the producing task metadata when needed
- if any target sentence is missing selected audio, MVP must stop at `manual_review_pending` with a structured missing-audio reason instead of pretending the audio stage is complete

## Agent Boundaries

### 1. Pipeline Orchestrator Agent

Owns stage state and transition decisions.

Inputs:

- `bookId`
- current `Book.status`
- child `ProcessingTask` states
- source fingerprint and stage checkpoints
- blocking manual review summary
- quality coverage summary

Outputs:

- next stage
- run/skip/retry/manual-review/fail decision
- structured reason
- queue payload

Files:

- Modify: `apps/web/src/lib/auto-pipeline/common.ts`
- Modify: `apps/web/src/lib/auto-pipeline/runner.ts`
- Create: `apps/web/src/lib/auto-pipeline/orchestrator.ts`
- Create: `apps/web/src/lib/auto-pipeline/checkpoint-store.ts`
- Test: `apps/web/src/lib/__tests__/auto-pipeline-orchestrator.test.ts`

### 2. Selected Audio Set Helper

Defines the single selected-audio contract consumed by auto-pipeline, quality checkpoints, manual review gate, and future final assembly.

Inputs:

- target book/chapter/sentence scope
- completed `AudioFile` rows
- sentence ordering

Outputs:

- selected audio file ids
- selected sentence coverage
- compact `selectedAudioSetHash`
- missing sentence ids

Files:

- Create: `apps/web/src/lib/auto-pipeline/selected-audio-set.ts`
- Test: `apps/web/src/lib/__tests__/selected-audio-set.test.ts`

### 3. Voice Routing Agent

Assigns default voice/engine before audio generation when a character has no explicit voice binding.

Inputs:

- character profiles
- `SpeakerProfile` / `SpeakerEngineVariant`
- configured TTS providers
- script sentence role/emotion/tone

Outputs:

- default provider, `voxcpm`, only when there is no explicit voice configuration
- voice id, default `__voxcpm_default__`
- route metadata
- manual review item only when no usable engine exists

Files:

- Modify: `apps/web/src/lib/audio-generation/routing/voice-route-resolver.ts`
- Modify: `apps/web/src/lib/audio-generation/types.ts`
- Modify: `apps/web/src/lib/task-queue/dedupe.ts`
- Create: `apps/web/src/lib/auto-pipeline/voice-routing-agent.ts`
- Test: `apps/web/src/lib/__tests__/auto-pipeline-voice-routing-agent.test.ts`

### 4. Prosody Planning Agent

Converts script metadata into stable TTS controls.

Inputs:

- `ScriptSentence.tone`
- `ScriptSentence.emotionLabel`
- `ScriptSentence.emotionIntensity`
- `ScriptSentence.prosody`
- route preset `engineParams`

Outputs:

- normalized prosody intent
- provider-neutral speech controls
- provider-specific payload only inside the selected provider adapter

Files:

- Modify: `apps/web/src/lib/audio-generation/synthesis/tts-request-builder.ts`
- Modify: `apps/web/src/lib/tts/types.ts`
- Modify: `apps/web/src/lib/tts/providers/voxcpm.ts`
- Modify: `apps/web/src/lib/voxcpm-service.ts`
- Create: `apps/web/src/lib/audio-generation/synthesis/prosody-control-planner.ts`
- Test: `apps/web/src/lib/__tests__/prosody-control-planner.test.ts`
- Test: `apps/web/src/lib/__tests__/voxcpm-provider.test.ts`
- Test: `apps/web/src/lib/__tests__/qwen3voice-provider.test.ts`

### 5. Human Gate Agent

Keeps manual intervention narrow without confusing "not pending" with "safe to assemble".

Manual review blocks automation when an item is:

- pending
- reprocessing
- rejected because automatic recovery exhausted its budget
- rejected because the failure is marked hard/blocking

Manual review does not block automation when an item is explicitly resolved, waived, or non-blocking.

Minimum manual review contract:

- `status`: `pending | reprocessing | resolved | rejected`
- `resolutionType`: closed project contract, not a historical free-form field
  - resolved/non-blocking: `fixed | waived | false_positive | accepted_risk`
  - blocking/failure: `auto_recovery_exhausted | hard_failure | missing_audio`
  - retry in progress: `retry_requested`
- `issueDetail.blocking`: boolean, default `true` for `pending` and `reprocessing`
- `issueDetail.recoveryExhausted`: boolean, default `false`
- `issueDetail.blockingReason`: optional short machine-readable reason

Development-stage rule: unknown `resolutionType` strings are invalid. Update every writer to emit the closed contract above, and fail tests when any module writes an unknown value. Only `manual-review-gate.ts` may classify these fields into blocking/non-blocking. Other modules should call this helper instead of duplicating Prisma JSON conditions.

`issueDetail.blocking === false` is privileged. It may be written only by explicit human resolution actions or trusted system gates that also set a recognized non-blocking `resolutionType`.

Files:

- Modify: `apps/web/src/lib/manual-review-sync-runner.ts`
- Modify: `apps/web/src/lib/auto-pipeline/runner.ts`
- Modify: `apps/web/src/lib/manual-review/actions/shared.ts`
- Modify: `apps/web/src/lib/manual-review/actions/single-resolve.ts`
- Modify: `apps/web/src/lib/manual-review/actions/batch/resolve.ts`
- Modify: `apps/web/src/lib/quality-check/fast-gate.ts`
- Modify: `apps/web/src/lib/quality-check/reprocessing-dispatch.ts`
- Modify: `apps/web/src/lib/audio-generation/runner/finalize-task.ts`
- Modify: `apps/web/src/lib/audio-generation/runner/followup-quality-check.ts`
- Create: `apps/web/src/lib/auto-pipeline/manual-review-gate.ts`
- Test: `apps/web/src/lib/__tests__/manual-review-gate.test.ts`
- Test: `apps/web/src/lib/__tests__/auto-pipeline-runner.test.ts`

### 6. Quality Repair Agent (Phase 2)

Turns quality failures into bounded automated repair actions.

Inputs:

- `QualityCheckResult`
- failed `AudioFile`
- failed `ScriptSentence`
- current attempt count
- provider failure summary

Outputs:

- retry same route
- retry with lower concurrency
- retry with adjusted `controlInstruction`
- switch fallback engine
- create manual review item

Files:

- Modify: `apps/web/src/lib/quality-check/reprocessing-dispatch.ts`
- Create: `apps/web/src/lib/auto-pipeline/repair-policy.ts`
- Test: `apps/web/src/lib/__tests__/auto-pipeline-repair-policy.test.ts`

Do not implement this in MVP. Existing QC reprocessing and manual review state need to be the source of truth before adding more repair actions.

## Implementation Tasks

### Task 0: Stabilize Prerequisites

Files:

- No required code changes in this plan task.
- Verify current VoxCPM2 provider changes and working tree state before starting orchestration changes.

Steps:

1. Confirm the VoxCPM2 provider integration is reviewed, tested, and either committed or isolated from this work.
2. Confirm unrelated Mastra/runtime/text-splitting changes are not mixed into the orchestration branch.
3. Run:

```bash
git status --short
pnpm --filter web test -- src/lib/__tests__/voxcpm-provider.test.ts src/lib/__tests__/tts-provider-status-route.test.ts --runInBand
pnpm --filter web typecheck
```

Expected:

- orchestration work starts from a known baseline
- PR/review scope does not mix provider integration, runtime migration, and auto-pipeline orchestration

### Task 1: Add Orchestrator Decision Contract

Files:

- Create: `apps/web/src/lib/auto-pipeline/orchestrator.ts`
- Modify: `apps/web/src/lib/auto-pipeline/common.ts`
- Test: `apps/web/src/lib/__tests__/auto-pipeline-orchestrator.test.ts`

Steps:

1. Add `AutoPipelineDecision` type with `action`, `stage`, `reason`, `retryable`, `manualReviewRequired`.
2. Add checkpoint types: `AutoPipelineCheckpoint`, `AutoPipelineStageVersion`, `AutoPipelineSourceFingerprint`.
3. Add checkpoint lifecycle helpers:
   - pure helpers in `orchestrator.ts`: `buildCheckpointPatch`, `markCheckpointInvalid`, `buildStageDecision`
   - persistence helpers in `checkpoint-store.ts`: `readPipelineCheckpoints`, `applyCheckpointPatch`
4. Write tests for complete, skip, stale-checkpoint, invalidated-checkpoint, retry, fail, and manual-review decisions.
5. Implement pure decision functions. No database calls in this file.
6. Store compact serializable checkpoint data in `Book.metadata.autoPipeline.checkpoints`; store full target id lists only on the child `ProcessingTask.taskData.metadata`.
7. Run:

```bash
pnpm --filter web test -- src/lib/__tests__/auto-pipeline-orchestrator.test.ts --runInBand
pnpm --filter web typecheck
```

Expected:

- decision logic is deterministic
- no runner side effects inside the orchestrator
- stale source or stale stage version never produces a skip decision
- invalidated downstream checkpoints cannot produce a skip decision

### Task 2: Add Selected Audio Set Helper

Files:

- Create: `apps/web/src/lib/auto-pipeline/selected-audio-set.ts`
- Test: `apps/web/src/lib/__tests__/selected-audio-set.test.ts`

Steps:

1. Implement a pure selector that accepts completed audio rows and target sentence ids.
2. Select one audio per sentence by highest `attemptNo`, then newest `createdAt`, then stable `id`.
3. Return:
   - `selectedAudioFileIds`
   - `selectedBySentenceId`
   - `missingSentenceIds`
   - `targetSentenceIdsHash`
   - `selectedAudioSetHash`
   - `selectedCount`
   - `missingCount`
4. Build `selectedAudioSetHash` from a stable object:
   - `targetSentenceIdsHash`
   - ordered tuples of `sentenceId`, `selectedAudioFileId`, `attemptNo`, `audioUpdatedAt`
   - `missingSentenceIdsHash`
   - `missingCount`
5. Add tests for duplicate completed audio per sentence, missing sentence audio, deterministic tie breaking, and hash changes when sentence scope/order changes.
6. Run:

```bash
pnpm --filter web test -- src/lib/__tests__/selected-audio-set.test.ts --runInBand
pnpm --filter web typecheck
```

Expected:

- every consumer can share one definition of selected latest audio
- old completed audio is excluded from quality coverage and future final assembly once a newer selected audio exists
- missing target sentence audio is represented explicitly and cannot pass as a complete audio stage

### Task 3: Make Auto Pipeline Re-entrant by Stage Evidence

Files:

- Modify: `apps/web/src/lib/auto-pipeline/runner.ts`
- Modify: `apps/web/src/lib/auto-pipeline/task-stage-utils.ts`
- Test: `apps/web/src/lib/__tests__/auto-pipeline-runner.test.ts`
- Test: `apps/web/src/lib/__tests__/quality-check-runner.test.ts`

Steps:

1. Use `selected-audio-set.ts` as the only source for target audio ids and selected audio hash.
2. Add source fingerprint:
   - `uploadedFilePath`
   - `originalFilename`
   - `fileSize`
   - source content hash when cheap to compute from the uploaded file
   - text processing options
3. Add stage version inputs:
   - text parser version and options
   - script prompt file hash, runtime policy/version, and LLM model config id
   - audio router policy version, provider adapter version, output format, TTS options
   - quality config, signal source config, target audio set hash
4. Add evidence checks:
   - text stage complete only if checkpoint source fingerprint matches and chapters/text segments exist
   - script stage complete only if script checkpoint matches current text artifact hash
   - audio stage complete only if audio checkpoint matches `selectedAudioSetHash` from `selected-audio-set.ts`
   - quality stage complete only if checkpoint records `qualityTaskId`, `selectedAudioSetHash`, `completedAt`, and verdict summary for the current selected audio set
5. Hard constraint for MVP quality: auto-pipeline quality stage must call `runQualityCheckTask` with `type="batch"` and `audioFileIds=selectedAudioFileIds`; do not use book/chapter quality selection that scans all completed audio.
6. If `missingSentenceIds` is non-empty, write a structured manual-review reason and move to `manual_review_pending`; do not write completed audio/quality checkpoints.
7. Before rerunning a stage, invalidate that stage and all downstream checkpoints before invoking any destructive stage logic.
8. After a stage succeeds, write its completed checkpoint and keep downstream checkpoints absent unless they were produced against the new artifact hash.
9. Add a regression test where text rerun fails after downstream cleanup; old script/audio/quality checkpoints must not remain reusable.
10. Add a regression test where one sentence has old and new completed audio; only the selected newer audio id is passed to quality, and the old completed audio is excluded from coverage/hash.
11. Use orchestrator decision before creating each child task.
12. Preserve current child task creation path for stages that must run.
13. Run:

```bash
pnpm --filter web test -- src/lib/__tests__/auto-pipeline-runner.test.ts src/lib/__tests__/quality-check-runner.test.ts --runInBand
pnpm --filter web typecheck
```

Expected:

- replaying an interrupted pipeline skips completed stages
- new upload or changed options invalidates downstream checkpoints
- text rerun failure does not preserve old script/audio/quality checkpoints
- quality coverage is computed only over the selected audio set
- old completed audio cannot satisfy the current selected-audio quality checkpoint
- failed stages keep structured reason in `taskData.metadata`

### Task 4: Default Voice Routing for Zero-touch Audio

Files:

- Create: `apps/web/src/lib/auto-pipeline/voice-routing-agent.ts`
- Modify: `apps/web/src/lib/audio-generation/routing/voice-route-resolver.ts`
- Modify: `apps/web/src/lib/audio-generation/types.ts`
- Modify: `apps/web/src/lib/audio-retry-plan.ts`
- Modify: `apps/web/src/lib/audio-generation/execution/batch-audio-runtime.ts`
- Modify: `apps/web/src/lib/task-queue/dedupe.ts`
- Modify: `apps/web/src/lib/validation.ts`
- Test: `apps/web/src/lib/__tests__/auto-pipeline-voice-routing-agent.test.ts`
- Test: `apps/web/src/lib/__tests__/audio-retry-plan.test.ts`
- Create: `apps/web/src/lib/__tests__/validation.test.ts`

Steps:

1. Replace hard-filter provider semantics with one field: `preferredProvider?: "voxcpm" | "qwen3voice"`.
2. Treat `preferredProvider` as a default/fallback routing preference only. It must never exclude explicit `request.voiceProfileId` or `CharacterVoiceBinding`.
3. Make zero-touch preset use `preferredProvider="voxcpm"`.
4. Update dedupe keys to include `preferredProvider`.
5. Update `AudioGenerationOptionsSchema` so entry points accept:
   - `preferredProvider="voxcpm"`
   - `preferredProvider="qwen3voice"`
   - no `provider`, `defaultProvider`, or `providerMode` dual path
6. Add `resolveEffectiveAudioPolicyProvider(options)`:
   - preferred provider: `options.preferredProvider`
   - fallback: `mixed`
7. Use the effective policy provider in retry plan and batch runtime so VoxCPM default mode still gets conservative concurrency.
8. Preserve priority:
   - explicit `request.voiceProfileId`
   - explicit `CharacterVoiceBinding`
   - `SpeakerEngineVariant`
   - default VoxCPM2 fallback
9. Update tests so non-VoxCPM explicit voice profiles still win under the zero-touch preset.
10. Add validation tests for `preferredProvider` and rejected stale provider-shape payloads.
11. Create manual review only when no provider is healthy and no explicit usable route exists.
12. Run:

```bash
pnpm --filter web test -- src/lib/__tests__/auto-pipeline-voice-routing-agent.test.ts src/lib/__tests__/audio-engine-router.test.ts src/lib/__tests__/audio-retry-plan.test.ts src/lib/__tests__/validation.test.ts --runInBand
pnpm --filter web typecheck
```

Expected:

- books can generate audio without manually assigning every character voice
- explicit user voice settings still win
- preferred provider never filters out explicit user configuration
- VoxCPM preference uses VoxCPM runtime policy, including conservative concurrency

### Task 5: Centralize VoxCPM2 Prosody Control

Files:

- Create: `apps/web/src/lib/audio-generation/synthesis/prosody-control-planner.ts`
- Modify: `apps/web/src/lib/audio-generation/synthesis/tts-request-builder.ts`
- Modify: `apps/web/src/lib/tts/types.ts`
- Modify: `apps/web/src/lib/tts/providers/voxcpm.ts`
- Modify: `apps/web/src/lib/voxcpm-service.ts`
- Test: `apps/web/src/lib/__tests__/prosody-control-planner.test.ts`
- Test: `apps/web/src/lib/__tests__/voxcpm-provider.test.ts`
- Test: `apps/web/src/lib/__tests__/qwen3voice-provider.test.ts`

Steps:

1. Create a provider-neutral `ProsodyIntent` from `tone`, `emotionLabel`, `emotionIntensity`, and `prosody`.
2. Keep `tts-request-builder` responsible only for priority merging and normalized intent.
3. Let the VoxCPM2 provider adapter serialize `ProsodyIntent` into `control_instruction`, `cfg_value`, `inference_timesteps`, `normalize`, and `denoise`.
4. Keep VoxCPM-specific fields out of the generic `TTSRequest`; if a shared type needs extension, add a provider-scoped field such as `providerParams.voxcpm`.
5. Ensure Qwen3Voice does not receive VoxCPM-specific fields.
6. Run:

```bash
pnpm --filter web test -- src/lib/__tests__/prosody-control-planner.test.ts src/lib/__tests__/voxcpm-provider.test.ts src/lib/__tests__/qwen3voice-provider.test.ts --runInBand
pnpm --filter web typecheck
```

Expected:

- VoxCPM2 gets richer instructions automatically
- Qwen3Voice behavior does not regress
- provider-specific fields do not leak into unrelated providers

### Task 6: Add Blocking Manual Review Gate

Files:

- Create: `apps/web/src/lib/auto-pipeline/manual-review-gate.ts`
- Modify: `apps/web/src/lib/auto-pipeline/runner.ts`
- Modify: `apps/web/src/lib/manual-review-sync-runner.ts`
- Modify: `apps/web/src/lib/status.ts`
- Modify: `apps/web/src/lib/validation.ts`
- Modify: `apps/web/src/lib/constants.ts`
- Modify: `apps/web/src/types/book.ts`
- Test: `apps/web/src/lib/__tests__/manual-review-gate.test.ts`
- Test: `apps/web/src/lib/__tests__/auto-pipeline-runner.test.ts`
- Create: `apps/web/src/lib/__tests__/status.test.ts`
- Modify: `apps/web/src/lib/__tests__/validation.test.ts`

Steps:

1. Define exported constants for allowed review status and resolution types.
2. Implement `classifyManualReviewItem(item)` in `manual-review-gate.ts`.
3. Replace current review writers so they emit only the closed `resolutionType` contract:
   - manual approve/edit/save paths emit `fixed`, `waived`, `false_positive`, or `accepted_risk`
   - retry/regenerate paths emit `retry_requested`
   - exhausted automatic paths emit `auto_recovery_exhausted`
   - unrecoverable missing audio or enqueue failures emit `missing_audio` or `hard_failure`
4. Treat `pending` and `reprocessing` as blocking unless a privileged non-blocking resolution has set `issueDetail.blocking === false`.
5. Treat `rejected` as blocking when:
   - `resolutionType` is `auto_recovery_exhausted` or `hard_failure`
   - `issueDetail.recoveryExhausted === true`
   - `issueDetail.blocking === true`
6. Treat only `fixed`, `waived`, `false_positive`, and `accepted_risk` as non-blocking resolved values.
7. Replace `pendingReviewCount === 0` final gate logic with the blocking gate result.
8. Add `audio_review_ready` to status metadata, validation enum, constants, and `BookStatus` type.
9. Add tests that fail on unknown `resolutionType` writes instead of normalizing them.
10. Add a status/validation test so task and book pages do not render `audio_review_ready` as an unknown state.
11. Run:

```bash
pnpm --filter web test -- src/lib/__tests__/manual-review-gate.test.ts src/lib/__tests__/auto-pipeline-runner.test.ts src/lib/__tests__/status.test.ts src/lib/__tests__/validation.test.ts --runInBand
pnpm --filter web typecheck
```

Expected:

- rejected hard failures cannot pass into completion
- non-blocking review history does not stop automation
- all review blocking decisions go through `manual-review-gate.ts`
- `Book.status = "audio_review_ready"` is accepted by validation and shown with intentional status metadata

### Task 7: Add One-click API Preset

Files:

- Create: `apps/web/src/lib/auto-pipeline/presets.ts`
- Modify: `apps/web/src/lib/auto-pipeline-trigger-service.ts`
- Modify: `apps/web/src/app/api/books/[id]/upload/route.ts`
- Create or Modify: `apps/web/src/app/api/books/[id]/auto-pipeline/route.ts`
- Test: `apps/web/src/lib/__tests__/auto-pipeline-preset.test.ts`
- Test: `apps/web/src/lib/__tests__/auto-pipeline-route.test.ts`
- Test: `apps/web/src/lib/__tests__/upload-route.test.ts`

Steps:

1. Add `resolveAutoPipelinePreset("zero_touch_voxcpm")` in service/common code.
2. Define a preset version string, for example `zero_touch_voxcpm@1`.
3. Move preset resolution into `startAutoPipelineTask` or a helper called by it, so every entry point uses the same options.
4. Store `presetId`, `presetVersion`, and `resolvedOptions` in task metadata at creation time.
5. Make normal replay use stored `resolvedOptions`, not the current preset resolver.
6. Add an explicit "refresh preset" path for operators who intentionally want current preset behavior.
7. Keep upload route thin: it may pass a preset id, but it must not build orchestration options inline.
8. Update the existing upload auto-trigger path so default `autoPipelineEnabled=true` goes through the preset resolver.
9. Ensure replay can reuse a running pipeline without changing options.
10. Use `preferredProvider=voxcpm`; do not keep parallel `provider/defaultProvider/providerMode` semantics.
11. Run:

```bash
pnpm --filter web test -- src/lib/__tests__/auto-pipeline-preset.test.ts src/lib/__tests__/auto-pipeline-route.test.ts src/lib/__tests__/upload-route.test.ts --runInBand
pnpm --filter web typecheck
```

Expected:

- one request can start full production
- repeated requests reuse running pipeline instead of creating duplicate work
- upload auto-trigger and explicit auto-pipeline route resolve presets identically
- replay preserves the original resolved options unless explicitly refreshed

### Task 8: Upload Validation Boundary

Files:

- Modify: `apps/web/src/app/api/books/[id]/upload/route.ts`
- Test: `apps/web/src/lib/__tests__/upload-route.test.ts`

Steps:

1. Remove UTF-8 content interpretation from upload validation.
2. Keep upload validation to file presence, extension, and size.
3. Let `text-processor` own encoding detection and empty-text validation.
4. Run:

```bash
pnpm --filter web test -- src/lib/__tests__/upload-route.test.ts src/lib/__tests__/gbk-segmentation.test.ts --runInBand
pnpm --filter web typecheck
```

Expected:

- GBK/UTF-16 files are not rejected before text processing
- upload route does not duplicate text processor responsibility

### Task 9: Final Assembly Ownership (Phase 2)

Files:

- Modify: `apps/web/src/lib/manual-review-sync-runner.ts`
- Modify: `apps/web/src/lib/final-assembly-runner.ts`
- Modify: `apps/web/src/lib/task-queue/ops/worker.ts`
- Test: `apps/web/src/lib/__tests__/manual-review-sync-runner.test.ts`
- Test: `apps/web/src/lib/__tests__/final-assembly-runner.test.ts`

Steps:

1. Make final assembly an independent stage with a scope key: `book/chapter/segment + targetAudioSetHash`.
2. Skip final assembly only when same scope is completed and output exists.
3. Allow only one processing task per final assembly scope.
4. Define exactly one owner for enqueueing final assembly.
5. Run:

```bash
pnpm --filter web test -- src/lib/__tests__/manual-review-sync-runner.test.ts src/lib/__tests__/final-assembly-runner.test.ts --runInBand
pnpm --filter web typecheck
```

Expected:

- no duplicate final assembly tasks for the same audio set
- replay and manual sync cannot overwrite each other's final assembly metadata

### Task 10: Operational Visibility

Files:

- Modify: `apps/web/src/app/tasks/page.tsx`
- Modify: `apps/web/src/components/audio-generation/AudioGenerationStatusCards.tsx`
- Modify: `apps/web/src/lib/slo-alerts/service.ts`
- Test: `apps/web/src/app/__tests__/tasks-page.test.tsx`
- Test: `apps/web/src/components/audio-generation/__tests__/AudioGenerationStatusCards.test.tsx`

Steps:

1. Show current agent/stage decision in task cards.
2. Show skipped/retried/manual-review counts.
3. Surface provider status, especially `voxcpm` health.
4. Run:

```bash
pnpm --filter web test -- src/app/__tests__/tasks-page.test.tsx src/components/audio-generation/__tests__/AudioGenerationStatusCards.test.tsx --runInBand
pnpm --filter web typecheck
```

Expected:

- operators can see what the automation did and why
- no one has to inspect logs for routine pipeline state

## MVP Cut

For the first deploy, do only:

1. Task 0: Stabilize prerequisites
2. Task 1: Orchestrator decision contract
3. Task 2: Selected audio set helper
4. Task 3: Re-entrant stage evidence with fingerprints/checkpoints
5. Task 4: Default VoxCPM2 voice routing
6. Task 5: Prosody intent and provider adapter boundary
7. Task 6: Blocking manual review gate
8. Task 7: One-click API preset
9. Task 8: Upload validation boundary

Defer advanced repair, final assembly ownership changes, and UI polish until the zero-touch happy path is correct.

MVP completion state:

- Do not promise a merged chapter or whole-book file.
- The pipeline may mark itself `review_ready` when selected latest per-sentence audio exists, quality coverage matches the selected audio set hash, and the manual review gate has no blocking items.
- Use `Book.status = "audio_review_ready"` for MVP success, so it cannot be confused with completed merged delivery.
- If the product requires a downloadable whole-book artifact, move Task 9 into MVP before calling the workflow complete.

## Acceptance Criteria

- Uploading a book with auto pipeline enabled can reach review-ready per-sentence audio without manual voice assignment.
- MVP does not claim chapter/book merged delivery.
- VoxCPM2 is the default audio engine only when there is no explicit voice configuration.
- Zero-touch preset uses `preferredProvider="voxcpm"` as a routing preference, not a hard provider filter.
- VoxCPM preference still resolves to VoxCPM runtime/retry policy.
- Selected latest audio is defined only by `selected-audio-set.ts`.
- Selected audio hash includes ordered sentence/audio/attempt/update tuples plus target sentence hash and missing count.
- MVP quality runs only against `type="batch"` with `selectedAudioFileIds`; book/chapter scans over all completed audio are not valid for auto-pipeline evidence.
- Pipeline replay skips completed stages only when source fingerprint, stage version, and artifact hash match.
- Rerunning a destructive stage invalidates current/downstream checkpoints before cleanup and does not leave stale checkpoints after failure.
- Failed stages record structured reasons.
- Blocking manual review status, not raw pending count, controls whether automation may complete.
- Manual review blocking semantics are centralized in `manual-review-gate.ts` with explicit status/resolution/issueDetail contract.
- All review writers emit the closed `resolutionType` contract; unknown values fail tests instead of being normalized.
- `audio_review_ready` is added to status constants, validation, type metadata, and display metadata before the pipeline can emit it.
- Audio option validation accepts `preferredProvider` and rejects stale provider-shape payloads.
- GBK/UTF-16 uploads reach text processing instead of being rejected by upload UTF-8 checks.
- Replay uses stored `resolvedOptions`; preset refresh is explicit.
- `pnpm --filter web typecheck` passes.
- Targeted tests for orchestrator, checkpoints, voice routing, prosody planning, manual review gate, upload validation, and auto pipeline pass.

## Rollout Notes

- Keep provider key `voxcpm` even though the backend is VoxCPM2.
- Default audio concurrency should stay conservative: `batchSize=1` for VoxCPM2 until measured otherwise.
- Do not delete existing manual controls. The automated path should be a preset, not the only path.
- Do not add a separate "agent database" in v1. Use `ProcessingTask.taskData.metadata` and existing domain tables.
- Use `preferredProvider=voxcpm` for zero-touch routing.
- Always compute the audio retry/runtime policy from `resolveEffectiveAudioPolicyProvider`, not directly from provider-shaped request fields.
- Do not use `pendingReviewCount === 0` as a final gate.
- Do not implement repair-policy or final-assembly ownership in the MVP.
- Include prompt file hashes in script stage versions and provider adapter/router policy versions in audio stage versions.
- Store compact hashes in `Book.metadata`; keep large artifact id arrays in task metadata or queryable domain tables.
- Store preset snapshots as `presetId`, `presetVersion`, and `resolvedOptions`; replay must not silently adopt future preset changes.
