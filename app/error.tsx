"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl px-5 py-20">
      <h1 className="font-display text-4xl font-extrabold">Something went wrong.</h1>
      <p className="mt-3 text-muted">The page could not be rendered. You can try it again.</p>
      <button className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white" onClick={() => reset()} type="button">
        Retry
      </button>
    </div>
  );
}
