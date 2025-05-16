import React from "react";
import { toast } from "react-toastify";

import { WalletContextState } from "@solana/wallet-adapter-react";
import { uploadMetadataToIPFS } from "@/lib/uploadMetadataToIPFS";
import { uploadToIPFSUsingPinata } from "@/lib/uploadToIPFSUsingPinata";

import { GeneratedImage, Pool } from "./types";

// Utility to check if kids mode is active
export const isKidsMode = (mode: string) => mode === "kids";

export const handleExport = (
  selectedImageId: number | null,
  generatedImages: GeneratedImage[]
) => {
  if (!selectedImageId) {
    toast.warning("Please select an image to export", {
      position: "bottom-left",
      autoClose: 3000,
    });
    return;
  }

  const selectedImage = generatedImages.find(
    (img) => img.id === selectedImageId
  );

  if (!selectedImage) return;

  // Show a toast notification that download is starting
  toast.info("Starting download...", {
    position: "bottom-left",
    autoClose: 2000,
    icon: () => React.createElement("span", null, "📥"),
  });

  const link = document.createElement("a");
  link.href = selectedImage.url;
  link.download = `generated-image-${selectedImageId}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Show a success toast
  setTimeout(() => {
    toast.success("Image downloaded successfully!", {
      position: "bottom-left",
      autoClose: 3000,
      icon: () => React.createElement("span", null, "✅"),
    });
  }, 1000);
};

export const handleDownloadImage = (
  e: React.MouseEvent,
  image: GeneratedImage
) => {
  e.stopPropagation();

  const link = document.createElement("a");
  link.href = image.url;
  link.download = `generated-image-${image.id}.png`;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    toast.success("Image downloaded successfully!", {
      position: "bottom-left",
      autoClose: 3000,
      icon: () => React.createElement("span", null, "✅"),
    });
  }, 1000);
};

// Mint NFT
export const mintNFT = async (
  walletContext: WalletContextState,
  selectedImageId: number | null,
  generatedImages: GeneratedImage[],
  mode: string,
  selectedPool: Pool | null,
  mintNft: (
    poolAddress: string,
    name: string,
    symbol: string,
    metadataUri: string,
    sellerFeeBasisPoints: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>,
  customNftName: string
) => {
  if (!selectedImageId) {
    toast.warning("Please select an image to mint!", {
      position: "bottom-left",
      autoClose: 3000,
    });
    return { success: false };
  }

  if (!selectedPool || !selectedPool.address) {
    toast.warning("Please select a collection pool before minting!", {
      position: "bottom-left",
      autoClose: 4000,
    });
    return { success: false };
  }

  const selectedImage = generatedImages.find(
    (img) => img.id === selectedImageId
  );

  if (!selectedImage) {
    toast.error("Selected image not found.", {
      position: "bottom-left",
      autoClose: 3000,
    });
    return { success: false };
  }

  try {
    const poolInfo = {
      address: selectedPool.address,
      name: selectedPool.name,
    };

    const nftName = customNftName || `${poolInfo.name} Artwork`;
    const mintingToastId = toast.loading(`Minting NFT on ${poolInfo.name}...`, {
      position: "bottom-left",
    });

    // Fetch the image blob from the original URL
    const response = await fetch(selectedImage.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image for minting: ${response.status}`);
    }
    const blob = await response.blob();

    const imageIpfsUrl = await uploadToIPFSUsingPinata(blob);
    toast.update(mintingToastId, {
      render: "Uploading image and metadata to IPFS...",
      type: "info",
      isLoading: true,
    });

    const metadataIpfsUrl = await uploadMetadataToIPFS(
      nftName,
      "AI-enhanced artwork created with SketchXpress.",
      imageIpfsUrl
    );
    toast.update(mintingToastId, {
      render: `Creating your NFT on ${poolInfo.name}...`,
      type: "info",
      isLoading: true,
    });

    try {
      const result = await mintNft(
        poolInfo.address,
        nftName,
        "SXP",
        metadataIpfsUrl,
        500
      );

      const nftAddress = result?.nftMint;
      toast.dismiss(mintingToastId);

      return {
        success: true,
        nftAddress,
        poolInfo,
        cancelled: false,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (txError: any) {
      toast.dismiss(mintingToastId);

      if (
        txError?.code === 4001 ||
        txError?.message?.includes("User rejected") ||
        txError?.message?.includes("rejected") ||
        txError?.message?.includes("cancelled")
      ) {
        // User cancelled the transaction
        return {
          success: false,
          cancelled: true,
          error: "Transaction cancelled by user",
        };
      } else {
        return {
          success: false,
          cancelled: false,
          error: txError.message || "Transaction failed",
        };
      }
    }
  } catch (error) {
    console.error("❌ Minting failed:", error);
    return {
      success: false,
      cancelled: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
