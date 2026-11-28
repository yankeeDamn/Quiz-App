import { AdminAccess } from '@/components/admin/admin-access';
import { PdfDraftLibrary } from '@/components/admin/pdf-draft-library';
export default function Page(){return <main className="mx-auto w-full max-w-6xl space-y-4 p-4"><AdminAccess>{process.env.NEXT_PUBLIC_INDEPENDENT_CONTENT_ENABLED==='true'?<PdfDraftLibrary/>:<p>Independent PDF drafts are disabled.</p>}</AdminAccess></main>;}
