"use client";
import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { ebookApi, type SkillCertificate as Certificate } from "@/lib/ebooks";
export function SkillCertificate({ id }: { id: string }) {
  const [certificate, setCertificate] = useState<Certificate | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void ebookApi<{ certificate: Certificate }>(
      `/ebooks/certificates/${encodeURIComponent(id)}`,
      { public: true },
    ).then((result) => {
      if (!active) return;
      if (result.data) setCertificate(result.data.certificate);
      else
        setError(
          "This achievement is unavailable or has not been shared publicly.",
        );
    });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16">
      <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-background to-emerald-50 p-8 sm:p-12 dark:border-indigo-900 dark:from-indigo-950/30 dark:to-emerald-950/20">
        <Award className="h-14 w-14 text-indigo-600" />
        <h1 className="mt-6 text-2xl font-bold">
          ExamPro Skill Completion Certificate
        </h1>
        {certificate ? (
          <>
            <p className="mt-6 text-3xl font-bold">{certificate.name}</p>
            <p className="mt-4 text-lg">{certificate.title}</p>
            <p className="mt-5 text-4xl font-bold">{certificate.percentage}%</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Completed{" "}
              {new Date(certificate.completedAt).toLocaleDateString("en-IN")} ·
              Server-graded assessment
            </p>
            <p className="mt-6 break-all font-mono text-[10px] text-muted-foreground">
              Result ID: {certificate.id}
            </p>
          </>
        ) : (
          <p className="mt-5 text-sm" role="status">
            {error || "Verifying the shared result…"}
          </p>
        )}
        <p className="mt-7 border-t pt-5 text-xs leading-6 text-muted-foreground">
          Issued by ExamPro for its own learning assessment. This is not a
          vendor-issued, accredited or proctored qualification.
        </p>
      </section>
    </main>
  );
}
