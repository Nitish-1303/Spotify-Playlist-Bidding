/**
 * The last song this browser put on the tape. Written at the moment the bid is
 * placed, purely so the page you land on after checkout can show you what
 * happened. Nothing waits on it — the song is already on the tape.
 */
export type Receipt = {
  trackId: string;
  trackUrl: string;
  title: string;
  artist: string;
  bid: number;
  /** The track position that was bought. */
  targetRank: number;
  /** Where it sat the instant it was written on. */
  landedRank: number;
};

const RECEIPT_KEY = "playlistbid-receipt";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function saveReceipt(receipt: Receipt) {
  storage()?.setItem(RECEIPT_KEY, JSON.stringify(receipt));
}

export function readReceipt(): Receipt | null {
  try {
    const raw = storage()?.getItem(RECEIPT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Receipt;
  } catch {
    return null;
  }
}
