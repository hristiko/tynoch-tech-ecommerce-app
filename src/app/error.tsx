"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center" role="alert">
      <h1 className="text-3xl font-bold">We couldn’t load this page</h1>
      <p className="mt-3 text-muted">{error.message || "Something went wrong."} Try again, or come back in a moment.</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">Try again</button>
    </div>
  );
}
