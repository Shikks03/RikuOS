import { LoadingSignal } from "../_shell/NavProgress";
import { OutlineBars } from "../_shell/Outline";

/**
 * /freelance's outline (smooth-feel spec §3.1): the hero row's three cards
 * with their fixed labels, the state-of-play box, and the four sections'
 * eyebrows and headings — the page's frame, with bars where every figure,
 * name and row will be. The health strip is left out (plan deviation 11).
 * The labels are the view model's fixed ones (freelanceView.ts).
 */

const CARDS = ["Drafts", "Contacts", "Needs you"] as const;

const SECTIONS = [
  ["Pipeline", "Your pipeline"],
  ["Campaigns", "Your campaigns"],
  ["Approach performance", "Your approaches"],
  ["Needs you", "Waiting on you"],
] as const;

export default function Loading() {
  return (
    <main className="app-content" aria-busy="true">
      <LoadingSignal announce />
      <div className="fl">
        <div className="fl-body">
          <div className="stats">
            {CARDS.map((label) => (
              <div className="stat" key={label}>
                <div className="stat-top">
                  <span className="lbl">{label}</span>
                </div>
                <OutlineBars lines={2} />
              </div>
            ))}
          </div>
          <div className="fl-say">
            <OutlineBars />
          </div>
        </div>
        {SECTIONS.map(([eyebrow, heading]) => (
          <section className="fl-sect" key={heading}>
            <span className="eyebrow">{eyebrow}</span>
            <h2 className="fl-h">{heading}</h2>
            <OutlineBars />
          </section>
        ))}
      </div>
    </main>
  );
}
