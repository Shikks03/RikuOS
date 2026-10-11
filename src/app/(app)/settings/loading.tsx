import { CardsOutline } from "../_shell/Outline";

/** /settings' outline (smooth-feel spec §3.1): its four cards' fixed labels, in page order. */
export default function Loading() {
  return (
    <main>
      <CardsOutline labels={["Follow-up chaser", "Monitoring", "Google Calendar", "Calendar layers"]} />
    </main>
  );
}
