// src/app/api/webhooks/helius/route.ts - Enhanced version with volume tracking
import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  processWebhookEvent,
  extractCollectionInfo,
  logInstructionDiscriminators,
} from "@/lib/webhooks/heliusWebhook";
import { HeliusWebhookPayload } from "@/lib/webhooks/types";
import { volumeCache } from "@/lib/cache/volumeCache";

// Log discriminators on startup for debugging
if (process.env.NODE_ENV === "development") {
  logInstructionDiscriminators();
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
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
    } else {
      console.log("Webhook running without signature verification");
    }

    // Parse the webhook payload
    const payload: HeliusWebhookPayload = JSON.parse(body);

    // Process each event
    const processedEvents = [];
    let totalNewPools = 0;
    let totalNewCollections = 0;
    let totalVolumeEvents = 0;

    for (const event of payload.events) {
      try {
        // Process the transaction (now with volume data)
        const processedData = processWebhookEvent(event);

        // Track volume data if present
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
          // Extract collection information
          const { newPools, newCollections } =
            extractCollectionInfo(processedData);

          // Log interesting findings
          if (newPools.length > 0 || newCollections.length > 0) {
            if (newCollections.length > 0) {
              newCollections.forEach((collection) => {
                if (collection.symbol)
                  console.log(`    Symbol: ${collection.symbol}`);
                if (collection.uri) console.log(`    URI: ${collection.uri}`);
              });
            }

            if (newPools.length > 0) {
              newPools.forEach((pool) => {
                if (pool.basePrice)
                  console.log(`    Base Price: ${pool.basePrice}`);
                if (pool.growthFactor)
                  console.log(`    Growth Factor: ${pool.growthFactor}`);
              });
            }
          }

          totalNewPools += newPools.length;
          totalNewCollections += newCollections.length;

          processedEvents.push({
            ...processedData,
            newPools,
            newCollections,
          });
        }
      } catch (error) {
        console.error(`Error processing event ${event.signature}:`, error);
      }
    }

    // Broadcast events to SSE clients
    if (processedEvents.length > 0 || totalVolumeEvents > 0) {
      // Import the broadcast function dynamically to avoid circular dependencies
      const { broadcastToSSEClients } = await import(
        "@/app/api/collections/sse/route"
      );

      // Broadcast each processed event (existing logic)
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

      // NEW: Broadcast volume updates if there were any trading activities
      if (totalVolumeEvents > 0) {
        // Get updated metrics for all pools that had volume activity
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedPools: Array<{ poolAddress: string; metrics: any }> = [];

        // Get unique pool addresses from volume events
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
          // Send volume update event
          broadcastToSSEClients({
            type: "volumeUpdate",
            timestamp: new Date().toISOString(),
            data: {
              updatedPools,
            },
          });

          console.log(
            `📊 Broadcasted volume updates for ${updatedPools.length} pools`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedEvents.length,
      totalNewPools,
      totalNewCollections,
      totalVolumeEvents, // NEW: Include volume events in response
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle GET requests (for webhook URL verification)
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
