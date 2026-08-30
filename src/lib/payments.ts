"use client";

import type { PaymentStatus } from "./types";

/** Thrown when card payments have not been switched on yet. */
export class CheckoutNotConfiguredError extends Error {}

export type StartCheckoutInput = {
  /** A Spotify track link. */
  track: string;
  /** Track number on the tape, counted from the top. The price is worked out on the server. */
  position: number;
};

export type StartedCheckout = {
  transactionId: string;
  ownerToken: string;
  checkoutUrl: string;
  amount: number;
};

/**
 * Asks the server to price a slot and open a checkout for it.
 *
 * Note what is not sent: no amount, no title, no artist. The server prices the
 * position against the live tape and reads the song's details from Spotify
 * itself, so nothing here is in a position to lie about either.
 */
export async function startCheckout(
  input: StartCheckoutInput,
): Promise<StartedCheckout> {
  const res = await fetch("/api/payments/create-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<StartedCheckout> & {
    error?: string;
    unconfigured?: boolean;
  };

  if (data.unconfigured) {
    throw new CheckoutNotConfiguredError(
      data.error || "Card payments are not switched on yet.",
    );
  }
  if (!res.ok || !data.checkoutUrl || !data.transactionId || !data.ownerToken) {
    throw new Error(data.error || "Unable to start payment. Please try again.");
  }
  return data as StartedCheckout;
}

export type PaymentView = {
  status: PaymentStatus;
  position: number;
  landedPosition?: number;
  title: string;
  artist: string;
  amount: number;
  currency: string;
  note?: string;
};

/**
 * The buyer's own payment state, straight from the backend. The redirect back
 * from Dodo is only a hint that something happened — this is what decides.
 */
export async function readPayment(
  transactionId: string,
  token: string,
): Promise<PaymentView | null> {
  const res = await fetch(
    `/api/payments/${encodeURIComponent(transactionId)}?token=${encodeURIComponent(token)}`,
    { headers: { "Cache-Control": "no-store" } },
  );
  if (!res.ok) return null;
  return (await res.json()) as PaymentView;
}

/* —— the browser's handle on its own payment —— */

const HANDLE_KEY = "playlistbid-payment";

export type PaymentHandle = { transactionId: string; ownerToken: string };

/**
 * The owner token is kept here and nowhere else. It is the only thing that lets
 * this browser read its own payment, and it is not a credential for anything
 * else — losing it costs you the receipt, not the slot.
 */
export function savePaymentHandle(handle: PaymentHandle) {
  try {
    localStorage.setItem(HANDLE_KEY, JSON.stringify(handle));
  } catch {
    /* private browsing with storage denied — the redirect still carries the id */
  }
}

export function readPaymentHandle(): PaymentHandle | null {
  try {
    const raw = localStorage.getItem(HANDLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PaymentHandle;
    return parsed?.transactionId && parsed?.ownerToken ? parsed : null;
  } catch {
    return null;
  }
}
