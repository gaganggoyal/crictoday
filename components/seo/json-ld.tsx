import { jsonLdScript } from "@/lib/seo";

/** schema.org data for search engines, in a script tag. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
  );
}
