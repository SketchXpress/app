import type { Metadata } from "next";

export const generateTermsMetadata = (): Metadata => {
  const currentDate = new Date().toISOString().split("T")[0];

  return {
    title: "Terms and Conditions | SketchXpress",
    description:
      "Read SketchXpress Terms and Conditions including age restrictions, blockchain risks, content guidelines, and platform policies for our AI-powered NFT creation platform.",

    keywords: [
      "SketchXpress terms",
      "NFT terms of service",
      "blockchain legal terms",
      "AI art platform terms",
      "Solana NFT terms",
      "digital art legal",
      "kids mode terms",
      "parental consent NFT",
      "cryptocurrency terms",
      "smart contract terms",
    ],

    openGraph: {
      title: "Terms and Conditions | SketchXpress",
      description:
        "Legal terms and conditions for using SketchXpress - AI-powered sketch to NFT platform with blockchain integration.",
      type: "website",
      url: "https://sketchxpress.tech/terms",
      images: [
        {
          url: "https://sketchxpress.tech/assets/images/og-terms.png",
          width: 1200,
          height: 630,
          alt: "SketchXpress Terms and Conditions",
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: "Terms and Conditions | SketchXpress",
      description:
        "Legal terms for using SketchXpress - AI art platform with blockchain NFT minting.",
      images: ["https://sketchxpress.tech/assets/images/twitter-terms.png"],
    },

    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        noimageindex: false,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    alternates: {
      canonical: "https://sketchxpress.tech/terms",
    },

    other: {
      "last-modified": currentDate,
      "legal-document": "terms-of-service",
      "content-language": "en",
      "document-type": "legal-terms",
    },
  };
};
