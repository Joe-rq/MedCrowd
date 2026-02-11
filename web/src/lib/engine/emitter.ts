// Typed event emitter for consultation events

import type { ConsultationEvent } from "./events";

export type EventHandler = (event: ConsultationEvent) => void;

export class ConsultationEmitter {
  private handlers: EventHandler[] = [];

  on(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  emit(event: ConsultationEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("[Emitter] Handler error:", err);
      }
    }
  }
}

/** Create a no-op emitter (default when no listeners needed) */
export function createEmitter(): ConsultationEmitter {
  return new ConsultationEmitter();
}
