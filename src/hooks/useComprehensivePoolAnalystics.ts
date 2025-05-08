import { useState, useEffect, useCallback, useRef } from "react";
import { PublicKey, Connection, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, BN, Wallet } from "@coral-xyz/anchor";
import { Helius } from "helius-sdk";
import { asyncRateLimit } from '@tanstack/pacer';
import { sha256 } from '@noble/hashes/sha256';

// Import program constants
import { IDL as BondingCurveIDL_JSON, PROGRAM_ID } from "@/utils/idl";

// --- Constants ---
const HELIUS_API_KEY = "69b4db73-1ed1-4558-8e85-192e0994e556";
const SOLANA_NETWORK = "devnet" as const;
const POLLING_INTERVAL_MS = 30000;
const MAX_ACTIVITIES_PER_FETCH = 50;
const LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'WARN' : 'DEBUG';

// --- Event Discriminators ---
const NFT_MINT_DISCRIMINATOR = Buffer.from(sha256("event:NftMint")).subarray(0, 8).toString('hex');
const NFT_SALE_DISCRIMINATOR = Buffer.from(sha256("event:NftSale")).subarray(0, 8).toString('hex');

// --- Interfaces ---
interface DecodedEvent {
    programId: string;
    name: string;
    data: {
        signature: string;
        timestamp: string;
        nft_mint: string;
        pool: string;
        sale_price?: string;
        mint_price?: string;
        sell_fee?: string;
        protocol_fee?: string;
        seller?: string;
        minter?: string;
    };
}

interface BondingCurvePoolAccountData {
    collection: PublicKey;
    basePrice: BN;
    growthFactor: BN;
    currentSupply: BN;
    protocolFee: BN;
    creator: PublicKey;
    totalEscrowed: BN;
    isActive: boolean;
    totalDistributed: BN;
    totalSupply: BN;
    currentMarketCap: BN;
    authority: PublicKey;
    tensorMigrationTimestamp: BN;
    isMigratedToTensor: boolean;
    isPastThreshold: boolean;
    bump: number;
}

export interface MintSaleActivity {
    type: "mint" | "sale";
    signature: string;
    activityTimestamp: number;
    userAddress: string;
    nftMintAddress: string;
    poolAddress: string;
    priceLamports: number;
    feeLamports: number;
}

export interface PoolAnalyticsState {
    poolAddress: string;
    collection?: string;
    basePrice?: number;
    growthFactor?: number;
    currentSupplyOnChain?: number;
    protocolFeeOnChain?: number;
    creatorAddress?: string;
    totalEscrowedOnChain?: number;
    isActiveOnChain?: boolean;
    totalMintedCount: number;
    totalSoldCount: number;
    currentSupplyFromEvents: number;
    recentActivities: MintSaleActivity[];
    oldestActivitySignature?: string;
    newestActivitySignature?: string;
    _metrics?: {
        lastRequestDuration: number;
        requestCount: number;
        errorCount: number;
        rateLimitHits: number;
    };
}

// --- Helpers ---
const logger = {
    debug: (...args: unknown[]) => LOG_LEVEL === 'DEBUG' && console.debug('[DEBUG]', new Date().toISOString(), ...args),
    info: (...args: unknown[]) => console.info('[INFO]', new Date().toISOString(), ...args),
    warn: (...args: unknown[]) => console.warn('[WARN]', new Date().toISOString(), ...args),
    error: (...args: unknown[]) => console.error('[ERROR]', new Date().toISOString(), ...args),
};

const redact = (value: string) => value ? `${value.slice(0, 4)}...${value.slice(-4)}` : '';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class RateLimitError extends Error {
    readonly retryAfter: number;
    constructor(message: string, retryAfter: number) {
        super(message);
        this.retryAfter = retryAfter;
        this.name = 'RateLimitError';
    }
}

// --- Helius Configuration ---
const helius = new Helius(HELIUS_API_KEY, SOLANA_NETWORK);
const connection = new Connection(helius.endpoint);
const HELIUS_RATE_LIMITER = asyncRateLimit(
    async (signatures: string[]) => {
        const start = Date.now();
        try {
            const response = await connection.getParsedTransactions(signatures);
            logger.debug(`Helius request completed in ${Date.now() - start}ms`);
            return response;
        } catch (error: unknown) {
            logger.error(`Helius request failed after ${Date.now() - start}ms`, error);
            
            if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'status' in error.response && 'headers' in error.response && error.response.status === 429) {
                const retryAfter = parseInt((error.response.headers as Record<string, string>)['retry-after']) || 30000;
                const errorMessage = 'message' in error ? String(error.message) : 'Rate limit exceeded';
                throw new RateLimitError(errorMessage, retryAfter);
            }
            
            throw error;
        }
    },
    {
        limit: 10,
        window: 60000
    }
);

export function useComprehensivePoolAnalytics(poolAddressString?: string) {
    const [analytics, setAnalytics] = useState<PoolAnalyticsState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const provider = useRef<AnchorProvider | null>(null);
    const program = useRef<Program | null>(null);
    const metrics = useRef({ 
        requestCount: 0, 
        errorCount: 0, 
        rateLimitHits: 0,
        lastSuccess: 0,
        requestAttempts: 0
    });

    useEffect(() => {
        const connection = new Connection(helius.endpoint, "confirmed");
        provider.current = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        program.current = new Program(BondingCurveIDL_JSON as Idl, new PublicKey(PROGRAM_ID), provider.current);
    }, []);

    const parseAnchorEvents = useCallback((logs: string[], signature: string) => {
        return logs.flatMap(log => {
            if (!log.startsWith("Program log: ")) return [];
            const logStr = log.replace("Program log: ", "");
            const [discriminator, dataBase64] = logStr.split(" ");
            
            try {
                if (discriminator === NFT_MINT_DISCRIMINATOR || discriminator === NFT_SALE_DISCRIMINATOR) {
                    const eventData = JSON.parse(
                        Buffer.from(dataBase64, "base64").toString("utf8")
                    );
                    
                    return {
                        programId: PROGRAM_ID.toString(),
                        name: discriminator === NFT_MINT_DISCRIMINATOR ? "NftMint" : "NftSale",
                        data: {
                            ...eventData,
                            signature
                        }
                    };
                }
            } catch (error) {
                logger.error("Failed to parse event log", { log, error });
            }
            return [];
        });
    }, []);

    const transformDecodedEventToActivity = useCallback((
        decodedEvent: DecodedEvent
    ): MintSaleActivity | null => {
        try {
            const { name, data } = decodedEvent;
            const baseData = {
                signature: data.signature,
                activityTimestamp: Number(data.timestamp),
                nftMintAddress: data.nft_mint,
                poolAddress: data.pool,
                priceLamports: Number(data.sale_price || data.mint_price),
                feeLamports: Number(data.sell_fee || data.protocol_fee),
                userAddress: data.seller || data.minter || ''
            };

            return name === "NftSale" ? 
                { type: "sale", ...baseData } : 
                { type: "mint", ...baseData };

        } catch (error) {
            logger.error("Event transformation failed", { 
                error: error instanceof Error ? error.message : 'Unknown',
                rawData: decodedEvent.data
            });
            return null;
        }
    }, []);

    const fetchActivitiesFromHelius = useCallback(async (
        targetPoolAddress: string,
        options?: { limit?: number; before?: string; until?: string }
    ) => {
        const context = { pool: redact(targetPoolAddress), options };
        try {
            logger.info("Fetching activities", context);
            metrics.current.requestCount++;

            const [poolSignatures, programSignatures] = await Promise.all([
                provider.current!.connection.getSignaturesForAddress(
                    new PublicKey(targetPoolAddress),
                    { 
                        limit: options?.limit || MAX_ACTIVITIES_PER_FETCH,
                        before: options?.before,
                        until: options?.until
                    },
                    "confirmed"
                ),
                provider.current!.connection.getSignaturesForAddress(
                    new PublicKey(PROGRAM_ID),
                    { 
                        limit: options?.limit || MAX_ACTIVITIES_PER_FETCH,
                        before: options?.before,
                        until: options?.until
                    },
                    "confirmed"
                )
            ]);

            const allSignatures = [...poolSignatures, ...programSignatures]
                .sort((a, b) => b.slot - a.slot)
                .map(s => s.signature);

            if (!allSignatures.length) {
                logger.debug("No signatures found", context);
                return { newActivities: [] };
            }

            const transactions = await HELIUS_RATE_LIMITER(allSignatures) ?? [];

            const parsedActivities = transactions.flatMap(tx => {
                if (!tx) return [];
                const events = parseAnchorEvents(tx.meta?.logMessages || [], tx.transaction.signatures[0]);
                return events.map(event => transformDecodedEventToActivity(event)).filter(Boolean);
            }) as MintSaleActivity[];

            logger.info("Processed events", {
                transactionsChecked: transactions.length,
                validEvents: parsedActivities.length
            });

            return {
                newActivities: parsedActivities,
                oldestSig: allSignatures[allSignatures.length - 1],
                newestSig: allSignatures[0]
            };

        } catch (error) {
            metrics.current.errorCount++;
            logger.error("Activity fetch failed", { ...context, error });
            
            if (error instanceof RateLimitError) {
                metrics.current.rateLimitHits++;
                await delay(error.retryAfter);
                return fetchActivitiesFromHelius(targetPoolAddress, options);
            }
            return { newActivities: [] };
        }
    }, [parseAnchorEvents, transformDecodedEventToActivity]);

    const fetchPoolAccountInfo = useCallback(async (poolPk: PublicKey): Promise<Partial<PoolAnalyticsState>> => {
        const context = { pool: redact(poolPk.toBase58()) };
        try {
            logger.info("Fetching pool account info", context);
            const accountInfo = await program.current!.account.bondingCurvePool.fetch(poolPk) as unknown as BondingCurvePoolAccountData;
            
            return {
                collection: accountInfo.collection.toBase58(),
                basePrice: accountInfo.basePrice.toNumber(),
                growthFactor: accountInfo.growthFactor.toNumber(),
                currentSupplyOnChain: accountInfo.currentSupply.toNumber(),
                protocolFeeOnChain: accountInfo.protocolFee.toNumber(),
                creatorAddress: accountInfo.creator.toBase58(),
                totalEscrowedOnChain: accountInfo.totalEscrowed.toNumber(),
                isActiveOnChain: accountInfo.isActive,
            };
        } catch (error) {
            metrics.current.errorCount++;
            logger.error("Pool info fetch failed", { ...context, error });
            
            if (error instanceof Error && error.message.includes("429")) {
                throw new RateLimitError(error.message, 1000);
            }
            throw error;
        }
    }, []);

    const loadAnalytics = useCallback(async (currentPoolAddress: string, mode: "initial" | "loadMore" | "loadNew") => {
        const context = { pool: redact(currentPoolAddress), mode };
        try {
            logger.info("Loading analytics", context);
            setIsLoading(true);

            const [poolConfig, { newActivities, oldestSig, newestSig }] = await Promise.all([
                fetchPoolAccountInfo(new PublicKey(currentPoolAddress)),
                fetchActivitiesFromHelius(currentPoolAddress, {
                    limit: MAX_ACTIVITIES_PER_FETCH,
                    before: mode === "loadMore" ? analytics?.oldestActivitySignature : undefined,
                    until: mode === "loadNew" ? analytics?.newestActivitySignature : undefined
                })
            ]);

            const combinedActivities = mode === "loadMore" 
                ? [...analytics?.recentActivities || [], ...newActivities]
                : [...newActivities, ...analytics?.recentActivities || []];

            const uniqueActivities = Array.from(new Map(
                combinedActivities.map(act => [`${act.signature}_${act.type}_${act.nftMintAddress}`, act])
            ).values()).sort((a, b) => b.activityTimestamp - a.activityTimestamp);

            setAnalytics(prev => ({
                ...prev,
                ...poolConfig,
                poolAddress: currentPoolAddress,
                totalMintedCount: uniqueActivities.filter(a => a.type === "mint").length,
                totalSoldCount: uniqueActivities.filter(a => a.type === "sale").length,
                currentSupplyFromEvents: uniqueActivities.filter(a => a.type === "mint").length - 
                                       uniqueActivities.filter(a => a.type === "sale").length,
                recentActivities: uniqueActivities,
                oldestActivitySignature: oldestSig || prev?.oldestActivitySignature,
                newestActivitySignature: newestSig || prev?.newestActivitySignature,
                _metrics: {
                    lastRequestDuration: Date.now() - metrics.current.lastSuccess,
                    requestCount: metrics.current.requestCount,
                    errorCount: metrics.current.errorCount,
                    rateLimitHits: metrics.current.rateLimitHits
                }
            }));

            metrics.current.lastSuccess = Date.now();
        } catch (error) {
            logger.error("Analytics load failed", { ...context, error });
            setError(error instanceof Error ? error.message : "Unknown error");
        } finally {
            setIsLoading(false);
        }
    }, [fetchPoolAccountInfo, fetchActivitiesFromHelius, analytics]);

    useEffect(() => {
        if (!poolAddressString) return;
        const interval = setInterval(() => loadAnalytics(poolAddressString, "loadNew"), POLLING_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [poolAddressString, loadAnalytics]);

    return {
        analytics,
        isLoading,
        error,
        refreshAnalytics: useCallback(() => {
            if (poolAddressString) loadAnalytics(poolAddressString, "initial");
        }, [poolAddressString, loadAnalytics]),
        loadMoreActivities: useCallback(() => {
            if (poolAddressString) loadAnalytics(poolAddressString, "loadMore");
        }, [poolAddressString, loadAnalytics])
    };
}

// --- Dummy Wallet Configuration ---
const dummyKeypair = Keypair.generate();
const dummyWallet: Wallet = {
    publicKey: dummyKeypair.publicKey,
    payer: dummyKeypair,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => tx,
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => txs,
};
