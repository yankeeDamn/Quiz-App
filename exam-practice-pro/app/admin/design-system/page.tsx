import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { AdminAccess } from '@/components/admin/admin-access';
import { DesignSystem } from '@/components/admin/design-system';
export const metadata = { title: 'Design system | ExamPro', robots: { index: false, follow: false } };
export default function Page() {
  return <><Header /><main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6"><AdminAccess><DesignSystem /></AdminAccess></main><Footer /></>;
}
