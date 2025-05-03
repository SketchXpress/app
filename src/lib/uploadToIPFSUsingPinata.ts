const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;
const UPLOAD_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export async function uploadToIPFSUsingPinata(
  file: File | Blob
): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error(
      "Missing Pinata JWT Token. Please set NEXT_PUBLIC_PINATA_JWT in your .env.local"
    );
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Pinata upload failed:", errorText);
    throw new Error("Failed to upload file to Pinata IPFS.");
  }

  const data = await response.json();
  const cid = data.IpfsHash;
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
