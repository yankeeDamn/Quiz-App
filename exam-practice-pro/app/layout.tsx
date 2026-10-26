import type { Metadata } from 'next';
import { Inter, Hind_Siliguri, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { AuthProvider } from '@/components/layout/auth-provider';
import { UserStorageProvider } from '@/components/layout/user-storage-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FloatingWhatsApp } from '@/components/mocks/whatsapp-button';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const bangla = Hind_Siliguri({
  subsets:['bengali','latin'],
  weight:['400','500','600','700'],
  variable:'--font-bangla',
});
const hindi = Noto_Sans_Devanagari({
  subsets:['devanagari','latin'],
  weight:['400','500','600','700'],
  variable:'--font-hindi',
});

export const metadata: Metadata = {
  title: 'ExamPro',
  description: 'Mock tests for SSC, Banking, Railways, UPSC and campus placements, plus certification practice. Doubts answered on WhatsApp.',
  keywords: ['exam', 'practice', 'quiz', 'study', 'test', 'certification'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${bangla.variable} ${hindi.variable} font-sans antialiased`}>
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
                  <FloatingWhatsApp />
                </div>
              </TooltipProvider>
            </UserStorageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
