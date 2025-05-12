import "@/styles/globals.scss";
import "@/styles/walletButton.scss";
import { Providers } from "./providers";
import WalletConnectionProvider from "@/wallet/WalletProvider";
import styles from "@/styles/pages/mintstreet/layout.module.scss";
import AnchorContextProvider from "@/contexts/AnchorContextProvider";
import MintStreetHeader from "@/components/MintStreetHeader/MintStreetHeader";

export default function MintStreetLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <div className={styles.mintStreetContainer}>
          <WalletConnectionProvider>
            <AnchorContextProvider>
              <Providers>
                <MintStreetHeader />
                <main>
                  {children}
                </main>
              </Providers>
            </AnchorContextProvider>
          </WalletConnectionProvider>
        </div>
      </body>
    </html>
  );
}