import { redirect } from 'next/navigation';
/** Legacy demo route redirects to the native, database-backed ExamPro catalogue. */
export default function ExamProPage(){ redirect('/india-mocks'); }
