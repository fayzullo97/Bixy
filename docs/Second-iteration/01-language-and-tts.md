# Bixy PRD — Part 1: Language & TTS

> Covers original PRD §1–§2. Read `00-context-shipped-v1.md` first. Referenced
> by Part 02 (narration pipeline), Part 04 (detour tracking references §1's
> variant-pooling), and Part 07 (§1's tier rule).

---

### 1. Level-gated language split

**What changed (v14.1):** Reference material stays at 6 tiers
(A1/A2/B1/B1+/B2/C1) — no C2 tier for grammar. A future C2 tier is planned as
part of the later speaking/listening/reading/writing expansion only, so this
language rule doesn't apply to it.

For A1–B2, content shifts to the student's selected language (Uzbek or
Russian) — narration, formal board text, common-mistake wording, and
quiz-surrounding phrasing (instructions/feedback like "well done" / "try
again").

Stays English at every level, A1 through C1, because it's the actual English
content being taught or tested:
- Example sentences (correct and incorrect)
- Grammar/tense terminology when introduced (e.g. "Present Perfect")
- Quiz/check-in testable items: question stem, multiple-choice options,
  fill-in-the-blank sentence, True/False statement
- **Speech/thought bubble dialogue (story track):** not explicitly covered
  by the original spec. **Correction:** an earlier revision of this doc
  resolved it the other way — bubbles following narration (localized A1–B2)
  — reasoning that a localized voice over an English-only bubble undermines
  the point of localizing. Live generation showed that reasoning doesn't
  survive contact with how the story track actually teaches. Generating
  `present_simple_be` in Russian produced exactly these bubbles:

      beat 3 [speech_bubble]:  "I am an engineer"
      beat 4 [speech_bubble]:  "I am a nurse"
      beat 5 [speech_bubble]:  "We are neighbours"
      beat 6 [thought_bubble]: "It is cold"

  Every one is the English sentence being taught — the story track
  demonstrates the grammar by having characters *speak* it. Localizing them
  to «Я инженер» demonstrates nothing about English "to be" and destroys the
  lesson's content. The v1 sample does the same thing (`present-perfect.ts`:
  `"I've been to Bukhara myself!"`).

  The original reasoning holds for casual scene-setting dialogue, but for a
  grammar tutor bubbles are almost always demonstrative. So bubble `text` is
  **English-locked at every level**, alongside `sentence` / `wrong` /
  `correct`; the narration localizes and explains what the drawn scene is
  showing in English. This keeps the rule mechanically checkable — the
  alternative (English when demonstrative, localized when scene-setting) is
  a convention inside one field that `languageCheck` cannot validate, which
  is the exact class of rule the schema decision below rejects.

C1 stays fully English at every layer. **Correction:** earlier versions of
this doc said "unchanged from v1" — that's inaccurate. v1 has no level
check at all, so a C1 lesson for a student with Russian selected actually
gets Russian narration today. The literal reading of this rule is a real
behavior change for existing C1 users, not a no-op — but it's fixing an
accidental v1 gap against the original design intent (C1 = already fluent,
doesn't need localization), not introducing a new restriction.

**Schema decision (confirmed during implementation planning):** enforced
structurally, not just by prompt convention. The board script schema splits
per-field by style — fields like an example sentence or a common-mistake's
wrong/correct pair get their own explicit fields that are always English,
separate from the surrounding explanation/note fields that localize — so
`languageCheck` can validate mechanically rather than trusting the model to
keep an English example correctly embedded inside an otherwise-localized
block. Chosen over the cheaper alternative (localizing whole beats by style
and accepting embedded English content isn't separately guaranteed) because
this project has repeatedly seen exactly this class of bug — trusting a
model to honor an embedded language convention inside blended text — break
in practice (see Part 02's TTS code-switching work). Breaking change to the
board script contract: full lesson-cache regeneration required, cache keyed
by effective language (`contentLanguage(level, appLanguage)`) so C1's
en/uz/ru all collapse to one cached row per topic instead of three.

### 2. TTS architecture

**What changed (v14.1):** Replaces the single-provider (Aisha/VoiceLab)
narration model from v1 with a split by language:

- **Uzbek narration:** AishaAI/VoiceLab — unchanged from v1
- **Russian + English narration:** OpenAI `gpt-4o-mini-tts` — one provider for
  both, chosen for native mid-sentence language switching (handles embedded
  English grammar terms inside Russian narration in a single voice, no
  vendor-switch seam)
- **Yandex SpeechKit:** evaluated and dropped — its voices are
  single-language-per-model, so a Russian voice reading embedded English terms
  would carry the same accent problem the switch was meant to solve
- Verified via direct demo: mixed Russian+English text through
  `gpt-4o-mini-tts` — no accent issues in the blended speech
