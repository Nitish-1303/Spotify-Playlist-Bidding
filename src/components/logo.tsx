import Link from "next/link";

type LogoProps = {
  size?: "sm" | "md";
  href?: string | null;
  className?: string;
};

function NoteMark({ size }: { size: "sm" | "md" }) {
  const px = size === "md" ? 36 : 28;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="8" fill="#2dd4bf" />
      <path
        d="M20.5 7.5v11.2a3.4 3.4 0 1 1-1.7-2.95V11.2l-7.3 1.55v8.45a3.4 3.4 0 1 1-1.7-2.95V10.1l10.7-2.6Z"
        fill="#042f2e"
      />
    </svg>
  );
}

export function Logo({ size = "sm", href = "/", className = "" }: LogoProps) {
  const textClass = size === "md" ? "text-xl" : "text-base";
  const content = (
    <span className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${className}`}>
      <NoteMark size={size} />
      <span className={textClass}>PlaylistBid</span>
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} className="text-white hover:opacity-90">
      {content}
    </Link>
  );
}
