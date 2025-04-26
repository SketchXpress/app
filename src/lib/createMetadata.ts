/**
 * Creates a metadata JSON object for an NFT.
 *
 * @param name - Name of the NFT
 * @param description - Description of the NFT
 * @param imageUrl - IPFS URL of the uploaded image
 * @returns Metadata object
 */
export function createMetadata(
  name: string,
  description: string,
  imageUrl: string
) {
  return {
    name: name,
    symbol: "SXP", // You can change "SXP" to whatever symbol you want
    description: description,
    image: imageUrl, // Must be IPFS public URL
    attributes: [
      {
        trait_type: "Mode",
        value: "Pro",
      },
      {
        trait_type: "Enhanced",
        value: "AI Enhanced",
      },
      {
        trait_type: "Platform",
        value: "SketchXpress",
      },
    ],
  };
}
