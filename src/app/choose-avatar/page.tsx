// First sign-in (spec 003): pick your avatar before the home screen.
import { AvatarPicker } from "@/components/AvatarPicker";

export default function ChooseAvatar() {
  return (
    <div className="welcome">
      <h1>Choose your avatar</h1>
      <p className="muted">This is you in your chats with Laddu. You can change it any time in Settings.</p>
      <AvatarPicker current={null} next="/" />
    </div>
  );
}
