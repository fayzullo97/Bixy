import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { BoardHost } from '../board/BoardHost';
import { InputBar } from '../board/InputBar';
import { decideAsk } from '../board/detour';
import type { Beat, BoardScript } from '../board/types';
import { isOffline } from '../net/offline';
import { pickAndEncodeImage, type EncodedImage } from '../net/image';
import { strings, type Lang } from '../i18n';

/**
 * DEV-ONLY: generates a real lesson via the pipeline and plays it on the board.
 * Dev-logs in to get a session (the /lessons endpoint is authed), then renders
 * the generated script through the same renderer the real board uses.
 *
 * Also mounts the single input (§8.5) — the real signed-in flow renders it in
 * PathBoardScreen; wiring it here too means the input (typed detour, photo,
 * re-explanation) is exercisable straight from `?dev=board`. Static screenshot
 * mode (`?beat=N`) omits it.
 */
export function DevBoardScreen({
  topicId,
  text,
  language,
  seekTo,
  showSubtitles,
  resume,
}: {
  topicId?: string;
  text?: string;
  language: Lang;
  seekTo?: number;
  showSubtitles?: boolean;
  /** DEV: resume from the saved last_completed_beat instead of the top (§9.1). */
  resume?: boolean;
}) {
  const t = strings[language];
  const [script, setScript] = useState<BoardScript | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [resumeFromBeatId, setResumeFromBeatId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reexplain, setReexplain] = useState<{ nonce: number; beats: Beat[] } | null>(null);
  const [onDetour, setOnDetour] = useState(false);
  const [inputBusy, setInputBusy] = useState(false);
  const [inputNotice, setInputNotice] = useState<string | null>(null);
  // The topic passed via ?dev=board — a detour can return to it.
  const baseScriptRef = useRef<BoardScript | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { session } = await api.devLogin(language);
        if (active) setSession(session);
        const { board_script } = await api.generateLesson(session, { topic_id: topicId, text, language });
        if (!active) return;
        if (resume) {
          const record = (await api.getProgress(session)).find((p) => p.topic_id === board_script.topic_id);
          if (active && record && record.status !== 'passed') setResumeFromBeatId(record.last_completed_beat);
        }
        if (!active) return;
        baseScriptRef.current = board_script;
        setScript(board_script);
      } catch (e) {
        if (!active) return;
        setError(
          String(e).includes('no_content')
            ? "I don't have information about that."
            : `Generation failed: ${String(e)}`,
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [topicId, text, language, resume]);

  const activeTopicId = script?.topic_id ?? topicId ?? null;

  const handleAsk = useCallback(
    async (input: { text?: string; image?: EncodedImage }) => {
      if (!session) return;
      setInputBusy(true);
      setInputNotice(null);
      try {
        const result = await api.ask(session, {
          text: input.text,
          image: input.image,
          language,
          current_topic_id: activeTopicId,
        });
        const decision = decideAsk(result, activeTopicId);
        if (decision.action === 'detour') {
          setReexplain(null);
          setResumeFromBeatId(null);
          setOnDetour(true);
          setScript(decision.boardScript);
        } else if (decision.action === 'replay') {
          setReexplain(null);
          setResumeFromBeatId(null);
          setScript(decision.boardScript);
        } else if (decision.action === 'reexplain') {
          setReexplain((prev) => ({ nonce: (prev?.nonce ?? 0) + 1, beats: decision.beats }));
        } else {
          setInputNotice(t.askOffTopic);
        }
      } catch {
        setInputNotice(isOffline() ? t.offline : t.lessonFailed);
      } finally {
        setInputBusy(false);
      }
    },
    [session, language, activeTopicId, t],
  );

  const handleAttach = useCallback(async () => {
    setInputNotice(null);
    const picked = await pickAndEncodeImage();
    if (picked === null) return;
    if (typeof picked === 'string') {
      setInputNotice(
        picked === 'too_large' ? t.imageTooLarge : picked === 'unsupported' ? t.imageUnsupported : t.imageUnreadable,
      );
      return;
    }
    await handleAsk({ image: picked });
  }, [handleAsk, t]);

  const backToBase = useCallback(() => {
    if (!baseScriptRef.current) return;
    setReexplain(null);
    setResumeFromBeatId(null);
    setOnDetour(false);
    setScript(baseScriptRef.current);
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!script) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>Generating lesson…</Text>
        <ActivityIndicator color="#5aa9ff" />
      </View>
    );
  }

  const board = (
    <BoardHost
      key={activeTopicId ?? 'none'}
      script={script}
      seekTo={seekTo}
      showSubtitles={showSubtitles}
      resumeFromBeatId={resumeFromBeatId}
      appendSegment={reexplain ? { nonce: reexplain.nonce, note: t.reexplainNote, beats: reexplain.beats } : undefined}
      gradeFillIn={
        session
          ? async (q, answer) => {
              const { correct } = await api.gradeFillIn(session, {
                question: q.question,
                accepted_answers: q.accepted_answers ?? [],
                answer,
              });
              return correct;
            }
          : undefined
      }
      onProgress={session ? (patch) => api.putProgress(session, script.topic_id, patch) : undefined}
    />
  );

  // Static screenshot mode has no input control.
  if (seekTo != null) return board;

  return (
    <View style={styles.fill}>
      {onDetour ? (
        <Pressable onPress={backToBase} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>← {t.detourReturn}</Text>
        </Pressable>
      ) : null}
      {board}
      {inputNotice ? <Text style={styles.notice}>{inputNotice}</Text> : null}
      <InputBar
        placeholder={t.inputPlaceholder}
        attachLabel={t.attachPhoto}
        busy={inputBusy}
        onSend={(value) => handleAsk({ text: value })}
        onAttach={handleAttach}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#12151c' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c', gap: 12 },
  info: { color: '#98a2b3', fontSize: 15 },
  error: { color: '#ff6b6b', fontSize: 16, textAlign: 'center', paddingHorizontal: 24 },
  notice: { color: '#f0b429', fontSize: 14, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  back: { position: 'absolute', top: 14, right: 18, zIndex: 1 },
  backText: { color: '#5b6472', fontSize: 13, textDecorationLine: 'underline' },
});
