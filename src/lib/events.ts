type Listener<T> = (data: T) => void;

class EventBus {
  private listeners: Record<string, Listener<unknown>[]> = {};

  subscribe<T>(event: string, callback: Listener<T>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event].push(callback as Listener<unknown>);

    return () => {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      );
    };
  }

  publish<T>(event: string, data: T): void {
    if (!this.listeners[event]) return;

    this.listeners[event].forEach((callback) => {
      callback(data);
    });
  }
}

export const eventBus = new EventBus();

// Event types
export interface EnhanceStartedEvent {
  jobId: string;
}

export interface EnhanceCompletedEvent {
  images: string[];
  width: number;
  height: number;
}

export interface EnhanceFailedEvent {
  error: string;
}

// Helper functions for enhance events
export const subscribeToEnhanceStarted = (
  callback: Listener<EnhanceStartedEvent>
) => {
  return eventBus.subscribe("enhance:started", callback);
};

export const publishEnhanceStarted = (jobId: string) => {
  eventBus.publish("enhance:started", { jobId });
};

export const subscribeToEnhanceCompleted = (
  callback: Listener<EnhanceCompletedEvent>
) => {
  return eventBus.subscribe("enhance:completed", callback);
};

export const publishEnhanceCompleted = (
  images: string[],
  width: number,
  height: number
) => {
  eventBus.publish("enhance:completed", { images, width, height });
};

export const subscribeToEnhanceFailed = (
  callback: Listener<EnhanceFailedEvent>
) => {
  return eventBus.subscribe("enhance:failed", callback);
};

export const publishEnhanceFailed = (error: string) => {
  eventBus.publish("enhance:failed", { error });
};
