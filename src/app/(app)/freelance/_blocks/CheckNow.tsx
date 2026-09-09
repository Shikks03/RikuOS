"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * The only control on the page, and the page's only client code.
 *
 * router.refresh() re-runs the server render and reconciles in place, so the
 * new reading arrives through the same server path as a page load and this
 * island never has to know a snapshot's shape. That is also why the EXISTING
 * READING STAYS ON SCREEN while the check runs: nothing here blanks the strip.
 *
 * `busy` covers the POST and the refresh that follows it — useTransition's
 * isPending is what makes the second half honest, since router.refresh()
 * returns before the server render lands.
 *
 * A failed POST is NOT swallowed (R67). A non-2xx response and a thrown fetch
 * are ONE fact to the reader — the reading did not move, and the reason is not
 * the sites — so both produce the same label, `Couldn't check`, in the button's
 * own register rather than as a line in the strip: the strip's lines are claims
 * about the world, and a failed press is a fact about a button. The stamp
 * cannot carry it either, because formatAge floors to whole hours and a reading
 * under an hour old stamps `checked 0h ago` on both sides of the press.
 *
 * `Couldn't check` stands only until the next press — setFailed(false) at the
 * top of check() clears it — and .btn uppercases it in CSS, so it renders
 * COULDN'T CHECK beside CHECK NOW and CHECKING….
 *
 * The route itself never errors on a rapid second press — a 60-second floor
 * returns the existing reading with 200 rather than a 429.
 */
export default function CheckNow() {
  const router = useRouter();
  const [posting, setPosting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const busy = posting || isPending;

  async function check(): Promise<void> {
    setPosting(true);
    setFailed(false);
    let ok = false;
    try {
      const res = await fetch("/api/health/sites", { method: "POST" });
      ok = res.ok;
    } catch {
      // A rejected fetch and a response that arrived and said no are ONE fact
      // to the reader: the reading did not move, and the reason is not the
      // sites. The stamp cannot carry that — formatAge floors to hours, so a
      // reading under an hour old stamps `checked 0h ago` either way.
      ok = false;
    }
    setFailed(!ok);
    setPosting(false);
    // Unconditional, INCLUDING after a failure. requireSession returns 401 on
    // an expired cookie, and this refresh re-runs the server render, which hits
    // the (app) layout's session check, which redirects to /login. That is the
    // right outcome for the one failure with a real remedy, and it is free.
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button type="button" className="btn" disabled={busy} onClick={() => void check()}>
      {busy ? "Checking…" : failed ? "Couldn't check" : "Check now"}
    </button>
  );
}
