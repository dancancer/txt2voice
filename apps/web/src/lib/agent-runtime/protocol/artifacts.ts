export interface ArtifactEnvelope<TPayload> {
  id: string;
  kind: string;
  version: string;
  createdAt: string;
  payload: TPayload;
}
