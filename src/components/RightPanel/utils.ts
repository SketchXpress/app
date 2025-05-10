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
    address: `Dw3DsPgXDVDPxVHoWhDcxKyJVu3ZEqkViwkpAahP9Knv`,
    name: "Kids Collection",
  },
  pro: {
    address: `8RKh6HYujHmwPCG6qgNJZCzGJZv1zyzyhhWVhPYAJBG3`,
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
  ) => Promise<any>,
  customNftName: string
) => {
  // Don't check for wallet connection here anymore - let the component handle it

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

    // Use custom name if provided, otherwise use default
    const nftName = customNftName || `${poolInfo.name} Artwork`;

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
      nftName,
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
      nftName,
      "SXP",
      metadataIpfsUrl,
      500
    );

    const nftAddress = result?.nftMint;

    // Close the loading toast first
    toast.dismiss(mintingToastId);

    // Don't show success toast here - let the component show enhanced feedback
    // Just return success
    return { success: true, nftAddress, poolInfo };
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
    return { success: false };
  }
};
