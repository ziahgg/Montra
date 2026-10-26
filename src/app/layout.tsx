import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { Providers } from '@/components/Providers';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

/** Every screen reads IndexedDB on the client, so routes intentionally stream behind a loading gate (pages opt out too). */
export const instant = false;

export const metadata: Metadata = {
  title: 'Montra — Personal Finance',
  description: 'See where your money goes, set budgets that fit, and save for what matters. Local-first; data stays in this browser.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#EEF0F3',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} data-theme="light">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
