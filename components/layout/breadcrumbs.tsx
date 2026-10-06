import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, type Crumb } from "@/lib/seo";

/**
 * The trail above a page's heading, and the same trail for search engines. The last crumb is the
 * page itself: search engines get it, and the heading below already names it.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap gap-x-2">
          {crumbs.slice(0, -1).map((crumb, index) => (
            <li key={crumb.path} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              <Link
                href={crumb.path}
                className="inline-flex min-h-8 items-center hover:text-foreground"
              >
                {crumb.name}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
