"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRef, useState } from "react";
import { imageSrc } from "@/lib/domain/media";
import type { ProfileImage } from "@/lib/domain/types";

const control =
  "inline-flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25";

/** A profile's photos as a grid that opens each one large, with arrows and Escape to close. */
export function PhotoGallery({ name, photos }: { name: string; photos: ProfileImage[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const photo = photos[index];
  const alt = (item: ProfileImage, at: number) => item.caption || `${name}, photo ${at + 1}`;
  const open = (at: number) => {
    setIndex(at);
    if (!dialog.current?.open) dialog.current?.showModal();
  };
  const step = (by: number) => setIndex((at) => (at + by + photos.length) % photos.length);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((item, at) => (
          <li key={item.id} className="min-w-0">
            <button
              type="button"
              onClick={() => open(at)}
              aria-label={`Open ${alt(item, at)}`}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <Image
                src={imageSrc(item, "small")}
                alt={alt(item, at)}
                fill
                sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 50vw"
                unoptimized
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </button>
            {item.caption ? <p className="mt-1.5 text-sm text-muted">{item.caption}</p> : null}
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        aria-label={`${name} photos`}
        className="m-auto w-[min(1100px,94vw)] bg-transparent p-0 text-white backdrop:bg-black/85"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        {photo ? (
          <figure className="grid gap-3">
            <div className="relative h-[74svh]">
              <Image
                src={imageSrc(photo)}
                alt={alt(photo, index)}
                fill
                sizes="94vw"
                unoptimized
                className="object-contain"
              />
            </div>
            <figcaption className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                {photo.caption ? `${photo.caption} · ` : ""}
                <span className="text-white/75">
                  {index + 1} of {photos.length}
                </span>
              </span>
              <span className="flex gap-2">
                {photos.length > 1 ? (
                  <>
                    <button type="button" className={control} onClick={() => step(-1)}>
                      <ChevronLeft aria-hidden="true" size={20} />
                      <span className="sr-only">Previous photo</span>
                    </button>
                    <button type="button" className={control} onClick={() => step(1)}>
                      <ChevronRight aria-hidden="true" size={20} />
                      <span className="sr-only">Next photo</span>
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className={control}
                  onClick={() => dialog.current?.close()}
                  autoFocus
                >
                  <X aria-hidden="true" size={20} />
                  <span className="sr-only">Close</span>
                </button>
              </span>
            </figcaption>
          </figure>
        ) : null}
      </dialog>
    </>
  );
}
