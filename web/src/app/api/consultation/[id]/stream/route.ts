import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getConsultation, getEvents } from "@/lib/db";

const POLL_INTERVAL_MS = 500;
const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes max

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const consultation = await getConsultation(id);

  if (!consultation || consultation.askerId !== session.userId) {
    return new Response("Not found", { status: 404 });
  }

  const eventKey = `consultation-events:${id}`;
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      let lastIndex = 0;

      function send(event: string, data: string) {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      // Send initial status
      send("status", JSON.stringify({ status: consultation.status }));

      // If already terminal, close immediately
      if (["DONE", "PARTIAL", "FAILED"].includes(consultation.status)) {
        send("done", JSON.stringify({ status: consultation.status }));
        controller.close();
        return;
      }

      // Poll KV for new events
      async function pollEvents() {
        if (closed) return;

        try {
          const events = await getEvents(eventKey, 0, -1);
          // Events are in reverse order (lpush), so reverse to get chronological
          const chronological = [...events].reverse();

          if (chronological.length > lastIndex) {
            for (let i = lastIndex; i < chronological.length; i++) {
              try {
                const event = JSON.parse(chronological[i]);
                send(event.type, chronological[i]);

                // If consultation is done, close the stream
                if (event.type === "consultation:done") {
                  send("done", chronological[i]);
                  closed = true;
                  controller.close();
                  return;
                }
              } catch {
                // Skip malformed events
              }
            }
            lastIndex = chronological.length;
          }

          // Check timeout
          if (Date.now() - startTime > MAX_DURATION_MS) {
            send("timeout", JSON.stringify({ message: "Stream timeout" }));
            closed = true;
            controller.close();
            return;
          }

          // Also check consultation status directly (in case events were missed)
          const current = await getConsultation(id);
          if (current && ["DONE", "PARTIAL", "FAILED"].includes(current.status)) {
            send("done", JSON.stringify({ status: current.status }));
            closed = true;
            controller.close();
            return;
          }

          // Schedule next poll
          setTimeout(pollEvents, POLL_INTERVAL_MS);
        } catch (err) {
          console.error("[SSE] Poll error:", err);
          if (!closed) {
            setTimeout(pollEvents, POLL_INTERVAL_MS * 2);
          }
        }
      }

      pollEvents();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
