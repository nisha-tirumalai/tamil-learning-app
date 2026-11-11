// Welcome (spec 001): Laddu says hello, and I choose who starts.
import Link from "next/link";
import { Laddu } from "@/components/Characters";
import { WELCOME } from "@/lib/chat/config";
import { firstName } from "@/lib/chat/pick";
import { createClient } from "@/lib/supabase/server";
import { start } from "./chat/actions";

export default async function Welcome() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  const { data: profile } = await db.from("profiles").select("display_name").eq("id", user?.id ?? "").maybeSingle();
  const name = firstName(profile?.display_name);
  return (
    <div className="welcome">
      <Laddu size={150} />
      <div className="bubble big">
        <p className="tanglish">{WELCOME.tanglish(name)}</p>
        <p className="english">{WELCOME.english(name)}</p>
      </div>
      <div className="start-buttons">
        <form action={start.bind(null, "me")}><button>I start</button></form>
        <form action={start.bind(null, "laddu")}><button>Laddu starts</button></form>
      </div>
      <Link href="/chats">Past chats ›</Link>
    </div>
  );
}
