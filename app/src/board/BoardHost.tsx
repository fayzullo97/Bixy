import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Board } from './Board';
import { fetchDoodleCatalog, type DoodleCatalog } from './doodleCatalog';
import { parseBoardScript } from './validate';
import { presentPerfectSample } from './samples/present-perfect';
import type { BoardScript, QuizQuestion } from './types';
import { useBoardFonts } from './fonts';
import { FONT_REGULAR } from './fonts';

/**
 * Loads what the board needs — Caveat fonts + the doodle catalog — validates the
 * script against the catalog, then plays it. In Phase 3 the script is the static
 * §8.2 sample; Phase 4 will swap in generated scripts behind the same interface.
 */
export function BoardHost({
  seekTo,
  showSubtitles,
  script: providedScript,
  resumeFromBeatId,
  appendSegment,
  gradeFillIn,
  onProgress,
}: {
  seekTo?: number;
  showSubtitles?: boolean;
  /** A generated script to play; when omitted, the static §8.2 sample is used. */
  script?: BoardScript;
  /** Resume playback from this saved `last_completed_beat` (§8.9/§9.1). */
  resumeFromBeatId?: number | null;
  /** A re-explanation segment to append to the live board (§8.5). */
  appendSegment?: { nonce: number; note: string; beats: BoardScript['beats'] };
  /** Server-backed fill-in-the-blank grader (§8.11); omitted for the offline sample. */
  gradeFillIn?: (q: QuizQuestion, answer: string) => Promise<boolean>;
  /** Persist incremental lesson/quiz progress (§8.9); omitted when there's no session. */
  onProgress?: (patch: {
    status?: 'started' | 'passed';
    quiz_score?: number | null;
    last_completed_beat?: number | null;
    mastered?: boolean;
  }) => void;
}) {
  const fontsLoaded = useBoardFonts();
  const [catalog, setCatalog] = useState<DoodleCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDoodleCatalog()
      .then(setCatalog)
      .catch((e) => setError(`Couldn't load doodles: ${String(e)}`));
  }, []);

  const script = useMemo(() => {
    if (!catalog) return null;
    try {
      return parseBoardScript(providedScript ?? presentPerfectSample, new Set(catalog.keys()));
    } catch (e) {
      setError(String(e));
      return null;
    }
  }, [catalog, providedScript]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!fontsLoaded || !catalog || !script) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#5aa9ff" />
      </View>
    );
  }
  return (
    <Board
      script={script}
      catalog={catalog}
      seekTo={seekTo}
      showSubtitles={showSubtitles}
      resumeFromBeatId={resumeFromBeatId}
      appendSegment={appendSegment}
      gradeFillIn={gradeFillIn}
      onProgress={onProgress}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c', padding: 24 },
  error: { fontFamily: FONT_REGULAR, color: '#ff6b6b', fontSize: 18, textAlign: 'center' },
});
