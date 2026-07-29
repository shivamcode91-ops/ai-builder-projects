import Deck from "../components/Deck.js";

// The deck is a client component and fetches its own decisions, so the page is
// just the shell. Kept dynamic so the execution mode and provider are read at
// request time rather than baked in at build.
export const dynamic = "force-dynamic";

export default function Page() {
  return <Deck />;
}
