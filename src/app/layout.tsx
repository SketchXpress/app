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

export const metadata: Metadata = {
  title: "SketchXpress | AI-Powered Sketch to NFT Platform with Bonding Curves",
  description: "Transform sketches into AI-enhanced NFTs using advanced bonding curve economics. Mint, trade, and optimize digital assets with SketchXpress - your gateway to AI image generation and NFT innovation.",
  keywords: [
    // Primary keywords
    "sketch to image AI",
    "image enhance AI",
    "NFT bonding curves",
    "Mint street NFT collection",
    "SketchXpress",
    "AI NFT generator",
    "dynamic NFT pricing",
    "decentralized NFT minting",
    "AI image enhancement",
    "NFT collection analytics",

    // Brand name variations and common misspellings
    "Sketch Xpress",
    "Sketch Express",
    "SketchExpress",
    "Sketch X Press",
    "SkethXpress",
    "SketcXpress",
    "SketchXpres",
    "Sketsh Express",
    "Sketch Expres",
    "SkechXpress",
    "SketchXprez",
    "Skech Express",

    // URL variations
    "sketchxpress.com",
    "sketch-xpress.com",
    "sketchexpress.com",
    "www.sketchxpress.com",
    "sketch xpress com"
  ],
  authors: [{ name: "SketchXpress Team" }],
  creator: "SketchXpress",
  publisher: "SketchXpress Technologies",
  robots: "index, follow,max-image-preview:large",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sketchxpress.com",
    title: "SketchXpress | Next-Gen AI NFT Creation Platform",
    description: "From sketch to market-ready NFT: Leverage AI image enhancement and bonding curve economics for optimal digital asset creation and distribution.",
    siteName: "SketchXpress",
    images: [
      {
        url: "https://sketchxpress.tech/assets/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "SketchXpress AI NFT Creation Workflow: Sketch → AI Enhancement → NFT Minting"
      }
    ]
  },

  twitter: {
    card: "summary_large_image",
    title: "SketchXpress - AI-Driven NFT Ecosystem",
    description: "Revolutionizing NFT creation with AI image enhancement and bonding curve market dynamics. #Web3 #NFTs #AI",
    creator: "@SketchXpress",
    images: {
      url: "https://sketchxpress.tech/assets/images/og-image.png",
      alt: "Visualization of SketchXpress AI to NFT pipeline"
    }
  },

  // Existing PWA configuration
  icons: {
    icon: "/assets/icons/favicon.ico",
    apple: "/assets/icons/apple-touch-icon.png"
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SketchXpress",
  },

  alternates: {
    canonical: "https://sketchxpress.com"
  },

  // Enhanced metadata for AI/NFT features
  other: {
    "ai-tool": "sketch-to-image, image-enhancement, nft-generator",
    "nft-features": "bonding-curves, dynamic-pricing, collection-analytics",
    "marketplace-integration": "mint-street, decentralized-exchange",
    "common-misspellings": "sketch express, sketch xpress, sketchexpress, sketch-xpress"
  }
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

        {/* Common misspellings meta tag to capture typo traffic */}
        <meta name="also-known-as" content="Sketch Express, SketchExpress, Sketch Xpress, Sketch X Press" />

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
                  "alternateName": [
                    "Sketch Xpress",
                    "Sketch Express",
                    "SketchExpress"
                  ],
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
                  "alternateName": [
                    "Sketch Xpress",
                    "Sketch Express",
                    "SketchExpress"
                  ],
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
                  "alternateName": [
                    "Sketch Xpress",
                    "Sketch Express",
                    "SketchExpress"
                  ],
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
                },
                {
                  "@type": "FAQPage",
                  "@id": "https://sketchxpress.tech/#faq",
                  "mainEntity": [
                    {
                      "@type": "Question",
                      "name": "What is Sketch Express?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Sketch Express (SketchXpress) is an AI-powered platform that transforms your sketches into enhanced NFTs using bonding curve economics on the Solana blockchain."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "How do I use SketchXpress?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Simply create a sketch, use our AI tools to enhance your image, and mint it as an NFT with our easy-to-use interface."
                      }
                    }
                  ]
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
        <link rel="icon" href="/assets/icons/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />
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
              <main className={styles.main}>
                {children}
              </main>
              {/* Hidden content for SEO - common misspellings */}
              <div style={{ display: 'none' }} aria-hidden="true">
                <p>Also known as Sketch Express, SketchExpress, Sketch Xpress - commonly misspelled variations of SketchXpress</p>
              </div>
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
