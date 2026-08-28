import type { PaymentMethod } from "@/lib/payments";

export type PendingBid = {
  trackId: string;
  trackUrl: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  genre: string;
  bid: number;
  askingPrice?: number;
  method?: PaymentMethod;
};

const PENDING_KEY = "playlistbid-pending-bid";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function savePendingBid(bid: PendingBid) {
  storage()?.setItem(PENDING_KEY, JSON.stringify(bid));
}

export function readPendingBid(): PendingBid | null {
  try {
    const raw = storage()?.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingBid;
  } catch {
    return null;
  }
}

export function clearPendingBid() {
  storage()?.removeItem(PENDING_KEY);
}
