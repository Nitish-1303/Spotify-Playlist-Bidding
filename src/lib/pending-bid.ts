export type PendingBid = {
  trackId: string;
  trackUrl: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  genre: string;
  bid: number;
  askingPrice?: number;
};

const PENDING_KEY = "playlistbid-pending-bid";

export function savePendingBid(bid: PendingBid) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(bid));
}

export function readPendingBid(): PendingBid | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingBid;
  } catch {
    return null;
  }
}

export function clearPendingBid() {
  sessionStorage.removeItem(PENDING_KEY);
}
