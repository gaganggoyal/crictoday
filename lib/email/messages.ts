import { FORMAT_LABEL } from "@/lib/domain/labels";
import { formatInTimeZone } from "@/lib/domain/time";
import type { StoredMatch, StoredOffer } from "@/lib/domain/types";
import { siteUrl } from "@/lib/utils";

/** Every email has a plain-text part for any client and an HTML part styled like the site. */
export type EmailBody = { subject: string; text: string; html: string };

/** Kick-off, format and the match page link appear when the caller has them. */
export type EmailMatch = Pick<StoredMatch, "homeName" | "awayName" | "venueName" | "cityName"> &
  Partial<Pick<StoredMatch, "slug" | "competitionName" | "format" | "startsAt" | "timezone">>;

type EmailOffer = Pick<StoredOffer, "sellerName" | "sellerDomain" | "url">;

// The request is marked notified when its alert is drafted, so this is its only email.
export const ALERT_CLOSED =
  "You asked for one alert for this match, so this request is now closed. We will not email you about it again.";

const ALERT_REASON =
  "You are getting this email because this address asked for a ticket alert on cricketmatch.today.";

export function signInMessage(link: string): EmailBody {
  const subject = "Your cricketmatch.today sign-in link";
  return {
    subject,
    text: `Sign in: ${link}\nThis link expires in 30 minutes.\nIf you did not ask to sign in, ignore this email.`,
    html: renderEmail({
      subject,
      preheader: "Your link works once and expires in 30 minutes.",
      eyebrow: "Sign in",
      heading: "Your sign-in link",
      paragraphs: [
        "Tap the button to sign in to cricketmatch.today. The link works once and expires in 30 minutes.",
      ],
      action: { label: "Sign in", url: link },
      showLink: true,
      notes: [
        "If you did not ask to sign in, ignore this email. Nobody can sign in with this address without the link.",
      ],
      reason:
        "You are getting this email because someone asked to sign in to cricketmatch.today with this address.",
    }),
  };
}

export function alertConfirmationMessage(input: {
  match: EmailMatch | null;
  verifyUrl: string;
  unsubscribeUrl: string;
}): EmailBody {
  const { match } = input;
  const teams = match ? `${match.homeName} vs ${match.awayName}` : null;
  const subject = teams
    ? `Confirm your ticket alert: ${teams}`
    : "Confirm your cricket ticket alert";
  return {
    subject,
    text: [
      ...(match ? [matchLine(match)] : []),
      `Confirm this alert: ${input.verifyUrl}`,
      "A request does not reserve a ticket.",
      `Unsubscribe: ${input.unsubscribeUrl}`,
    ].join("\n"),
    html: renderEmail({
      subject,
      preheader: teams
        ? `Confirm to hear once when tickets for ${teams} are listed.`
        : "Confirm to turn on your ticket alert.",
      eyebrow: "Ticket alert",
      heading: "Confirm your ticket alert",
      paragraphs: [
        "When tickets for this match are listed and approved, we will email you once. The alert starts when you confirm.",
      ],
      match: match ?? undefined,
      action: { label: "Confirm alert", url: input.verifyUrl },
      notes: [
        "A request does not reserve a ticket.",
        "If you did not ask for this alert, ignore this email and it stays off.",
      ],
      reason: ALERT_REASON,
      unsubscribeUrl: input.unsubscribeUrl,
    }),
  };
}

/** The text matches approve_ticket_offer in the Supabase migration. */
export function ticketAlertMessage(match: EmailMatch, offer: EmailOffer): EmailBody {
  const teams = `${match.homeName} vs ${match.awayName}`;
  const subject = `Ticket alert: ${teams}`;
  return {
    subject,
    text: [
      teams,
      `${match.venueName}, ${match.cityName}`,
      `Seller: ${offer.sellerName}`,
      `Domain: ${offer.sellerDomain}`,
      `Link: ${offer.url}`,
      "This alert does not reserve a ticket.",
    ].join("\n"),
    html: renderEmail({
      subject,
      preheader: `${offer.sellerName} is selling tickets for ${teams}.`,
      eyebrow: "Tickets listed",
      heading: "Tickets are listed",
      paragraphs: [
        `${offer.sellerName} is selling tickets for ${teams}. You buy them on the seller's site, not on cricketmatch.today.`,
      ],
      match,
      seller: offer,
      action: { label: "View tickets", url: offer.url, caption: `Opens ${offer.sellerDomain}` },
      secondary: match.slug
        ? { label: "Match details", url: `${siteUrl()}/match/${match.slug}` }
        : undefined,
      notes: ["This alert does not reserve a ticket.", ALERT_CLOSED],
      reason: ALERT_REASON,
    }),
  };
}

type EmailProfile = { name: string; kind: string; place: string };

const PROFILE_REASON =
  "You are getting this email because this address manages a profile on cricketmatch.today.";

/** To moderators: a new or changed profile is waiting for its check. */
export function profileReviewNotice(profile: EmailProfile, reviewUrl: string): EmailBody {
  const subject = `New profile to check: ${profile.name}`;
  return {
    subject,
    text: [
      `${profile.name} (${profile.kind}, ${profile.place}) is waiting for a check.`,
      `Review it: ${reviewUrl}`,
    ].join("\n"),
    html: renderEmail({
      subject,
      preheader: `${profile.kind} in ${profile.place}`,
      eyebrow: "Moderation",
      heading: "A profile is waiting for its check",
      paragraphs: [
        `${profile.name}, a ${profile.kind.toLowerCase()} in ${profile.place}, asked to be listed. Check that it is real and that the contact belongs to it.`,
      ],
      action: { label: "Review the profile", url: reviewUrl },
      notes: [],
      reason: "You are getting this email because you moderate cricketmatch.today.",
    }),
  };
}

/** To the owner: the profile passed its check and is public. */
export function profileApprovedMessage(
  profile: EmailProfile,
  publicUrl: string,
  dashboardUrl: string,
): EmailBody {
  const subject = `${profile.name} is live on cricketmatch.today`;
  return {
    subject,
    text: [
      `${profile.name} passed its check and is now public: ${publicUrl}`,
      `Post matches and add what you offer from your account: ${dashboardUrl}`,
      "Matches you post now go live straight away.",
    ].join("\n"),
    html: renderEmail({
      subject,
      preheader: "Your profile is public. Matches you post go live straight away.",
      eyebrow: "Profile approved",
      heading: `${profile.name} is live`,
      paragraphs: [
        "Your profile passed its check and is now public. Fans in your city find it on the city and state pages.",
        "Matches you post from now on go live straight away. Add your coaching, camps, ground hire and other offers too.",
      ],
      action: { label: "See your profile", url: publicUrl },
      secondary: { label: "Post a match", url: dashboardUrl },
      notes: [],
      reason: PROFILE_REASON,
    }),
  };
}

/** To the owner: the moderator sent the profile back with a reason. */
export function profileRejectedMessage(
  profile: EmailProfile,
  reason: string,
  dashboardUrl: string,
): EmailBody {
  const subject = `${profile.name} needs a change before it goes live`;
  return {
    subject,
    text: [
      `A moderator checked ${profile.name} and asked for a change: ${reason}`,
      `Edit and resubmit it here: ${dashboardUrl}`,
    ].join("\n"),
    html: renderEmail({
      subject,
      preheader: reason,
      eyebrow: "Profile check",
      heading: "Your profile needs a change",
      paragraphs: [
        `A moderator checked ${profile.name} and asked for this change:`,
        reason,
        "Edit the profile and save it. It goes back for a check straight away.",
      ],
      action: { label: "Edit your profile", url: dashboardUrl },
      notes: [],
      reason: PROFILE_REASON,
    }),
  };
}

/** The site's layout around text that was written elsewhere, such as Supabase alert drafts. */
export function plainMessageHtml(subject: string, text: string, reason: string) {
  const lines = text.split("\n").filter((line) => line.trim());
  return renderEmail({
    subject,
    preheader: lines[0] ?? subject,
    eyebrow: "cricketmatch.today",
    heading: subject,
    paragraphs: lines,
    notes: [],
    reason,
  });
}

function matchLine(match: EmailMatch) {
  const when = kickOff(match);
  return [`${match.homeName} vs ${match.awayName}`, when, `${match.venueName}, ${match.cityName}`]
    .filter(Boolean)
    .join(", ");
}

function kickOff(match: EmailMatch) {
  return match.startsAt && match.timezone ? formatInTimeZone(match.startsAt, match.timezone) : null;
}

type Layout = {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  match?: EmailMatch;
  seller?: EmailOffer;
  action?: { label: string; url: string; caption?: string };
  /** Print the action link under the button, for clients that block buttons. */
  showLink?: boolean;
  secondary?: { label: string; url: string };
  notes: string[];
  reason: string;
  unsubscribeUrl?: string;
};

// The site's palette from app/globals.css. Dark values apply where the client honours
// prefers-color-scheme; elsewhere the light card is used.
const C = {
  page: "#f3f5ef",
  card: "#fffefb",
  text: "#162018",
  muted: "#3e4a42",
  line: "#d9e0d4",
  pitch: "#176b43",
  pitchDeep: "#105535",
  ball: "#d85f25",
};
const SANS = "Satoshi, 'Avenir Next', Avenir, 'Segoe UI', Helvetica, Arial, sans-serif";
const DISPLAY =
  "'Cabinet Grotesk', 'Avenir Next', Avenir, 'Segoe UI', Helvetica, Arial, sans-serif";

const STYLE = `
  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
  img { -ms-interpolation-mode: bicubic; }
  @media (max-width: 620px) {
    .cm-pad { padding-left: 22px !important; padding-right: 22px !important; }
    .cm-h1 { font-size: 25px !important; line-height: 31px !important; }
    .cm-teams { font-size: 21px !important; line-height: 27px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .cm-page { background: #101612 !important; }
    .cm-card { background: #1a2420 !important; border-color: #2c3b33 !important; }
    .cm-panel { background: #101612 !important; border-color: #2c3b33 !important; }
    .cm-text { color: #f3f5ef !important; }
    .cm-muted { color: #c5d0c6 !important; }
    .cm-line { border-color: #2c3b33 !important; }
    .cm-link { color: #8ee0b0 !important; }
    .cm-ball { color: #f08a52 !important; }
  }`;

function renderEmail(layout: Layout) {
  const site = siteUrl();
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(layout.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>${STYLE}</style>
</head>
<body class="cm-page" style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(layout.preheader)}${"&#8204;&nbsp;".repeat(40)}</div>
<table role="presentation" class="cm-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:28px 12px 36px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td style="padding:0 6px 16px;">${wordmark(site)}</td></tr>
<tr><td>
<table role="presentation" class="cm-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.card};border:1px solid ${C.line};border-radius:20px;">
<tr><td bgcolor="${C.pitchDeep}" style="background:${C.pitchDeep};border-radius:19px 19px 0 0;line-height:0;font-size:0;"><img src="${site}/email/banner.jpg" width="598" alt="" style="display:block;width:100%;max-width:598px;height:auto;border:0;border-radius:19px 19px 0 0;"></td></tr>
<tr><td class="cm-pad" style="padding:32px 40px 0;">
<p class="cm-ball" style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.ball};">${esc(layout.eyebrow)}</p>
<h1 class="cm-text cm-h1" style="margin:0;font-family:${DISPLAY};font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.5px;color:${C.text};">${esc(layout.heading)}</h1>
${layout.paragraphs.map((paragraph) => `<p class="cm-muted" style="margin:14px 0 0;font-family:${SANS};font-size:16px;line-height:25px;color:${C.muted};">${linkify(paragraph)}</p>`).join("\n")}
</td></tr>
${layout.match ? matchPanel(layout.match, layout.seller) : ""}
${layout.action ? actionBlock(layout.action, layout.showLink) : ""}
${layout.secondary ? `<tr><td class="cm-pad" style="padding:18px 40px 0;font-family:${SANS};font-size:15px;line-height:22px;"><a class="cm-link" href="${href(layout.secondary.url)}" target="_blank" style="color:${C.pitch};font-weight:700;text-decoration:none;">${esc(layout.secondary.label)} &rarr;</a></td></tr>` : ""}
${notesBlock(layout.notes)}
</table>
</td></tr>
${footer(site, layout.reason, layout.unsubscribeUrl)}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

function wordmark(site: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:10px;"><a href="${site}" target="_blank"><img src="${site}/email/logo.png" width="32" height="32" alt="" style="display:block;border:0;"></a></td>
<td valign="middle" style="font-family:${DISPLAY};font-size:20px;line-height:24px;font-weight:800;letter-spacing:-0.4px;"><a class="cm-text" href="${site}" target="_blank" style="color:${C.text};text-decoration:none;">cricketmatch<span class="cm-ball" style="color:${C.ball};">.today</span></a></td>
</tr></table>`;
}

function matchPanel(match: EmailMatch, seller?: EmailOffer) {
  const label = [match.competitionName, match.format ? FORMAT_LABEL[match.format] : null]
    .filter((part): part is string => Boolean(part))
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(" · ");
  const when = kickOff(match);
  // Values are HTML: escaped text, with the seller's domain on its own line.
  const rows: Array<[string, string]> = [
    ...(when ? [["When", esc(when)] as [string, string]] : []),
    ["Where", esc(`${match.venueName}, ${match.cityName}`)],
    ...(seller
      ? [
          ["Seller", `${esc(seller.sellerName)}<br>${domainHtml(seller.sellerDomain)}`] as [
            string,
            string,
          ],
        ]
      : []),
  ];
  return `<tr><td class="cm-pad" style="padding:24px 40px 0;">
<table role="presentation" class="cm-panel" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};border:1px solid ${C.line};border-radius:16px;">
<tr><td style="padding:20px 22px 18px;">
${label ? `<p class="cm-muted" style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};">${esc(label)}</p>` : ""}
<p class="cm-text cm-teams" style="margin:0;font-family:${DISPLAY};font-size:24px;line-height:30px;font-weight:800;letter-spacing:-0.3px;color:${C.text};">${esc(match.homeName)} <span class="cm-ball" style="color:${C.ball};">vs</span> ${esc(match.awayName)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
${rows.map(([name, value]) => `<tr><td class="cm-muted" valign="top" style="padding:4px 14px 0 0;font-family:${SANS};font-size:12px;line-height:20px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${C.muted};white-space:nowrap;">${name}</td><td class="cm-text" style="padding:4px 0 0;font-family:${SANS};font-size:15px;line-height:20px;color:${C.text};word-break:break-word;overflow-wrap:anywhere;">${value}</td></tr>`).join("\n")}
</table>
</td></tr>
</table>
</td></tr>`;
}

function actionBlock(action: NonNullable<Layout["action"]>, showLink?: boolean) {
  const url = href(action.url);
  return `<tr><td class="cm-pad" style="padding:28px 40px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="${C.pitch}" style="background:${C.pitch};border-radius:999px;"><a href="${url}" target="_blank" style="display:inline-block;padding:15px 32px;font-family:${SANS};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(action.label)} &rarr;</a></td>
</tr></table>
${action.caption ? `<p class="cm-muted" style="margin:10px 0 0;font-family:${SANS};font-size:13px;line-height:18px;color:${C.muted};word-break:break-word;overflow-wrap:anywhere;">${domainHtml(action.caption)}</p>` : ""}
${showLink ? `<p class="cm-muted" style="margin:18px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted};">If the button does not work, copy this link into your browser:<br><a class="cm-link" href="${url}" target="_blank" style="color:${C.pitch};word-break:break-all;">${esc(action.url)}</a></p>` : ""}
</td></tr>`;
}

function notesBlock(notes: string[]) {
  if (notes.length === 0) return `<tr><td style="padding:0 0 32px;"></td></tr>`;
  return `<tr><td class="cm-pad" style="padding:28px 40px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="cm-line" style="border-top:1px solid ${C.line};padding-top:18px;">
${notes.map((note) => `<p class="cm-muted" style="margin:0 0 6px;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted};">${esc(note)}</p>`).join("\n")}
</td></tr></table>
</td></tr>`;
}

function footer(site: string, reason: string, unsubscribeUrl?: string) {
  const link = (url: string, label: string) =>
    `<a class="cm-link" href="${href(url)}" target="_blank" style="color:${C.pitch};font-weight:700;text-decoration:none;">${label}</a>`;
  const links = [
    link(`${site}/matches`, "Find matches"),
    link(`${site}/legal/privacy`, "Privacy"),
    ...(unsubscribeUrl ? [link(unsubscribeUrl, "Unsubscribe")] : []),
  ];
  return `<tr><td class="cm-pad" align="center" style="padding:22px 28px 0;font-family:${SANS};text-align:center;">
<p class="cm-muted" style="margin:0 0 10px;font-size:12px;line-height:18px;color:${C.muted};">${esc(reason)}</p>
<p style="margin:0 0 10px;font-size:12px;line-height:18px;">${links.join(` <span class="cm-muted" style="color:${C.muted};">&middot;</span> `)}</p>
<p class="cm-muted" style="margin:0;font-size:12px;line-height:18px;color:${C.muted};">cricketmatch.today &middot; Find the match. Feel the ground.</p>
</td></tr>`;
}

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char]!);
}

/** Escaped text that may wrap after each dot, so long domains break at their parts on phones. */
function domainHtml(text: string) {
  return esc(text).replace(/\./g, ".<wbr>");
}

/** An http(s) link, escaped for an attribute. Anything else becomes "#". */
function href(url: string) {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? esc(url) : "#";
  } catch {
    return "#";
  }
}

/** Escaped text with its http(s) links made clickable. */
function linkify(text: string) {
  return text
    .split(/(https?:\/\/[^\s<>"']+)/g)
    .map((part, index) =>
      index % 2 === 1
        ? `<a class="cm-link" href="${href(part)}" target="_blank" style="color:${C.pitch};word-break:break-all;">${esc(part)}</a>`
        : esc(part),
    )
    .join("");
}
