/**
 * Tox'sCraft EventBus
 * A simple publish-subscribe messaging system to handle decoupled events
 * like player movement, inventory updates, achievements, saving, and audio cues.
 */

type Callback = (...args: any[]) => void;

class EventBus {
  private events: Map<string, Set<Callback>> = new Map();

  /**
   * Subscribe to an event
   */
  on(event: string, callback: Callback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);

    // Return unsubscribe function for convenience
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: Callback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * Publish an event to all subscribers
   */
  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      // Create a copy to prevent concurrent modification errors during callback execution
      const copy = Array.from(callbacks);
      for (const callback of copy) {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event listener for event "${event}":`, error);
        }
      }
    }
  }

  /**
   * Clear all subscribers
   */
  clear(): void {
    this.events.clear();
  }
}

export const eventBus = new EventBus();
