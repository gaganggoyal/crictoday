import { describe, expect, it } from "vitest";
import { matches } from "@/lib/data/seed";
import { formatInTimeZone } from "@/lib/domain/time";
import {
  ALERT_CLOSED,
  alertConfirmationMessage,
  plainMessageHtml,
  signInMessage,
  ticketAlertMessage,
} from "@/lib/email/messages";
import { siteUrl } from "@/lib/utils";

const match = matches.find((item) => item.offers.length > 0)!;
const offer = {
  sellerName: "Board",
  sellerDomain: "tickets.example.com",
  url: "https://tickets.example.com/delhi?stand=north&tier=2",
};
const verifyUrl = "https://cricketmatch.today/requests/verify-token";
const unsubscribeUrl = "https://cricketmatch.today/requests/unsub-token?intent=unsubscribe";

function hrefs(html: string) {
  return [...html.matchAll(/href="([^"]*)"/g)].map((found) => found[1]);
}

describe("email messages", () => {
  it("keeps the sign-in link first in the text and behind the button", () => {
    const link = "https://cricketmatch.today/login/verify?token=abc_123&next=%2Fdashboard";
    const message = signInMessage(link);
    expect(message.subject).toBe("Your cricketmatch.today sign-in link");
    expect(message.text.split("\n")[0]).toBe(`Sign in: ${link}`);
    expect(hrefs(message.html)).toContain(link.replace("&", "&amp;"));
    expect(message.html).toContain("Sign in &rarr;</a>");
    expect(message.html).toContain("expires in 30 minutes");
  });

  it("names the match in the alert confirmation", () => {
    const message = alertConfirmationMessage({ match, verifyUrl, unsubscribeUrl });
    const when = formatInTimeZone(match.startsAt, match.timezone);
    expect(message.subject).toBe(
      `Confirm your ticket alert: ${match.homeName} vs ${match.awayName}`,
    );
    expect(message.text.split("\n")).toEqual([
      `${match.homeName} vs ${match.awayName}, ${when}, ${match.venueName}, ${match.cityName}`,
      `Confirm this alert: ${verifyUrl}`,
      "A request does not reserve a ticket.",
      `Unsubscribe: ${unsubscribeUrl}`,
    ]);
    expect(message.html).toContain(when);
    expect(hrefs(message.html)).toEqual(expect.arrayContaining([verifyUrl, unsubscribeUrl]));
  });

  it("still sends a confirmation when the match cannot be loaded", () => {
    const message = alertConfirmationMessage({ match: null, verifyUrl, unsubscribeUrl });
    expect(message.subject).toBe("Confirm your cricket ticket alert");
    expect(message.text.split("\n")[0]).toBe(`Confirm this alert: ${verifyUrl}`);
    expect(hrefs(message.html)).toContain(verifyUrl);
  });

  it("keeps the ticket alert text Supabase sends and adds the seller and match page", () => {
    const message = ticketAlertMessage(match, offer);
    expect(message.subject).toBe(`Ticket alert: ${match.homeName} vs ${match.awayName}`);
    expect(message.text.split("\n")).toEqual([
      `${match.homeName} vs ${match.awayName}`,
      `${match.venueName}, ${match.cityName}`,
      "Seller: Board",
      "Domain: tickets.example.com",
      `Link: ${offer.url}`,
      "This alert does not reserve a ticket.",
    ]);
    expect(hrefs(message.html)).toEqual(
      expect.arrayContaining([
        "https://tickets.example.com/delhi?stand=north&amp;tier=2",
        `${siteUrl()}/match/${match.slug}`,
      ]),
    );
    expect(message.html.replaceAll("<wbr>", "")).toContain("Opens tickets.example.com");
    expect(message.html).toContain(formatInTimeZone(match.startsAt, match.timezone));
    expect(message.html).toContain(ALERT_CLOSED);
  });

  it("escapes names and drops links that are not http or https", () => {
    const message = ticketAlertMessage(
      {
        ...match,
        homeName: '<img src=x onerror="alert(1)">',
        awayName: "Tom & Jerry's XI",
        venueName: "<b>Ground</b>",
      },
      { ...offer, sellerName: '"Seller" <script>', url: "javascript:alert(1)" },
    );
    expect(message.html).not.toMatch(/<img src=x|<script>|<b>Ground/);
    expect(message.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(message.html).toContain("Tom &amp; Jerry&#39;s XI");
    expect(hrefs(message.html)).not.toContain("javascript:alert(1)");
    expect(hrefs(message.html)).toContain("#");
  });

  it("wraps text written elsewhere in the same layout with its links clickable", () => {
    const html = plainMessageHtml(
      "Ticket alert: A vs B",
      "A vs B\nLink: https://tickets.example.com/b?x=1&y=2\n<i>note</i>",
      "You asked for a ticket alert on cricketmatch.today.",
    );
    expect(hrefs(html)).toContain("https://tickets.example.com/b?x=1&amp;y=2");
    expect(html).toContain("&lt;i&gt;note&lt;/i&gt;");
    expect(html).not.toContain("<i>note</i>");
  });

  it("stays under the size at which Gmail clips a message", () => {
    const bodies = [
      signInMessage("https://cricketmatch.today/login/verify?token=t").html,
      alertConfirmationMessage({ match, verifyUrl, unsubscribeUrl }).html,
      ticketAlertMessage(match, offer).html,
    ];
    for (const html of bodies) {
      expect(new TextEncoder().encode(html).length).toBeLessThan(102 * 1024);
    }
  });
});
