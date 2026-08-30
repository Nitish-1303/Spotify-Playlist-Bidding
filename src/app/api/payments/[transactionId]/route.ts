import { NextResponse } from "next/server";
import { readOwnTransaction } from "@/lib/payment-service";

/**
 * The buyer's own view of their payment.
 *
 * Requires the owner token minted when the checkout was opened, so one browser
 * cannot read another's payment and ids cannot be enumerated. A missing
 * transaction and a wrong token are deliberately indistinguishable.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  const { transactionId } = await params;
  const token =
    new URL(request.url).searchParams.get("token") ||
    request.headers.get("x-payment-token") ||
    "";

  const view = await readOwnTransaction(transactionId, token);
  if (!view) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(view, {
    headers: { "Cache-Control": "no-store" },
  });
}
