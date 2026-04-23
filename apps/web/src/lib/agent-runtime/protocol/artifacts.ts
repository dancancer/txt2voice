export interface ArtifactEnvelope<TPayload> {
  id: string;
  kind: string;
  version: string;
  createdAt: string;
  payload: TPayload;
}

export const ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT =
  "character-memory-snapshot";
export const ARTIFACT_KIND_CHARACTER_RESOLUTION_EVIDENCE =
  "character-resolution-evidence";

export const createArtifactEnvelope = <TPayload>(
  artifact: ArtifactEnvelope<TPayload>
): ArtifactEnvelope<TPayload> => artifact;
