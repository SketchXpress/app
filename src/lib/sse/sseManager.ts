/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SSEConnection {
  id: string;
  controller: ReadableStreamDefaultController;
  createdAt: number;
  lastHeartbeat: number;
  readyState: "open" | "closed";
}

class SSEManager {
  private connections = new Map<string, SSEConnection>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start heartbeat manager
    this.startHeartbeatManager();
    // Start cleanup manager
    this.startCleanupManager();
  }

  addConnection(id: string, controller: ReadableStreamDefaultController) {
    // Remove existing connection with same ID
    if (this.connections.has(id)) {
      console.log(`Replacing existing connection: ${id}`);
      this.removeConnection(id);
    }

    const connection: SSEConnection = {
      id,
      controller,
      createdAt: Date.now(),
      lastHeartbeat: Date.now(),
      readyState: "open",
    };

    this.connections.set(id, connection);
    console.log(
      `SSE connection added: ${id}. Total connections: ${this.connections.size}`
    );

    // Send welcome message
    this.sendToConnection(id, {
      type: "connection",
      timestamp: new Date().toISOString(),
      clientId: id,
      message: "Connected to real-time collections stream",
    });
  }

  removeConnection(id: string) {
    const connection = this.connections.get(id);
    if (connection) {
      connection.readyState = "closed";

      // Try to close the controller safely
      try {
        connection.controller.close();
      } catch {
        // Controller might already be closed
        console.log(`Controller already closed for ${id}`);
      }

      this.connections.delete(id);
      console.log(
        `SSE connection removed: ${id}. Total connections: ${this.connections.size}`
      );
    }
  }

  sendToConnection(id: string, data: any) {
    const connection = this.connections.get(id);
    if (!connection || connection.readyState === "closed") {
      return false;
    }

    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      const encoder = new TextEncoder();
      connection.controller.enqueue(encoder.encode(message));
      connection.lastHeartbeat = Date.now();
      return true;
    } catch (error) {
      console.error(`Error sending to connection ${id}:`, error);
      this.removeConnection(id);
      return false;
    }
  }

  broadcast(data: any) {
    let successCount = 0;
    const failedConnections: string[] = [];

    this.connections.forEach((connection, id) => {
      if (this.sendToConnection(id, data)) {
        successCount++;
      } else {
        failedConnections.push(id);
      }
    });

    // Clean up failed connections
    failedConnections.forEach((id) => this.removeConnection(id));

    console.log(
      `Broadcasted to ${successCount}/${this.connections.size} SSE clients`
    );
    return successCount;
  }

  private startHeartbeatManager() {
    this.heartbeatInterval = setInterval(() => {
      if (this.connections.size === 0) return;

      const heartbeatData = {
        type: "heartbeat",
        timestamp: new Date().toISOString(),
      };

      // Send heartbeat to all connections
      this.connections.forEach((connection, id) => {
        this.sendToConnection(id, heartbeatData);
      });
    }, 30000); // Every 30 seconds
  }

  private startCleanupManager() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleConnections: string[] = [];

      // Find stale connections (no activity for 2 minutes)
      this.connections.forEach((connection, id) => {
        if (
          now - connection.lastHeartbeat > 120000 ||
          connection.readyState === "closed"
        ) {
          staleConnections.push(id);
        }
      });

      // Remove stale connections
      staleConnections.forEach((id) => {
        console.log(`Removing stale connection: ${id}`);
        this.removeConnection(id);
      });

      // Log stats periodically
      if (this.connections.size > 0) {
        console.log(
          `SSE Manager stats: ${this.connections.size} active connections`
        );
      }
    }, 60000); // Every minute
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      connections: Array.from(this.connections.values()).map((conn) => ({
        id: conn.id,
        createdAt: conn.createdAt,
        lastHeartbeat: conn.lastHeartbeat,
        age: Date.now() - conn.createdAt,
        readyState: conn.readyState,
      })),
    };
  }

  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections
    this.connections.forEach((connection, id) => {
      this.removeConnection(id);
    });

    this.connections.clear();
    console.log("SSE Manager cleaned up");
  }
}

// Export singleton instance
export const sseManager = new SSEManager();

// Cleanup on process exit
process.on("SIGTERM", () => {
  console.log("SIGTERM received, cleaning up SSE Manager...");
  sseManager.cleanup();
});

process.on("SIGINT", () => {
  console.log("SIGINT received, cleaning up SSE Manager...");
  sseManager.cleanup();
});
