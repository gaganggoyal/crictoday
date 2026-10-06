import "server-only";
import type { EmailDraft } from "@/lib/domain/workflows";
import { plainMessageHtml } from "@/lib/email/messages";
import { emailService } from "@/lib/email/service";

/** Send drafted emails. One failed send does not stop the rest. Returns the failure count. */
export async function sendDrafts(emails: EmailDraft[], reason: string) {
  const service = emailService();
  let failed = 0;
  for (const email of emails) {
    try {
      await service.send({
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html ?? plainMessageHtml(email.subject, email.text, reason),
      });
    } catch (error) {
      failed += 1;
      console.error("[email] not sent:", error instanceof Error ? error.message : error);
    }
  }
  return failed;
}
