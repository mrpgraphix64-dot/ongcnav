import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, Cinzel } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ONGC Navratri 2026 | Ahmedabad — Official Event Website',
  description: 'Celebrate Navratri 2026 with ONGC at ONGC Ground, Ahmedabad. 9 nights of authentic Garba, live folk music, culture, and community spirit.',
  icons: {
    icon: '/images/favicon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#7A1930',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`scroll-smooth ${inter.variable} ${outfit.variable} ${cinzel.variable}`}>
      <body className="font-sans bg-cream text-ink antialiased selection:bg-maroon selection:text-white min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
