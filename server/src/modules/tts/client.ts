/**
 * Provider-neutral TTS contract (§9.1). The generation pipeline depends only on
 * this — swapping the concrete provider (Aisha, and previously VoiceLab) is a
 * change to the implementation behind it, not to the pipeline, storage, or cache.
 */
export interface TtsClient {
  /** False when no API key is configured — the pipeline then skips audio. */
  readonly enabled: boolean;
  /** Synthesizes one narration into a single WAV (chunking + rejoining as needed). */
  synthesize(text: string, language: string): Promise<Buffer>;
}
