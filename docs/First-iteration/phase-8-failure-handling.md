# Phase 8 — Failure handling & cross-cutting concerns

Not a feature area on its own — a pass to make sure every failure state
across the whole app is handled, once the features that can fail exist.

### 8.10 Failure handling
- If the model times out generating a response, the app reloads automatically rather than leaving the student staring at a stuck board.
- Automatic reload on timeout needs a cap — after a couple of automatic attempts, stop and tell the student plainly instead of looping silently, which is what would happen during a genuine outage rather than a one-off slow response.
- If the student loses their connection, the app tells them plainly that they're offline and need to reload to continue — no silent retries, no faked progress.
- If Telegram sign-in itself fails — the student declines the confirmation box, the popup is blocked, the `id_token` fails server-side validation (§8.8), or Telegram is unreachable — the app says so plainly and offers to retry, the same principle as the other failure cases above, rather than a silent redirect loop or a generic error.
- If AI-generated lesson content fails schema validation — even after a retry — the app shows a plain error and lets the student retry manually, rather than silently falling back to something simpler or looping automatically. Decided deliberately: automatic fallback risks quietly serving degraded content without the student (or anyone) noticing a problem occurred at all.
- Both cases are low-cost specifically because of incremental progress saving (§8.9): a reload picks the student back up at the last saved point instead of losing the lesson.

---

### 8.5 The input — the only tool
For v1, the bottom of the screen holds exactly one control: a text input where the student can type anything — a new topic ("explain present perfect"), a question about what's currently on the board, or a request to go back over something ("can you explain the timeline part again?"). There is no separate topic browser, settings panel, or per-beat button set in v1; re-explanation is requested through the same input rather than a dedicated tap-to-replay control. Check-in and quiz answers are the one exception — those are selected from on-board options, not typed (§8.4).

Requirements:
- The input accepts free text and a photo attachment from the same control — typing a topic or attaching a photo of a blackboard/textbook page (§8.1) are both first-class ways to ask, not a second tool bolted on.
- Submitting a new question while a lesson is on the board should feel like a continuation, not a reset — prior context (and the board itself) should remain unless the student clearly starts a new topic.
- No other visible controls ship in v1: no topic list, no level picker, no history panel. Anything beyond the single input and the check-in/quiz options is explicitly deferred (see §6.2).

## 11. UX principles

- **One board, one tool.** The screen is a giant, plain, mostly-empty board with a single input control anchored at the bottom — no sidebars, no toolbars, no topic menus for v1. This follows the layout direction from the Figma reference provided: a large open canvas with a compact, dark, pill-shaped input area sitting on top of it, rather than a conventional app chrome of headers and panels.
- **The input does everything.** Starting a topic, attaching a photo, and asking for something to be re-explained are all the same action: type or attach, in the one input. Resist adding a second control to handle any of these separately in v1 — that's explicitly deferred (§6.2).
- **Pacing over speed.** The board should feel like it's being drawn by someone, not rendered instantly. Resist the urge to make lessons load "faster" by skipping the progressive reveal — the reveal is the product.
- **Checked, not just told.** A lesson isn't a monologue — it pauses to ask, not just to breathe. Comprehension checks between chunks and a quiz at the end are what make this feel like tutoring rather than a video with buttons.
- **Sentence-level narration, not paragraph dumps.** Beats should be short enough that a follow-up question can target one specific part, not "explain half the lesson again."
- **Visual restraint.** Diagrams should use a small, consistent visual language (a timeline looks the same across every tense lesson) rather than novel illustration per topic — consistency helps comprehension more than variety here.

A working prototype demonstrating the core rendering mechanic (progressive board drawing synced to narration, with granular replay) was built during scoping for the present perfect tense. It was browser-based, which now lines up directly with the web-app MVP decision, and can serve as a technical north star during implementation — the minimalist board-plus-input layout is the piece still to be designed against the Figma reference.

---

## 10. Non-functional requirements

| Requirement | Target |
|---|---|
| **Content accuracy** | The curated reference material is reviewed once, on creation and on update, rather than reviewing individual generated lessons (see §12); a photo request adds a topic-identification accuracy question worth its own testing pass |
| **Lesson load time** | Cached lessons should begin playing within ~1–2 seconds; first-time generations should show visible progress rather than a blank wait |
| **Re-explanation latency** | Follow-up answers should return and begin rendering within a few seconds |
| **Device support** | Modern desktop and mobile web browsers; layout should stay usable on a phone browser even though the reference design is desktop-width, given the target persona is phone-first (see §13) |
| **File handling** | Photo upload with a clear size/format limit; graceful, plain messaging when a photo is unreadable or doesn't clearly show a recognizable grammar topic |
| **Offline** | Not required for v1 |
| **Cost predictability** | Grounding content (the reference material) is sent via prompt caching, not at full price, on every model call; a photo request adds one small, one-off image-analysis call to identify the topic before generation begins — cost per lesson should still be tracked from day one |
| **Progress durability** | A lesson resumed after closing the tab picks up from the last incrementally-saved point, not from the start (§8.9) |
| **Auth security** | Identity comes from Telegram, not a custom credential store — the app's own responsibility is validating the `id_token` correctly server-side on every login (§8.8, §12), not storing or protecting a password |

---

