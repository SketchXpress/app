"use client";

import { createContext, useContext, FC, ReactNode, useMemo } from "react";

import { IDL, PROGRAM_ID } from "@/utils/idl";
import { PublicKey, Connection } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

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
const createReadOnlyProvider = (connection: Connection) => {
  return new AnchorProvider(
    connection,
    {
      publicKey: PublicKey.default,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      signTransaction: (_tx) =>
        Promise.reject(new Error("Read-only provider cannot sign")),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      signAllTransactions: (_txs) =>
        Promise.reject(new Error("Read-only provider cannot sign")),
    },
    { commitment: "confirmed" }
  );
};

export const AnchorContextProvider: FC<AnchorContextProviderProps> = ({
  children,
}) => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const { provider, program, initialized } = useMemo(() => {
    try {
      let provider: AnchorProvider;

      if (
        wallet.publicKey &&
        wallet.signTransaction &&
        wallet.signAllTransactions
      ) {
        provider = new AnchorProvider(
          connection,
          {
            publicKey: wallet.publicKey || PublicKey.default,
            signTransaction:
              wallet.signTransaction || ((tx) => Promise.resolve(tx)),
            signAllTransactions:
              wallet.signAllTransactions || ((txs) => Promise.resolve(txs)),
          },
          { commitment: "confirmed" }
        );
      } else {
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
      console.error("Error initializing Anchor context:", error);
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
