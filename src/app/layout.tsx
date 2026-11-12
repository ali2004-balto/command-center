// Root layout: the demo ribbon, and the "Setup incomplete" page when required settings are missing.
import type { Metadata } from 'next';
import { connection } from 'next/server';
import './globals.css';
import { isMock, missingEnv } from '@/lib/env';
import SetupIncomplete from '@/components/SetupIncomplete';

export const metadata: Metadata = {
  title: 'Command Center',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection(); // always render per request: environment is read at request time
  const missing = missingEnv();
  return (
    <html lang="en">
      <body>
        {isMock() && <div className="ribbon">DEMO DATA</div>}
        {missing.length > 0 ? <SetupIncomplete missing={missing} /> : children}
      </body>
    </html>
  );
}
