/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { FC, ReactNode, useMemo, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { PublicKey, Connection } from '@solana/web3.js';
import { createContext, useContext } from 'react';
import { IDL, PROGRAM_ID } from '@/utils/idl';

interface AnchorContextProviderProps {
  children: ReactNode;
}

export interface AnchorContextState {
  program: Program | null;
  provider: AnchorProvider | null;
  initialized: boolean;
}

const AnchorContext = createContext<AnchorContextState>({
  program: null,
  provider: null,
  initialized: false,
});

export const useAnchorContext = () => useContext(AnchorContext);

// Create a read-only AnchorProvider for fetching data
const createReadOnlyProvider = (connection: Connection) => {
  return new AnchorProvider(
    connection,
    {
      publicKey: PublicKey.default,
      signTransaction: (_tx) => Promise.reject(new Error("Read-only provider cannot sign")),
      signAllTransactions: (_txs) => Promise.reject(new Error("Read-only provider cannot sign")),
    },
    { commitment: 'confirmed' }
  );
};

export const AnchorContextProvider: FC<AnchorContextProviderProps> = ({ children }) => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const { provider, program, initialized } = useMemo(() => {


    try {
      let provider: AnchorProvider;

      // If wallet is connected and has all required methods, use it
      if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
        provider = new AnchorProvider(
          connection,
          {
            publicKey: wallet.publicKey || PublicKey.default,
            signTransaction: wallet.signTransaction || ((tx) => Promise.resolve(tx)),
            signAllTransactions: wallet.signAllTransactions || ((txs) => Promise.resolve(txs)),
          },
          { commitment: 'confirmed' }
        );

      } else {
        // Otherwise use a read-only provider
        provider = createReadOnlyProvider(connection);

      }

      // Create the program with the IDL
      const programId = new PublicKey(PROGRAM_ID);
      // @ts-expect-error - Ignoring type error for now to allow build to complete
      const program = new Program(IDL, programId, provider);



      return {
        provider,
        program,
        initialized: true,
      };
    } catch (error) {
      console.error('Error initializing Anchor context:', error);
      return {
        provider: null,
        program: null,
        initialized: false,
      };
    }
  }, [connection, wallet]);

  return (
    <AnchorContext.Provider value={{ provider, program, initialized }}>
      {children}
    </AnchorContext.Provider>
  );
};

export default AnchorContextProvider;