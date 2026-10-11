import { CardsOutline } from "../../_shell/Outline";

/** The queue's outline (smooth-feel spec §3.1, §6): two unlabelled cards. Overrides the dashboard's outline above it. */
export default function Loading() {
  return (
    <main>
      <CardsOutline labels={[null, null]} />
    </main>
  );
}
