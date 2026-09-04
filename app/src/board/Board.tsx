import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Beat, BoardScript, CheckInBeat, FormalBeat, QuizQuestion, StoryBeat } from './types';
import type { DoodleCatalog } from './doodleCatalog';
import { Scene } from './Scene';
import { FormalText } from './FormalText';
import { NoteCard, QuizQuestionCard, type QuizAnswer } from './Quiz';
import { beatDurationMs } from './pacing';
import { playNarration } from './audio';
import { pickReTeachVariant } from './variants';
import { decideMastery } from './mastery';
import { gradeFillInLocally } from './gradeLocal';
import { buildResumeState } from './resume';
import { registerHideBackstop } from '../progress/backstop';
import { FONT_REGULAR } from './fonts';

// The board is one continuous, append-only surface (§8.4/§11): lesson beats, then
// the end-of-topic quiz, then a result — and, on a miss, a re-teach appended below
// and the quiz again. Everything the student has seen stays scrolled above.
type BeatItem = { key: string; kind: 'beat'; beat: Beat };
type QuizItem = { key: string; kind: 'quiz'; qIndex: number; q: QuizQuestion };
type NoteTone = 'info' | 'success' | 'warn';
type NoteItem = { key: string; kind: 'note'; title: string; body?: string; tone: NoteTone };
type BoardItem = BeatItem | QuizItem | NoteItem;

type ProgressPatch = {
  status?: 'started' | 'passed';
  quiz_score?: number | null;
  last_completed_beat?: number | null;
  mastered?: boolean;
};

interface Props {
  script: BoardScript;
  catalog: DoodleCatalog;
  /** 1-based beat count to render statically (dev/screenshot). Omit to auto-play. */
  seekTo?: number;
  showSubtitles?: boolean;
  /** Saved `last_completed_beat` to resume from (§8.9/§9.1): everything up to it is
   *  replayed instantly and playback continues from the next beat. Live mode only. */
  resumeFromBeatId?: number | null;
  /** A re-explanation segment (§8.5) to append to the live board when `nonce`
   *  changes — a continuation of the current lesson, not a reset. */
  appendSegment?: { nonce: number; note: string; beats: Beat[] };
  /** Server-backed fill-in-the-blank grader (§8.11). Falls back to a local check offline. */
  gradeFillIn?: (q: QuizQuestion, answer: string) => Promise<boolean>;
  /** Persist an incremental progress patch (§8.9). No-op when absent (e.g. the sample). */
  onProgress?: (patch: ProgressPatch) => void;
}

function isCheckIn(beat: Beat): beat is CheckInBeat {
  return beat.type === 'formal_beat' && beat.style === 'check_in_question';
}

/** Groups the flat item list into render blocks — consecutive story beats collapse
 *  into one evolving Scene; everything else is its own block. */
function useBlocks(items: BoardItem[]) {
  return useMemo(() => {
    const blocks: Array<
      | { kind: 'scene'; key: string; beats: StoryBeat[]; keys: string[] }
      | { kind: 'formal'; key: string; beat: FormalBeat }
      | { kind: 'quiz'; key: string; item: QuizItem }
      | { kind: 'note'; key: string; item: NoteItem }
    > = [];
    for (const item of items) {
      if (item.kind === 'beat' && item.beat.type === 'story_beat') {
        const last = blocks[blocks.length - 1];
        if (last && last.kind === 'scene') {
          last.beats.push(item.beat);
          last.keys.push(item.key);
        } else {
          blocks.push({ kind: 'scene', key: item.key, beats: [item.beat], keys: [item.key] });
        }
      } else if (item.kind === 'beat') {
        blocks.push({ kind: 'formal', key: item.key, beat: item.beat as FormalBeat });
      } else if (item.kind === 'quiz') {
        blocks.push({ kind: 'quiz', key: item.key, item });
      } else {
        blocks.push({ kind: 'note', key: item.key, item });
      }
    }
    return blocks;
  }, [items]);
}

export function Board({ script, catalog, seekTo, showSubtitles, resumeFromBeatId, appendSegment, gradeFillIn, onProgress }: Props) {
  const live = seekTo == null;
  const quiz = script.quiz ?? [];

  // Resume point (§8.9/§9.1): computed once on mount. Pre-populates the board up to
  // the saved beat as instant history (keys `resume-<id>`), so live playback starts
  // from the next beat instead of the top. Only applies to the first linear pass.
  const resume = useMemo(() => {
    const rs = buildResumeState(script.beats, live ? resumeFromBeatId : null);
    const items: BoardItem[] = rs.doneBeats.map((beat) => ({ key: `resume-${beat.id}`, kind: 'beat', beat }));
    const checkInAnswers: Record<string, number> = {};
    for (const [beatId, index] of Object.entries(rs.answeredCheckIns)) {
      checkInAnswers[`resume-${beatId}`] = index;
    }
    return { items, beatIdx: rs.nextBeatIdx, checkInAnswers };
    // Mount-time only — resuming is a first-render concern, not reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Playback state ---------------------------------------------------------
  const [items, setItems] = useState<BoardItem[]>(resume.items);
  const [phase, setPhase] = useState<'lesson' | 'quiz' | 'done'>('lesson');
  const [lessonBeats, setLessonBeats] = useState<Beat[]>(script.beats);
  const [beatIdx, setBeatIdx] = useState(resume.beatIdx);
  const [passId, setPassId] = useState(0);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  // Answers keyed by the item's unique key, so history stays answered across passes.
  const [checkInAnswers, setCheckInAnswers] = useState<Record<string, number>>(resume.checkInAnswers);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, QuizAnswer>>({});

  const scrollRef = useRef<ScrollView | null>(null);
  const keyRef = useRef(0);
  const mkKey = () => `it-${keyRef.current++}`;
  const beatRevealedRef = useRef<Set<string>>(new Set()); // `${passId}:${beatIdx}` guard
  const quizStartedRef = useRef<Set<number>>(new Set()); // passId guard
  const quizAnswersRef = useRef<Record<string, QuizAnswer>>({});
  const currentQuizKeysRef = useRef<string[]>([]);
  const latestPatchRef = useRef<ProgressPatch | null>(null);

  const reportProgress = useCallback(
    (patch: ProgressPatch) => {
      latestPatchRef.current = { ...(latestPatchRef.current ?? {}), ...patch };
      onProgress?.(patch);
    },
    [onProgress],
  );

  // §8.9 backstop: flush the latest patch if the tab is hidden between saves.
  useEffect(() => {
    if (!onProgress) return;
    return registerHideBackstop(() => {
      if (latestPatchRef.current) onProgress(latestPatchRef.current);
    });
  }, [onProgress]);

  const startQuizPass = useCallback(() => {
    if (quizStartedRef.current.has(passId)) return;
    quizStartedRef.current.add(passId);
    setSubtitle(null);
    if (quiz.length === 0) {
      setItems((prev) => [
        ...prev,
        { key: mkKey(), kind: 'note', title: 'Lesson complete', tone: 'success' },
      ]);
      setPhase('done');
      return;
    }
    // Answers accumulate across passes keyed by unique item key, so earlier
    // (answered) quiz cards scrolled above stay answered. Only the current pass's
    // scoring scope resets here.
    const firstKey = mkKey();
    currentQuizKeysRef.current = [firstKey];
    setItems((prev) => [
      ...prev,
      { key: mkKey(), kind: 'note', title: 'Quick test', body: `${quiz.length} questions to wrap up.`, tone: 'info' },
      { key: firstKey, kind: 'quiz', qIndex: 0, q: quiz[0] },
    ]);
    setPhase('quiz');
  }, [passId, quiz]);

  // --- Lesson auto-advance ----------------------------------------------------
  // Reveals one beat per beatIdx, gating on check-ins; a narrated story beat
  // advances on audio end, everything else on a length-based timer (§8.3).
  useEffect(() => {
    if (!live || phase !== 'lesson') return;
    if (beatIdx >= lessonBeats.length) {
      startQuizPass();
      return;
    }
    const beat = lessonBeats[beatIdx];
    const guard = `${passId}:${beatIdx}`;
    if (!beatRevealedRef.current.has(guard)) {
      beatRevealedRef.current.add(guard);
      setItems((prev) => [...prev, { key: mkKey(), kind: 'beat', beat }]);
      setSubtitle(beat.type === 'story_beat' ? beat.narration : null);
      // Resume point only tracks the first, linear pass through the lesson.
      if (passId === 0) reportProgress({ status: 'started', last_completed_beat: beat.id });
    }
    if (isCheckIn(beat)) return; // gate: wait for the answer handler to advance
    if (beat.type === 'story_beat' && beat.audio_url) {
      return playNarration(beat.audio_url, () => setBeatIdx((i) => i + 1));
    }
    const timer = setTimeout(() => setBeatIdx((i) => i + 1), beatDurationMs(beat));
    return () => clearTimeout(timer);
  }, [live, phase, beatIdx, lessonBeats, passId, startQuizPass, reportProgress]);

  useEffect(() => {
    if (live) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [items, live]);

  // --- Re-explanation append (§8.5) ------------------------------------------
  // A follow-up answer arrives as a short segment appended below the current
  // lesson (a continuation, not a reset). Story-beat narration is shown as a
  // caption note since re-explanations carry no synthesized audio; formal beats
  // render color-coded as usual.
  const appendedNonceRef = useRef(0);
  useEffect(() => {
    if (!live || !appendSegment || appendSegment.nonce === appendedNonceRef.current) return;
    appendedNonceRef.current = appendSegment.nonce;
    const appended: BoardItem[] = [{ key: mkKey(), kind: 'note', title: appendSegment.note, tone: 'info' }];
    for (const beat of appendSegment.beats) {
      if (beat.type === 'story_beat') {
        appended.push({ key: mkKey(), kind: 'note', title: '', body: beat.narration, tone: 'info' });
      } else {
        appended.push({ key: mkKey(), kind: 'beat', beat });
      }
    }
    setItems((prev) => [...prev, ...appended]);
  }, [live, appendSegment]);

  // --- Check-in answering (§8.4) ---------------------------------------------
  const handleCheckIn = useCallback(
    (itemKey: string, optionIndex: number) => {
      const beat = lessonBeats[beatIdx];
      if (!beat || !isCheckIn(beat)) return;
      setCheckInAnswers((m) => ({ ...m, [itemKey]: optionIndex }));

      if (optionIndex === beat.correct_index) {
        setBeatIdx((i) => i + 1);
        return;
      }
      // Wrong: the tailored clarification (§8.13) renders on the check-in itself.
      // Re-teach that part of the lesson (§9.2) — the segment since the previous
      // check-in — then continue. Formative: a wrong answer never blocks or penalizes.
      let start = 0;
      for (let j = beatIdx - 1; j >= 0; j--) {
        if (isCheckIn(lessonBeats[j])) {
          start = j + 1;
          break;
        }
      }
      const segment = lessonBeats.slice(start, beatIdx).filter((b) => !isCheckIn(b));
      const variant = pickReTeachVariant(segment);
      setItems((prev) => [
        ...prev,
        { key: mkKey(), kind: 'note', title: "Let's look at that part again", tone: 'info' },
        ...variant.map((b) => ({ key: mkKey(), kind: 'beat' as const, beat: b })),
      ]);
      setBeatIdx((i) => i + 1);
    },
    [lessonBeats, beatIdx],
  );

  // --- Quiz answering + mastery branching (§8.4) -----------------------------
  const gradeFn = useCallback(
    async (q: QuizQuestion, answer: string) => {
      if (gradeFillIn) return gradeFillIn(q, answer);
      return gradeFillInLocally(q.accepted_answers ?? [], answer);
    },
    [gradeFillIn],
  );

  const finishQuiz = useCallback(() => {
    const answers = currentQuizKeysRef.current.map((k) => quizAnswersRef.current[k]);
    const { scorePct: pct, outcome, reteachBeats } = decideMastery(quiz, answers, script.beats);

    if (outcome === 'passed') {
      reportProgress({ status: 'passed', quiz_score: pct, mastered: true });
      setItems((prev) => [
        ...prev,
        { key: mkKey(), kind: 'note', title: `Topic passed — ${pct}%`, body: 'Nice work. On to the next one.', tone: 'success' },
      ]);
      setPhase('done');
      return;
    }

    reportProgress({ quiz_score: pct });
    const reteachMissed = outcome === 'reteach_missed';
    setItems((prev) => [
      ...prev,
      {
        key: mkKey(),
        kind: 'note',
        title: reteachMissed ? "Let's revisit a few things" : "Let's go through it once more",
        body: reteachMissed
          ? `You scored ${pct}%. We'll go back over just the parts that tripped you up.`
          : `You scored ${pct}%. No worries — we'll take it from the top.`,
        tone: 'warn',
      },
    ]);
    setLessonBeats(reteachBeats);
    setBeatIdx(0);
    setPassId((p) => p + 1);
    setPhase('lesson');
  }, [quiz, script.beats, reportProgress]);

  const handleQuizAnswer = useCallback(
    (itemKey: string, qIndex: number, answer: QuizAnswer) => {
      quizAnswersRef.current[itemKey] = answer;
      setQuizAnswers({ ...quizAnswersRef.current });
      if (qIndex + 1 < quiz.length) {
        const nextKey = mkKey();
        currentQuizKeysRef.current.push(nextKey);
        setItems((prev) => [...prev, { key: nextKey, kind: 'quiz', qIndex: qIndex + 1, q: quiz[qIndex + 1] }]);
      } else {
        finishQuiz();
      }
    },
    [quiz, finishQuiz],
  );

  // --- Static (dev/seek) render: no gating, no quiz --------------------------
  const staticBlocks = useMemo(() => {
    if (live) return null;
    const upto = Math.max(1, Math.min(seekTo, script.beats.length));
    return script.beats.slice(0, upto).map((beat) => ({ key: `seek-${beat.id}`, kind: 'beat' as const, beat }));
  }, [live, seekTo, script.beats]);

  const liveBlocks = useBlocks(items);
  const staticGrouped = useBlocks(staticBlocks ?? []);
  const blocks = live ? liveBlocks : staticGrouped;
  const newestKey = live ? items[items.length - 1]?.key : undefined;

  return (
    <View style={styles.board}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {blocks.map((block) => {
          if (block.kind === 'scene') {
            const animate = live && newestKey !== undefined && block.keys.includes(newestKey);
            return <Scene key={block.key} beats={block.beats} catalog={catalog} animate={animate} />;
          }
          if (block.kind === 'formal') {
            const animate = live && block.key === newestKey;
            const beat = block.beat;
            if (isCheckIn(beat)) {
              const answered = checkInAnswers[block.key];
              return (
                <FormalText
                  key={block.key}
                  beat={beat}
                  animate={animate}
                  checkInSelected={answered}
                  onCheckInSelect={
                    live && answered === undefined ? (index) => handleCheckIn(block.key, index) : undefined
                  }
                />
              );
            }
            return <FormalText key={block.key} beat={beat} animate={animate} />;
          }
          if (block.kind === 'quiz') {
            return (
              <QuizQuestionCard
                key={block.key}
                q={block.item.q}
                index={block.item.qIndex}
                total={quiz.length}
                answer={quizAnswers[block.key]}
                onAnswer={(a) => handleQuizAnswer(block.key, block.item.qIndex, a)}
                gradeFillIn={gradeFn}
              />
            );
          }
          return <NoteCard key={block.key} title={block.item.title} body={block.item.body} tone={block.item.tone} />;
        })}
      </ScrollView>

      {subtitle ? (
        <View style={styles.subtitleBar} pointerEvents="none">
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, backgroundColor: '#12151c' },
  content: { paddingHorizontal: 28, paddingTop: 32, paddingBottom: 80, gap: 4 },
  subtitleBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
  },
  subtitle: { fontFamily: FONT_REGULAR, fontSize: 20, color: '#c8ccd6', textAlign: 'center' },
});
