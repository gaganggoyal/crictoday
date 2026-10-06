import type { ReactNode } from "react";

export type DocSection = { id: string; title: string; body: ReactNode };

const LONG_DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** A long page of text, such as a policy, with its sections listed beside it. */
export function DocPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  /** The date the text last changed, as YYYY-MM-DD. */
  updated?: string;
  sections: DocSection[];
}) {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-12">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">{eyebrow}</p>
        <h1 className="mt-2 font-display text-5xl leading-[0.98] font-extrabold tracking-tight sm:text-6xl">
          {title}
        </h1>
        <div className="mt-4 text-lg text-muted">{intro}</div>
        {updated ? (
          <p className="mt-4 text-sm text-muted">
            Last updated{" "}
            <time dateTime={updated}>{LONG_DATE.format(new Date(`${updated}T00:00:00Z`))}</time>
          </p>
        ) : null}
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-14">
        <details className="rounded-[1.25rem] border border-line bg-surface p-4 lg:hidden">
          <summary className="cursor-pointer font-semibold">On this page</summary>
          <nav aria-label="On this page" className="mt-3">
            <Contents sections={sections} />
          </nav>
        </details>
        <div className="grid min-w-0 max-w-3xl gap-12">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-24"
            >
              <h2 id={`${section.id}-title`} className="font-display text-3xl font-extrabold">
                {section.title}
              </h2>
              <div className="prose-page mt-4 text-[17px] leading-7">{section.body}</div>
            </section>
          ))}
        </div>
        <nav
          aria-label="On this page"
          className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
        >
          <h2 className="text-sm font-semibold">On this page</h2>
          <div className="mt-3">
            <Contents sections={sections} />
          </div>
        </nav>
      </div>
    </div>
  );
}

function Contents({ sections }: { sections: DocSection[] }) {
  return (
    <ol className="grid gap-2 text-sm">
      {sections.map((section) => (
        <li key={section.id}>
          <a href={`#${section.id}`} className="text-muted hover:text-foreground">
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Pairs of a label and its detail, such as each kind of record and how long it is kept. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-[1.25rem] border border-line bg-line">
      {items.map(([term, detail]) => (
        <div
          key={term}
          className="grid gap-1 bg-surface p-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-6"
        >
          <dt className="font-semibold">{term}</dt>
          <dd className="text-muted">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}
