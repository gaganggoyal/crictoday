import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  findWatchPage,
  IND_A_V_PAK_A_2026,
  liveStreams,
  streamState,
  WATCH_PAGES,
  watchJsonLd,
  watchPath,
} from "@/lib/watch";

describe("live stream pages", () => {
  it("each has its own page, a YouTube id and a live window", () => {
    const slugs = new Set<string>();
    for (const page of WATCH_PAGES) {
      expect(page.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(slugs.has(page.slug), page.slug).toBe(false);
      slugs.add(page.slug);
      expect(existsSync(`app/(public)${watchPath(page)}/page.tsx`), page.slug).toBe(true);
      expect(findWatchPage(page.slug)).toBe(page);
      expect(page.youtubeId).toMatch(/^[\w-]{11}$/);
      expect(Date.parse(page.liveFrom)).toBeLessThan(Date.parse(page.liveUntil));
      expect(Date.parse(page.match.startsAt)).toBeLessThan(Date.parse(page.liveUntil));
      expect(Date.parse(page.checkedAt)).not.toBeNaN();
    }
    expect(findWatchPage("no-such-stream")).toBeNull();
  });

  it("is live from the stream's start until the match should be over", () => {
    const page = IND_A_V_PAK_A_2026;
    expect(streamState(page, new Date("2026-11-22T09:00:00Z"))).toBe("upcoming");
    expect(streamState(page, new Date("2026-11-22T12:00:00Z"))).toBe("live");
    expect(streamState(page, new Date("2026-11-22T19:00:00Z"))).toBe("ended");
    expect(liveStreams(new Date("2026-11-22T12:00:00Z"))).toEqual([page]);
    expect(liveStreams(new Date("2026-11-23T12:00:00Z"))).toEqual([]);
  });

  it("describes the stream and the match it shows for search engines", () => {
    const [video, match] = watchJsonLd(IND_A_V_PAK_A_2026)["@graph"];
    expect(match?.["@id"]).toMatch(/#match$/);
    expect(video).toMatchObject({
      "@type": "VideoObject",
      uploadDate: "2026-11-22T09:09:46Z",
      embedUrl: "https://www.youtube.com/embed/yG06f6yORy4",
      publication: { "@type": "BroadcastEvent", isLiveBroadcast: true },
      about: { "@id": match?.["@id"] },
    });
    expect(match).toMatchObject({
      "@type": "SportsEvent",
      startDate: "2026-11-22T10:00:00Z",
      location: { name: "West End Park International Cricket Stadium" },
      competitor: [{ name: "India A" }, { name: "Pakistan A" }],
    });
  });
});
