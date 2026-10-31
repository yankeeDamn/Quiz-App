import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SkillCertificate } from "@/components/certifications/skill-certificate";
export const metadata = {
  title: "Skill Completion | ExamPro",
  robots: { index: false, follow: false },
};
export default async function AchievementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <Header />
      <SkillCertificate id={id} />
      <Footer />
    </>
  );
}
