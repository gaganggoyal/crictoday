"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { takeDownProfileImageAction } from "@/app/profile-actions";
import { IMAGE_ROLE_LABEL, imageSrc, type ImageRole } from "@/lib/domain/media";
import type { ProfileImage } from "@/lib/domain/types";

/** A profile picture as a moderator sees it, with a button that deletes it. */
export function ImageTakedown({
  profile,
  role,
  image,
}: {
  profile: string;
  role: ImageRole;
  image: ProfileImage;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  if (result?.ok) {
    return (
      <p role="status" className="text-sm font-medium">
        {result.text}
      </p>
    );
  }
  return (
    <figure className="grid content-start gap-2">
      <a
        href={imageSrc(image)}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-[4/3] overflow-hidden rounded-xl border border-line bg-white"
      >
        <Image
          src={imageSrc(image, "small")}
          alt={`${IMAGE_ROLE_LABEL[role]} ${image.caption ?? ""}`.trim()}
          fill
          sizes="200px"
          unoptimized
          className={role === "logo" ? "object-contain p-2" : "object-cover"}
        />
      </a>
      <figcaption className="text-xs text-muted">
        {IMAGE_ROLE_LABEL[role]}
        {image.caption ? `: ${image.caption}` : ""}
      </figcaption>
      <button
        type="button"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-3 text-sm disabled:opacity-60"
        onClick={() => {
          if (!window.confirm("Take this picture down? Its files are deleted.")) return;
          startTransition(async () => {
            const body = new FormData();
            body.set("profile", profile);
            body.set("id", image.id);
            const outcome = await takeDownProfileImageAction(body);
            setResult(
              outcome.ok
                ? { ok: true, text: "Taken down." }
                : { ok: false, text: Object.values(outcome.errors)[0] ?? "That did not work." },
            );
          });
        }}
      >
        {pending ? "Taking down" : "Take down"}
      </button>
      {result && !result.ok ? <p className="text-xs text-danger">{result.text}</p> : null}
    </figure>
  );
}
