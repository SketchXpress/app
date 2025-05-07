// utils.ts
import React from "react";
import { toast } from "react-toastify";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { uploadMetadataToIPFS } from "@/lib/uploadMetadataToIPFS";
import { uploadToIPFSUsingPinata } from "@/lib/uploadToIPFSUsingPinata";
import { GeneratedImage, Pool } from "./types";

// Defining default pools for Kids and Pro modes
export const DEFAULT_POOLS = {
  kids: {
    address: `6Gj1WnJiN4ie7EQgKzDXDy7Tfqik1EXubkziVaXRdzNR`,
    name: "Kids Collection",
  },
  pro: {
    address: `6Gj1WnJiN4ie7EQgKzDXDy7Tfqik1EXubkziVaXRdzNR`,
    name: "Pro Collection",
  },
};

// Utility to check if kids mode is active
export const isKidsMode = (mode: string) => mode === "kids";

// Export image function
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
  link.href = selectedImage.url; // Use the original URL for download
  link.download = `generated-image-${selectedImageId}.png`; // This forces download instead of navigation
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
  }, 1000); // Slight delay to avoid toast overlap
};

// Individual image download function
export const handleDownloadImage = (
  e: React.MouseEvent,
  image: GeneratedImage
) => {
  e.stopPropagation();

  // Show downloading toast
  toast.info("Starting download...", {
    position: "bottom-left",
    autoClose: 2000,
    icon: () => React.createElement("span", null, "📥"),
  });

  const link = document.createElement("a");
  link.href = image.url;
  link.download = `generated-image-${image.id}.png`;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Show success toast
  setTimeout(() => {
    toast.success("Image downloaded successfully!", {
      position: "bottom-left",
      autoClose: 3000,
      icon: () => React.createElement("span", null, "✅"),
    });
  }, 1000); // Slight delay to avoid toast overlap
};

// Mint NFT function
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
  ) => Promise<any>
) => {
  if (!walletContext.connected || !walletContext.publicKey) {
    toast.error("Please connect your wallet first!", {
      position: "bottom-left",
      autoClose: 3000,
    });
    return false;
  }

  if (!selectedImageId) {
    toast.warning("Please select an image to mint!", {
      position: "bottom-left",
      autoClose: 3000,
    });
    return false;
  }

  const selectedImage = generatedImages.find(
    (img) => img.id === selectedImageId
  );

  if (!selectedImage) {
    toast.error("Selected image not found.", {
      position: "bottom-left",
      autoClose: 3000,
    });
    return false;
  }

  try {
    // Determine which pool to use
    const defaultPool = isKidsMode(mode)
      ? DEFAULT_POOLS.kids
      : { ...DEFAULT_POOLS.pro, name: "Pro Collection" };

    const poolInfo = selectedPool
      ? { address: selectedPool.address, name: selectedPool.name }
      : defaultPool;

    // Show a loading toast that includes pool information
    const mintingToastId = toast.loading(
      `Starting NFT minting process on ${poolInfo.name}...`,
      {
        position: "bottom-left",
      }
    );

    // Fetch the image blob from the original URL
    const response = await fetch(selectedImage.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image for minting: ${response.status}`);
    }
    const blob = await response.blob();

    // Upload image to IPFS
    toast.update(mintingToastId, {
      render: "Uploading image to IPFS...",
      type: "info",
      isLoading: true,
    });
    const imageIpfsUrl = await uploadToIPFSUsingPinata(blob);

    // Upload metadata to IPFS
    toast.update(mintingToastId, {
      render: "Uploading metadata to IPFS...",
      type: "info",
      isLoading: true,
    });
    const metadataIpfsUrl = await uploadMetadataToIPFS(
      poolInfo.name + " Artwork", // Use pool name in metadata
      "AI-enhanced artwork created with SketchXpress.",
      imageIpfsUrl
    );

    // Mint the NFT with pool info
    toast.update(mintingToastId, {
      render: `Creating your NFT on the ${poolInfo.name}...`,
      type: "info",
      isLoading: true,
    });

    const result = await mintNft(
      poolInfo.address,
      poolInfo.name + " Artwork",
      "SXP",
      metadataIpfsUrl,
      500 // sellerFeeBasisPoints (5%)
    );

    const nftAddress = result?.nftMint;

    // Success toast with pool information
    toast.update(mintingToastId, {
      render: `🎉 NFT minted successfully on ${poolInfo.name}!\nAddress: ${nftAddress}`,
      type: "success",
      isLoading: false,
      autoClose: 5000,
      closeButton: true,
      draggable: true,
      icon: () => React.createElement("span", null, "🖼️"),
    });

    return true;
  } catch (error) {
    toast.error(
      `Minting failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      {
        position: "bottom-left",
        autoClose: 5000,
      }
    );
    return false;
  }
};
