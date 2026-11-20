import type { Metadata, Viewport } from 'next';
import { Figtree, Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import Measure from './Measure';

// Tier labels: Inter Black
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: '900',
});

// The controls
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
  // An on-screen keyboard overlays the page rather than shortening it, so it can't turn a
  // portrait tablet's page landscape and move the sidebar beside the board while typing
  interactiveWidget: 'resizes-visual',
  themeColor: '#78A5BD', // storm-400
};

// Own scroll container (html and body don't scroll); from b8 up and below it alike the
// editor fits the window, scrolling inside its own panels
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${figtree.variable} antialiased`}>
        {/* The status bar's strip in the top bar's color on phones (globals.css) */}
        <div aria-hidden className="tierbinder-status" />
        <main className="flex justify-center items-start overflow-y-auto h-dvh pb-[env(safe-area-inset-bottom)]">
          {children}
        </main>
        <Measure />
      </body>
    </html>
  );
}
