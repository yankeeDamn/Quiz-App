import type { Metadata } from "next";
import { cache } from "react";
import { API_BASE_URL } from "@/lib/api";
import type { EbookTrack } from "@/lib/ebooks";
const publicBook=cache(async(slug:string):Promise<EbookTrack|null>=>{
 if(process.env.NEXT_PUBLIC_MONETIZATION_ENABLED!=="true")return null;
 try{const response=await fetch(API_BASE_URL+"/api/v1/ebooks/"+encodeURIComponent(slug),{cache:"no-store",signal:AbortSignal.timeout(4000)});if(!response.ok)return null;const data=await response.json();return data.data?.ebook?.visibility==="public"?data.data.ebook:null;}catch{return null;}
});
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { EbookReader } from "@/components/certifications/ebook-reader";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const book=await publicBook((await params).slug);
 return {title:book?book.title+" | ExamPro":"Start Learning | ExamPro",description:book?.subtitle||"Interactive ebooks and skill assessments",robots:{index:!!book,follow:!!book}};
}
export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ chapter?: string; attempt?: string; view?: string }>;
}) {
  const { slug } = await params,
    query = await searchParams;
  const initialBook=await publicBook(slug);
  return (
    <>
      <Header />
      <EbookReader
        slug={slug}
        initialBook={initialBook}
        initialChapter={query.chapter}
        resumeId={query.attempt}
        initialView={query.view}
      />
      <Footer />
    </>
  );
}
