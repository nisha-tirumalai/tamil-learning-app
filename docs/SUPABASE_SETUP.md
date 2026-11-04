# Setting up Supabase (first time)

Supabase gives the app three things: **login** (magic-link emails), a
**database** for each person's private data, and the **rules** that keep that
data private. Takes about 15 minutes. The free plan is enough.

Supabase changes its screens from time to time. If a button has a slightly
different name, look for the closest match.

## 1. Create an account

1. Go to **https://supabase.com** and click **Start your project**.
2. Click **Continue with GitHub** and approve. (This only signs you in. It doesn't
   give Supabase your code.)
3. If it asks you to create an **organization**: name it anything (e.g. your name),
   choose **Personal** and the **Free** plan, and click **Create organization**.

## 2. Create the project

1. Click **New project**.
2. **Project name:** `tamil-learning-app`.
3. **Database password:** click **Generate a password**, then copy it into your
   password manager. The app doesn't use it, but you can't see it again later.
4. **Region:** the one closest to you and your friends.
5. Click **Create new project** and wait 1–2 minutes until the dashboard appears.

## 3. Create the tables and security rules

1. In the left sidebar, click **SQL Editor** (the `>_` icon).
2. Click **+ New query** if an empty editor isn't already open.
3. In VS Code, open `supabase/migrations/20261104000000_init.sql`, press
   **Ctrl+A** then **Ctrl+C** to copy it all.
4. Paste it into the Supabase editor and click **Run** (bottom right, or Ctrl+Enter).
5. You should see **Success. No rows returned**. If you see a red error instead,
   copy it and send it to Claude. Don't run the file twice: the second run
   errors with "already exists", which is harmless but confusing.

## 4. Add yourself to the invite list

1. In the left sidebar, click **Table Editor**, then the **allowlist** table.
2. Click **Insert** → **Insert row**.
3. **email:** your email address, **all lowercase**. **note:** e.g. `me`.
4. Click **Save**.

Do the same later for your sister and friends. Only emails in this table can sign up.

## 5. Turn on the invite-only check

This tells Supabase to check the allowlist before creating any account.

1. In the left sidebar, click **Authentication**.
2. Under **Configuration**, click **Auth Hooks** (it may just say **Hooks**).
3. Click **Add hook** → **Before User Created hook**.
4. **Hook type:** **Postgres**. **Postgres Schema:** `public`.
   **Postgres function:** `hook_before_user_created`.
5. Click **Create hook**.

## 6. Tell Supabase where the app lives

1. Still under **Authentication**, click **URL Configuration**.
2. **Site URL:** `http://localhost:3000` → **Save**.
3. Under **Redirect URLs**, click **Add URL**, enter
   `http://localhost:3000/auth/callback`, and save.

(When the app goes on Vercel in a later milestone, we'll add its address here too.)

## 7. Copy your keys into `.env.local`

1. Click the **gear icon** (**Project Settings**) at the bottom of the left sidebar.
2. Click **Data API** and copy the **Project URL** (looks like
   `https://abcdefgh.supabase.co`).
3. Click **API Keys** and copy the **Publishable key** (starts with
   `sb_publishable_`). If you only see "anon / service_role" keys, copy the **anon**
   one; it works the same way.
   **Don't** copy the **secret** / **service_role** key anywhere. The app doesn't
   need it, and it skips all the security rules.
4. In VS Code, right-click `.env.example` → **Copy**, then **Paste** in the same
   folder and rename the copy to **`.env.local`**.
5. Paste your two values into `.env.local` and save.

`.env.local` is in `.gitignore`, so git will never commit it. To double-check,
run `git status`: `.env.local` must **not** appear in the list.

## 8. Run the app

In the VS Code terminal:

```
npm install
npm run dev
```

1. Open **http://localhost:3000**. You'll land on the login page.
2. Enter your email and click **Email me a sign-in link**.
3. Open the email from Supabase and click the link. You should see the Lessons list.
4. Open a lesson, tap **Looks wrong?** on any card, add a note, and click **Save flag**.
5. Click **My flags**: your flag should be there. In Supabase, **Table Editor →
   flags** shows the same row.
6. **Invite-only check:** sign out and try a different email that's *not* on the
   allowlist. You should see "This app is invite-only."

### About the sign-in emails
Supabase's built-in email is for testing. It only sends to members of your
Supabase organization (you), and only a few emails per hour. If an email doesn't
arrive, wait a while before trying again. Before inviting friends, we'll add
Google sign-in or a free email service (decision noted in `docs/PLAN.md`).

## 9. Save and push

```
git add package-lock.json
git commit -m "Add package lock file"
git push
```

`package-lock.json` (made by `npm install`) records the exact package versions.
GitHub Actions needs it to run the tests. After pushing, open the repo on GitHub
and click the **Actions** tab. You should see a **Tests** run with a green tick
within about 5 minutes. See [TESTS.md](TESTS.md) for what each test checks.
