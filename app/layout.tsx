import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Poppins, Space_Grotesk, Inter, Patrick_Hand } from 'next/font/google';
import '@/styles/globals.css';
import { RouteShell } from '@/components/layout/RouteShell';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const patrickHand = Patrick_Hand({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-patrick-hand',
  display: 'swap',
});

import { MiniAppProvider } from '@/components/miniapp/MiniAppProvider';
import { SoundProvider } from '@/components/sound/SoundProvider';
import PwaRegistrar from '@/components/pwa/PwaRegistrar';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://mentalwealthacademy.world';

export const metadata: Metadata = {
  title: 'Mental Wealth Academy',
  description: 'Unlock your potential, reach your horizon.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon.png', type: 'image/png' },
      { url: '/icons/logo-mwa.png', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  applicationName: 'Mental Wealth Academy',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black',
    title: 'Mental Wealth Academy',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Mental Wealth Academy',
    description: 'Unlock your potential, reach your horizon.',
    images: [
      {
        url: 'https://i.imgur.com/Ouwx2i8.png',
        width: 1200,
        height: 630,
        alt: 'Mental Wealth Academy — a 12-week personal development program with Blue',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mental Wealth Academy',
    description: 'Unlock your potential, reach your horizon.',
    images: ['https://i.imgur.com/Ouwx2i8.png'],
  },
  other: {
    'fc:miniapp': JSON.stringify({
      version: 'next',
      imageUrl: 'https://i.imgur.com/Ouwx2i8.png',
      button: {
        title: 'Launch Mental Wealth Academy',
        action: {
          type: 'launch_miniapp',
          name: 'Mental Wealth Academy',
          url: APP_URL,
          splashImageUrl: `${APP_URL}/splashlogo.png`,
          splashBackgroundColor: '#000000',
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} ${spaceGrotesk.variable} ${patrickHand.variable}`}
      data-sidebar-collapsed="true"
      style={{ '--sidebar-width': '72px' } as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        {/* Departure Mono is self-hosted via @font-face in globals.css; preload it
            so it is available early for canvas/SVG that reference it by name.
            All other fonts are self-hosted by next/font (no external requests). */}
        <link
          rel="preload"
          href="/fonts/DepartureMono-Regular.otf"
          as="font"
          type="font/otf"
          crossOrigin="anonymous"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="base:app_id" content="695b13d2c63ad876c908212a" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var root = document.documentElement;
                  var stored = localStorage.getItem('sideNavCollapsed');
                  var collapsed = stored === null
                    ? root.getAttribute('data-sidebar-collapsed') === 'true'
                    : stored === 'true';

                  root.setAttribute('data-sidebar-collapsed', collapsed ? 'true' : 'false');
                  root.style.setProperty('--sidebar-width', collapsed ? '72px' : '265px');

                  if (stored === null) {
                    localStorage.setItem('sideNavCollapsed', collapsed ? 'true' : 'false');
                  }

                  document.cookie = 'sideNavCollapsed=' + (collapsed ? 'true' : 'false') + '; path=/; max-age=31536000; SameSite=Lax';
                } catch (e) {}
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('mwa-theme') || 'dark';
                  if (!localStorage.getItem('mwa-theme')) {
                    localStorage.setItem('mwa-theme', 'dark');
                  }
                  if (theme === 'dark' && window.location.pathname !== '/') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
            <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress only non-critical wallet SDK analytics errors
              if (typeof window !== 'undefined') {
                const originalError = window.console.error;
                window.console.error = function(...args) {
                  const errorString = String(args[0] || '');
                  const errorMessage = args.join(' ');
                  
                  // Check if any argument is an object with AnalyticsSDKApiError context
                  const hasAnalyticsContext = args.some(arg => {
                    if (typeof arg === 'object' && arg !== null) {
                      if (arg.context === 'AnalyticsSDKApiError') {
                        return true;
                      }
                      try {
                        const argString = JSON.stringify(arg);
                        if (argString.includes('AnalyticsSDKApiError') || 
                            argString.includes('Analytics SDK')) {
                          return true;
                        }
                      } catch (e) {
                        // Ignore JSON stringify errors
                      }
                    }
                    return false;
                  });
                  
                  // Suppress wallet SDK analytics fetch errors (non-critical)
                  const isAnalyticsError = 
                    hasAnalyticsContext ||
                    ((errorString.includes('Analytics SDK') || errorMessage.includes('Analytics SDK')) &&
                    (errorString.includes('Failed to fetch') || 
                     errorString.includes('AnalyticsSDKApiError') ||
                     errorMessage.includes('Failed to fetch') ||
                     errorMessage.includes('AnalyticsSDKApiError') ||
                     errorString.includes('TypeError: Failed to fetch') ||
                     errorMessage.includes('TypeError: Failed to fetch')));
                  
                  if (isAnalyticsError) {
                    return; // Suppress analytics errors
                  }
                  
                  // Suppress Coinbase Wallet SDK analytics errors (non-critical)
                  if (errorMessage.includes('cca-lite.coinbase.com') ||
                      errorMessage.includes('ERR_BLOCKED_BY_CLIENT') ||
                      errorString.includes('cca-lite.coinbase.com')) {
                    return;
                  }
                  
                  originalError.apply(console, args);
                };
                
                // Suppress network warnings for blocked wallet telemetry requests
                const originalWarn = window.console.warn;
                window.console.warn = function(...args) {
                  const warnMessage = args.join(' ');
                  if (warnMessage.includes('cca-lite.coinbase.com') ||
                      warnMessage.includes('ERR_BLOCKED_BY_CLIENT')) {
                    return;
                  }
                  originalWarn.apply(console, args);
                };
              }
            `,
          }}
        />
      </head>
      <body>
        <PwaRegistrar />
        <MiniAppProvider>
          <SoundProvider>
            <RouteShell>{children}</RouteShell>
          </SoundProvider>
        </MiniAppProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
