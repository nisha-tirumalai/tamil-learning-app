# Running phase 2 (login) in Codespaces

You'll get the app running in a codespace (a computer in the cloud that GitHub
lends you), connect it to a real Supabase project, and log in on your phone.
About 30 minutes. Everything here is free.

Screens change from time to time. If a button has a slightly different name,
pick the closest match.

**Where keys go:** only in **GitHub Codespaces secrets**, never in a file. Your
repo is public, and secrets are stored by GitHub, encrypted, outside the repo.

---

## Part A: Open the codespace and run the tests

1. Go to https://github.com/nisha-tirumalai/tamil-learning-app.
2. Click the green **Code** button → **Codespaces** tab → **Create codespace on main**.
   (If you already have one, delete it with **⋯ → Delete** and create a fresh
   one, so it picks up the new setup in `.devcontainer/`.)
3. Wait for it to finish building (3–5 minutes the first time). It runs
   `npm install` by itself. That's the step your laptop can't do.
4. Open the terminal (**☰ menu → Terminal → New Terminal**) and run:
   ```
   npm test
   ```
   These are the lesson-data tests. They should all pass.
5. Then run:
   ```
   npm run test:db
   ```
   This starts a throwaway Supabase inside the codespace (the first time takes a
   few minutes to download) and runs the database security tests too. It never
   touches your real project.
6. If anything fails, start Claude Code in the codespace and paste the error. It
   will read `CLAUDE.md` and `docs/PLAN.md` to pick up where we left off.

## Part B: Create your real Supabase project

1. Go to **https://supabase.com** → **Start your project** → **Continue with GitHub**
   → **Authorize**. (This only signs you in; it doesn't give Supabase your code.)
2. If asked to create an **organization**: any name, **Personal**, **Free** plan →
   **Create organization**.
3. Click **New project**:
   - **Project name:** `tamil-learning-app`
   - **Database password:** click **Generate a password** and save it in your
     password manager (the app doesn't use it, but you can't see it again).
   - **Region:** the closest to you.
   - Click **Create new project** and wait 1–2 minutes.

## Part C: Create the tables and security rules

1. Left sidebar → **SQL Editor** (the `>_` icon) → **+ New query** if no empty editor
   is open.
2. In the codespace, open `supabase/migrations/20261104000000_init.sql`, then
   **Ctrl+A**, **Ctrl+C**.
3. Paste into the Supabase editor and click **Run**.
4. You should see **Success. No rows returned.** (Don't run it twice. The second
   run says "already exists", which is harmless but confusing.)

## Part D: Add yourself to the invite list

1. **SQL Editor** → **+ New query**, paste this, and click **Run**:
   ```sql
   insert into public.allowlist (email, note) values ('nisha.tirumalai@gmail.com', 'me');
   ```
2. To check: left sidebar → **Table Editor** → **allowlist**. Your email should be
   there.

## Part E: Turn on the invite-only check

1. Left sidebar → **Authentication** → under **Configuration**, **Auth Hooks**
   (may say **Hooks**).
2. **Add hook** → **Before User Created hook**.
3. **Hook type:** Postgres · **Schema:** `public` · **Function:** `hook_before_user_created`.
4. Click **Create hook**.

## Part F: Store the keys as Codespaces secrets

1. In Supabase: gear icon (**Project Settings**) at the bottom left →
   - **Data API** → copy the **Project URL** (`https://xxxx.supabase.co`).
   - **API Keys** → copy the **Publishable key** (`sb_publishable_…`). If you only
     see "anon / service_role", copy **anon**.
   - **Never** copy the **secret** / **service_role** key anywhere. The app doesn't
     need it, and it bypasses all the security rules.
2. On GitHub: your profile picture (top right) → **Settings** → left sidebar
   **Codespaces** → **Secrets** section → **New secret**.
3. Add two secrets, one at a time:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the Publishable key |

   For each one, under **Repository access**, choose
   `nisha-tirumalai/tamil-learning-app`, then click **Add secret**.
4. Back in the codespace, a message says your secrets changed. Click
   **Reload to apply**. (If there's no message: **☰ → View → Command Palette** →
   type **Codespaces: Rebuild Container**.)
5. Check that they arrived, in the terminal:
   ```
   echo $NEXT_PUBLIC_SUPABASE_URL
   ```
   It should print your project URL. (Don't paste the output anywhere public.)

## Part G: Tell Supabase your codespace's address

The sign-in email links back to the app, and Supabase only allows addresses you list.

1. In the codespace terminal, run:
   ```
   echo "https://${CODESPACE_NAME}-3000.app.github.dev"
   ```
   and copy what it prints.
2. In Supabase: **Authentication** → **URL Configuration**:
   - **Site URL:** paste that address → **Save**.
   - **Redirect URLs** → **Add URL** → paste the address followed by
     `/auth/callback` (e.g. `https://…-3000.app.github.dev/auth/callback`) → **Save**.

(If you ever delete this codespace and make a new one, its address changes, so
repeat Part G.)

## Part H: Start the app and open it on your phone

1. In the codespace terminal:
   ```
   npm run dev
   ```
   Wait for **Ready**.
2. Open the **Ports** tab (next to Terminal). Find port **3000 (App)**,
   right-click → **Port Visibility** → **Public**.
   *Why:* a private port only opens after signing in to GitHub in that browser,
   which gets in the way on a phone. Public is safe enough here because the app
   itself requires an invite-only login. Set it back to **Private** when you're done.
3. Copy the **Forwarded Address** (the same address as in Part G) and open it on your
   phone. Texting or emailing it to yourself is easiest.
4. On the phone: enter `nisha.tirumalai@gmail.com` → **Email me a sign-in link**.
5. Open the email **on the same phone** and tap the link.
   - **iPhone + Gmail app:** the Gmail app opens links in its own browser, which
     doesn't share Safari's login data, so the link fails. **Long-press the link →
     Open in Safari** (or whichever browser you used in step 3).
   - The link only works in the browser that asked for it, and only once.
6. You should see the Lessons list. 🎉 Try **Looks wrong?** on a card, then **My flags**.

### If the email doesn't come
Supabase's built-in email sends only to members of your Supabase organization
(you are one) and only a few per hour. Wait 10–20 minutes before asking for another.

### Invite-only check
Sign out and try a different email. You should see "This app is invite-only."

## Part I: Save the lock file

`npm install` created `package-lock.json`, which records the exact package
versions. The GitHub Actions tests need it. In the codespace terminal:
```
git add package-lock.json
git commit -m "Add package lock file"
git push
```
Then on GitHub, open the **Actions** tab. The **Tests** run should turn green
within about 5 minutes.
