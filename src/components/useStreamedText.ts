"use client";

import { useEffect, useState } from "react";

export type StreamState = "idle" | "loading" | "streaming" | "done" | "off";

/**
 * Reads a text/plain stream into state as it arrives. `enabled` is false for a
 * portfolio tab that has not been opened yet, so no summary is generated (and
 * no tokens are spent) until someone looks at it.
 *
 * One stream per mounted component: `url` is expected to be stable for the
 * lifetime of the caller, so give the caller a React key if its url can change.
 */
export function useStreamedText(url: string, enabled = true) {
  const [text, setText] = useState("");
  const [state, setState] = useState<StreamState>(enabled ? "loading" : "idle");

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    (async () => {
      try {
        setState("loading");
        const res = await fetch(url, { signal: controller.signal });
        if (res.status === 503) {
          setText(await res.text());
          setState("off");
          return;
        }
        if (!res.body) throw new Error("no response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        setState("streaming");
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setText((prev) => prev + decoder.decode(value, { stream: true }));
        }
        setState("done");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setText(
          "This note could not be reached. The market data on this page is live and unaffected.",
        );
        setState("off");
      }
    })();

    return () => controller.abort();
  }, [url, enabled]);

  return { text, state };
}
