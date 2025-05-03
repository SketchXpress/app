import { uploadToIPFSUsingPinata } from "@/lib/uploadToIPFSUsingPinata";
import { createMetadata } from "@/lib/createMetadata";

/**
 * Uploads metadata JSON to IPFS (Pinata) and returns the metadata URL
 *
 * @param name - Name of the NFT
 * @param description - Description of the NFT
 * @param imageUrl - IPFS URL of the uploaded image
 * @returns IPFS URL of uploaded Metadata JSON
 */
export async function uploadMetadataToIPFS(
  name: string,
  description: string,
  imageUrl: string
): Promise<string> {
  // 1. Create metadata object
  const metadataObject = createMetadata(name, description, imageUrl);

  // 2. Turn metadata object into Blob
  const metadataBlob = new Blob([JSON.stringify(metadataObject)], {
    type: "application/json",
  });

  // 3. Upload the Blob to Pinata IPFS
  const metadataUrl = await uploadToIPFSUsingPinata(metadataBlob);

  return metadataUrl;
}
