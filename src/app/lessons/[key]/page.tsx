// One lesson's items as cards. (Real flashcards with spaced repetition come in
// milestone 3; for now this lets you browse and flag anything that looks wrong.)
import { notFound } from "next/navigation";
import { ItemCard } from "@/components/ItemCard";
import { lessonSections, lessonTitle } from "@/lib/lessons";

export default async function LessonPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const sections = lessonSections(key);
  if (!sections) notFound();
  return (
    <>
      <h1>{lessonTitle(key)}</h1>
      {sections.map(({ section, cards }) => (
        <section key={section}>
          <h2>{section}</h2>
          {cards.map((card) => <ItemCard key={card.id} card={card} />)}
        </section>
      ))}
    </>
  );
}
