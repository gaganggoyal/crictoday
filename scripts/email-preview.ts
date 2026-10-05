import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { matches } from "@/lib/data/seed";
import {
  ALERT_CLOSED,
  alertConfirmationMessage,
  signInMessage,
  ticketAlertMessage,
  type EmailBody,
} from "@/lib/email/messages";
import { emailService } from "@/lib/email/service";
import { siteUrl } from "@/lib/utils";

const OUT = ".email-preview";

const USAGE = `Usage: pnpm email:preview [--send <email>]

Writes each email the site sends, filled in with a DEMO match, to ${OUT}/
as HTML and text. With --send, also sends them to <email> through the
configured provider, with subjects starting "[Preview]". Preview buttons
open the site; they do not sign anyone in or change an alert.

Reads NEXT_PUBLIC_SITE_URL and the email settings from the environment,
then .env.local, then .env.`;

// Earlier files win: loadEnvFile never replaces a variable that is already set.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

function samples(): Record<string, EmailBody> {
  const match = matches.find((item) => item.offers.some((offer) => offer.approved)) ?? matches[0]!;
  const offer = match.offers.find((item) => item.approved) ?? {
    sellerName: "Example Tickets",
    sellerDomain: "tickets.example.com",
    url: "https://tickets.example.com/",
  };
  const matchPage = `${siteUrl()}/match/${match.slug}`;
  const alert = ticketAlertMessage(match, offer);
  return {
    "sign-in": signInMessage(`${siteUrl()}/login`),
    "alert-confirmation": alertConfirmationMessage({
      match,
      verifyUrl: matchPage,
      unsubscribeUrl: matchPage,
    }),
    // deliverAlerts adds the closing line to the text when it sends an alert.
    "ticket-alert": { ...alert, text: `${alert.text}\n${ALERT_CLOSED}` },
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("help") || args.includes("--help")) {
    console.log(USAGE);
    return;
  }
  const sendAt = args.indexOf("--send");
  const to = sendAt >= 0 ? args[sendAt + 1] : undefined;
  if (sendAt >= 0 && !to?.includes("@")) throw new Error(USAGE);

  mkdirSync(OUT, { recursive: true });
  const service = to ? emailService() : null;
  for (const [name, message] of Object.entries(samples())) {
    writeFileSync(path.join(OUT, `${name}.html`), message.html);
    writeFileSync(path.join(OUT, `${name}.txt`), `${message.subject}\n\n${message.text}\n`);
    if (service && to) {
      await service.send({ to, ...message, subject: `[Preview] ${message.subject}` });
    }
  }
  console.log(`Wrote ${OUT}/${to ? ` and sent the previews to ${to}` : ""}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
