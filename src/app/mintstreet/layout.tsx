import styles from "./layout.module.scss";
import { Providers } from "./providers";
import AnchorContextProvider from "@/contexts/AnchorContextProvider";

export default function MintStreetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.mintStreetContainer}>
      <AnchorContextProvider>
        <Providers>
          {children}
        </Providers>
      </AnchorContextProvider>
    </div>
  );
}