import type { Metadata, Viewport } from "next";
import "./globals.scss";
import styles from "./layout.module.scss";
import "../styles/walletButton.css";
import WalletConnectionProvider from "@/wallet/WalletProvider";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import HeaderWrapper from "@/components/HeaderWrapper/HeaderWrapper";
import Script from "next/script";
import { registerServiceWorker } from "./sw-register";
import TanStackQueryProvider from "@/providers/TanStackQueryProvider";
import AnchorContextProvider from "@/contexts/AnchorContextProvider";

export const viewport: Viewport = {
  themeColor: '#00B7E1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

// Enhanced SEO metadata for sketchxpress.tech
export const metadata: Metadata = {
  title: "SketchXpress - Draw to NFT | AI Sketch Enhancement | Blockchain Art Creator",
  description: "Transform sketches into blockchain NFTs instantly. Draw anything and mint AI-enhanced digital art on Solana. Free online drawing tool - sketch to NFT in seconds!",
  keywords: "sketchxpress, sketch express, draw NFT, sketch to NFT, AI art generator, blockchain drawing, Solana NFT creator, online sketch app, digital art NFT, draw to earn, NFT minting platform, AI sketch enhancer, crypto art maker, web3 drawing tool, sketch anything NFT, express drawing app, blockchain artist tool, instant NFT creator, drawing marketplace, sketch NFT mint",
  applicationName: "SketchXpress",
  authors: [{ name: "SketchXpress Team" }],
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  creator: "SketchXpress",
  publisher: "SketchXpress",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://sketchxpress.tech'),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en-US',
      'en': '/',
    },
  },
  openGraph: {
    title: 'SketchXpress - Draw to NFT in Seconds | AI-Powered Blockchain Art',
    description: 'Sketch anything and transform it into NFT art instantly. AI enhancement meets blockchain technology.',
    url: 'https://sketchxpress.tech',
    siteName: 'SketchXpress',
    images: [
      {
        url: 'https://sketchxpress.tech/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SketchXpress - Transform Sketches to NFTs',
      },
      {
        url: 'https://sketchxpress.tech/assets/images/og-image-square.png',
        width: 1200,
        height: 1200,
        alt: 'SketchXpress Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SketchXpress - Draw to NFT | AI Blockchain Art',
    description: '🎨 Sketch → 🤖 AI Enhancement → 💎 NFT. Create blockchain art in seconds!',
    site: '@sketchxpress',
    creator: '@sketchxpress',
    images: ['https://sketchxpress.tech/assets/images/twitter-card.png'],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/assets/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/assets/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
      { url: '/assets/icons/icon-120x120.png', sizes: '120x120' },
      { url: '/assets/icons/icon-152x152.png', sizes: '152x152' },
      { url: '/assets/icons/icon-180x180.png', sizes: '180x180' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/assets/icons/safari-pinned-tab.svg',
        color: '#00B7E1',
      },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SketchXpress',
    startupImage: [
      {
        url: '/assets/icons/apple-splash-2048-2732.png',
        media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/assets/icons/apple-splash-1668-2388.png',
        media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/assets/icons/apple-splash-1536-2048.png',
        media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
      },
      {
        url: '/assets/icons/apple-splash-1125-2436.png',
        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
      },
    ],
  },
  verification: {
    google: 'google-site-verification=crmxfyyS7T84MHobtEc-g1rAPET1k84JaZ__A-Ur6yY',
    yandex: 'a583f14d6af70938',
  },
  category: 'technology',
  other: {
    'msapplication-TileColor': '#00B7E1',
    'msapplication-TileImage': '/assets/icons/ms-icon-144x144.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  if (typeof window !== 'undefined') {
    registerServiceWorker();
  }
  return (
    <html lang="en">
      <head>
        {/* Essential meta tags */}
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="yandex-verification" content="a583f14d6af70938" />

        {/* PWA meta tags */}
        <meta name="application-name" content="SketchXpress" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SketchXpress" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#00B7E1" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Additional SEO meta tags */}
        <meta name="theme-color" content="#00B7E1" />
        <meta name="color-scheme" content="normal" />

        {/* Enhanced Schema.org structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebApplication",
                  "@id": "https://sketchxpress.tech/#webapp",
                  "name": "SketchXpress",
                  "url": "https://sketchxpress.tech",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://sketchxpress.tech/assets/images/logo.png",
                    "width": 512,
                    "height": 512
                  },
                  "description": "Transform sketches into NFTs instantly with AI enhancement on Solana blockchain",
                  "applicationCategory": "DesignApplication",
                  "operatingSystem": "Any",
                  "browserRequirements": "Requires JavaScript. Requires HTML5.",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "USD"
                  },
                  "featureList": [
                    "Real-time drawing canvas",
                    "AI-powered sketch enhancement",
                    "One-click NFT minting",
                    "Solana blockchain integration",
                    "NFT marketplace",
                    "Digital art gallery"
                  ]
                },
                {
                  "@type": "Organization",
                  "@id": "https://sketchxpress.tech/#organization",
                  "name": "SketchXpress",
                  "url": "https://sketchxpress.tech",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://sketchxpress.tech/assets/images/logo.png",
                    "width": 512,
                    "height": 512
                  },
                  "sameAs": [
                    "https://x.com/sketch_xpress",
                    "https://github.com/sketchxpress"
                  ]
                },
                {
                  "@type": "WebSite",
                  "@id": "https://sketchxpress.tech/#website",
                  "url": "https://sketchxpress.tech",
                  "name": "SketchXpress",
                  "description": "Draw and create NFT art on blockchain",
                  "publisher": {
                    "@id": "https://sketchxpress.tech/#organization"
                  },
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                      "@type": "EntryPoint",
                      "urlTemplate": "https://sketchxpress.tech/search?q={search_term_string}"
                    },
                    "query-input": "required name=search_term_string"
                  }
                }
              ]
            }),
          }}
        />

        {/* Breadcrumb Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://sketchxpress.tech"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Draw",
                  "item": "https://sketchxpress.tech/"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "MintStreet",
                  "item": "https://sketchxpress.tech/mintstreet"
                }
              ]
            }),
          }}
        />

        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://api.sketchxpress.tech" />

        {/* Preload critical resources */}
        <link rel="preload" href="/assets/images/logo.png" as="image" />

        {/* PWA icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/icon-16x16.png" />
        <link rel="mask-icon" href="/assets/icons/safari-pinned-tab.svg" color="#00B7E1" />

        {/* Service Worker Registration */}
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <TanStackQueryProvider>
          <WalletConnectionProvider>
            <AnchorContextProvider>
              <HeaderWrapper />
              <main className={styles.main}>{children}</main>
            </AnchorContextProvider>
          </WalletConnectionProvider>
          <ToastContainer
            position="bottom-left"
            autoClose={4000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </TanStackQueryProvider>
      </body>
    </html>
  )
}