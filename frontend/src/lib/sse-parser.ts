export type SSEEvent = { eventType: string; data: string };

/**
 * Parse an SSE text buffer, extracting complete events separated by double-newlines.
 * Returns parsed events and the remaining (incomplete) buffer.
 */
export function parseSSEBuffer(buffer: string): {
  events: SSEEvent[];
  remaining: string;
} {
  // Normalize line endings
  let normalized = buffer.replace(/\r\n/g, "\n");
  const events: SSEEvent[] = [];

  let boundary = normalized.indexOf("\n\n");
  while (boundary !== -1) {
    const raw = normalized.slice(0, boundary);
    normalized = normalized.slice(boundary + 2);

    let eventType = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) {
        // Strip single optional leading space per SSE spec
        eventType = line.slice(6).replace(/^ /, "");
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).replace(/^ /, ""));
      }
    }
    events.push({ eventType, data: dataLines.join("\n") });
    boundary = normalized.indexOf("\n\n");
  }

  return { events, remaining: normalized };
}
