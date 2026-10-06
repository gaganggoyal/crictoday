import Image from "next/image";
import { imageSrc } from "@/lib/domain/media";
import { shortName } from "@/lib/domain/profiles";
import type { ProfileImage } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * A profile's logo in a rounded square, or its initials when it has none. The files are already
 * sized, so Next.js serves them as they are.
 */
export function ProfileLogo({
  name,
  logo,
  size,
  className,
}: {
  name: string;
  logo: ProfileImage | null;
  size: number;
  className?: string;
}) {
  const box = cn(
    "relative block shrink-0 overflow-hidden rounded-2xl border border-line bg-white",
    className,
  );
  if (!logo) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          box,
          "grid place-items-center border-0 bg-pitch font-display font-extrabold text-white",
        )}
        style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size / 3)) }}
      >
        {shortName(name).slice(0, 3)}
      </span>
    );
  }
  return (
    <span className={box} style={{ width: size, height: size }}>
      <Image
        src={imageSrc(logo, size <= 96 ? "small" : "full")}
        alt={`${name} logo`}
        fill
        sizes={`${size}px`}
        unoptimized
        className="object-contain p-1"
      />
    </span>
  );
}

/** The wide photo across the top of a profile or its card, or the pitch green without one. */
export function ProfileCover({
  cover,
  size,
  priority = false,
  className,
}: {
  cover: ProfileImage | null;
  size: "full" | "small";
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-pitch to-pitch-deep",
        className,
      )}
    >
      {cover ? (
        <Image
          src={imageSrc(cover, size)}
          alt=""
          fill
          priority={priority}
          sizes={
            size === "full"
              ? "(min-width: 1120px) 1080px, 100vw"
              : "(min-width: 640px) 400px, 100vw"
          }
          unoptimized
          className="object-cover"
        />
      ) : (
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full text-white/10"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 400 175"
        >
          <circle cx="330" cy="40" r="70" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M282 -10c22 30 22 70 0 100M378 -10c-22 30-22 70 0 100"
            fill="none"
            stroke="currentColor"
            strokeDasharray="4 6"
            strokeWidth="2"
          />
          <rect x="40" y="120" width="320" height="2" fill="currentColor" />
        </svg>
      )}
    </div>
  );
}
