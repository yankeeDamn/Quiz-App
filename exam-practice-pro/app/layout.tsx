import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { AuthProvider } from '@/components/layout/auth-provider';
import { UserStorageProvider } from '@/components/layout/user-storage-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'NewsHub - Fresh News from Around the World',
  description: 'A modern news platform aggregating fresh, diverse news from multiple sources including GDELT, RSS feeds, and HackerNews.',
  keywords: ['news', 'india', 'world news', 'technology', 'hacker news', 'rss', 'aggregator'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <UserStorageProvider>
              <TooltipProvider delay={300}>
                <div className="relative flex min-h-screen flex-col bg-background">
                  {children}
                </div>
              </TooltipProvider>
            </UserStorageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
