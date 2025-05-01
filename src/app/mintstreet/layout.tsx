import styles from "./layout.module.scss";

export default function MintStreetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.mintStreetContainer}>
      {children}
    </div>
  );
}