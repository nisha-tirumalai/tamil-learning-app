// "Choose your avatar": two pictures, tap one. A plain form, so it works even
// before the page's JavaScript has loaded.
import { chooseAvatar } from "@/app/settings/actions";
import { AVATAR_LABELS, AVATARS, type Avatar } from "@/lib/avatar";
import { Character } from "./Characters";

export function AvatarPicker({ current, next }: { current: Avatar | null; next: "/" | "/settings" }) {
  return (
    <form action={chooseAvatar} className="avatar-picker">
      <input type="hidden" name="next" value={next} />
      {AVATARS.map((a) => (
        <button key={a} type="submit" name="avatar" value={a}
          className={a === current ? "avatar-choice chosen" : "avatar-choice"} aria-pressed={a === current}>
          <Character avatar={a} size={130} crop="bust" />
          <span>{AVATAR_LABELS[a]}</span>
        </button>
      ))}
    </form>
  );
}
