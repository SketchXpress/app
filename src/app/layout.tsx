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

export const viewport: Viewport = {
  themeColor: '#00B7E1',
}

// Define PWA metadata
export const metadata: Metadata = {
  title: "SketchXpress",
  description: "Sketch to AI to NFT, express your creativity",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SketchXpress",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  if (typeof window !== 'undefined') {
    registerServiceWorker();
  }
  return (
    <html lang="en">
      <head>
        <meta name="application-name" content="SketchXpress" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SketchXpress" />
        <meta name="format-detection" content="telephone=no" />

        {/* PWA icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#00B7E1" />

        {/* Service Worker Registration */}
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('Service Worker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('Service Worker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <WalletConnectionProvider>
          <HeaderWrapper />
          <main className={styles.main}>{children}</main>
        </WalletConnectionProvider>

        <ToastContainer
          position="bottom-right"
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
      </body>
    </html>
  )
}