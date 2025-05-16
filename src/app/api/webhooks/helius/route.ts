/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

import { volumeCache } from "@/lib/cache/volumeCache";
import { HeliusWebhookPayload } from "@/lib/webhooks/types";
import {
  verifyWebhookSignature,
  processWebhookEvent,
  extractCollectionInfo,
} from "@/lib/webhooks/heliusWebhook";

// Helper function to extract pool address from event
function extractPoolAddressFromEvent(event: any): string | null {
  try {
    if (event.instructions?.[0]?.accounts?.[0]) {
      const poolAddress = event.instructions[0].accounts[0];

      return poolAddress;
    }

    return null;
  } catch (error) {
    console.error("Error extracting pool address:", error);
    return null;
  }
}

// Helper function to determine transaction type from processed data
function getTransactionType(processedData: any): string | null {
  try {
    // Check the instruction name from processed data
    if (processedData.instructionName) {
      return processedData.instructionName;
    }

    if (processedData.type) {
      return processedData.type;
    }

    return null;
  } catch (error) {
    console.error("Error determining transaction type:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Getting the raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("x-helius-signature");

    // Verify webhook signature (optional for enhanced webhooks)
    const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      if (!verifyWebhookSignature(body, signature, webhookSecret)) {
        console.error("Invalid webhook signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // Parse the webhook payload
    const payload: HeliusWebhookPayload = JSON.parse(body);
    const processedEvents = [];
    let totalNewPools = 0;
    let totalNewCollections = 0;
    let totalVolumeEvents = 0;
    let totalPoolTransactions = 0;

    for (const event of payload.events) {
      try {
        const processedData = processWebhookEvent(event);

        if (processedData.volumeData) {
          processedData.volumeData.forEach((volumeEvent) => {
            volumeCache.addTransaction({
              poolAddress: volumeEvent.poolAddress,
              type: volumeEvent.type,
              amount: volumeEvent.amount,
              trader: volumeEvent.trader,
              timestamp: volumeEvent.timestamp,
              signature: event.signature,
            });
            totalVolumeEvents++;
          });
        }

        if (processedData.hasCollectionEvents) {
          const { newPools, newCollections } =
            extractCollectionInfo(processedData);

          totalNewPools += newPools.length;
          totalNewCollections += newCollections.length;

          processedEvents.push({
            ...processedData,
            newPools,
            newCollections,
          });
        }

        try {
          const poolAddress = extractPoolAddressFromEvent(event);
          const transactionType = getTransactionType(processedData);

          if (poolAddress && transactionType) {
            if (
              transactionType === "mintNft" ||
              transactionType === "sellNft"
            ) {
              const { broadcastToSSEClients } = await import(
                "@/lib/sse/eventBroadcaster"
              );

              // Broadcast pool-specific transaction
              broadcastToSSEClients({
                type: "poolTransaction",
                timestamp: new Date().toISOString(),
                data: {
                  poolAddress,
                  transaction: processedData,
                  transactionType,
                },
              });

              totalPoolTransactions++;
            }
          }
        } catch (poolError) {
          console.error("Error processing pool-specific event:", poolError);
        }
      } catch (error) {
        console.error(`Error processing event ${event.signature}:`, error);
      }
    }

    // Broadcast events to SSE clients
    if (processedEvents.length > 0 || totalVolumeEvents > 0) {
      // Import the broadcast function dynamically to avoid circular dependencies
      const { broadcastToSSEClients } = await import(
        "@/lib/sse/eventBroadcaster"
      );

      processedEvents.forEach((processedEvent) => {
        if (processedEvent.newPools && processedEvent.newPools.length > 0) {
          broadcastToSSEClients({
            type: "newPools",
            timestamp: new Date().toISOString(),
            data: processedEvent.newPools,
          });
        }

        if (
          processedEvent.newCollections &&
          processedEvent.newCollections.length > 0
        ) {
          broadcastToSSEClients({
            type: "newCollections",
            timestamp: new Date().toISOString(),
            data: processedEvent.newCollections,
          });
        }
      });

      // Broadcast volume updates if there were any trading activities
      if (totalVolumeEvents > 0) {
        const updatedPools: Array<{ poolAddress: string; metrics: any }> = [];

        // Getting unique pool addresses from volume events
        const poolsWithActivity = new Set<string>();
        for (const event of processedEvents) {
          if (event.volumeData) {
            event.volumeData.forEach((v) =>
              poolsWithActivity.add(v.poolAddress)
            );
          }
        }

        // Get metrics for pools with activity
        poolsWithActivity.forEach((poolAddress) => {
          const metrics = volumeCache.getPoolMetrics(poolAddress);
          updatedPools.push({ poolAddress, metrics });
        });

        if (updatedPools.length > 0) {
          broadcastToSSEClients({
            type: "volumeUpdate",
            timestamp: new Date().toISOString(),
            data: {
              updatedPools,
            },
          });
        }
      }
    }

    const response = {
      success: true,
      processed: processedEvents.length,
      totalNewPools,
      totalNewCollections,
      totalVolumeEvents,
      totalPoolTransactions,
      message: "Webhook processed successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Webhook endpoint active",
    timestamp: new Date().toISOString(),
    discriminators: {
      createPool: "calculated at runtime",
      createCollectionNft: "calculated at runtime",
      mintNft: "calculated at runtime",
      sellNft: "calculated at runtime",
    },
  });
}
