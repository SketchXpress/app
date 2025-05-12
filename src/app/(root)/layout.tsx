import type { Metadata, Viewport } from "next";
import { ToastContainer } from 'react-toastify';
import Header from "@/components/Header/Header";
import WalletConnectionProvider from "@/wallet/WalletProvider";
import AnchorContextProvider from "@/contexts/AnchorContextProvider";
import TanStackQueryProvider from "@/providers/TanStackQueryProvider";

import "@/styles/globals.scss";
import "@/styles/walletButton.scss";
import styles from "@/styles/pages/layout.module.scss";

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
    "sketchxpress.com",
    "sketch-xpress.com",
    "sketchexpress.com",
    "www.sketchxpress.com",
    "sketch xpress com",
    "sketchxpress.tech",
    "sketch-xpress.tech",
    "sketchexpress.tech",
    "www.sketchxpress.tech",
    "sketch xpress tech"
  ],
  authors: [{ name: "SketchXpress Team" }],
  creator: "SketchXpress",
  publisher: "SketchXpress Technologies",
  robots: "index, follow,max-image-preview:large",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sketchxpress.tech",
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

  icons: {
    icon: "/assets/icons/favicon.ico",
    apple: "/assets/icons/apple-touch-icon.png",
    shortcut: "/assets/icons/icon-32x32.png"
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SketchXpress",
  },

  alternates: {
    canonical: "https://sketchxpress.tech"
  },

  verification: {
    yandex: "a583f14d6af70938"
  },

  other: {
    "ai-tool": "sketch-to-image, image-enhancement, nft-generator",
    "nft-features": "bonding-curves, dynamic-pricing, collection-analytics",
    "marketplace-integration": "mint-street, decentralized-exchange",
    "common-misspellings": "sketch express, sketch xpress, sketchexpress, sketch-xpress",
    "application-name": "SketchXpress",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "SketchXpress",
    "format-detection": "telephone=no",
    "msapplication-TileColor": "#00B7E1",
    "msapplication-tap-highlight": "no",
    "color-scheme": "normal"
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TanStackQueryProvider>
          <WalletConnectionProvider>
            <AnchorContextProvider>
              <Header />
              <main className={styles.main}>
                {children}
              </main>
              {/* Hidden content for SEO */}
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