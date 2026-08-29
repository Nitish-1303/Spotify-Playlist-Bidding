"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

/**
 * How long ago a track last moved. Held back until the browser has mounted:
 * "how long ago" depends on the instant it is read, and the server reads it at
 * a different instant, which React reports as a hydration mismatch. The tape
 * itself only becomes real after hydration anyway.
 */
export function TimeAgo({ ts }: { ts: number }) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(timeAgo(ts));
  }, [ts]);

  return <>{text}</>;
}
