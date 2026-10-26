import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
export function LegalPage({title,children}:{title:string;children:React.ReactNode}){
 return <><Header/><main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
 <nav className="mb-6 text-sm text-muted-foreground"><Link href="/" className="underline">Home</Link> / {title}</nav>
 <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
 <p className="mt-2 text-sm text-muted-foreground">Last updated: 26 October 2026</p>
 <div className="mt-8 space-y-6 leading-relaxed text-foreground/90">{children}</div>
 <p className="mt-8 border-t pt-5 text-sm text-muted-foreground">Questions? <Link href="/contact" className="font-semibold underline">Contact ExamPro</Link>.</p>
 </main><Footer/></>;
}
export function LegalSection({title,children}:{title:string;children:React.ReactNode}){
 return <section className="space-y-2"><h2 className="text-xl font-semibold">{title}</h2><div className="space-y-2">{children}</div></section>;
}
