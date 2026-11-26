import { StudyPage } from "@/components/study-plans/student";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; day: string }>;
}) {
  const { slug, day } = await params;
  return <StudyPage slug={slug} day={Number(day)} />;
}
