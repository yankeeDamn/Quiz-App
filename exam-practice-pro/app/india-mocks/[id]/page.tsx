import { notFound } from 'next/navigation';
import { indiaExams } from '@/data/india-exams';
import { PracticeClient } from './practice-client';
export function generateStaticParams(){ return indiaExams.map(e=>({id:e.id})); }
export default async function MockPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 const exam=indiaExams.find(e=>e.id===id);
 if(!exam) notFound();
 return <PracticeClient exam={exam}/>;
}
