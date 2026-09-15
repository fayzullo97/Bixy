import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Beat, BoardScript, CheckInBeat, FormalBeat, QuizQuestion, SpokenUnit, StoryBeat } from './types';
import type { DoodleCatalog } from './doodleCatalog';
import { Scene } from './Scene';
import { FormalText } from './FormalText';
import { NoteCard, QuizQuestionCard, type QuizAnswer } from './Quiz';
import { beatDurationMs } from './pacing';
import { clipUrls, playSequence } from './audio';
import { subtitleWindow } from './subtitle';
import { pickReTeachVariant } from './variants';
import { decideMastery } from './mastery';
import { pickScoreReaction } from './scoreReaction';
import { gradeFillInLocally } from './gradeLocal';
import { buildResumeState } from './resume';
import { registerHideBackstop } from '../progress/backstop';
import { FONT_REGULAR, FONT_SEMIBOLD } from './fonts';

// The board is one continuous, append-only surface (§8.4/§11): lesson beats, then
// the end-of-topic quiz, then a result — and, on a miss, a re-teach appended below
// and the quiz again. Everything the student has seen stays scrolled above.
type BeatItem = { key: string; kind: 'beat'; beat: Beat };
type QuizItem = { key: string; kind: 'quiz'; qIndex: number; q: QuizQuestion };
type NoteTone = 'info' | 'success' | 'warn';
type NoteItem = { key: string; kind: 'note'; title: string; body?: string; tone: NoteTone };
// A failing score is announced and WAITS (Part 04 §6): re-teaching begins only
// once the student presses "Let's start", replacing v1's instant auto-restart.
type ConfirmItem = { key: string; kind: 'confirm'; title: string; label: string; onConfirm: () => void };
type BoardItem = BeatItem | QuizItem | NoteItem | ConfirmItem;

type ProgressPatch = {
  status?: 'started' | 'passed';
  quiz_score?: number | null;
  last_completed_beat?: number | null;
  mastered?: boolean;
  /** Reported as quiz ids; the server stores durable fingerprints (Part 04 §6). */
  missed_quiz_question_ids?: number[];
  retest_round?: number;
};

interface Props {
  script: BoardScript;
  catalog: DoodleCatalog;
  /** 1-based beat count to render statically (dev/screenshot). Omit to auto-play. */
  seekTo?: number;
  /**
   * Set `false` to hide the narration caption. Defaults to ON when omitted,
   * which is what production has always shown — before Part 02 §3 this prop was
   * destructured but never read, so the caption rendered regardless of it.
   */
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
  /** Retests already failed on this topic (Part 04 §6), from persisted progress. */
  initialRetestRound?: number;
  /** Fetches the shorter retest after a re-teach (Part 04 §6). Without it the
   *  board repeats the full test, which is v1's behaviour. */
  onRequestRetest?: () => Promise<QuizQuestion[]>;
  /**
   * Marks this board as a detour (Part 04 §13). A detour ends with a wrap-up
   * check-in and then returns to the interrupted topic, instead of running the
   * topic's full end-of-topic test — that test is what marks the topic passed,
   * and a detour deliberately isn't a completion path.
   */
  detour?: {
    /** One check-in question about the detour topic; null when none is pooled. */
    requestWrapUp: () => Promise<QuizQuestion | null>;
    /** Return to the interrupted topic, resuming where it left off. */
    onComplete: () => void;
  };
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
      | { kind: 'confirm'; key: string; item: ConfirmItem }
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
      } else if (item.kind === 'confirm') {
        blocks.push({ kind: 'confirm', key: item.key, item });
      } else {
        blocks.push({ kind: 'note', key: item.key, item });
      }
    }
    return blocks;
  }, [items]);
}

export function Board({ script, catalog, seekTo, showSubtitles, resumeFromBeatId, appendSegment, gradeFillIn, onProgress, initialRetestRound = 0, onRequestRetest, detour }: Props) {
  const live = seekTo == null;
  const quiz = script.quiz ?? [];
  const quizIntro = script.quiz_intro?.trim();
  // After a re-teach the next test is the 8-question retest, not the full one
  // (Part 04 §6). Fetched while the re-teach plays so it's ready on arrival.
  const [retestQuiz, setRetestQuiz] = useState<QuizQuestion[] | null>(null);

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
  // 'awaiting_retry' holds the board still after a failing score until the
  // student presses "Let's start" (Part 04 §6).
  const [phase, setPhase] = useState<'lesson' | 'quiz' | 'awaiting_retry' | 'wrap_up' | 'done'>('lesson');
  const [lessonBeats, setLessonBeats] = useState<Beat[]>(script.beats);
  const [beatIdx, setBeatIdx] = useState(resume.beatIdx);
  const [passId, setPassId] = useState(0);
  // Narration subtitle (Part 02 §3). `unit` is the story beat's spoken unit;
  // `positionMs` tracks playback so the window can roll. A unit with word
  // timings gets the rolling window; one without shows its full text, which is
  // what Uzbek lessons do until Whisper alignment is validated for them.
  const [subtitleUnit, setSubtitleUnit] = useState<SpokenUnit | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  // Answers keyed by the item's unique key, so history stays answered across passes.
  const [checkInAnswers, setCheckInAnswers] = useState<Record<string, number>>(resume.checkInAnswers);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, QuizAnswer>>({});

  // How many retests this topic has already failed, driving §6's second-miss
  // escalation. Seeded from persisted progress so it survives a session boundary.
  const retestRoundRef = useRef(initialRetestRound);
  // Whichever question set the current pass is using: the full test, or the
  // shorter retest after a re-teach.
  const activeQuizRef = useRef<QuizQuestion[]>(script.quiz ?? []);
  const scrollRef = useRef<ScrollView | null>(null);
  const keyRef = useRef(0);
  const mkKey = () => `it-${keyRef.current++}`;
  const beatRevealedRef = useRef<Set<string>>(new Set()); // `${passId}:${beatIdx}` guard
  const quizStartedRef = useRef<Set<number>>(new Set()); // passId guard
  const wrapUpStartedRef = useRef(false); // fires once per detour
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
    const activeQuiz = retestQuiz && retestQuiz.length > 0 ? retestQuiz : quiz;
    if (quizStartedRef.current.has(passId)) return;
    quizStartedRef.current.add(passId);
    setSubtitleUnit(null);
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
    activeQuizRef.current = activeQuiz;
    setItems((prev) => [
      ...prev,
      // Part 02 §5: the hand-off line is generated and spoken, so it's already in
      // the student's language. The English fallback only applies to a script
      // generated before quiz_intro existed.
      quizIntro
        ? { key: mkKey(), kind: 'note' as const, title: quizIntro, tone: 'info' as const }
        : {
            key: mkKey(),
            kind: 'note' as const,
            title: 'Quick test',
            body: `${activeQuiz.length} questions to wrap up.`,
            tone: 'info' as const,
          },
      { key: firstKey, kind: 'quiz', qIndex: 0, q: activeQuiz[0] },
    ]);
    setPhase('quiz');
  }, [passId, quiz, quizIntro, retestQuiz]);

  // Speaks the hand-off once, when the test first opens. Not replayed on a retry
  // pass — it introduces the test, it isn't part of it. The test stays silent.
  const quizIntroSpokenRef = useRef(false);
  useEffect(() => {
    if (!live || phase !== 'quiz' || quizIntroSpokenRef.current) return;
    quizIntroSpokenRef.current = true;
    const clips = clipUrls(script.quiz_intro_speech);
    if (!clips.length) return;
    return playSequence(clips, () => {});
  }, [live, phase, script.quiz_intro_speech]);

  // --- Detour wrap-up (Part 04 §13) -------------------------------------------
  // A detour interrupted something. Rather than silently resuming — which is
  // what made the interrupted topic look abandoned — it closes with an explicit
  // "we're done with your question" check-in, then returns on its own. The
  // manual "Back to your plan" control stays available, but is no longer the
  // only way back.
  const [wrapUp, setWrapUp] = useState<{ q: QuizQuestion; answered: boolean } | null>(null);
  const wrapUpTriesRef = useRef(0);

  const startWrapUp = useCallback(() => {
    if (!detour || wrapUpStartedRef.current) return;
    wrapUpStartedRef.current = true;
    setPhase('wrap_up');
    detour
      .requestWrapUp()
      .then((q) => {
        // Nothing pooled for this topic yet — return straight away rather than
        // stranding the student on a blank step.
        if (!q) detour.onComplete();
        else setWrapUp({ q, answered: false });
      })
      .catch(() => detour.onComplete());
  }, [detour]);

  const answerWrapUp = useCallback(
    (index: number) => {
      if (!detour || !wrapUp || wrapUp.answered) return;
      setWrapUp({ ...wrapUp, answered: true });

      const correct = index === wrapUp.q.correct_index;
      wrapUpTriesRef.current += 1;
      // Wrong once: ask again, and the pool's rotation hands back a different
      // question. Never more than that — this is a wrap-up, not a gate, and it
      // must not become a reason the interrupted topic stays unfinished.
      if (!correct && wrapUpTriesRef.current < 2) {
        detour
          .requestWrapUp()
          .then((q) => (q ? setWrapUp({ q, answered: false }) : detour.onComplete()))
          .catch(() => detour.onComplete());
        return;
      }
      // Brief pause so the student sees the result land before the board moves.
      setTimeout(() => detour.onComplete(), 1200);
    },
    [detour, wrapUp],
  );

  // --- Lesson auto-advance ----------------------------------------------------
  // Reveals one beat per beatIdx, gating on check-ins; a narrated story beat
  // advances on audio end, everything else on a length-based timer (§8.3).
  useEffect(() => {
    if (!live || phase !== 'lesson') return;
    if (beatIdx >= lessonBeats.length) {
      if (detour) startWrapUp();
      else startQuizPass();
      return;
    }
    const beat = lessonBeats[beatIdx];
    const guard = `${passId}:${beatIdx}`;
    if (!beatRevealedRef.current.has(guard)) {
      beatRevealedRef.current.add(guard);
      setItems((prev) => [...prev, { key: mkKey(), kind: 'beat', beat }]);
      // Only story narration is subtitled — formal text is already written on
      // the board, so repeating it underneath would just be noise.
      setSubtitleUnit(beat.type === 'story_beat' ? (beat.speech?.[0] ?? { text: beat.narration, language: 'en' }) : null);
      setPositionMs(0);
      // Resume point only tracks the first, linear pass through the lesson.
      if (passId === 0) reportProgress({ status: 'started', last_completed_beat: beat.id });
    }
    // A check-in's stem is narrated (Part 02 §5) but the beat still gates on the
    // answer, so play the clip and let the answer handler advance.
    const clips = clipUrls(beat.speech);
    const track = beat.type === 'story_beat' ? (_: number, ms: number) => setPositionMs(ms) : undefined;
    if (isCheckIn(beat)) return clips.length ? playSequence(clips, () => {}) : undefined;
    // Every beat type now narrates, so every beat advances on audio end. The
    // length-based timer is the fallback for a beat whose audio never arrived.
    if (clips.length) return playSequence(clips, () => setBeatIdx((i) => i + 1), track);
    const timer = setTimeout(() => setBeatIdx((i) => i + 1), beatDurationMs(beat));
    return () => clearTimeout(timer);
  }, [live, phase, beatIdx, lessonBeats, passId, startQuizPass, startWrapUp, detour, reportProgress]);

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
    const round = retestRoundRef.current;
    // Score against whichever set was actually answered — a retest is 8
    // questions, so scoring it against the full 10–15 would understate it badly.
    const active = activeQuizRef.current;
    const { scorePct: pct, outcome, reteachBeats, missedIndexes } = decideMastery(
      active,
      answers,
      script.beats,
      round,
    );

    if (outcome === 'passed') {
      // Clear the retest state too: a pass ends the cycle, so a future failure
      // on this topic starts from round 0 rather than inheriting an escalation.
      reportProgress({
        status: 'passed',
        quiz_score: pct,
        mastered: true,
        missed_quiz_question_ids: [],
        retest_round: 0,
      });
      retestRoundRef.current = 0;
      setItems((prev) => [
        ...prev,
        { key: mkKey(), kind: 'note', title: `Topic passed — ${pct}%`, body: 'Nice work. On to the next one.', tone: 'success' },
      ]);
      setPhase('done');
      return;
    }

    // Record what was missed so the retest can lead with it — by quiz id, which
    // the server resolves to durable fingerprints (Part 04 §6).
    const nextRound = round + 1;
    retestRoundRef.current = nextRound;
    reportProgress({
      quiz_score: pct,
      missed_quiz_question_ids: missedIndexes.map((i) => active[i]!.quiz_question_id),
      retest_round: nextRound,
    });

    const reteachMissed = outcome === 'reteach_missed';
    const inPersona = pickScoreReaction(script, outcome, pct, round);
    const fallback = reteachMissed
      ? `You scored ${pct}%. We'll go back over just the parts that tripped you up.`
      : `You scored ${pct}%. No worries — we'll take it from the top.`;

    // Announce, then WAIT. v1 restarted immediately; §6 requires the student to
    // acknowledge the score before the re-teach begins.
    setItems((prev) => [
      ...prev,
      {
        key: mkKey(),
        kind: 'confirm',
        title: inPersona ?? fallback,
        label: "Let's start",
        onConfirm: () => {
          // Fetch the retest NOW, in parallel with the re-teach playing, so it's
          // ready by the time the beats finish rather than stalling the board.
          if (onRequestRetest) {
            onRequestRetest()
              .then((questions) => setRetestQuiz(questions.length > 0 ? questions : null))
              .catch(() => setRetestQuiz(null)); // fall back to the full test
          }
          setLessonBeats(reteachBeats);
          setBeatIdx(0);
          setPassId((p) => p + 1);
          setPhase('lesson');
        },
      },
    ]);
    setPhase('awaiting_retry');
  }, [script, reportProgress, onRequestRetest]);

  const handleQuizAnswer = useCallback(
    (itemKey: string, qIndex: number, answer: QuizAnswer) => {
      quizAnswersRef.current[itemKey] = answer;
      setQuizAnswers({ ...quizAnswersRef.current });
      const active = activeQuizRef.current;
      if (qIndex + 1 < active.length) {
        const nextKey = mkKey();
        currentQuizKeysRef.current.push(nextKey);
        setItems((prev) => [...prev, { key: nextKey, kind: 'quiz', qIndex: qIndex + 1, q: active[qIndex + 1]! }]);
      } else {
        finishQuiz();
      }
    },
    [finishQuiz],
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
          if (block.kind === 'confirm') {
            return (
              <ConfirmCard
                key={block.key}
                title={block.item.title}
                label={block.item.label}
                onConfirm={block.item.onConfirm}
                done={phase !== 'awaiting_retry'}
              />
            );
          }
          return <NoteCard key={block.key} title={block.item.title} body={block.item.body} tone={block.item.tone} />;
        })}
      </ScrollView>

      {wrapUp ? (
        <View style={styles.wrapUpBar}>
          <Text style={styles.wrapUpLead}>{"One last thing before we head back —"}</Text>
          <Text style={styles.wrapUpQuestion}>{wrapUp.q.question}</Text>
          <View style={styles.wrapUpOptions}>
            {(wrapUp.q.options ?? []).map((option, i) => {
              const isCorrect = wrapUp.answered && i === wrapUp.q.correct_index;
              const isWrongPick = wrapUp.answered && i !== wrapUp.q.correct_index;
              return (
                <Pressable
                  key={`${option}-${i}`}
                  disabled={wrapUp.answered}
                  onPress={() => answerWrapUp(i)}
                  accessibilityRole="button"
                  style={[
                    styles.wrapUpOption,
                    isCorrect && styles.wrapUpOptionCorrect,
                    isWrongPick && styles.wrapUpOptionMuted,
                  ]}
                >
                  <Text style={styles.wrapUpOptionText}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {showSubtitles !== false && subtitleUnit ? (
        <View style={styles.subtitleBar} pointerEvents="none">
          <Subtitle unit={subtitleUnit} positionMs={positionMs} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * A failing score, announced in Bixy's voice, with the board held until the
 * student acknowledges it (Part 04 §6). v1 restarted the topic instantly; the
 * pause is the point — it turns a silent reset into something the student agreed
 * to. Once pressed it stays visible but inert, since the board is append-only
 * and this scrolls up into history.
 */
function ConfirmCard({
  title,
  label,
  onConfirm,
  done,
}: {
  title: string;
  label: string;
  onConfirm: () => void;
  done: boolean;
}) {
  return (
    <View style={styles.confirmCard}>
      <Text style={styles.confirmTitle}>{title}</Text>
      {!done ? (
        <Pressable style={styles.confirmButton} onPress={onConfirm} accessibilityRole="button">
          <Text style={styles.confirmButtonText}>{label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The narration caption (Part 02 §3). With word timings it rolls a fixed-size
 * window in step with the audio, highlighting the word being spoken; without
 * them it falls back to the unit's full text, which is the v1 behaviour Uzbek
 * lessons keep until Whisper alignment is validated for Aisha audio.
 */
function Subtitle({ unit, positionMs }: { unit: SpokenUnit; positionMs: number }) {
  const timed = unit.words && unit.words.length > 0 ? unit.words : null;
  if (!timed) return <Text style={styles.subtitle}>{unit.text}</Text>;

  const { words, activeIndex } = subtitleWindow(timed, positionMs);
  return (
    <Text style={styles.subtitle}>
      {words.map((w, i) => (
        <Text key={`${w.start_ms}-${i}`} style={i === activeIndex ? styles.subtitleActive : undefined}>
          {i > 0 ? ' ' : ''}
          {w.text}
        </Text>
      ))}
    </Text>
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
  subtitle: { fontFamily: FONT_REGULAR, fontSize: 20, color: '#8b93a3', textAlign: 'center' },
  confirmCard: {
    alignSelf: 'stretch',
    marginVertical: 14,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3a4256',
    backgroundColor: 'rgba(90,169,255,0.06)',
    gap: 14,
  },
  confirmTitle: { fontFamily: FONT_REGULAR, fontSize: 24, color: '#e6e8ee', lineHeight: 32 },
  confirmButton: {
    alignSelf: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#5aa9ff',
  },
  confirmButtonText: { fontFamily: FONT_SEMIBOLD, fontSize: 19, color: '#0b0e14' },
  wrapUpBar: {
    alignSelf: 'stretch',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#3a4256',
    backgroundColor: 'rgba(11,14,20,0.92)',
    gap: 12,
  },
  wrapUpLead: { fontFamily: FONT_REGULAR, fontSize: 17, color: '#8b93a3' },
  wrapUpQuestion: { fontFamily: FONT_REGULAR, fontSize: 23, color: '#e6e8ee', lineHeight: 31 },
  wrapUpOptions: { gap: 9 },
  wrapUpOption: {
    borderWidth: 1,
    borderColor: '#3a4256',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  wrapUpOptionCorrect: { borderColor: '#5fd08a', backgroundColor: 'rgba(95,208,138,0.12)' },
  wrapUpOptionMuted: { opacity: 0.45 },
  wrapUpOptionText: { fontFamily: FONT_REGULAR, fontSize: 21, color: '#e6e8ee' },
  // The word currently being spoken reads brighter than the rest of the window.
  subtitleActive: { color: '#e6e8ee' },
});
