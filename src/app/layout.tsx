import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

// Tier labels: Inter Black. Only tcgTierStack uses it, so it's loaded here.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: '900',
});

// Own scroll container (html and body don't scroll)
export default function TierStackLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${inter.variable} flex justify-center items-start overflow-y-auto h-[calc(100dvh_-_62px_-_env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]`}
    >
      {children}
    </div>
  );
}
