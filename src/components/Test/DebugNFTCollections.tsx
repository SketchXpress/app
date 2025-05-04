// components/DebugNFTCollections.tsx
"use client";

import { useEffect } from "react";
import { useNFTCollections } from "@/hooks/useNFTCollections";

export default function DebugNFTCollections() {
  const { collections, loading, error } = useNFTCollections(6);

  useEffect(() => {
    console.group("🔍 useNFTCollections");
    console.log("collections:", collections);
    console.log("loading:", loading);
    console.log("error:", error);
    console.groupEnd();
  }, [collections, loading, error]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Check console for useNFTCollections output</h2>
    </div>
  );
}
