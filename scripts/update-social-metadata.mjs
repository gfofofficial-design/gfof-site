// Apply the page-specific, static Open Graph/X cards after rendering them.
// Run with --write; without it, this script checks that HTML is up to date.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://galacticfederation.co";
const write = process.argv.includes("--write");
const fixed = new Map([
  ["command-preview.html", "command"], ["index.html", "command"],
  ["staking.html", "staking"], ["roadmap.html", "roadmap"],
  ["building.html", "building"], ["corrections.html", "record"],
  ["record.html", "record"], ["adjudication-method.html", "record"],
  ["security.html", "record"], ["treasury.html", "treasury"],
  ["research.html", "research"], ["liquidation-spec.html", "research"],
  ["governance-spec.html", "research"], ["access-spec.html", "research"],
  ["creator-fee-spec.html", "research"], ["faq.html", "command"],
  ["intel.html", "research"],
]);
const journeyPages = [
  "index", "the-signal", "supply-run", "starport-market", "repair-the-shuttle",
  "observatory-journey", "meridian-relay", "long-way-home", "lending-lab",
  "keys-to-the-gate", "holder-passport", "docking-request", "changing-course",
  "borrowed-voice", "avatar", "after-the-crowd",
];
for (const page of journeyPages) fixed.set(`journey/${page}.html`,
  page === "lending-lab" ? "lending-lab" : page === "holder-passport" ? "passport" : "journey");

const alt = {
  command: "Galactic Federation: on-chain finance with the work and record in public.",
  staking: "GFOF staking in design: three proposed terms; no pool open or deposits available.",
  journey: "First Contact Journey: five Federation guides approach a lantern-lit harbor.",
  passport: "Explorer Passport: an optional read-only GFOF holder check with no deposit.",
  building: "Federation build log: a private lending prototype with tested flows and open gates.",
  record: "The Federation public record: commitments, corrections, and evidence.",
  treasury: "Federation transparency: check public locks, wallets, and receipts.",
  roadmap: "Federation roadmap with receipts: live, in review, and uncommitted work.",
  research: "Federation research: design and specifications before code.",
  "lending-lab": "The Lending Lab: a wallet-free simulation with fictional funds.",
};
const fallbackDescription = {
  journey: "An interactive Federation story about choices, evidence, and trust. No wallet required.",
  passport: "An optional, read-only GFOF wallet check in the Federation Journey. No deposit or reward.",
  "lending-lab": "Try a wallet-free simulation of supply, borrowing, interest, and repayment with fictional funds.",
};
const metaNames = ["og:type", "og:title", "og:description", "og:url", "og:image",
  "og:image:type", "og:image:width", "og:image:height", "og:image:alt",
  "twitter:card", "twitter:site", "twitter:title", "twitter:description",
  "twitter:image", "twitter:image:alt"];
const escapeAttr = (value) => String(value).replace(/&(?!(?:amp|lt|gt|quot|#\d+);)/g, "&amp;")
  .replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const readTag = (html, name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta\\s+(?:name|property)="${escaped}"\\s+content="([^"]*)"[^>]*>`, "i"));
  return match?.[1] ?? null;
};
const line = (kind, name, value) => `<meta ${kind}="${name}" content="${escapeAttr(value)}">`;
let problems = 0;
for (const [relative, key] of fixed) {
  const path = join(root, ...relative.split("/"));
  const imagePath = join(root, "assets", "social", `social-${key}-v1.png`);
  if (!existsSync(path) || !existsSync(imagePath)) throw new Error(`Missing page/card for ${relative}`);
  const old = readFileSync(path, "utf8");
  const title = readTag(old, "og:title") ?? old.match(/<title>([^<]+)<\/title>/i)?.[1];
  const description = readTag(old, "og:description") ?? readTag(old, "description") ??
    fallbackDescription[key] ?? "Explore the Galactic Federation's public work on Solana.";
  const canonicalSource = old.match(/<link\s+rel="canonical"\s+href="([^"]+)"[^>]*>/i)?.[1] ??
    (relative === "command-preview.html" || relative === "index.html" ? `${origin}/` :
      relative === "journey/index.html" ? `${origin}/journey/` :
      relative.startsWith("journey/") ? `${origin}/${relative}` :
      `${origin}/${relative.replace(/\.html$/, "")}`);
  const canonical = canonicalSource === origin ? `${origin}/` : canonicalSource;
  if (!title || !canonical.startsWith(origin + "/")) throw new Error(`Invalid title/canonical for ${relative}`);
  const twitterTitle = readTag(old, "twitter:title") ?? title;
  const twitterDescription = readTag(old, "twitter:description") ?? description;
  const url = `${origin}/assets/social/social-${key}-v1.png`;
  const block = [
    line("property", "og:type", "website"), line("property", "og:url", canonical),
    line("property", "og:title", title), line("property", "og:description", description),
    line("property", "og:image", url), line("property", "og:image:type", "image/png"),
    line("property", "og:image:width", "1200"), line("property", "og:image:height", "630"),
    line("property", "og:image:alt", alt[key]),
    line("name", "twitter:card", "summary_large_image"),
    line("name", "twitter:site", "@GFOF_Offcial"),
    line("name", "twitter:title", twitterTitle),
    line("name", "twitter:description", twitterDescription),
    line("name", "twitter:image", url), line("name", "twitter:image:alt", alt[key]),
  ].join("\n");
  let updated = old;
  for (const name of metaNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    updated = updated.replace(new RegExp(`<meta\\s+(?:name|property)="${escaped}"\\s+content="[^"]*"[^>]*>[ \\t]*(?:\\r?\\n)?`, "gi"), "");
  }
  const insertAfter = updated.match(/<meta\s+name="description"[^>]*>/i)?.[0] ??
    updated.match(/<title>[^<]+<\/title>/i)?.[0];
  if (!insertAfter) throw new Error(`No metadata insertion point for ${relative}`);
  updated = updated.replace(insertAfter, `${insertAfter}\n${block}`);
  if (write) writeFileSync(path, updated, "utf8");
  else if (updated !== old) { console.error(`Social metadata differs: ${relative}`); problems++; }
}
if (problems) process.exit(1);
console.log(`${fixed.size} public pages ${write ? "updated" : "verified"} with page-relevant social images.`);
