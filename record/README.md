# Federation Record — anchored forecasts

Canonical text and OpenTimestamps proofs for forecasts published at
https://galacticfederation.co/record

Each forecast has two files:

- `fr-NNN.txt`      — the canonical text, exactly as filed
- `fr-NNN.txt.ots`  — the OpenTimestamps proof

To verify one yourself, download both and drop them into the verifier at
https://opentimestamps.org — it reports when that text existed, attested
by the Bitcoin blockchain rather than by us.

The text files are byte-exact. Changing a single character, including
whitespace or a line ending, invalidates the proof. That is the point.
