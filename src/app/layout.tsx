import { Figtree, Inter } from 'next/font/google';
import type { ReactNode } from 'react';

// Tier labels: Inter Black. Only tcgTierStack uses it, so it's loaded here.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: '900',
});

// The controls. A stand-in for Google Sans Rounded; only tcgTierStack uses it.
const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
});

// Own scroll container (html and body don't scroll)
export default function TierStackLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${inter.variable} ${figtree.variable} flex justify-center items-start overflow-y-auto h-dvh pb-[env(safe-area-inset-bottom)]`}
    >
      {children}
    </div>
  );
}
