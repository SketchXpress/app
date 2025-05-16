"use client";

import Image from "next/image";
import { useState } from "react";
import { Lock, Info } from "lucide-react";

import styles from "./ParentalControl.module.scss";

interface ParentalControlProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  image?: {
    id: number;
    title: string;
    src: string;
  } | null;
}

const ParentalControl = ({
  isOpen,
  onClose,
  onApprove,
  image,
}: ParentalControlProps) => {
  const [parentalPin, setParentalPin] = useState("");
  const [pinError, setPinError] = useState(false);

  if (!isOpen) return null;

  const verifyParentalPin = () => {
    // For demo purposes we'll use a PIN "1234"
    if (parentalPin === "1234") {
      onApprove();
      setParentalPin("");
    } else {
      setPinError(true);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.parentalDialog}>
        <h3 className={styles.parentalTitle}>
          <Lock size={16} className={styles.lockIcon} />
          Parent Approval Required
        </h3>

        <div className={styles.parentalContent}>
          <p className={styles.parentalText}>
            Your child wants to mint their artwork as an NFT. This action
            requires your approval.
          </p>

          {image && (
            <div className={styles.previewImage}>
              <Image
                src={image.src}
                alt="Artwork to mint"
                width={150}
                height={150}
                className={styles.mintPreview}
              />
            </div>
          )}

          <div className={styles.pinInputGroup}>
            <label className={styles.pinLabel}>
              Please enter your parental PIN:
            </label>
            <input
              type="password"
              className={`${styles.pinInput} ${
                pinError ? styles.pinError : ""
              }`}
              placeholder="Enter PIN"
              value={parentalPin}
              onChange={(e) => {
                setParentalPin(e.target.value);
                if (pinError) setPinError(false);
              }}
              maxLength={4}
            />
            {pinError && (
              <p className={styles.errorText}>
                Incorrect PIN. Please try again.
              </p>
            )}
            <p className={styles.pinHint}>For demo purposes, use PIN: 1234</p>
          </div>
        </div>

        <div className={styles.parentalActions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.approveButton} onClick={verifyParentalPin}>
            Approve Minting
          </button>
        </div>

        <div className={styles.infoBox}>
          <Info size={14} className={styles.infoIcon} />
          <p className={styles.infoText}>
            NFTs (Non-Fungible Tokens) are digital certificates of ownership for
            digital items. Minting creates this certificate on a blockchain.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ParentalControl;
