import {AdminAccess} from '@/components/admin/admin-access';
import {CertificationDraftHub} from '@/components/admin/certification-draft-hub';
export default function Page(){return <main className="mx-auto max-w-6xl space-y-4 p-4"><AdminAccess>{process.env.NEXT_PUBLIC_INDEPENDENT_CONTENT_ENABLED==='true'?<CertificationDraftHub/>:<p>Independent certification drafts are disabled.</p>}</AdminAccess></main>;}
