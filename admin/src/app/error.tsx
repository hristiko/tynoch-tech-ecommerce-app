"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">The dashboard could not be loaded.</h1>
      <p className="text-sm text-slate-600">Check that DynamoDB is running and that the admin app has the correct configuration.</p>
      <button className="w-fit rounded-lg bg-moss px-5 py-3 text-white" type="button" onClick={reset}>Try again</button>
    </main>
  );
}
