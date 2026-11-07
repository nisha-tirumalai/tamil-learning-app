// Database security tests: proves the database itself (row-level security)
// keeps each person's data private, not just the app's screens.
//
// These need a Supabase to talk to. GitHub Actions starts a throwaway local one
// and sets TEST_SUPABASE_* (see .github/workflows/test.yml). They're skipped
// otherwise, so they can never run against your real project by accident.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

const run = Date.now().toString(36);
const emailA = `alice-${run}@test.local`;
const emailB = `bala-${run}@test.local`;
const password = `pw-${run}-${Math.random().toString(36).slice(2)}`;

// A sample row for each per-user table, plus a change to try making to it.
// Typed loosely on purpose: the Supabase client here has no table types, and
// exact literal types make its insert() reject the rows at type-check time.
type Row = Record<string, any>;
const TABLES: Record<string, { row: Row; change: Row }> = {
  flags: { row: { item_id: "L01-test", english: "You", tanglish: "Nee" }, change: { note: "changed by someone else" } },
  card_state: { row: { item_id: "L01-test", state: { reps: 0 }, due: "2026-01-01T00:00:00+00:00" }, change: { state: { reps: 999 } } },
  review_log: { row: { item_id: "L01-test", rating: 3 }, change: { rating: 1 } },
  daily_activity: { row: { day: "2026-01-01", minutes: 5 }, change: { minutes: 99 } },
};

describe.skipIf(!configured)("database security (row-level security)", () => {
  let admin: SupabaseClient, alice: SupabaseClient, bala: SupabaseClient, visitor: SupabaseClient;
  let aliceId = "", balaId = "";
  const client = (key: string) => createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } });

  beforeAll(async () => {
    admin = client(serviceKey!);      // the secret key skips RLS: used only to set up and check
    visitor = client(anonKey!);       // not signed in
    alice = client(anonKey!);
    bala = client(anonKey!);

    const allow = await admin.from("allowlist").insert([{ email: emailA }, { email: emailB }]);
    expect(allow.error).toBeNull();
    for (const [email, set] of [[emailA, (id: string) => (aliceId = id)], [emailB, (id: string) => (balaId = id)]] as const) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      expect(error).toBeNull();
      set(data.user!.id);
    }
    expect((await alice.auth.signInWithPassword({ email: emailA, password })).error).toBeNull();
    expect((await bala.auth.signInWithPassword({ email: emailB, password })).error).toBeNull();
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of [aliceId, balaId]) if (id) await admin.auth.admin.deleteUser(id);   // also deletes their rows
    await admin.from("allowlist").delete().in("email", [emailA, emailB]);
  });

  test("someone not on the allowlist can't sign up", async () => {
    const { data, error } = await visitor.auth.signUp({ email: `stranger-${run}@test.local`, password });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  test("signing up creates a profile that only its owner can see", async () => {
    const { data } = await alice.from("profiles").select("id");
    expect(data).toEqual([{ id: aliceId }]);
  });

  for (const [table, { row, change }] of Object.entries(TABLES)) {
    test(`${table}: another user can't see, change, delete, or fake your rows`, async () => {
      // Alice saves a row.
      const saved = await alice.from(table).insert(row).select().single();
      expect(saved.error).toBeNull();
      expect(saved.data.user_id).toBe(aliceId);

      // Bala can't see it…
      const seen = await bala.from(table).select("*").eq("user_id", aliceId);
      expect(seen.data).toEqual([]);
      // …can't change it…
      const changed = await bala.from(table).update(change).eq("user_id", aliceId).select();
      expect(changed.data ?? []).toEqual([]);
      // …can't delete it…
      const deleted = await bala.from(table).delete().eq("user_id", aliceId).select();
      expect(deleted.data ?? []).toEqual([]);
      // …and can't save a row pretending to be Alice. (A different item/day, so
      // the only thing that can stop it is the security rule.)
      const fake: Row = { ...row, user_id: aliceId, ...("day" in row ? { day: "2026-01-02" } : { item_id: "L01-fake" }) };
      const faked = await bala.from(table).insert(fake);
      expect(faked.error).not.toBeNull();

      // Checked with the secret key: Alice has just her one row, unchanged.
      const check = await admin.from(table).select("*").eq("user_id", aliceId);
      expect(check.data).toHaveLength(1);
      for (const [column, value] of Object.entries(change)) expect(check.data![0][column]).not.toEqual(value);
      expect(check.data![0]).toMatchObject(Object.fromEntries(Object.keys(change).map((c) => [c, (row as Record<string, unknown>)[c] ?? null])));

      // Alice herself can still see her row.
      const own = await alice.from(table).select("*");
      expect(own.data).toHaveLength(1);
    });
  }

  test("someone who isn't signed in can't read anything private", async () => {
    for (const table of [...Object.keys(TABLES), "profiles", "usage_daily", "allowlist"]) {
      const { data } = await visitor.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });

  test("signed-in users can't read or add to the allowlist", async () => {
    expect((await alice.from("allowlist").select("*")).data).toEqual([]);
    expect((await alice.from("allowlist").insert({ email: "friend@test.local" })).error).not.toBeNull();
  });

  test("you can change your own settings, but you can't make yourself an admin", async () => {
    const settings = await alice.from("profiles").update({ pace: "slow" }).eq("id", aliceId).select("pace");
    expect(settings.data).toEqual([{ pace: "slow" }]);
    expect((await alice.from("profiles").update({ is_admin: true }).eq("id", aliceId)).error).not.toBeNull();
    const check = await admin.from("profiles").select("is_admin").eq("id", aliceId).single();
    expect(check.data!.is_admin).toBe(false);
  });

  test("you can't change your own usage counts (so you can't dodge the daily cap)", async () => {
    const { error } = await alice.from("usage_daily").insert({ user_id: aliceId, day: "2026-01-01", chat_messages: 0 });
    expect(error).not.toBeNull();
  });
});
