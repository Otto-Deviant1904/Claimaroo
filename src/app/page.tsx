export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
        Forward 2026
      </p>
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          AI Claims Agent
        </h1>
        <p className="text-lg text-zinc-600">
          25% backend checkpoint. Schema, persisting tools, APIs, and seeded
          claims. No voice widget and no officer dashboard on this slice.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-base">
        <li>
          <a className="underline underline-offset-4" href="/api/health">
            /api/health
          </a>
        </li>
        <li>
          <a className="underline underline-offset-4" href="/api/claims">
            /api/claims
          </a>
        </li>
        <li>
          <a className="underline underline-offset-4" href="/api/status">
            /api/status
          </a>
        </li>
      </ul>
      <p className="text-sm text-zinc-600">
        Next person: start at{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-900">
          docs/handoff.md
        </code>{" "}
        in the repo. How to run is at the top of README.md.
      </p>
    </main>
  );
}
