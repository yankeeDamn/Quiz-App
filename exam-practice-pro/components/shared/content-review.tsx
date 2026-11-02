'use client';

import { useExamLanguage } from '@/components/exampro/exam-language';
import { whatsappLink } from '@/lib/plans';

/** Missing review evidence always shows the warning, including old saved data. */
export function ContentReviewBadge({ underReview = true }: { underReview?: boolean }) {
  const { language, t } = useExamLanguage();
  if (!underReview) return null;
  return <span lang={language} className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{t('underReview')}</span>;
}

export function ReportMistake({ questionId }: { questionId: string }) {
  const { language, t } = useExamLanguage();
  return <a lang={language} href={whatsappLink(`ExamPro: please review question ID ${questionId}. I would like to report a mistake.`)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-9 items-center text-sm font-medium text-indigo-700 underline underline-offset-4 dark:text-indigo-300">{t('reportMistake')}</a>;
}
