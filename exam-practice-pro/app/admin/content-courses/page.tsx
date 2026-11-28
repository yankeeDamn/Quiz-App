import {AdminAccess} from '@/components/admin/admin-access';
import {CourseDraftBuilder} from '@/components/admin/course-draft-builder';
export default function Page(){return <main className="mx-auto max-w-6xl space-y-4 p-4"><AdminAccess>{process.env.NEXT_PUBLIC_INDEPENDENT_CONTENT_ENABLED==='true'?<CourseDraftBuilder/>:<p>Independent course drafts are disabled.</p>}</AdminAccess></main>;}
