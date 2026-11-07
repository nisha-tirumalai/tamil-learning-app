# What the tests check

Run them yourself with `npm test`. GitHub Actions runs them on every push: open
the repo's **Actions** tab to see the results.

`npm test` runs only the lesson tests. The database tests skip themselves
unless a test database is set up. `npm run test:db` (in Codespaces) starts one and runs everything, and so does GitHub Actions.

## Lesson data (`tests/lessons.test.ts`)

| Test | In plain English |
|------|------------------|
| every item has its own id | No two items share an id, so a flag or a review always points at exactly one item. |
| every item has English and Tanglish | No blank cards. |
| no Tamil script in the text the app displays | The brief's rule: users never see Tamil script. Fails if any English or Tanglish contains Tamil letters. |
| the stored Tamil really is Tamil script | Whatever text-to-speech will read is real Tamil, not English pasted in the wrong column. |
| namaskāram and nandri are there as greetings | The two greetings from Adi's Book are present, with Tamil for the voice. |
| cards never include the Tamil script | Checks every card the app could send to a phone. The Tamil is left out completely, not just hidden. |
| every lesson is listed, including Adi's Book | The home page shows Lessons 1–12 (there's no Lesson 6) and the book. |
| a flag's snapshot comes from the real item | When you flag a card, the app saves the item's real English and Tanglish (looked up on the server), and rejects unknown items. |

## Database security (`tests/rls.test.ts`)

These create two pretend users, **Alice** and **Bala**, in a throwaway database,
then try to break the privacy rules.

| Test | In plain English |
|------|------------------|
| someone not on the allowlist can't sign up | The invite-only rule is enforced by the database, not just the login page. |
| signing up creates a profile that only its owner can see | Each new user gets settings (voice, pace…) and can see only their own. |
| flags / card_state / review_log / daily_activity: another user can't see, change, delete, or fake your rows | Alice saves something. Bala tries to read it, change it, delete it, and save a row in Alice's name. All four must fail, and Alice's row must be unchanged. Repeated for each private table: flags, flashcard schedule, answer history, practice days. |
| someone who isn't signed in can't read anything private | A logged-out visitor gets nothing from any table. |
| signed-in users can't read or add to the allowlist | Friends can't see who else is invited, or invite themselves. |
| you can change your own settings, but not make yourself an admin | Changing your pace works; setting `is_admin` is refused. |
| you can't change your own usage counts | Nobody can reset their daily chat count to get around the cap. |

## Type-check (`npm run typecheck`)

Not a test as such: TypeScript reads all the code and catches mistakes like a
misspelled field name before the app runs.
