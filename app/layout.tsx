import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MCB Data Collection',
  description: 'Event tracking and data collection system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
