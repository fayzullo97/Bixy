# Bixy PRD — Part 2: Narration Pipeline

> Covers original PRD §3, §5. Read `00-context-shipped-v1.md` and
> `01-language-and-tts.md` first (this builds directly on the TTS
> architecture and language rules from Part 01).

---

### 3. Speech naturality (pacing, filler words, chunked subtitles)

**What changed (v14.2, confirmed live v14.21):** Narration is now synthesized per sentence (or per
short beat) as separate TTS calls rather than one call per lesson segment,
and the resulting clips are stitched together with a fixed **400ms silence
gap** between sentences — reads as a natural thinking pause rather than
continuous reading, and works identically across every provider since it's
audio splicing, not a prompt the model has to interpret. This also yields an
exact known duration per sentence clip, used below. Verified live across all
three providers with exact arithmetic match between predicted and measured
clip duration (speech time + gap count × 400ms). Deliberately no merging of
short sentences — a filler word gets its own clip specifically so the 400ms
gap after it reads as a thinking pause, not just faster splicing.

**Filler words** are baked into the lesson-generation script itself (the AI
content step), not left to the TTS layer, so behavior stays consistent across
Aisha and OpenAI alike. Plain-spelling interjections only (e.g. "Hmm...",
"Xo'p, mayli.") — not stretched spellings like "Riiiightttt" — after testing
confirmed plain spelling reads naturally on Aisha. Source phrase bank
(Uzbek, tested and approved) is grouped by function and used contextually:
- **Thinking/hesitation** (mid-explanation pauses): Hmm..., Eh!, Ha-a...,
  Ie!, O-ho!, Hmm, qiziq..., Hmm... tushunarli., Hmm... bir daqiqa., Eh...
  balki shundaydir., Hmm... bu haqda yaxshilab o'ylash kerak.
- **Transition/agreement** (moving on / confirming a rule): Xo'p, mayli.,
  Ha, albatta!, Ha-a, endi tushundim., Ana endi gap!
- **Praise** (correct check-in answers): Ajoyib!, Zo'r!, Qoyil!, Qoyil, juda
  yaxshi!
- **Big surprise/shock** (reserved for genuinely unexpected moments, not
  routine narration): Voy!, Vau!, Obbo!, Nima?!, Voy, shunaqami?!
- Flagged for native-speaker review before use in the wrong-answer reaction
  set: "Obbo, nima qilib qo'ydingiz?" (reads as scolding) and "Voy,
  bechora..." (reads as pitying) — hold out of rotation until confirmed.
- **Confirmed rollout: Uzbek ships now, Russian and English are an explicit
  tracked follow-up**, not a blocker — same pattern as every other
  multilingual rollout in this project (ship what's ready, fast-follow the
  rest). Ru/en banks need drafting using the same categorization above
  before this covers all three languages Part 01 supports (Russian and
  English narration both need it, since Part 01's C1 gate means even
  English-narrated lessons need their own bank, not just ru).

**Chunked subtitles** replace the current full-text display with a rolling
**7-word window** synced to actual audio playback, so the visible words stay
ahead of where Bixy is currently speaking rather than dumping the whole
sentence at once.
- Sync source: neither TTS engine returns timestamps natively. Generated
  audio is passed through `whisper-1` with `timestamp_granularities: ["word"]`
  to get real word-level timing. **Correction:** an earlier version of this
  doc claimed this counts as forced alignment rather than blind
  transcription, reasoning that since the script text is already known,
  accuracy should be high. That's inaccurate — `whisper-1`'s transcription
  endpoint doesn't constrain output to known text; it's blind transcription
  like any other audio, so returned words aren't guaranteed to match the
  script and a reconciliation step (aligning Whisper's tokens against the
  script's tokens, handling mismatches) is required, not optional.
  **Confirmed working:** built as an LCS-based reconciliation over
  normalized tokens — matched words take Whisper's heard timings, dropped
  words interpolate across the gap, and a match ratio below 50% falls back
  to proportional timing instead of trusting a bad alignment. Verified live
  at 100% word match on both tested languages, including correctly timing
  an English word embedded inside a Russian clip.
- **Granularity: per unit, not per beat, not per sentence.** This doc
  originally said "per-beat," but that wording predates Part 5's per-field
  language split below — a beat can now hold multiple spoken units in
  different languages (an English sentence and a localized note in the same
  common-mistake beat, for instance), and Whisper takes one language hint
  per call, so "per-beat" isn't a coherent instruction once a beat can be
  bilingual. Per-unit is the faithful reading of "not per-sentence," and
  cut Whisper calls from a would-be 28/lesson down to 4/lesson in testing —
  see §5's subtitle-scope note below for why the count is that low.
- **Rollout: English + Russian first.** Uzbek is a fast-follow, not a
  blocker — Uzbek isn't in Whisper's documented language list, so alignment
  accuracy on Aisha-generated audio needs a dedicated test before relying on
  it. Uzbek lessons keep the current full-text subtitle display until that
  test passes.
- Fallback if Whisper alignment proves unreliable for Uzbek (or anywhere
  reconciliation fails): proportional timing using each sentence clip's
  known duration (from the 400ms-splice work above), distributed across
  that sentence's words by character length. Less precise than real
  alignment, but bounded per sentence rather than drifting across a whole
  lesson.
- **Scope: story-track narration only, not formal-track.** Formal-track
  content (title, formula, explanation, etc.) is already written on the
  board — a subtitle repeating text the student can already see is noise,
  not an aid. This isn't a cost-saving shortcut (though it does cut Whisper
  calls substantially, confirmed 4/lesson vs. a would-be 28/lesson) — the
  product reasoning holds independent of the cost benefit.
- **`showSubtitles` bug fixed along the way:** the prop existed but was
  never read, so subtitles rendered unconditionally in production
  regardless of what was passed. Now `undefined` still means on (preserves
  existing behavior for any caller not passing it explicitly), `false`
  actually hides them.

**Cross-cutting infrastructure note, resolved:** Part 02 added real
processing weight (per-sentence TTS calls, Whisper calls) on top of Part
01's per-field split, which raised a real question of whether cold
generation would blow past Vercel's function duration limits badly enough
to need a job+poll architecture instead of a synchronous request. Measured
after both §3 and §5 shipped: cold generation is ~45s, comfortably under
both the 120s client timeout and the 300s platform ceiling — per-sentence
synthesis parallelizes better than the fewer/longer calls it replaced, so
the timeout pressure eased rather than worsened despite the added work.
Job+poll is not being built. Revisit only if a future addition measurably
pushes cold generation back toward that ceiling again.

### 5. Formal-track narration

**What changed (v14.4):** Story beats already get narrated; formal-track
content previously appeared as silent text only. Now everything is spoken
except the end-of-topic test, closing the gap between the two tracks feeling
like a lesson vs. a silent reading assignment.

**Spoken:**
- Title
- Formula (e.g. "Subject + have/has + past participle")
- Explanation
- Examples
- Common mistakes
- Correct vs. incorrect version pairs — both the wrong form and the fix are
  voiced, not just the fix
- Check-in questions — the question stem only; multiple-choice and
  True/False options stay silent, text-only
- A transition line before the end-of-topic test begins (e.g. "Okay, let's
  see how much you understand the topic") — follows the same level-gated
  language rule as everything else in Part 01 §1 (selected language for
  A1–B2, English for C1). **Confirmed during implementation:** this must be
  a generated script field (e.g. a top-level `quiz_intro`), not a client-side
  string — it needs to be spoken and level-gated, which hardcoded client
  chrome can't do. Distinct from the deferred client-chrome i18n work
  (Quiz.tsx, Board.tsx, LevelCheckBoard.tsx literals) — those stay
  deferred; this one specifically can't be, since it has no other home.

**Stays silent (text only):**
- The 10–15 question end-of-topic test — question text and options both,
  different register from the lesson itself

**Out of scope (confirmed during implementation):** re-explanation segments
(mid-lesson clarification answers) currently have no audio at all and
render as a silent caption note — this section doesn't extend to them.
Noted rather than dropped, since this may resurface once Part 04 (which
owns retry/re-teach flows) gets built.

**Known gap surfaced during implementation:** the filler-word bank's
"Praise" category (correct check-in answers) has nowhere to fire from —
correct-answer feedback is currently a hardcoded English "Exactly right."
with no generated field for it. This needs a schema addition (a generated,
localized, spoken check-in-success reaction) that extends this same
per-unit narration approach — a narrower version of what this section
already does — but wasn't built as part of this pass. Tracked here rather
than lost; not urgent.

**Cache versioning:** the board-script contract changed again on top of
Part 01's schema (`rule_version` 1→2). Turned out not to be strictly
required — extending `narrationComplete` to gate the whole script means a
stale-shaped cached row fails the check and self-heals by regenerating,
the same mechanism that already handled pre-TTS cached rows. Bumping the
version anyway rather than relying solely on that: an explicit version
number is a queryable, debuggable signal ("this row is on schema 2")
independent of knowing the self-healing mechanism exists — cheap given
the lever already exists from Part 01, worth it for the observability.

**Implementation note:** this is coverage expansion, not new infrastructure —
title/formula/explanation/example/common-mistake/correct-incorrect blocks
feed into the same pipeline already built for story narration (per-unit TTS
synthesis, 400ms splice, chunked-subtitle sync); that wiring just needs
extending to formal-track units, which currently skip it entirely. Formal
beats currently advance on a text-length timer (no audio existed to key
off); once narrated, they should advance on audio end instead, same as
story beats.
