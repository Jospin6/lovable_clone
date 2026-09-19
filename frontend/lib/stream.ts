import type { StreamEvent } from "./types";

export async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) return "Le prompt doit contenir entre 3 et 12 000 caractères.";
  } catch { /* The proxy may return a non-JSON error. */ }
  return `La requête a échoué (${response.status}). Réessayez.`;
}

export async function* readEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      // Normalize complete CRLF pairs, including those split across chunks.
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split("\n").filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart()).join("\n");
        if (!data) continue; // SSE keepalive comments.
        const event = JSON.parse(data);
        if (!event || typeof event.type !== "string") throw new Error("Événement de génération invalide.");
        yield event as StreamEvent;
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
