// Render the Federation's self-contained social cards with a local Chrome binary.
// No network fonts, image services, or public API calls are used.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve, sep } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "assets", "social");
const chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const profile = join(root, ".social-card-render-profile");
if (!existsSync(chrome)) throw new Error("Set CHROME_PATH to a local Chrome binary.");
if (!resolve(profile).startsWith(root + sep)) throw new Error("Render profile escaped the workspace.");
mkdirSync(output, { recursive: true });

const logo = `data:image/png;base64,${readFileSync(join(root, "logo-circle.png")).toString("base64")}`;
const journeyPhoto = `data:image/webp;base64,${readFileSync(join(root, "journey", "assets", "federation-crew-pier-wide.webp")).toString("base64")}`;
const cards = [
  { key: "command", label: "FEDERATION OS  /  COMMAND", lines: ["THE FEDERATION", "IS BUILDING."], copy: ["On-chain finance, with the work", "and the record in public."], status: "BUILDING ON SOLANA", accent: "#eec77d", art: "orbital" },
  { key: "staking", label: "GFOF  /  HOLDER PROGRAM", lines: ["STAKING", "IN DESIGN."], copy: ["Three proposed term lengths.", "No pool is open."], status: "PREPARATION  ·  NO DEPOSITS", accent: "#f5cb80", art: "staking" },
  { key: "journey", label: "FIRST CONTACT  /  THE JOURNEY", lines: ["ENTER THE", "FEDERATION."], copy: ["Meet the crew. Play the story", "behind the build."], status: "FREE TO PLAY  ·  NO WALLET", accent: "#f5d293", art: "journey" },
  { key: "passport", label: "FIRST CONTACT  /  EXPLORER PASSPORT", lines: ["EXPLORER", "PASSPORT."], copy: ["A read-only GFOF holder check.", "No deposit or token reward."], status: "OPTIONAL WALLET  ·  NO DEPOSIT", accent: "#9de2dd", art: "orbital" },
  { key: "building", label: "FEDERATION OS  /  BUILD LOG", lines: ["FOLLOW", "THE BUILD."], copy: ["Private lending prototype.", "Tested flows and open gates."], status: "PROTOTYPE  ·  NOT A LIVE MARKET", accent: "#89d9ef", art: "ledger" },
  { key: "record", label: "FEDERATION OS  /  PUBLIC RECORD", lines: ["THE RECORD", "REMAINS."], copy: ["What we promised. What changed.", "Evidence you can check."], status: "CORRECTIONS  ·  FORECASTS", accent: "#f5ca80", art: "record" },
  { key: "treasury", label: "FEDERATION OS  /  TRANSPARENCY", lines: ["VERIFY", "THE FACTS."], copy: ["Locks, wallets, and receipts.", "Check the public sources."], status: "ON-CHAIN TRANSPARENCY", accent: "#9bdddd", art: "vault" },
  { key: "roadmap", label: "FEDERATION OS  /  STATUS MAP", lines: ["ROADMAP", "WITH RECEIPTS."], copy: ["Live, in review, or uncommitted.", "Every state has a source."], status: "PUBLIC BUILD MAP", accent: "#d7bbff", art: "map" },
  { key: "research", label: "FEDERATION OS  /  RESEARCH", lines: ["DESIGN", "BEFORE CODE."], copy: ["Specifications, research, and", "the questions still open."], status: "PUBLIC RESEARCH", accent: "#b4a8ef", art: "blueprint" },
  { key: "lending-lab", label: "FIRST CONTACT  /  FINANCIAL LAB", lines: ["THE", "LENDING LAB."], copy: ["Put a fictional market to work.", "See what changes as risk moves."], status: "SIMULATION  ·  NO WALLET", accent: "#a6e2e7", art: "ledger" },
];

const xml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]);
let random = 47;
const next = () => ((random = (random * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const stars = Array.from({ length: 125 }, () => {
  const x = Math.round(next() * 1200), y = Math.round(next() * 630);
  const radius = next() > 0.91 ? 1.8 : 0.7;
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#d5eff7" opacity="${(0.14 + next() * 0.53).toFixed(2)}"/>`;
}).join("");

function art(card) {
  const a = card.accent;
  if (card.art === "journey") return `<image href="${journeyPhoto}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/><rect width="1200" height="630" fill="url(#journeyShade)"/>`;
  if (card.art === "staking") return `
    <circle cx="942" cy="317" r="229" fill="url(#halo)" opacity=".9"/>
    <circle cx="942" cy="317" r="222" fill="none" stroke="${a}" stroke-opacity=".19" stroke-width="1"/>
    <circle cx="942" cy="317" r="184" fill="none" stroke="${a}" stroke-opacity=".32" stroke-width="1" stroke-dasharray="2 9"/>
    <ellipse cx="942" cy="317" rx="236" ry="76" transform="rotate(-28 942 317)" fill="none" stroke="${a}" stroke-opacity=".58" stroke-width="2"/>
    <ellipse cx="942" cy="317" rx="209" ry="124" transform="rotate(34 942 317)" fill="none" stroke="#70d6df" stroke-opacity=".37" stroke-width="1.5"/>
    <circle cx="760" cy="402" r="8" fill="${a}"/><circle cx="1082" cy="201" r="7" fill="#9ce8e6"/><circle cx="1125" cy="425" r="5" fill="${a}"/>
    <circle cx="942" cy="317" r="99" fill="#06111f" stroke="${a}" stroke-opacity=".52" stroke-width="2"/>
    <image href="${logo}" x="866" y="241" width="152" height="152"/>
    <text x="942" y="519" text-anchor="middle" class="art-label">PROPOSED · 1 / 6 / 12 MONTHS</text>`;
  if (card.art === "orbital") return `
    <circle cx="938" cy="322" r="246" fill="url(#halo)"/>
    <circle cx="938" cy="322" r="216" fill="none" stroke="${a}" stroke-opacity=".27" stroke-width="2"/>
    <circle cx="938" cy="322" r="178" fill="none" stroke="#70d6df" stroke-opacity=".25" stroke-width="1"/>
    <ellipse cx="938" cy="322" rx="253" ry="89" transform="rotate(-29 938 322)" fill="none" stroke="${a}" stroke-opacity=".65" stroke-width="2"/>
    <image href="${logo}" x="825" y="209" width="226" height="226"/>
    <circle cx="734" cy="424" r="5" fill="${a}"/><circle cx="1138" cy="211" r="6" fill="#8be6e0"/>`;
  if (card.art === "ledger" || card.art === "blueprint") return `
    <circle cx="950" cy="315" r="265" fill="url(#halo)" opacity=".58"/>
    <g transform="translate(732 143) rotate(-7 218 175)">
      <rect x="34" y="29" width="366" height="330" rx="14" fill="#071a2b" stroke="${a}" stroke-opacity=".4" stroke-width="2"/>
      <path d="M58 108H374M58 185H374M58 262H374" stroke="${a}" stroke-opacity=".23"/>
      <text x="68" y="76" class="art-label">${card.art === "blueprint" ? "SPECIFICATION / PUBLIC" : card.key === "lending-lab" ? "FLOW / FICTIONAL MARKET" : "FLOW / PRIVATE PROTOTYPE"}</text>
      <circle cx="95" cy="145" r="15" fill="none" stroke="${a}" stroke-width="2"/><path d="M111 145H289" stroke="${a}" stroke-width="2"/><circle cx="307" cy="145" r="15" fill="${a}" fill-opacity=".72"/>
      <circle cx="95" cy="222" r="15" fill="none" stroke="#78d6d7" stroke-width="2"/><path d="M111 222H242" stroke="#78d6d7" stroke-width="2"/><circle cx="260" cy="222" r="15" fill="none" stroke="#78d6d7" stroke-width="2"/>
      <path d="M78 305H340" stroke="${a}" stroke-opacity=".45" stroke-dasharray="9 9"/>
    </g>`;
  if (card.art === "record") return `
    <circle cx="950" cy="320" r="255" fill="url(#halo)" opacity=".7"/>
    <g transform="translate(764 122) rotate(7 183 183)">
      <rect x="0" y="18" width="354" height="374" rx="12" fill="#071725" stroke="${a}" stroke-opacity=".45" stroke-width="2"/>
      <path d="M35 105H319M35 183H319M35 261H319M35 339H319" stroke="${a}" stroke-opacity=".25"/>
      <text x="35" y="65" class="art-label">PUBLIC / APPEND ONLY</text>
      <path d="m53 140 12 12 23-28m-35 94 12 12 23-28m-35 94 12 12 23-28" fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M110 139H278M110 217H255M110 295H291" stroke="#b9d5dd" stroke-opacity=".66" stroke-width="4" stroke-linecap="round"/>
    </g>`;
  if (card.art === "vault") return `
    <circle cx="951" cy="319" r="258" fill="url(#halo)" opacity=".76"/>
    <circle cx="951" cy="319" r="200" fill="#061724" stroke="${a}" stroke-opacity=".3" stroke-width="2"/>
    <circle cx="951" cy="319" r="151" fill="none" stroke="${a}" stroke-opacity=".55" stroke-width="3"/>
    <circle cx="951" cy="319" r="83" fill="#061724" stroke="${a}" stroke-width="2"/>
    <path d="M951 236v166m-83-83h166m-142-59 118 118m0-118-118 118" stroke="${a}" stroke-opacity=".45" stroke-width="3"/>
    <circle cx="951" cy="319" r="27" fill="#0e3440" stroke="${a}" stroke-width="3"/>
    <text x="951" y="557" text-anchor="middle" class="art-label">SOURCE  /  SIGNATURE  /  STATUS</text>`;
  if (card.art === "map") return `
    <circle cx="946" cy="318" r="260" fill="url(#halo)" opacity=".65"/>
    <path d="M737 420C793 424 808 283 867 278S955 387 1009 339 1051 199 1143 183" fill="none" stroke="${a}" stroke-width="3" stroke-opacity=".78"/>
    <path d="M737 420C793 424 808 283 867 278S955 387 1009 339 1051 199 1143 183" fill="none" stroke="${a}" stroke-width="14" stroke-opacity=".08"/>
    <circle cx="737" cy="420" r="16" fill="#122739" stroke="${a}" stroke-width="3"/><circle cx="867" cy="278" r="17" fill="#122739" stroke="${a}" stroke-width="3"/><circle cx="1009" cy="339" r="17" fill="#122739" stroke="${a}" stroke-width="3"/><circle cx="1143" cy="183" r="17" fill="#122739" stroke="${a}" stroke-width="3"/>
    <text x="799" y="489" class="art-label">LIVE</text><text x="1040" y="443" class="art-label">IN REVIEW</text>`;
  return "";
}

function cardSvg(card) {
  const titleSize = card.key === "roadmap" || card.key === "command" ? 66 : 73;
  const journey = card.art === "journey";
  const title = card.lines.map((line, i) => `<text x="74" y="${266 + i * 78}" class="title" font-size="${titleSize}">${xml(line)}</text>`).join("");
  const copy = card.copy.map((line, i) => `<text x="78" y="${421 + i * 35}" class="copy">${xml(line)}</text>`).join("");
  return `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
  <radialGradient id="background" cx="78%" cy="47%" r="78%"><stop offset="0" stop-color="#143947"/><stop offset=".48" stop-color="#091b2c"/><stop offset="1" stop-color="#030916"/></radialGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="${card.accent}" stop-opacity=".20"/><stop offset=".55" stop-color="#367f88" stop-opacity=".13"/><stop offset="1" stop-color="#367f88" stop-opacity="0"/></radialGradient>
  <linearGradient id="journeyShade"><stop offset="0" stop-color="#04101c" stop-opacity=".94"/><stop offset=".48" stop-color="#061322" stop-opacity=".88"/><stop offset=".79" stop-color="#061322" stop-opacity=".22"/><stop offset="1" stop-color="#061322" stop-opacity=".06"/></linearGradient>
  <linearGradient id="leftFade"><stop offset="0" stop-color="#030a16" stop-opacity=".84"/><stop offset=".63" stop-color="#030a16" stop-opacity=".55"/><stop offset="1" stop-color="#030a16" stop-opacity="0"/></linearGradient>
</defs>
<style>
  .brand{font:700 19px Bahnschrift,'Segoe UI',sans-serif;letter-spacing:3px;fill:#ecf4f4}
  .label,.status,.footer,.art-label{font:600 15px Bahnschrift,'Segoe UI',sans-serif;letter-spacing:2.6px;fill:${card.accent}}
  .title{font-family:Bahnschrift,'Segoe UI',sans-serif;font-weight:700;letter-spacing:-2.8px;fill:#f4f4ef}
  .copy{font:400 27px 'Segoe UI',sans-serif;fill:#d2e0e4}
  .footer{fill:#a6bfc5;letter-spacing:1.8px;font-size:16px}
  .art-label{font-size:12px;letter-spacing:2.3px}
</style>
<rect width="1200" height="630" fill="url(#background)"/>
${journey ? art(card) : `<g>${stars}</g>${art(card)}`}
${journey ? '<rect x="30" y="558" width="1140" height="42" fill="#061322" opacity=".58"/>' : ''}
<rect x="29" y="29" width="1142" height="572" rx="12" fill="none" stroke="${card.accent}" stroke-opacity=".3"/>
<path d="M56 125H1144" stroke="${card.accent}" stroke-opacity=".23"/>
<image href="${logo}" x="72" y="55" width="48" height="48"/>
<text x="137" y="83" class="brand">GALACTIC FEDERATION</text>
<text x="1134" y="83" text-anchor="end" class="label" style="font-size:13px">SOLANA  /  GFOF</text>
<text x="77" y="182" class="label">${xml(card.label)}</text>
${title}
${copy}
<rect x="76" y="507" width="${Math.min(545, 34 + card.status.length * 11.5)}" height="37" rx="5" fill="#0c2430" stroke="${card.accent}" stroke-opacity=".62"/>
<text x="94" y="532" class="status" style="font-size:14px;letter-spacing:1.5px">${xml(card.status)}</text>
<path d="M56 560H1144" stroke="${card.accent}" stroke-opacity=".22"/>
<text x="77" y="585" class="footer">galacticfederation.co</text>
<text x="1133" y="585" text-anchor="end" class="footer">FOLLOW THE EVIDENCE  /  GF-00</text>
</svg>`;
}

try {
  for (const card of cards) {
    const svgPath = join(output, `.render-${card.key}.svg`);
    const pngPath = join(output, `social-${card.key}-v1.png`);
    writeFileSync(svgPath, cardSvg(card), "utf8");
    const result = spawnSync(chrome, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
      "--force-device-scale-factor=1", "--window-size=1200,630",
      `--user-data-dir=${profile}`, `--screenshot=${pngPath}`,
      pathToFileURL(svgPath).href,
    ], { encoding: "utf8", timeout: 30000 });
    rmSync(svgPath);
    if (result.status !== 0 || !existsSync(pngPath)) {
      throw new Error(`Card rendering failed for ${card.key}: ${result.error?.message || result.stderr.slice(-300)}`);
    }
    const png = readFileSync(pngPath);
    if (png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
        png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) {
      throw new Error(`Unexpected PNG dimensions for ${card.key}`);
    }
    console.log(`${card.key}: ${Math.round(png.length / 1024)} KiB`);
  }
} finally {
  if (resolve(profile).startsWith(root + sep) && existsSync(profile)) {
    rmSync(profile, { recursive: true, force: true });
  }
}
