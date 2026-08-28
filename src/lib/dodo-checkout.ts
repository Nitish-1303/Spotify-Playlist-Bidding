"use client";

import { useEffect, useRef } from "react";
import { DodoPayments } from "dodopayments-checkout";

type CheckoutEvent = {
  event_type: string;
  data?: { message?: string };
};

let initialized = false;

export function useDodoCheckout(handlers?: {
  onClosed?: () => void;
  onError?: (message: string) => void;
  onRedirect?: () => void;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (initialized) return;
    const mode =
      process.env.NEXT_PUBLIC_DODO_PAYMENTS_MODE === "live" ? "live" : "test";

    DodoPayments.Initialize({
      mode,
      displayType: "overlay",
      onEvent: (event: CheckoutEvent) => {
        switch (event.event_type) {
          case "checkout.closed":
            handlersRef.current?.onClosed?.();
            break;
          case "checkout.redirect":
            handlersRef.current?.onRedirect?.();
            break;
          case "checkout.error":
            handlersRef.current?.onError?.(
              event.data?.message || "Checkout error",
            );
            break;
          default:
            break;
        }
      },
    });
    initialized = true;
  }, []);

  return {
    openCheckout: async (checkoutUrl: string) => {
      await DodoPayments.Checkout.open({ checkoutUrl });
    },
  };
}
