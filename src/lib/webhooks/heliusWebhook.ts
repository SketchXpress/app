import crypto from "crypto";
import {
  HeliusWebhookEvent,
  CollectionEvent,
  ProcessedWebhookData,
} from "./types";
import { IDL as BondingCurveIDL } from "@/utils/idl";
import { BorshInstructionCoder, Idl } from "@coral-xyz/anchor";

// Create instruction decoder with proper IDL
const instructionCoder = new BorshInstructionCoder(BondingCurveIDL as Idl);

// Calculate Anchor instruction discriminators
function calculateDiscriminator(instructionName: string): Buffer {
  const preimage = `global:${instructionName}`;
  const hash = crypto.createHash("sha256").update(preimage).digest();
  return hash.slice(0, 8);
}

// Known instruction discriminators for our program
const INSTRUCTION_DISCRIMINATORS = {
  createPool: calculateDiscriminator("createPool"),
  createCollectionNft: calculateDiscriminator("createCollectionNft"),
  mintNft: calculateDiscriminator("mintNft"),
  sellNft: calculateDiscriminator("sellNft"),
  migrateToTensor: calculateDiscriminator("migrateToTensor"),
};

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    // Helius sends signature as "sha256=hash"
    const providedSignature = signature.replace("sha256=", "");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

interface DecodedInstruction {
  name: string;
  args: Record<string, unknown> | null;
}

function decodeInstruction(instructionData: string): DecodedInstruction | null {
  try {
    // Convert base64 instruction data to buffer
    const data = Buffer.from(instructionData, "base64");

    // Check minimum length for discriminator
    if (data.length < 8) {
      return null;
    }

    // Get the discriminator (first 8 bytes)
    const discriminator = data.slice(0, 8);

    // Find matching instruction by discriminator
    for (const [name, expectedDiscriminator] of Object.entries(
      INSTRUCTION_DISCRIMINATORS
    )) {
      if (discriminator.equals(expectedDiscriminator)) {
        try {
          // Try using BorshInstructionCoder first
          const decoded = instructionCoder.decode(data);
          return {
            name,
            args: decoded as Record<string, unknown>,
          };
        } catch (borshError) {
          console.warn(
            `BorshInstructionCoder failed for ${name}, trying manual extraction:`,
            borshError
          );

          // Fallback to manual extraction
          const args = extractInstructionArgs(name, data);
          return { name, args };
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error decoding instruction:", error);
    return null;
  }
}

// Fallback manual extraction for when Borsh decoding fails
function extractInstructionArgs(
  instructionName: string,
  data: Buffer
): Record<string, unknown> | null {
  try {
    // Skip the 8-byte discriminator
    const argsData = data.slice(8);

    switch (instructionName) {
      case "createPool":
        // createPool has: basePrice (u64), growthFactor (u64)
        if (argsData.length >= 16) {
          return {
            basePrice: argsData.readBigUInt64LE(0).toString(),
            growthFactor: argsData.readBigUInt64LE(8).toString(),
          };
        }
        break;

      case "createCollectionNft":
        // createCollectionNft has: name (string), symbol (string), uri (string)
        // Manual Borsh string decoding would be complex, so we'll try another approach
        try {
          // Try to extract the strings manually
          // Borsh encodes strings as [length: u32][data: bytes]
          let offset = 0;

          // Read name
          if (argsData.length >= 4) {
            const nameLength = argsData.readUInt32LE(offset);
            offset += 4;

            if (argsData.length >= offset + nameLength) {
              const name = argsData
                .slice(offset, offset + nameLength)
                .toString("utf8");
              offset += nameLength;

              // Read symbol
              if (argsData.length >= offset + 4) {
                const symbolLength = argsData.readUInt32LE(offset);
                offset += 4;

                if (argsData.length >= offset + symbolLength) {
                  const symbol = argsData
                    .slice(offset, offset + symbolLength)
                    .toString("utf8");
                  offset += symbolLength;

                  // Read URI
                  if (argsData.length >= offset + 4) {
                    const uriLength = argsData.readUInt32LE(offset);
                    offset += 4;

                    if (argsData.length >= offset + uriLength) {
                      const uri = argsData
                        .slice(offset, offset + uriLength)
                        .toString("utf8");

                      return { name, symbol, uri };
                    }
                  }
                }
              }

              return { name };
            }
          }
        } catch (stringError) {
          console.warn("Error manually extracting strings:", stringError);
        }
        break;

      default:
        return null;
    }

    return null;
  } catch (error) {
    console.warn(`Error extracting args for ${instructionName}:`, error);
    return null;
  }
}

export function processWebhookEvent(
  event: HeliusWebhookEvent
): ProcessedWebhookData {
  const BONDING_CURVE_PROGRAM =
    process.env.BONDING_CURVE_PROGRAM_ID ||
    "FCpT1hnh9JKPmCR8s1rPA2ab5mETT9TFUcbDdnXhLPdu";

  const processedEvents: CollectionEvent[] = [];

  // Process each instruction in the transaction
  event.instructions.forEach((instruction) => {
    if (instruction.programId === BONDING_CURVE_PROGRAM) {
      // Decode the instruction
      const decodedInstruction = decodeInstruction(instruction.data);

      const collectionEvent: CollectionEvent = {
        type: "other",
        signature: event.signature,
        timestamp: event.timestamp,
        slot: event.slot,
        accounts: instruction.accounts,
        instructionData: instruction.data,
      };

      if (decodedInstruction) {
        switch (decodedInstruction.name) {
          case "createPool":
            collectionEvent.type = "createPool";
            // Account mapping from IDL:
            // 0: creator, 1: collectionMint, 2: pool, 3: systemProgram
            if (instruction.accounts.length >= 3) {
              collectionEvent.poolAddress = instruction.accounts[2]; // Pool PDA
              collectionEvent.collectionMint = instruction.accounts[1];
            }
            if (decodedInstruction.args) {
              collectionEvent.args = decodedInstruction.args;
            }
            break;

          case "createCollectionNft":
            collectionEvent.type = "createCollectionNft";
            // Account mapping from IDL:
            // 0: payer, 1: collectionMint, 2: metadataAccount, ...
            if (instruction.accounts.length >= 2) {
              collectionEvent.collectionMint = instruction.accounts[1];
            }
            if (decodedInstruction.args) {
              collectionEvent.args = decodedInstruction.args;
              // Extract collection name if available
              if (decodedInstruction.args.name) {
                collectionEvent.collectionName = decodedInstruction.args
                  .name as string;
              }
            }
            break;

          case "mintNft":
            collectionEvent.type = "mintNft";
            if (decodedInstruction.args) {
              collectionEvent.args = decodedInstruction.args;
            }
            break;
        }
      }

      processedEvents.push(collectionEvent);
    }
  });

  return {
    signature: event.signature,
    timestamp: event.timestamp,
    slot: event.slot,
    events: processedEvents,
    hasCollectionEvents: processedEvents.some(
      (e) => e.type === "createPool" || e.type === "createCollectionNft"
    ),
  };
}

export function extractCollectionInfo(processedData: ProcessedWebhookData): {
  newPools: Array<{
    poolAddress: string;
    collectionMint: string;
    collectionName?: string;
    signature: string;
    timestamp: number;
    basePrice?: string;
    growthFactor?: string;
  }>;
  newCollections: Array<{
    collectionMint: string;
    collectionName: string;
    symbol?: string;
    uri?: string;
    signature: string;
    timestamp: number;
  }>;
} {
  const newPools: Array<{
    poolAddress: string;
    collectionMint: string;
    collectionName?: string;
    signature: string;
    timestamp: number;
    basePrice?: string;
    growthFactor?: string;
  }> = [];

  const newCollections: Array<{
    collectionMint: string;
    collectionName: string;
    symbol?: string;
    uri?: string;
    signature: string;
    timestamp: number;
  }> = [];

  const collectionNames = new Map<
    string,
    { name: string; symbol?: string; uri?: string }
  >();

  // First pass: collect all collection metadata
  processedData.events.forEach((event) => {
    if (
      event.type === "createCollectionNft" &&
      event.collectionMint &&
      event.args
    ) {
      const name =
        (event.args.name as string) ||
        `Collection ${event.collectionMint.slice(0, 6)}...`;
      const symbol = event.args.symbol as string | undefined;
      const uri = event.args.uri as string | undefined;

      const collectionInfo = { name, symbol, uri };
      collectionNames.set(event.collectionMint, collectionInfo);

      newCollections.push({
        collectionMint: event.collectionMint,
        collectionName: name,
        symbol,
        uri,
        signature: event.signature,
        timestamp: event.timestamp,
      });
    }
  });

  // Second pass: process pools and match with collection metadata
  processedData.events.forEach((event) => {
    if (
      event.type === "createPool" &&
      event.poolAddress &&
      event.collectionMint
    ) {
      const collectionInfo = collectionNames.get(event.collectionMint);

      newPools.push({
        poolAddress: event.poolAddress,
        collectionMint: event.collectionMint,
        collectionName: collectionInfo?.name,
        signature: event.signature,
        timestamp: event.timestamp,
        basePrice: event.args?.basePrice as string | undefined,
        growthFactor: event.args?.growthFactor as string | undefined,
      });
    }
  });

  return { newPools, newCollections };
}

// Debug function to log discriminators for verification
export function logInstructionDiscriminators(): void {
  Object.entries(INSTRUCTION_DISCRIMINATORS).forEach(
    ([name, discriminator]) => {
      console.log(`${name}: ${discriminator.toString("hex")}`);
    }
  );
}
