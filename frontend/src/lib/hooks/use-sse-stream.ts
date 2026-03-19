import { useEffect, useRef } from "react";

import {
  createExponentialBackoff,
  type ExponentialBackoffOptions,
} from "@/lib/backoff";
import { parseSSEBuffer, type SSEEvent } from "@/lib/sse-parser";

type UseSSEStreamOptions = {
  /** Whether the stream should be active. */
  enabled: boolean;
  /** Return a fetch Response with a readable body. Called with an AbortSignal. */
  connect: (signal: AbortSignal) => Promise<Response>;
  /** Called for each parsed SSE event. */
  onEvent: (event: SSEEvent) => void;
  /** Backoff config for reconnection. */
  backoffConfig?: ExponentialBackoffOptions;
  /**
   * Serialized key that triggers reconnection when changed.
   * Encode any values the stream depends on (e.g. `\`${boardId}\``).
   */
  key?: string;
};

/**
 * Generic hook that manages a single SSE stream with automatic
 * reconnect + exponential backoff. Extracts the duplicated pattern
 * from board page SSE effects.
 */
export function useSSEStream({
  enabled,
  connect,
  onEvent,
  backoffConfig,
  key,
}: UseSSEStreamOptions): void {
  // Use refs so the effect always calls the latest connect/onEvent
  // without needing them in the dependency array.
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const backoffConfigRef = useRef(backoffConfig);
  backoffConfigRef.current = backoffConfig;

  useEffect(() => {
    if (!enabled) return;

    let isCancelled = false;
    const abortController = new AbortController();
    const backoff = createExponentialBackoff(backoffConfigRef.current);
    let reconnectTimeout: number | undefined;

    const run = async () => {
      try {
        const response = await connectRef.current(abortController.signal);
        if (!(response instanceof Response) || !response.body) {
          throw new Error("SSE connect did not return a readable response.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!isCancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length) {
            backoff.reset();
          }
          buffer += decoder.decode(value, { stream: true });
          const { events, remaining } = parseSSEBuffer(buffer);
          buffer = remaining;
          for (const event of events) {
            onEventRef.current(event);
          }
        }
      } catch {
        // Reconnect handled below.
      }

      if (!isCancelled) {
        if (reconnectTimeout !== undefined) {
          window.clearTimeout(reconnectTimeout);
        }
        const delay = backoff.nextDelayMs();
        reconnectTimeout = window.setTimeout(() => {
          reconnectTimeout = undefined;
          void run();
        }, delay);
      }
    };

    void run();
    return () => {
      isCancelled = true;
      abortController.abort();
      if (reconnectTimeout !== undefined) {
        window.clearTimeout(reconnectTimeout);
      }
    };
  }, [enabled, key]);
}
