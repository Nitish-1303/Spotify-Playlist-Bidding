/**
 * Brand marks for the two ways to pay, drawn inline so the payment step
 * shows the real logos without a third-party network request.
 * Colours are the published brand values; shapes are stylised.
 */

/** Solid "P" with its counter punched out — the PayPal monogram glyph. */
const P_GLYPH =
  "M2 1H8.6A5 5 0 0 1 8.6 11H5.6V20H2ZM5.6 4V8H8.1A2 2 0 0 0 8.1 4Z";

export function PayPalMark() {
  return (
    <span className="paymark">
      <svg
        viewBox="0 0 26 22"
        width="21"
        height="18"
        role="img"
        aria-label="PayPal"
        focusable="false"
      >
        <path d={P_GLYPH} fill="#003087" fillRule="evenodd" transform="translate(0 2)" />
        <path d={P_GLYPH} fill="#009cde" fillRule="evenodd" transform="translate(7 0)" />
      </svg>
      <span className="paymark-word" aria-hidden>
        <b style={{ color: "#253b80" }}>Pay</b>
        <b style={{ color: "#179bd7" }}>Pal</b>
      </span>
    </span>
  );
}

export function UpiMark() {
  return (
    <span className="paymark">
      {/* The UPI arrow device: saffron over green, as on the NPCI mark. */}
      <svg
        viewBox="0 0 20 22"
        width="16"
        height="18"
        role="img"
        aria-label="UPI"
        focusable="false"
      >
        <path d="M1 1h6.4l5.2 10L7.4 21H1l5.2-10Z" fill="#ff7b00" />
        <path d="M8.6 1H15l5 10-5 10H8.6l5-10Z" fill="#0b8a3e" />
      </svg>
      <span className="paymark-word" aria-hidden>
        <b style={{ color: "#0c2d5a" }}>UPI</b>
      </span>
    </span>
  );
}
