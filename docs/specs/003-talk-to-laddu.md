# 003: Talk to Laddu (voice)

**Status:** Draft, waiting for Nisha's answers and approval (2026-11-10)
**Phase:** 5 (SCOPING.md §10), moved up: after 3b (Laddu v1.1), before going live
**Based on:** SCOPING §0 (Speak mode, captions, 🔊/🔇, slow/replay), the
2026-11-10 feedback ("voice has to be a key part"; "Laddu's whole body, his
mouth moving, like we're having a conversation"), and a quick research check

## Problem + user story

Typing isn't fun, and it isn't the skill I want. I want to **speak** Tamil.

As a learner, I want to **talk to Laddu out loud and hear him answer**, like a
video call with a friend: I hold a button and say my sentence in Tanglish,
Laddu answers in a natural Tamil voice with his mouth moving, and I still get my
⭐ score and correction when I tap for it.

```
        ┌───────────────────────────────┐
        │                               │
        │          🧸  (big, full body,  │
        │       mouth moves as he talks)│
        │                               │
        │  "Ooh, Mysore pak-aa! Adhukku │   ← caption (see open question 1)
        │   enna enna venum, sollu?"    │
        │   [🐢 slow] [🔁 again]  [🔇]   │
        │                               │
        │  👧 "Na konjam sweets          │   ← what Laddu heard me say
        │      samaikkiren"   ⭐ 6 ›     │      (tap to fix if he heard wrong)
        │                               │
        │        [ 🎤 hold to talk ]    │
        │        ⌨️ type instead        │
        └───────────────────────────────┘
```

## Step 1 (before building): the voice bake-off

Nobody has published how well these services understand **Tanglish** (Tamil
and English mixed in one sentence). Benchmarks for Indian code-mixed speech are
mixed: one national benchmark reported very high error rates for OpenAI's
models; Google and ElevenLabs claim better Tamil results. So we test with
**my own voice**, then pick. This is a small eval, and a good portfolio story.

**Hearing test (speech-to-text):**
- I record ~15 sentences the way I really talk (see "How Nisha helps"), and
  write down exactly what I said in Tanglish.
- Each candidate service transcribes them: **Azure Speech** (the plan so far),
  **Google Cloud Speech (Chirp)**, **ElevenLabs Scribe**. OpenAI optional.
- Score each: how many words it got wrong, whether it **kept my mistakes** (a
  hearing service that quietly "fixes" my grammar would make my score wrong),
  whether English words survive, and how long it takes.
- Recordings and results stay **out of the public repo**; only the summary
  table goes in.

**Voice test (text-to-speech):**
- The same 5 Laddu lines, spoken by 2–3 candidate voices per service (Azure
  Tamil neural voices, Google Tamil voices, ElevenLabs Tamil voices).
- I listen (ideally with amma) and pick the one that sounds most like a
  real, friendly Tamil speaker.

**Decision:** the winner(s) go into the config, with the results table in the
spec. Hearing and voice can come from different services.

## Acceptance criteria

**Talking**
- [ ] A **🎤 hold-to-talk** button (see open question 2). Release to send. The
      first time, the phone asks for microphone permission; if I say no, I see
      how to turn it on, and typing still works.
- [ ] What Laddu heard appears as my bubble in **Tanglish** (never Tamil script).
      If he heard wrong, I can **tap to fix it** by typing, and the fixed text is
      what gets scored, so a hearing mistake is never counted as my mistake.
- [ ] Then everything from spec 002 happens: Laddu replies right away, the ⭐
      chip fills in when the score is ready.
- [ ] **⌨️ Type instead** is always one tap away; I can switch any time.

**Laddu talking**
- [ ] Laddu's reply is **spoken** in the chosen Tamil voice, starting within
      **3 s** of my sending (typical, Wi-Fi).
- [ ] The voice reads a hidden **Tamil-script** version of the reply (made with
      the reply, so pronunciation is right) while the screen only ever shows
      Tanglish. Same rule as always: no Tamil script on screen.
- [ ] **🐢 Slow** replays the reply more slowly; **🔁 Again** replays it.
- [ ] **🔇 Mute**: Laddu's replies are text only (for the bus); remembered.
- [ ] Sound only starts after I've tapped something (phones require this).

**The call screen**
- [ ] Laddu is **big, full body**, in the middle. While his voice plays, his
      **mouth moves** (a simple open/close animation that follows the loudness
      of his voice). When he's quiet, he idles (blinks).
- [ ] My girl character is smaller, near my bubble.
- [ ] Earlier messages scroll above, as in spec 002 (English and score on tap).
- [ ] New drawings (Laddu full body, two or three mouth shapes) are shown to me
      for approval first. If I provide teddy pictures I like (that I have the
      right to use), they're used as the style guide.

**Rules that always hold**
- [ ] **Daily cap:** each spoken message counts like a typed one. A recording
      that's too short, silent or longer than 30 s is rejected before any paid
      call, and doesn't count.
- [ ] **Audio isn't stored** after it's turned into text (only the text is saved,
      as now). Recordings go to our server, then to the hearing service, never
      straight from the phone with a key.
- [ ] New keys (whichever services win) are **Codespaces secrets**, used only on
      the server.
- [ ] **Errors:** if hearing fails: "Aiyo, I couldn't hear that 😅 Try again or
      type it." If the voice fails, the reply still shows as text.
- [ ] Works on my iPhone and in a laptop browser.

## Out of scope

- Scoring my **pronunciation** (Later Ideas: needs separate research)
- A custom or cloned voice for Laddu
- Hands-free conversation (no button, Laddu listens all the time)
- Perfect lip-sync to each sound; smooth professional animation
- Going live on Vercel (next step after this; the mic works on the codespace's
  https address for testing)

## Rough cost (to confirm in the bake-off)

Published prices vary by source; these are estimates at the 60-a-day cap.
- **Laddu's voice:** about $15–16 per million characters for standard neural
  voices. A reply is ~80 characters, so a full day at the cap is ~5,000
  characters: **about $2 a month**, possibly inside a free tier.
- **Hearing me:** roughly $0.20–$1 per hour of audio depending on the service.
  60 messages × ~5 s ≈ 5 minutes a day: **about $1–3 a month**.
- Plus the Claude calls I already pay for. Total stays around **$5 a month**.

## Tests + evals

**Bake-off (step 1):** the hearing test and voice test above, with a results
table: words wrong per service, mistakes kept vs "fixed", English words kept,
speed, cost; and my voice pick.

**Automated (CI, fake hearing + fake voice services, no cost):**
- A recording → text → Tanglish bubble → reply + score (spec 002 flow).
- Tamil script from the hearing service is turned into Tanglish and never sent
  to the screen; the hidden Tamil-script reply goes only to the voice service.
- Too short / silent / too long recordings are rejected and don't count.
- Fixing a mis-heard bubble re-scores the fixed text.
- Mute: no voice call is made.
- Hearing or voice failures show the right friendly message.

**Manual (Nisha, on her phone):** 10 spoken messages in a Laddu-starts
situation: Laddu understands me most of the time, I can fix the times he
doesn't, his voice sounds friendly and Tamil, his mouth moves when he talks,
and mute works on the bus.

## How Nisha helps (her part)

1. **Answer the open questions below.**
2. **Record ~15 sentences** on your phone (Voice Memos), the way you really talk,
   and type out what you said in Tanglish. Include:
   - 3 you're confident are correct
   - 3 with English words mixed in ("bus-la office-ku poren")
   - 3 where you're unsure or probably wrong (so we see if the service keeps the mistake)
   - 3 said fast and casually, like on the phone with amma
   - 3 longer ones (two sentences, like telling Laddu about your day)
   - Record 2 or 3 of them in a noisy place (kitchen, car)
3. **Make free accounts** for the candidates (I'll walk you through each:
   Azure, Google Cloud, ElevenLabs), and add their keys as Codespaces secrets.
4. **Listen to the voice samples** (with amma if you can) and pick Laddu's voice.
5. **Describe Laddu's look**, or share teddy pictures you like.

## Open questions (my suggestion in brackets)

1. ✍️ **Captions while Laddu talks:** SCOPING said captions are *always* shown
   (the ChatGPT test was too fast to follow), but spec 002 hides words to keep
   the screen calm. Which? [show Laddu's Tanglish caption while he talks, one
   line, English on tap]
2. ✍️ **Hold to talk, or tap to start and tap to stop?** [hold to talk: simpler,
   and it doesn't accidentally record the bus]
3. ✍️ **Laddu's voice:** a boy's or a man's voice, or a woman's? Young and playful,
   or calm? [young and playful, to match a teddy friend; depends what the
   services have]
4. ✍️ **Should Laddu's opening line also be spoken** when he starts a situation?
   [yes]
5. ✍️ **If hearing is clearly bad for everyone in the bake-off,** what then?
   [keep voice *out* for Laddu (he still talks), and I keep typing until a
   better service exists; that's a real finding for the write-up]
