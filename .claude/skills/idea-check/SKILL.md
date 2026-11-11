---
name: idea-check
description: Check how feasible a new feature idea is for the Tamil tutor app (Laddu) before any spec or code. Use when Nisha proposes a feature, asks "is this doable?", "can we add…", "how hard is…", or runs /idea-check.
---

# Idea check

Nisha has a feature idea. Give her an honest feasibility check in plain English
(she's new to programming), then let her decide. **Don't write a spec or code.**

## Before answering

1. Read `docs/SCOPING.md` (the phases in §10 and the Later Ideas list) and the
   "Where we are" section of `docs/PLAN.md`, so you know what's built, what's
   planned, and whether the idea (or part of it) is already there.
2. If the idea is unclear, ask **one** short question. Otherwise go straight on.

## Answer in this format

**The idea in one line:** restate it, so she can check you understood.

**Verdict:** one of
- 🟢 **Easy:** a small change, fits in now
- 🟡 **Medium:** doable, a real chunk of work
- 🔴 **Hard:** a big project, or needs things we don't have yet
- ⏸️ **Not yet:** good idea, but it depends on a phase that isn't done

**Already planned?** Say if it's in a phase or Later Ideas, and where.

**What it would take**, in plain English:
- **Work:** roughly how many working sessions (one session ≈ one sitting)
- **Money:** extra cost per month, if any (AI calls, images, voice, services)
- **New things needed:** accounts, keys, services, or data we don't have yet
- **Depends on:** phases or features that must exist first

**Risks:** what could go wrong. Always check: does it show Tamil script? Is it
spoken Tamil? Is the Tamil content reliable without the teacher checking it?
Is it slow (the card must appear in 3 s)? Does it touch privacy or other users?

**A cheaper version:** a smaller first step that gets most of the fun, if there is one.

**My recommendation:** where it should go: add to the current spec, a future
phase (which one), Later Ideas, or skip. Say why in one or two sentences.

**Next step:** ask what she wants: add it to Later Ideas, write a spec for it
(`docs/specs/NNN-name.md`, which still needs her approval before code), or
think about it more.

## Style

- Short. Use a table when comparing options.
- Explain any technical word the first time, with an everyday analogy if it helps.
- Be honest: if it's hard or expensive, say so kindly, and offer the cheaper version.
- Remember her priorities: accuracy first, fun second; portfolio > learning >
  speaking Tamil > real users.
