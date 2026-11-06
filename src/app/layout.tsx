import type { Metadata, Viewport } from 'next';
import { Figtree, Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { ReactNode } from 'react';
import './globals.css';

// Tier labels: Inter Black
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: '900',
});

// The controls. A stand-in for Google Sans Rounded.
const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
});

// Kept out of search results until the tool has its real domain
export const metadata: Metadata = {
  title: 'TierBinder',
  description: 'Make TCG tier lists and graphics.',
  robots: { index: false, follow: false },
};

// Lets the page draw under the iOS status bar. Browser bar color matches the top bar.
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#466E85', // storm-600
};

// Own scroll container (html and body don't scroll)
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${figtree.variable} antialiased`}>
        <main className="flex justify-center items-start overflow-y-auto h-dvh pb-[env(safe-area-inset-bottom)]">
          {children}
        </main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
