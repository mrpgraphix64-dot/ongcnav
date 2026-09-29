import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, Cinzel } from 'next/font/google';
import Script from 'next/script';
import { META_PIXEL_ID } from '@/lib/meta-pixel';
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
  description: 'Celebrate Navratri 2026 with ONGC at Malaviya Cricket Ground ONGC, Ahmedabad. 9 nights of authentic Garba, live folk music, culture, and community spirit.',
  icons: {
    icon: [
      { url: '/ongcnav.jpg' },
      { url: '/favicon.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/ongcnav.jpg',
    apple: '/apple-touch-icon.png',
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
        {/* Meta Pixel base code — loads site-wide, initializes the pixel and
            sends the standard PageView event. Automatic Advanced Matching is
            intentionally NOT enabled here: it would scan page forms for
            name/email/phone and this site has no existing cookie/consent
            mechanism to disclose that (see audit note). */}
        <Script id="meta-pixel-base" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
