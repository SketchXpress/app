"use client";
import styles from "./Spinner.module.scss";
const Spinner = () => {
  return (
    <div className={styles.spinnerContainer}>
      <div className={styles.spinner}></div>
      <div className={styles.spinnerInner}></div>
    </div>
  );
};

export default Spinner;
