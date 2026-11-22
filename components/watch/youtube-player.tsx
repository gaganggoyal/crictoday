"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { useHydrated } from "@/components/use-hydrated";

/**
 * A YouTube video that loads only when the visitor presses play, from YouTube's privacy-enhanced
 * domain: until then the page loads nothing from YouTube. Before the page's script runs, or
 * without it, the poster is a plain link to the video on YouTube.
 */
export function YouTubePlayer({
  id,
  title,
  label,
  live,
}: {
  id: string;
  /** What the video is, for the player's title and the poster's accessible name. */
  title: string;
  /** The words on the poster, such as "IND A vs PAK A". */
  label: string;
  live: boolean;
}) {
  const hydrated = useHydrated();
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="aspect-video overflow-hidden rounded-[1.25rem] bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <a
      href={`https://www.youtube.com/watch?v=${id}`}
      aria-label={`Play ${title}`}
      data-ready={hydrated ? "" : undefined}
      onClick={(event) => {
        // A modified click opens YouTube in a new tab or window, as any link does.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        setPlaying(true);
      }}
      className="group relative isolate flex aspect-video flex-col justify-between overflow-hidden rounded-[1.25rem] bg-[#105535] bg-gradient-to-br from-[#0b3a24] via-[#176b43] to-[#1f8352] p-4 text-[#F3F5EF] no-underline sm:p-7"
    >
      <span
        aria-hidden="true"
        className="absolute -top-16 -right-16 -z-10 h-40 w-40 rounded-full bg-[#D85F25] sm:h-56 sm:w-56"
      />
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#101612]/55 px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase">
        {live ? (
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#FF6B5E]"
          />
        ) : null}
        {live ? "Live now" : "Live stream"}
      </span>
      <span className="flex items-center gap-3 sm:gap-5">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F3F5EF] text-[#105535] shadow-lg transition-transform group-hover:scale-105 sm:h-20 sm:w-20"
        >
          <Play className="ml-0.5 h-6 w-6 fill-current sm:ml-1 sm:h-9 sm:w-9" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-xl leading-tight font-extrabold sm:text-4xl">
            {label}
          </span>
          <span className="mt-1 block text-xs text-[#F3F5EF]/85 sm:text-sm">
            Press play to load the stream from YouTube
          </span>
        </span>
      </span>
    </a>
  );
}
