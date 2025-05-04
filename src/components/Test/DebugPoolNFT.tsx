// src/components/Test/DebugPoolNFT.tsx
'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePoolNfts } from '@/hooks/usePoolNFTs';

const DebugPoolNFT: React.FC = () => {
  // Grab the dynamic [poolAddress] param from the URL
  const { poolAddress } = useParams() as { poolAddress: string };

  const { nfts, isLoading, error } = usePoolNfts(poolAddress);

  useEffect(() => {
    if (!isLoading && !error) {
      console.log(`Found ${nfts.length} NFTs in pool ${poolAddress}:`, nfts);
    }
  }, [nfts, isLoading, error, poolAddress]);

  if (isLoading) return <p>Loading NFTs…</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <div>
      <h2>NFTs in Pool {poolAddress}</h2>
      <ul>
        {nfts.map((nft) => (
          <li key={nft.mintAddress}>
            <strong>{nft.name}</strong> ({nft.symbol}) — minted at{' '}
            {nft.timestamp
              ? new Date(nft.timestamp * 1000).toLocaleString()
              : '—'}{' '}
            for {nft.price != null ? nft.price.toFixed(4) : '—'} SOL
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DebugPoolNFT;
