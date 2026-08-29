/**
 * The payment mark on the paddle. Drawn inline so the payment step needs no
 * third-party network request. This is a generic card glyph next to the Dodo
 * Payments wordmark rather than their registered logo — swap in the official
 * SVG here if you want the exact brand asset.
 */
export function DodoMark() {
  return (
    <span className="paymark">
      <svg
        viewBox="0 0 26 20"
        width="24"
        height="18"
        role="img"
        aria-label="Card payment"
        focusable="false"
      >
        <rect
          x="0.75"
          y="0.75"
          width="24.5"
          height="18.5"
          rx="2.75"
          fill="#ffffff"
          stroke="#1c1c1c"
          strokeWidth="1.5"
        />
        <rect x="0.75" y="4.5" width="24.5" height="3.5" fill="#1c1c1c" />
        <rect x="3.5" y="11.5" width="9" height="2" rx="1" fill="#1c1c1c" />
        <rect x="3.5" y="15" width="5.5" height="1.5" rx="0.75" fill="#8a8a8a" />
      </svg>
      <span className="paymark-word" aria-hidden>
        <b>Dodo Payments</b>
      </span>
    </span>
  );
}
