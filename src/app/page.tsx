import type { Metadata } from 'next';
import TierStackLoader from './TierStackLoader';

// Hidden tool: not linked from the home page and kept out of search results
export const metadata: Metadata = {
  title: 'tcgTierStack',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <TierStackLoader />;
}
