import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-24 text-center">
        <div>
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">404</p>
          <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
          <p className="mt-2 text-muted-foreground">
            The page you are looking for does not exist or has moved.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
              <Link href="/">Back to practice</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/india-mocks">India mock tests</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
