'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Vercel Analytics and Speed Insights, with each page's URL sent without its fragment: a
// share link's board (#board=…) stays on the device that opened it
const withoutFragment = <E extends { url: string }>(event: E): E => ({
  ...event,
  url: event.url.split('#')[0],
});

export default function Measure() {
  return (
    <>
      <Analytics beforeSend={withoutFragment} />
      <SpeedInsights beforeSend={withoutFragment} />
    </>
  );
}
