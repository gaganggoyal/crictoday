import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 py-20">
      <h1 className="font-display text-5xl font-extrabold">That page is not on the card.</h1>
      <p className="mt-3 text-muted">
        The fixture may be unpublished, or the address may be wrong.
      </p>
      <Link
        href="/matches"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white"
      >
        Browse matches
      </Link>
    </div>
  );
}
