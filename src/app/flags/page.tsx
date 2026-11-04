// "My flags": everything you've marked as looking wrong, newest first, so you
// can ask your teacher about them. Only your own flags are returned (RLS).
import { createClient } from "@/lib/supabase/server";
import { deleteFlag, setResolved } from "./actions";

export default async function FlagsPage() {
  const supabase = await createClient();
  const { data: flags, error } = await supabase
    .from("flags")
    .select("id, item_id, english, tanglish, note, source, resolved, created_at")
    .order("created_at", { ascending: false });

  if (error) return <p className="error">Couldn&apos;t load your flags.</p>;
  const open = flags.filter((f) => !f.resolved).length;

  return (
    <>
      <h1>My flags</h1>
      <p className="muted">
        {flags.length ? `${open} to ask about, ${flags.length - open} sorted.` : "Nothing flagged yet. Tap “Looks wrong?” on any card."}
      </p>
      {flags.map((f) => (
        <article key={f.id} className={`card${f.resolved ? " resolved" : ""}`}>
          <p className="tanglish">{f.tanglish}</p>
          <p className="english">{f.english}</p>
          {f.note && <p className="note">“{f.note}”</p>}
          <div className="card-footer">
            <span className="muted small">
              {new Date(f.created_at).toLocaleDateString()} · {f.item_id}{f.source === "chat" ? " · from chat" : ""}
            </span>
            <span className="row">
              <form action={setResolved}>
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="resolved" value={String(!f.resolved)} />
                <button className="link-button">{f.resolved ? "Reopen" : "Mark sorted"}</button>
              </form>
              <form action={deleteFlag}>
                <input type="hidden" name="id" value={f.id} />
                <button className="link-button danger">Delete</button>
              </form>
            </span>
          </div>
        </article>
      ))}
    </>
  );
}
