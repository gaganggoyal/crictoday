import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Privacy",
  "What cricketmatch.today stores and why.",
  "/legal/privacy",
);

export default function PrivacyPage() {
  return (
    <article className="mx-auto grid w-full max-w-3xl gap-4 px-5 py-12 text-[17px] leading-7">
      <h1 className="font-display text-5xl font-extrabold">Privacy</h1>
      <p>
        We store the email you give us for sign-in, ticket alerts and submissions. Alert addresses
        are encrypted, with a separate hash used only to avoid duplicate requests. We keep the time
        you consented.
      </p>
      <p>
        Outbound ticket clicks are counted without an account. The record stores the match, the
        approved offer and the time. It is not a browsing profile.
      </p>
      <p>
        Verification and alert email includes an unsubscribe link. Alerts stop when you unsubscribe,
        when the match starts, or when the match is cancelled.
      </p>
      <p>
        Analytics and error reporting run only when their keys are configured. They are off by
        default in this repository.
      </p>
    </article>
  );
}
