import type { Metadata } from "next";
import "./globals.scss";
import styles from "./layout.module.scss";
import "../styles/walletButton.css";
import WalletConnectionProvider from "@/wallet/WalletProvider";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import HeaderWrapper from "@/components/HeaderWrapper/HeaderWrapper";

export const metadata: Metadata = {
  title: "SketchXpress",
  description: "Sketch to AI to NFT, express your creativity",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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