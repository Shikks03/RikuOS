"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkNowLabel, type PressOutcome } from "@/lib/freelanceHealth";

/**
 * The only control on the page, and the page's only client code.
 *
 * router.refresh() re-runs the server render and reconciles in place — with the
 * one exception named below, a flip between the strip's two forms that remounts
 * this island — so the new reading arrives through the same server path as a
 * page load and this island never has to know a snapshot's shape. That is also
 * why the EXISTING READING STAYS ON SCREEN while the check runs: nothing here
 * blanks the strip.
 *
 * `busy` covers the POST and the refresh that follows it — useTransition's
 * isPending is what makes the second half honest, since router.refresh()
 * returns before the server render lands.
 *
 * EVERY PRESS IS ANSWERED, not only a failed one. Riku pressed twice inside a
 * minute on the live page and could not tell whether anything had happened,
 * because nothing had changed on screen and nothing could: inside the
 * 60-second floor the route returns the EXISTING reading with 200, and
 * formatAge floors to whole hours, so a reading two seconds old and one fifty
 * minutes old both stamp `checked 0h ago`. A press that worked was
 * indistinguishable from a dead button. The wording and the precedence live in
 * checkNowLabel (freelanceHealth.ts), where a test can reach them; this file
 * only decides which outcome occurred.
 *
 * A non-2xx response and a thrown fetch are ONE fact to the reader (R67) — the
 * reading did not move, and the reason is not the sites — so both produce
 * `failed`. A 200 is a success either way, and `fresh` says which kind: a new
 * reading, or the floor declining to re-check sites that were checked seconds
 * ago. THE ROUTE'S `fresh` FIELD IS NOW A CONTRACT, not the debugging
 * affordance its docblock used to call it; the route says so too.
 *
 * An unreadable 200 body cannot happen against our own route, and if it ever
 * did the honest reading of the status alone is that the check succeeded, so
 * the fallback is `fresh`. It is never `failed`: reporting a success as a
 * failure is the one direction that would make Riku re-press against real
 * client sites for no reason.
 *
 * An outcome stands only until the next press — the state is cleared in the
 * same batch that sets `posting`, so the button still opens on `Checking…` —
 * with ONE exception: when the refresh flips the strip between its quiet and
 * alarm forms, `<CheckNow />` sits at a different position in each (a child of
 * `.fl-health.quiet` in one, inside `.fl-stamp` in the other), so React
 * remounts the island with no outcome and an answer shown before the flip is
 * lost. A lost message, never a false claim; the markup is the mockup's and
 * stays.
 *
 * The route itself never errors on a rapid second press — the 60-second floor
 * returns the existing reading with 200 rather than a 429.
 */
export default function CheckNow() {
  const router = useRouter();
  const [posting, setPosting] = useState(false);
  const [outcome, setOutcome] = useState<PressOutcome>(null);
  const [isPending, startTransition] = useTransition();
  const busy = posting || isPending;

  async function check(): Promise<void> {
    setPosting(true);
    setOutcome(null);
    let next: PressOutcome = "failed";
    try {
      const res = await fetch("/api/health/sites", { method: "POST" });
      if (res.ok) {
        // Guarded rather than cast: this is a boundary read, and the page's own
        // rule is that a payload nobody validated does not get to decide what
        // the screen says. Anything but a boolean falls back to `fresh`.
        const body: unknown = await res.json().catch(() => null);
        const fresh = (body as { fresh?: unknown } | null)?.fresh;
        next = fresh === false ? "current" : "fresh";
      }
    } catch {
      // A rejected fetch and a response that arrived and said no are ONE fact
      // to the reader: the reading did not move, and the reason is not the
      // sites.
      next = "failed";
    }
    setOutcome(next);
    setPosting(false);
    // Unconditional, INCLUDING after a failure. The proxy returns 401 on an
    // expired cookie (requireSession behind it), and this refresh's RSC request
    // is redirected to /login by src/proxy.ts's fail-closed check
    // (proxy.ts:100-102), which answers before the (app) layout is ever
    // reached; the layout's own session check is defence in depth for a matcher
    // miss. That is the right outcome for the one failure with a real remedy,
    // and it is free.
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button type="button" className="btn" disabled={busy} onClick={() => void check()}>
      {checkNowLabel(outcome, busy)}
    </button>
  );
}
