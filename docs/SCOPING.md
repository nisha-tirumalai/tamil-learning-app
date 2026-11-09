# Tamil Speaking Tutor: Project Scoping Doc

> **What this is:** the single source of truth for *what* I'm building and *why*. Claude Code reads this before building anything (spec-driven development).
> **Owner:** Nisha Tirumalai (product + engineering) · **Started:** 2026-11-01 · **Last updated:** 2026-11-06
>
> **How to use it:**
> - ✍️ marks a decision **I** still need to make. My first-draft answer is next to it, so I can keep it or change it.
> - Check a box `[x]` when it's truly done. GitHub shows progress as "x of y tasks."
> - Every real decision goes in the **Decision Log** at the bottom, with the date and the reason.

---

## Why I'm building this

I'm Tamil, and I don't speak it well. I understand fragments from hearing my family, but when I try to say something specific (like telling my amma *"I'm on the work bus, I'll tell you about my day later"*), my phrasing comes out awkward, and I don't know the slang. One hour a week of class isn't enough. What actually works is **conversation with someone who corrects me**, and an app can do that every day, remember my weak spots, and make me practice them.

I'm also moving from finance toward building things. I already know how to analyze numbers. This project proves I can **build a product, define its metrics, and evaluate it**, so I can do both.

**My goals, ranked:**
| # | Goal | What success looks like |
|---|---|---|
| 1 | **Show employers** | Live demo link, clean README, an eval results table, a decision log, and a clear "why" story I can walk through in 5 minutes |
| 2 | **Learn** | I can explain every part of the system (data, prompts, scoring, evals, deployment) in an interview without notes |
| 3 | **Speak Tamil** | I can tell my family what's actually going on in my day, in natural spoken Tamil |
| 4 | **Real users** | Nice to have: my sister and friends use it too. Not required for the MVP |

---

## 0. Project Summary

- **Problem:** Heritage speakers like me understand some Tamil but can't **say what we actually mean** naturally. Classes are weekly, lesson notes are static text, and nobody's around to correct us in the moment.
- **Why it matters:** speaking a mother tongue keeps you connected to family. Getting better needs daily conversation with correction, focused on *your* recurring mistakes.
- **Proposed approach:** a phone-friendly app where I **speak or chat** with an AI tutor in Tanglish. After every message, it shows how a native speaker would say it, gives me a **score out of 10**, lets me try again, and then continues the conversation. It remembers my weak spots and steers future conversations toward them.
- **Primary success metric:** my **average score per week goes up** (and the share of messages needing no correction goes up).
- **App quality metric:** the tutor's corrections and scores **agree with a fluent speaker's** (my teacher or parents) on a test set.
- **Key risks / unknowns:**
  - Can an LLM correct **colloquial Tanglish** reliably? (spelling varies a lot)
  - Can it **score fairly and consistently**, giving the same message the same score each time?
  - Tamil **speech-to-text** accuracy on my accent
  - Slang and natural phrasing are not in my lesson notes
  - Free-tier limits; my laptop blocks npm, so I'm in Codespaces for now

### MVP (decided 2026-11-06)
**One user (me). No friends, leaderboards or games yet.**

```
Welcome screen  (the tutor is Laddu 🧸, a teddy-bear friend)
  "Vaanga, Nisha!"  (Come on in, Nisha!)
     ├── I start: I have something specific to say ("I'm on the bus coming home from work")
     └── Laddu starts: Laddu picks a random real-life situation and opens it
         (tea shop, auto ride, telling a friend about my day…), playing the other person

Every turn
  1. I say or type my message (Tanglish or English mixed in)
  2. Tutor shows:  what I said → better way to say it → score /10 → one-line why
  3. Optional: "Try saying it again" → re-scored
  4. Tutor continues the conversation (Tanglish, with an English meaning)

Always available
  🔊 / 🔇 volume toggle: muted = tutor replies as text only (for when I'm in public)
  Tanglish captions ALWAYS shown while the tutor speaks (read along)
  🐢 Slow-down + 🔁 replay buttons on every tutor reply
  Type or speak in the same chat box (🎤 arrives in phase 5)
  "Looks wrong?" flag on any correction

Past chats
  Scroll back through old conversations; delete any of them

Progress screen
  This week's average score, trend vs. last week, my top 3 recurring mistakes
```

**Not in MVP:** game, flashcards, multiple users or friends, leaderboard, podcasts, movie chat. See **Later Ideas**.

---

## 1. Problem Framing & Success Metrics

**User problem:** I know roughly *what* I want to say but not *how* to say it naturally. When I try, it comes out like "My day not good. Manager staring me. Tomorrow chat." I need a partner who lets me try, shows me the natural way, makes me say it again, and remembers what I keep getting wrong.

**Why AI engineering (vs. plain software):**
- Learners say **infinitely many things** in inconsistent Tanglish spelling. Correcting and scoring that can't be rule-based, so this is where the LLM earns its place.
- **Remembering weak spots** and steering the next conversation toward them needs the model to summarize mistakes, not just count them.
- Speech (TTS/STT) uses **pre-built speech models** (Azure). I'm not training anything.
- Progress charts, the volume toggle, and storing scores are **plain software**, with no AI needed.

**Users (MVP):** just me. Sister and friends come later.

**Stakeholders:**
| Who | Role |
|---|---|
| Nisha | PM, engineer, primary user |
| Teacher + parents | Fluent speakers: judge whether the tutor's corrections and scores are right (my "gold standard") |
| Claude Code | Implementation, working from this doc + specs |
| Mentor (Amazon/Coursera background) | Process advice, reviewer |

**Prior work (competitor research):** *What already exists, and why isn't it enough for me?* Interviewers will ask "why not just use ChatGPT voice?", and this section is the answer.
**What I found (tested 2026-11-07):**
| Product | Tamil? | What's missing for me |
|---|---|---|
| **Duolingo** | ❌ No Tamil course for English speakers | Not an option at all |
| **ChatGPT voice** | ✅ Talks in Tamil | **Writes in Tamil script**, which I can't read. **Voice-only is too fast**: I can't see the words, so I can't follow or learn from them. **Slow speech recognition.** Leans toward **formal Tamil**, not how my family talks. Doesn't score me, track progress, or target my weak spots. |
| ✍️ 1–2 more (YouTube spoken-Tamil channels, iTalki tutors) | | |

**The core insight: Tamil has two "languages."** Linguists call this *diglossia*. **Spoken Tamil** is what families and friends actually speak. **Formal/written Tamil** has different verb endings and sounds almost like a different language. Most learning material and AI defaults lean formal, which is like learning English from Shakespeare ("art thou") when you want to chat with friends ("what's up, what are you up to?").

**So my app's difference:**
1. **Spoken Tamil first:** casual, family-style Tamil is the default
2. **Tanglish on screen:** never Tamil script; I can *read along* in letters I know
3. **Voice + text together:** captions while it speaks, so I'm not lost in a fast audio stream
4. **Correction + score + memory:** not just chatting, but measurably improving

**Input and output:**
| | |
|---|---|
| **Input content** | Grows over time: teacher's lessons (11 so far, more as I take them), the book, and later phrases from family, slang, and topics I care about. The tutor must work **without** lesson content too; lessons just make it better. |
| **User input** | Spoken or typed Tanglish (English mixed in is fine), "try again" attempts, flags |
| **Output** | Corrections (Tanglish + English, never Tamil script), score /10 with reason, conversation replies, optional audio |
| **Stored** | Messages, scores, mistake types, and a weak-spots summary per user. Where: Claude Code decides (currently Supabase) |

**Constraints:**
| Constraint | Target | Notes |
|---|---|---|
| Latency | Correction + reply starts **< 3s** | Streaming text; audio follows |
| Cost | **< $5/month** for my usage | Daily caps on chat + STT |
| Quality bar | See **§1b, Evaluating the app** | ✍️ set real numbers after the first eval run |
| Privacy | My conversations are private; no chat text in logs | Keys only in secrets |
| Availability | Best-effort (free tiers) | |

### 1a. Scoring the learner (rubric v2, decided 2026-11-07)

Every message gets a **score out of 10**:
| Part | Points | Question it answers |
|---|---|---|
| **Grammar** | 0–6 | Are verb endings, tense, word order and case endings correct? (*poren* vs *ponen*, *busla* not *bus*) |
| **Sounds like spoken Tamil** | 0–4 | Family-style instead of textbook, natural phrasing (not word-by-word English), right word choice, right tone for the listener (*nee* / *neenga*) |

**Meaning is not scored.** The tutor only sees the sentence, so it can only guess what I meant. Instead the card shows **"I understood: …"** and a **That's not what I meant** button. (v1 had meaning 0–3; removed 2026-11-07.)

**Never a mistake:** Tanglish spelling variants, and English words Tamil speakers really use (bus, phone, computer).

Plus a **mistake type** tag for each error (verb tense, verb ending, missing case ending, word order, wrong word, missing word, too formal, too literal), which feeds my weak-spots list.

**Example:** I want to say *"My day wasn't good because of my manager. He's sitting next to me, so I'll tell you later."*
- I say: *"En naal nalla illa. Manager paakuraar. Naalaikki pesalaam."*
- I understood: *"My day wasn't good. The manager is watching. Let's talk tomorrow."*
- Better: *"Inniki naal sariyaa pogala. Manager pakkathula ukkaandhuttu irukkaaru, appuram solren."*
- Score: grammar 4/6 · spoken 2/4 = **6/10**. *Why:* "naalaikki" means tomorrow (for "later," say *appuram*); "sitting next to me" is *pakkathula ukkaandhuttu irukkaaru*.
- Mistake types: wrong word, too literal

✍️ *Grammar gets the bigger share because it's what I care about most. Revisit after a week of real use.* (These Tamil examples should be checked by my teacher.)

**How progress is shown (MVP):** weekly average score, trend vs. last week, % of messages scoring 9–10, and my top 3 mistake types shrinking over time.

### 1b. Evaluating the app (is the tutor any good?)

Two separate questions: **how good am I?** (the rubric above) and **how good is the app?** That second one is what this section answers.

**Gold set:** 40 of my real messages, each with the correct version + a score from a fluent speaker (teacher or parents). Then measure:
| Check | Target ✍️ |
|---|---|
| Correction is right (fluent speaker agrees) | ≥ 85% |
| Score within ±1 of the fluent speaker's score | ≥ 80% |
| Doesn't "fix" things that were already correct | ≤ 5% false corrections |
| Same message → same score when re-run (consistency) | ≥ 90% within ±1 |
| Never shows Tamil script | 100% |
| Keeps the conversation going naturally | Judge score ≥ 4/5 |

Every "Looks wrong?" flag becomes a new gold-set case.

**Success metrics:**
- **Learner (me):** weekly average score, % of 9–10 messages, recurring mistakes going down, practice days per week.
- **App:** the table above, plus 👍/👎 on corrections and flags per 100 messages.
- **System:** latency, cost per message and per month, error rate.

**Checklist**
- [x] I have strong evidence the problem matters (my own experience with family)
- [ ] ✍️ Asked 3 other heritage speakers whether they have the same problem
- [x] I've justified where the LLM is used and where it isn't
- [ ] Prior work table filled in
- [ ] Rubric v1 reviewed by my teacher
- [ ] Gold set of 40 messages scored by a fluent speaker
- [ ] Scope shared with teacher and mentor
- [x] Key decisions recorded in the Decision Log


---

## 2. Prompt Engineering & Systematic Tracking

**Prompt architecture (planned):**
| Prompt | Role |
|---|---|
| `tutor_system` | Persona, rules (Tanglish + English only, spoken register, gentle corrections, stay within the learner's lessons) |
| `tutor_context` template | Injects relevant lesson items + the learner's memory summary |
| `corrector_scorer` | For each learner message: better version, score /10 by rubric, one-line reason, mistake types (structured JSON) |
| `memory_summarizer` | After a chat: summarizes mistakes and topics into a short weak-spots note |
| `drill_generator` | Makes finish-the-sentence drills from lesson sentences |
| `judge` | LLM-as-judge prompt that scores tutor replies against a rubric (evals only) |

**Prompt organization:** prompts live in versioned files, not inside code:
```
prompts/
├── tutor_system_v1.md
├── tutor_context_v1.md
├── memory_summarizer_v1.md
├── drill_generator_v1.md
└── judge_v1.md
evaluation/
├── tutor_cases.jsonl      # test cases with expected behavior
└── results/               # one file per eval run
```

**Evaluation framework:**
| Aspect | Approach |
|---|---|
| Test set size | Start with **50 cases**, grow to 150 |
| Composition | Correct sentences, common beginner mistakes, formal-vs-spoken mixups, English mixed in, off-topic, "write it in Tamil script please" (should refuse), misspelled Tanglish |
| Metrics | Correction accuracy, false corrections (fixing what wasn't wrong), Tanglish-only compliance (automatic check), register correctness, friendliness (judge score 1–5) |
| Tooling | Script in `evaluation/` + LLM-as-judge + my manual review of a sample. ✍️ Later: Langfuse (free tier) |
| Update cadence | Every real flagged mistake or 👎 becomes a new test case |

**Checklist**
- [ ] Prompts stored in versioned files, not hardcoded
- [ ] Structured test set with expected behavior for each case
- [ ] Repeatable eval script that compares prompt versions
- [ ] Prompt changes pass the eval before being deployed
- [ ] Prompt iteration history + learnings written down

---

## 3. Model Selection & Evaluation

**Candidate models:** ✍️ check current prices before testing
| Model | Provider | Why test it |
|---|---|---|
| Claude Haiku (latest) | Anthropic | Cheap + fast; current default |
| Claude Sonnet (latest) | Anthropic | Quality ceiling: is the upgrade worth the cost? |
| A small OpenAI or Gemini model | OpenAI / Google | Different provider, for comparison on Tanglish |

**Evaluation approach:** run every model on the same `tutor_cases.jsonl`, score with the same rubric, and compare accuracy, cost per message, and latency in one table.

**Model routing:** not planned for MVP. Maybe later: cheap model for chat, stronger model for memory summaries.

**Checklist**
- [ ] Tested 2–3 models on my test set
- [ ] Compared quality, cost and latency in a table
- [ ] Licenses / terms OK for my use
- [ ] Documented why I chose the final model

---

## 4. Lesson Retrieval (lightweight RAG)

**Decision:** start **without** embeddings or a vector database. The content is small and well-structured, so the tutor gets lesson items by **lesson number + tags + the learner's recent mistakes**. I'll add embeddings only if evals show the tutor pulling the wrong material. (Explaining *why not* is a strong interview answer.)

**Data sources:**
| Source | Type | Volume | Updates |
|---|---|---|---|
| Teacher's lessons 1–12 (no 6) | .docx → JSON | ~1,770 items | When a new lesson arrives |
| Teacher's book | PDF → JSON | 33 items (pilot) → ~30 lessons | Batches |
| Overrides | JSON | 116+ corrections | Ongoing |

**Retrieval eval:** 20 learner questions ("how do I say *I'm hungry*?") with the lesson item that should be used, then measure whether the right item is included.

**Checklist**
- [ ] Retrieval approach documented (above)
- [ ] 20+ question retrieval test set
- [ ] Can tell whether a bad answer came from retrieval or from the model
- [ ] If upgraded to embeddings: before/after results documented

---

## 5. Agent Systems

**Not in scope.** The tutor is a single conversational call with context, not an agent with tools. Revisit only if a feature needs multi-step tool use.

---

## 6. Deployment & User Interface

**API design**
| Aspect | Approach |
|---|---|
| Framework | Next.js server routes (TypeScript) |
| Streaming | **Yes** for tutor replies |
| Authentication | Supabase magic link + invite allowlist |
| Rate limiting | Daily per-user caps on chat + STT (`usage_daily` table), with a friendly "come back tomorrow" message |
| Error handling | LLM/speech timeouts show a friendly retry message; errors logged |

**User interface**
| Aspect | Approach |
|---|---|
| UI framework | Next.js PWA, installable on phones |
| Key interactions | Welcome ("Vaanga, Nisha!") → I start / Laddu starts → turn loop (say it → correction + score → try again → reply) → progress screen |
| Feedback mechanism | "Looks wrong?" flag on any correction; 👍/👎 on tutor replies |

**Infrastructure**
| Aspect | Approach |
|---|---|
| Hosting | Vercel (app) + Supabase (database, auth, audio) + Azure Speech free tier |
| Containerization | Devcontainer for Codespaces (✍️ Docker image only if needed) |
| CI/CD | GitHub Actions runs tests on every push; Vercel deploys from `main` |

**Checklist**
- [ ] Streaming, errors and rate limits handled
- [ ] Feedback buttons work and are saved
- [x] `.env.example` exists; real keys only in secrets
- [ ] CI passing on every push (workflow exists, not yet green)
- [ ] Live demo link in README

---

## 7. System Monitoring & Error Analysis

**What to track**
| Component | Metrics |
|---|---|
| Tutor prompts | Judge score on sampled replies, Tanglish-only compliance, 👍/👎 rate, reply length |
| Retrieval | Which lesson items were included per reply |
| Speech | TTS cache hit rate, STT attempts + failures |
| Overall | Daily active users, session completion, latency p50/p95, cost per day, error rate |

**Logging:** one row per AI request in an `ai_requests` table: timestamp, user ID (no names), feature, prompt version, model, lesson items used, latency, tokens, cost, error. *No chat text in logs.*

**Error analysis process:** ✍️ *Suggestion:* every Sunday, spend 20 minutes on flags + 👎 replies → group into categories (wrong correction, wrong register, script leaked, bad audio, wrong lesson content) → fix content, prompt, or code → add a test case.

**Checklist**
- [ ] Structured log for every AI request
- [ ] Cost, latency and quality visible over time (Project HQ page, below)
- [ ] Weekly error review happening
- [ ] Every fix adds a new test case
- [ ] Alert if daily cost crosses a limit

---

## 8. Fine-Tuning

**Not planned.** I'll consider it only after prompts + retrieval are optimized *and* evals show a gap that prompting can't fix.

---

## 9. Code Quality & Repository Structure

**Current structure:** `src/` (app), `scripts/ingest/` (lesson parser), `data/`, `lessons/`, `supabase/` (database), `tests/`, `docs/`, `.github/workflows/`. To add: `prompts/`, `evaluation/`, `docs/specs/`.

**Spec-driven development:** before Claude Code builds any feature, it writes `docs/specs/NNN-feature-name.md` with:
1. **Problem + user story:** "As a learner, I want… so that…"
2. **Acceptance criteria:** checkable yes/no statements
3. **Out of scope**
4. **Tests + evals** that prove it works

I approve the spec, *then* code gets written.

**Code standards**
- [ ] TypeScript strict mode with typed functions
- [ ] Short comments explaining *why* on non-obvious code
- [x] No secrets in code (gitignored `.env*`)
- [ ] Model names, caps and prompt versions live in config, not scattered in code

**README contents**
- [ ] Problem + solution overview
- [ ] Architecture diagram
- [ ] Key decisions + trade-offs (link to Decision Log)
- [ ] Setup instructions (clone → run)
- [ ] Eval results table
- [ ] Live demo link + 60-second demo video

---

## 10. Timeline & Milestones

✍️ **YOUR CALL:** set target dates. Status: ⬜ not started · 🟨 in progress · ✅ done

| Phase | What | Target | Status |
|---|---|---|---|
| 0 | Goals + scoping doc (this file) | | 🟨 |
| 1 | Lesson data pipeline | | ✅ |
| 2 | Login + private per-user data | 2026-11-07 | ✅ |
| 3 | **Chat v1 with Laddu:** welcome → I start / Laddu starts (random situation) → correction + score /10 + try again + continue | | ⬜ |
| 4 | **Rubric + gold set + evals:** 40 scored messages, eval script, compare 2–3 models | | ⬜ |
| 5 | **Speak:** 🎤 in the chat box, Laddu's Tamil voice out, 🔊/🔇 mute button, words always on screen | | ⬜ |
| 6 | **Memory + progress:** weak-spots list steers conversations; weekly progress screen | | ⬜ |
| 7 | Logging + Project HQ dashboard | | ⬜ |
| 8 | Deploy → **MVP live on my phone**; daily use for 2 weeks; weekly error review | | ⬜ |
| 9 | Portfolio polish: README, eval results, demo video, write-up | | ⬜ |
| 10+ | Later Ideas (below) | | ⬜ |

## Later Ideas (parked, not in MVP)
- **Grammar rapid fire:** the app gives me an English sentence and I say it fast, cycling the same idea through tenses and forms: *"I'm going to the store now" → "I just went to the store" → "I'll go later" → "Will you come to the store with me later?"* Timed, scored, and focused on my weakest forms.
- **Pronunciation in the rubric (Speak mode):** score how clearly and smoothly I say the corrected sentence, not just whether I typed it right. Being able to *say* it matters. ✍️ Technical risk: check whether Tamil pronunciation scoring exists (e.g., Azure pronunciation assessment), or approximate it with speech-to-text accuracy + number of attempts.
- **Choose what you're graded on:** a pie chart in settings where each learner sets their own weights for grammar / meaning / naturalness / pronunciation. Sensible default, adjustable if you care more about sounding natural than about perfect grammar.
- **Game:** multiple-choice / fill-in-the-word built from *my* recurring mistakes and forgotten words
- **Friends:** sister + friends, private progress, opt-in streaks; maybe "most improved" / "most consistent" instead of a raw leaderboard
- **"Ask amma":** share a sentence with a family member, they record how they'd say it → becomes new content + slang
- **Slang & real-life phrasing pack:** from family, movies, everyday situations
- **Movie / show chat:** tell the tutor what I watched, discuss it in Tanglish, pick up phrases from it
- **Podcast mode (NotebookLM-style):** short audio episodes in easy Tamil on topics I pick, then a conversation about the episode
- **Flashcards + spaced repetition** for vocabulary (data pipeline already exists)
- **New-word dictionary:** words the tutor teaches me are saved to my own dictionary; I can browse it, get tested on it, and have conversations built around my new words so they stick (added 2026-11-07)
- **Make your own character:** when other people join, each one designs their own cartoon character for their side of the chat (added 2026-11-09)
- **Live comic pictures:** the app draws each moment of the conversation (me on the bus, my coworker next to me, Laddu with a speech bubble). Needs an image AI; slower and ~20–40× the cost of a message (added 2026-11-09)
- **Pick a situation:** choose the scene instead of a random one (added 2026-11-09)
- **Composite score per user:** one overall number or level (e.g. 7.4/10, or "Level 3: Chatting comfortably") that goes beyond phase 6's weekly average. To decide: what goes in (message scores only, or also practice streaks, new words learned, pronunciation), over what time (all time vs. the last 7/30 days), and how it's shown (number, level, chart over time). Depends on the scorer being checked first (phase 4) (added 2026-11-09)
- **Content helper agent:** a behind-the-scenes agent that runs about once a week. It looks at my past chats and weak spots, decides what I need practice on, writes new situations and practice sentences aimed at that, checks its own work (no Tamil script, spoken not formal), and saves the good ones for Laddu to use. Consider right after phase 6, once there's weak-spot data to work from. Needs its own quality checks, since nobody reviews its Tamil up front (added 2026-11-09)
- **Many users: costs + billing:** if lots of people use the app, decide how to cover AI costs, e.g. a paid plan with a higher daily limit (added 2026-11-07)

---

## 11. Project HQ Dashboard (my tracker)

A private admin-only page in the app (`/hq`) that shows me:
- **Progress:** checklist completion per section of this doc
- **Phase status:** the timeline table above
- **Eval results:** latest score per prompt/model version
- **Health:** today's cost, latency, errors, active users, open flags

It reads this file + the eval results + the `ai_requests` table, so this doc stays the source of truth. Built in Phase 6.

---

## 12. Appendix

- **Repo:** https://github.com/nisha-tirumalai/tamil-learning-app
- **Plan:** `docs/PLAN.md` · **Supabase setup:** `docs/SUPABASE_SETUP.md` · **Tests explained:** `docs/TESTS.md`
- **Glossary:** *Tanglish* = Tamil in English letters · *Register* = spoken vs. formal Tamil · *RLS* = row-level security (database privacy rules) · *Spaced repetition* = review schedule that brings back missed cards sooner · *LLM-as-judge* = using a model to score another model's answers

### Decision Log
| Date | Decision | Why |
|---|---|---|
| 2026-11-01 | Use an existing LLM with lesson content as context; no training or fine-tuning | Faster, cheaper, and enough for a small, structured dataset |
| 2026-11-01 | Never show Tamil script; store it for TTS | Users can't read script; TTS needs it for correct pronunciation |
| 2026-11-01 | Default to spoken Tamil; accept formal and label it | Goal is conversation; lessons mix both registers |
| 2026-11-01 | Next.js PWA + Supabase + Vercel, all TypeScript | Installs on phones, near-zero cost, one language to learn |
| 2026-11-01 | Invite-only allowlist + row-level security | Teacher's content + private mistakes; enforced in the database, not just the UI |
| 2026-11-01 | Speech-to-text goes through the server | So every attempt counts against the daily cost cap |
| 2026-11-04 | Generated spoken script matches the teacher's Tanglish, marked `needs_review` | Voice should say exactly what's on screen |
| 2026-11-04 | Teacher approved public lesson content in repo | Backup + simpler setup |
| 2026-11-04 | Use the app first; teacher fixes flagged items later (no review page) | Faster to learn what's actually wrong in real use |
| 2026-11-05 | Build in GitHub Codespaces for now | Dev laptop blocks npm (still enrolled in a former employer's device management) |
| 2026-11-05 | Adopt this scoping doc + spec-driven development | Production-style process; clearer use of AI; better portfolio |
| 2026-11-06 | Goals ranked: show employers > learn > speak Tamil > real users | Portfolio + learning come first; other users are a bonus |
| 2026-11-06 | MVP = Speak + Chat with correction, score /10, try again, memory, weekly progress; single user | This is the real problem (saying what I mean naturally) and the core AI work |
| 2026-11-06 | Flashcards, game, friends, leaderboard moved to Later Ideas | Keep the MVP focused on conversation |
| 2026-11-06 | Separate "scoring the learner" (rubric) from "evaluating the app" (gold set vs. fluent speaker) | The scorer itself must be tested, or progress numbers mean nothing |
| 2026-11-06 | Tutor must work without lesson content; lessons are a boost | Content will keep growing from many sources |
| 2026-11-07 | Tanglish captions always shown with voice + slow/replay buttons added to MVP | ChatGPT voice test: audio-only was too fast to follow, and its transcript was in Tamil script |
| 2026-11-07 | Rubric v2: meaning removed from the score (shown as "I understood" instead); grammar 6 + sounding natural 4 | The model can only guess intent, so scoring meaning would score a guess |
| 2026-11-07 | Past chats (view + delete) in the MVP | Seeing old conversations is part of learning; messages are already stored |
| 2026-11-07 | Amma-style tutor, one-sentence replies; accuracy first, fun second | Feels like real family conversation; keeps each turn light |
| 2026-11-09 | The tutor is **Laddu**, a teddy-bear friend (replaces amma-style); speech bubbles; one fixed girl character for me | A character makes it fun and personal; a friend feels relaxed |
| 2026-11-09 | Welcome = "Vaanga, Nisha!" with I start / Laddu starts; Laddu starts a random real-life situation (role-play) | Situations like ordering chai are real practice; no choosing keeps it light; fewer buttons |
| 2026-11-09 | No agent: a fixed two-step workflow (correct, then reply) | Faster, cheaper, predictable and testable |
| 2026-11-07 | Stay a PWA, not an App Store app | Free, instant updates, one codebase; enough for chat + speech |
| 2026-11-07 | Spoken (colloquial) Tamil is the core differentiator | Tamil diglossia: most tools and materials default to formal Tamil, which isn't how families speak |
