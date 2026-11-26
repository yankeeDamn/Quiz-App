import { StudyPage } from "@/components/study-plans/student";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <StudyPage slug={slug} />;
}
