import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TicketBadge } from "@/components/match/ticket-badge";

describe("TicketBadge", () => {
  it("shows the official attendance label", () => {
    const html = renderToStaticMarkup(<TicketBadge state="OFFICIAL_LINK" />);
    expect(html).toContain("Tickets available");
  });

  it("says when a match is under way or finished", () => {
    expect(renderToStaticMarkup(<TicketBadge state="IN_PLAY" />)).toContain("Under way");
    expect(renderToStaticMarkup(<TicketBadge state="FINISHED" />)).toContain("Finished");
  });
});
