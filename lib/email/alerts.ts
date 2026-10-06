import "server-only";
import type { EmailDraft } from "@/lib/domain/workflows";
import { ALERT_CLOSED, plainMessageHtml } from "@/lib/email/messages";
import { emailService } from "@/lib/email/service";
import { decryptString } from "@/lib/security/crypto";

/** Send ticket alerts. One failed send does not stop the rest. Returns the failure count. */
export async function deliverAlerts(emails: EmailDraft[]) {
  const service = emailService();
  let failed = 0;
  for (const email of emails) {
    try {
      const to = email.to.includes("@") ? email.to : decryptString(email.to);
      const text = `${email.text}\n${ALERT_CLOSED}`;
      // Supabase drafts its alerts as text; those get the site's layout around the text.
      const html =
        email.html ??
        plainMessageHtml(
          email.subject,
          text,
          "You asked for a ticket alert on cricketmatch.today.",
        );
      await service.send({ to, subject: email.subject, text, html });
    } catch (error) {
      failed += 1;
      console.error(
        "[email] ticket alert not sent:",
        error instanceof Error ? error.message : error,
      );
    }
  }
  return failed;
}
