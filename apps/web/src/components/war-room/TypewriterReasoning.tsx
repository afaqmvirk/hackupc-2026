"use client";

import { useEffect, useState } from "react";

const CHARS_PER_SECOND = 70; // tuned to fit ~250 chars in ~3.5s stage time

export function TypewriterReasoning({ text, signature }: { text: string; signature: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    if (!text) return;
    const intervalMs = 1000 / CHARS_PER_SECOND;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i >= text.length) {
        setDisplayed(text);
        clearInterval(id);
      } else {
        setDisplayed(text.slice(0, i));
      }
    }, intervalMs);
    return () => clearInterval(id);
    // signature changes whenever the source review changes — drives reset
  }, [text, signature]);

  return (
    <span className="font-mono text-[13px] leading-6 text-pp-secondary">
      {displayed}
      <span className="ml-0.5 inline-block h-3 w-[2px] -translate-y-[1px] animate-pulse bg-pp-violet align-middle" />
    </span>
  );
}
