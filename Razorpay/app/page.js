import Deck from "../components/Deck.js";

// The deck is a client component and fetches its own decisions, so the page is
// just the shell. Kept dynamic on a server build so the execution mode and
// provider are read at request time rather than baked in at build; the static
// export has no request time, so there it is prerendered.
export const dynamic =
  process.env.NEXT_PUBLIC_STATIC === "1" ? "force-static" : "force-dynamic";

export default function Page() {
  return <Deck />;
}
