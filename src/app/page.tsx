import type { Metadata, Viewport } from 'next';
import TierStackLoader from './TierStackLoader';

// Hidden tool: not linked from the home page and kept out of search results
export const metadata: Metadata = {
  title: 'tcgTierStack',
  robots: { index: false, follow: false },
};

// Browser bar color; matches the top bar
export const viewport: Viewport = {
  themeColor: '#1B2125',
};

export default function Page() {
  return <TierStackLoader />;
}
