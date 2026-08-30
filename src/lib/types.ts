export type TimeFilter = "all" | "today" | "week";

export type Spot = {
  id: string;
  trackId: string;
  trackUrl: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  bid: number;
  clicks: number;
  raisedAt: number;
};

export type Activity = {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  bid: number;
  at: number;
};

export type BoardState = {
  spots: Spot[];
  activity: Activity[];
  /**
   * Rank each spot held immediately before the most recent finalised payment,
   * keyed by spot id. Drives the ▲/▼ rank-change column — a real movement,
   * not a decoration.
   */
  prevRanks: Record<string, number>;
};

/**
 * Where a payment has got to. PlaylistBid keeps its own state machine because
 * Dodo is an external system: the tape may only move on SUCCESS, and SUCCESS is
 * only ever set by a signature-verified webhook.
 */
export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

/**
 * A purchase attempt. `amount` is computed on the server from `position` at the
 * moment checkout is created — the browser never gets a say in it.
 *
 * Private record. Never served to the public tape; see `publicTransaction`.
 */
export type PaymentTransaction = {
  id: string;
  /** SHA-256 of the token handed to the buyer's browser. Proves ownership. */
  ownerTokenHash: string;
  trackId: string;
  trackUrl: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  /** Track position bought, 1-based, as a rank on the tape. */
  position: number;
  /** Whole dollars, server-calculated. */
  amount: number;
  currency: "USD";
  provider: "dodo";
  providerCheckoutId?: string;
  providerPaymentId?: string;
  status: PaymentStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  /** Where the song actually ended up once the payment was finalised. */
  landedPosition?: number;
  /** Set when a finalised payment could not take the position asked for. */
  note?: string;
};
