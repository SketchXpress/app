export interface Collection {
  id: number;
  rank: number;
  name: string;
  image: string;
  poolPrice: string;
  verified: boolean;
}

export const collections: Collection[] = [
  {
    id: 1,
    rank: 1,
    name: "Courtyard.io",
    image: "/nft1.jpeg",
    poolPrice: "33.88 SOL",
    verified: true,
  },
  {
    id: 2,
    rank: 2,
    name: "Dungeons of Fortune",
    image: "/nft2.avif",
    poolPrice: "< 0.01 SOL",
    verified: true,
  },
  {
    id: 3,
    rank: 3,
    name: "Gemesis",
    image: "/nft3.jpg",
    poolPrice: "0.04 SOL",
    verified: true,
  },
  {
    id: 4,
    rank: 4,
    name: "Murakami Flowers",
    image: "/nft4.jpg",
    poolPrice: "0.27 SOL",
    verified: true,
  },
  {
    id: 5,
    rank: 5,
    name: "Crypto Kids",
    image: "/nft5.png",
    poolPrice: "0.54 SOL",
    verified: true,
  },
  {
    id: 6,
    rank: 6,
    name: "The Memes by 6529",
    image: "/nft6.webp",
    poolPrice: "0.04 SOL",
    verified: true,
  },
  {
    id: 7,
    rank: 7,
    name: "Moriusa",
    image: "/nft1.jpeg",
    poolPrice: "0.64 SOL",
    verified: false,
  },
  {
    id: 8,
    rank: 8,
    name: "Good Vibes Club",
    image: "/nft2.avif",
    poolPrice: "0.44 SOL",
    verified: true,
  },
];
