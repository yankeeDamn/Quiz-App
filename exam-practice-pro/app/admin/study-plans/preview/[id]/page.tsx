import { StudyPage } from "@/components/study-plans/student";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const { day } = await searchParams;
  return <StudyPage previewId={id} day={day ? Number(day) : undefined} />;
}
