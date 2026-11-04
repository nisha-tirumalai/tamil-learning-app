import Link from "next/link";
import { lessonList } from "@/lib/lessons";

export default function Home() {
  return (
    <>
      <h1>Lessons</h1>
      <ul className="lesson-list">
        {lessonList().map((l) => (
          <li key={l.key}>
            <Link href={`/lessons/${l.key}`}>
              <span>{l.title}</span>
              <span className="muted small">{l.count} items</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
