/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import { PublicKey, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import {
  AnchorProvider,
  Idl,
  BorshInstructionCoder,
  Program,
} from "@coral-xyz/anchor";
import { IDL as BondingCurveIDL, PROGRAM_ID } from "../utils/idl";

// Define interfaces for Helius API responses
interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

interface HeliusTransaction {
  signature: string;
  description?: string;
  type?: string;
  source?: string;
  fee?: number;
  feePayer: string;
  slot?: number;
  timestamp?: number;
  nativeTransfers?: NativeTransfer[];
  tokenTransfers?: any[];
  accountData?: any[];
  transactionError?: any;
  instructions: any[];
  events?: any;
}

// Export the HistoryItem interface
export interface HistoryItem {
  signature: string;
  blockTime: number | null | undefined;
  instructionName: string;
  accounts: PublicKey[];
  args: any;
  description: string;
  type: string;
  source: string;
  error: any;
  poolAddress?: string; // Added: Pool address involved
  price?: number; // Added: Price in SOL
}

// Helius API endpoint (hardcoded as requested)
const HELIUS_API_KEY = "69b4db73-1ed1-4558-8e85-192e0994e556";
const HELIUS_API_BASE = "https://api-devnet.helius.xyz/v0"; // Use devnet endpoint
const programId = new PublicKey(PROGRAM_ID);

// Helper function to find account index by name in IDL
const findAccountIndex = (idlInstruction: any, accountName: string): number => {
  if (!idlInstruction || !idlInstruction.accounts) return -1;
  return idlInstruction.accounts.findIndex(
    (acc: any) => acc.name === accountName
  );
};

export function useBondingCurveHistory(limit: number = 50) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
  const [lastSignature, setLastSignature] = useState<string | undefined>(
    undefined
  );

  // Keep connection/provider for Anchor Coder
  const connection = new Connection(
    `${HELIUS_API_BASE}/?api-key=${HELIUS_API_KEY}`,
    "confirmed"
  );
  const provider = new AnchorProvider(connection, {} as any, {
    commitment: "confirmed",
  });
  const program = new Program(BondingCurveIDL as Idl, programId, provider);
  const instructionCoder = program.coder.instruction as BorshInstructionCoder;

  const fetchHeliusHistory = useCallback(
    async (fetchBeforeSignature?: string) => {
      if (isLoading) return;
      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Get signatures and basic info using /addresses endpoint
        let signaturesUrl = `${HELIUS_API_BASE}/addresses/${programId.toBase58()}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`;
        if (fetchBeforeSignature) {
          signaturesUrl += `&before=${fetchBeforeSignature}`;
        }

        const signaturesResponse = await fetch(signaturesUrl);
        if (!signaturesResponse.ok) {
          const errorData = await signaturesResponse
            .json()
            .catch(() => ({ message: signaturesResponse.statusText }));
          throw new Error(
            `Helius Signatures API Error: ${signaturesResponse.status} - ${
              errorData.message || "Failed to fetch signatures"
            }`
          );
        }

        const signaturesResponseData = await signaturesResponse.json();

        if (!Array.isArray(signaturesResponseData)) {
          throw new Error(
            "Unexpected response format from Helius Signatures API"
          );
        }

        if (signaturesResponseData.length === 0) {
          setCanLoadMore(false);
          setIsLoading(false);
          return;
        }

        if (signaturesResponseData.length < limit) {
          setCanLoadMore(false);
        }

        const signatures = signaturesResponseData.map((tx) => tx.signature);
        const basicInfoMap = new Map(
          signaturesResponseData.map((tx) => [
            tx.signature,
            { timestamp: tx.timestamp },
          ])
        );

        // Step 2: Get detailed transaction data using Enhanced API /transactions endpoint
        const transactionsUrl = `${HELIUS_API_BASE}/transactions?api-key=${HELIUS_API_KEY}`;

        const detailedResponse = await fetch(transactionsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ transactions: signatures }),
        });

        if (!detailedResponse.ok) {
          const errorData = await detailedResponse
            .json()
            .catch(() => ({ message: detailedResponse.statusText }));
          throw new Error(
            `Helius Transactions API Error: ${detailedResponse.status} - ${
              errorData.message || "Failed to fetch transactions"
            }`
          );
        }

        const detailedTransactionsData = await detailedResponse.json();

        if (!Array.isArray(detailedTransactionsData)) {
          throw new Error(
            "Unexpected response format from Helius Transactions API"
          );
        }

        // Step 3: Process detailed data and extract info
        const parsedHistory: HistoryItem[] = [];
        detailedTransactionsData.forEach((tx: HeliusTransaction) => {
          const basicInfo = basicInfoMap.get(tx.signature);
          if (!basicInfo) return; // Should not happen if APIs are consistent

          let decodedName = "Unknown";
          let decodedArgs: any = {};
          let decodedAccounts: PublicKey[] = [];
          let poolAddress: string | undefined = undefined;
          let escrowAddress: string | undefined = undefined;
          let price: number | undefined = undefined;
          let relevantInstruction: any = undefined;
          let mainProgramInstructionIndex = -1;

          if (tx.instructions && Array.isArray(tx.instructions)) {
            mainProgramInstructionIndex = tx.instructions.findIndex(
              (ix: any) => ix.programId === programId.toBase58() && ix.data
            );
            relevantInstruction = tx.instructions[mainProgramInstructionIndex];

            if (relevantInstruction) {
              try {
                const decoded = instructionCoder.decode(
                  relevantInstruction.data,
                  "base58"
                );
                if (decoded) {
                  decodedName = decoded.name;
                  decodedArgs = decoded.data;
                  if (
                    relevantInstruction.accounts &&
                    Array.isArray(relevantInstruction.accounts)
                  ) {
                    decodedAccounts = relevantInstruction.accounts.map(
                      (acc: string) => new PublicKey(acc)
                    );

                    const idlInstruction = BondingCurveIDL.instructions.find(
                      (ix) => ix.name === decodedName
                    );

                    const poolAccountIndex = findAccountIndex(
                      idlInstruction,
                      "pool"
                    );
                    if (
                      poolAccountIndex !== -1 &&
                      relevantInstruction.accounts.length > poolAccountIndex
                    ) {
                      poolAddress =
                        relevantInstruction.accounts[poolAccountIndex];
                    }

                    if (
                      decodedName === "mintNft" ||
                      decodedName === "sellNft"
                    ) {
                      const escrowAccountIndex = findAccountIndex(
                        idlInstruction,
                        "escrow"
                      );
                      if (
                        escrowAccountIndex !== -1 &&
                        relevantInstruction.accounts.length > escrowAccountIndex
                      ) {
                        escrowAddress =
                          relevantInstruction.accounts[escrowAccountIndex];
                      }
                    }
                  }
                }
              } catch (e) {
                console.error(
                  `[${tx.signature}] Error decoding instruction:`,
                  e
                );
              }
            }

            // --- Price Extraction using nativeTransfers ---
            if (
              tx.nativeTransfers &&
              Array.isArray(tx.nativeTransfers) &&
              escrowAddress
            ) {
              if (decodedName === "mintNft") {
                const payer = tx.feePayer;

                // Finding the LARGEST transfer for mintNft
                const transfersToEscrow = tx.nativeTransfers
                  .filter(
                    (transfer: NativeTransfer) =>
                      transfer.fromUserAccount === payer &&
                      transfer.toUserAccount === escrowAddress
                  )
                  .sort((a, b) => b.amount - a.amount); // Sort by amount descending

                if (transfersToEscrow.length > 0) {
                  // Use the largest transfer as the price
                  price = transfersToEscrow[0].amount / LAMPORTS_PER_SOL;
                } else {
                  console.log(
                    `[${tx.signature}] ❌ No matching transfer found for mintNft`
                  );
                }
              } else if (decodedName === "sellNft") {
                const seller = tx.feePayer;

                // Finding the LARGEST transfer for sellNft
                const transfersFromEscrow = tx.nativeTransfers
                  .filter(
                    (transfer: NativeTransfer) =>
                      transfer.fromUserAccount === escrowAddress &&
                      transfer.toUserAccount === seller
                  )
                  .sort((a, b) => b.amount - a.amount); // Sort by amount descending

                if (transfersFromEscrow.length > 0) {
                  // Use the largest transfer as the price
                  price = transfersFromEscrow[0].amount / LAMPORTS_PER_SOL;
                } else {
                  console.log(
                    `[${tx.signature}] ❌ No matching transfer found for sellNft`
                  );
                }
              }
            }
          }

          parsedHistory.push({
            signature: tx.signature,
            blockTime: basicInfo.timestamp, // Use timestamp from first API call
            instructionName: decodedName,
            accounts: decodedAccounts,
            args: decodedArgs,
            description: tx.description || "",
            type: tx.type || "",
            source: tx.source || "",
            error: tx.transactionError,
            poolAddress: poolAddress,
            price: price,
          });
        });

        if (parsedHistory.length > 0) {
          const newLastSignature =
            parsedHistory[parsedHistory.length - 1].signature;
          setLastSignature(newLastSignature);

          setHistory((prev) => {
            const existingSignatures = new Set(
              prev.map((item) => item.signature)
            );
            const newItems = parsedHistory.filter(
              (item) => !existingSignatures.has(item.signature)
            );
            const combined = [...newItems, ...prev];
            combined.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
            return combined;
          });
        }
      } catch (err: any) {
        console.error("Error in fetchHeliusHistory:", err);
        setError(err.message || "Failed to fetch transaction history");
        setCanLoadMore(false);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, limit, instructionCoder] // instructionCoder is stable
  );

  useEffect(() => {
    if (history.length === 0 && !isLoading) {
      fetchHeliusHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = () => {
    if (canLoadMore && lastSignature && !isLoading) {
      fetchHeliusHistory(lastSignature);
    }
  };

  return { history, isLoading, error, loadMore, canLoadMore };
}
