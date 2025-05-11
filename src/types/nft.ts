export interface NFT {
  id: string;
  mintAddress: string;
  name: string;
  image: string;
  price: string;
  collectionId: string;
  collectionName: string;
}

export interface NFTCollection {
  uri?: string;
  id: number;
  poolAddress: string;
  title: string;
  floor: string;
  image: string;
  trending: boolean;
  supply?: number;
  collectionMint?: string;
}
