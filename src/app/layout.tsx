import type { Metadata } from "next";

import Header from "@/components/Header/Header";
import "./globals.scss";
import styles from "./layout.module.scss";

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
        <Header />
        <main className={styles.main}>{children}</main>
      </body>
    </html>
  )
}
