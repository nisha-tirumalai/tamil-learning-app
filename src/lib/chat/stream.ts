// Sends server events to the browser as one JSON object per line ("ndjson"),
// as they happen. Used by the send and reply routes. Server-only.
import { ERROR_TEXT } from "./config";
import { ModelNotConfigured } from "./model";

export function ndjsonResponse(events: () => AsyncIterable<object>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (e: object) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        for await (const event of events()) send(event);
      } catch (e) {
        console.error("chat stream failed:", (e as Error).message);
        send({ t: "error", message: e instanceof ModelNotConfigured ? e.message : ERROR_TEXT });
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
