import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { EbookReader } from "@/components/certifications/ebook-reader";
export const metadata: Metadata = {
  title: "Start Learning | ExamPro",
  description:
    "Interactive ebooks, chapter checks and ExamPro skill assessments",
  robots: { index: false, follow: false },
};
export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ chapter?: string; attempt?: string; view?: string }>;
}) {
  const { slug } = await params,
    query = await searchParams;
  return (
    <>
      <Header />
      <EbookReader
        slug={slug}
        initialChapter={query.chapter}
        resumeId={query.attempt}
        initialView={query.view}
      />
      <Footer />
    </>
  );
}
