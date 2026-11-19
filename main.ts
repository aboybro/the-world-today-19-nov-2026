// The World Today — Thursday 19 November 2026.
// A newspaper front page drawn procedurally: masthead, dateline, three top
// stories (Shenzhen trilateral summit, GTA VI launch day, Anthropic's record
// IPO), a schematic world map with eight flashpoints, and 40 stories in
// brief — 43 stories in all, every one reported on 19 November 2026.
// Node standard library only: a hand-written 5x7 bitmap font, a small canvas
// rasteriser and a PNG encoder. No assets, no network, no randomness, so two
// runs write byte-identical output.
//
// Run it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER: [number, number, number] = [247, 241, 227];
const INK: [number, number, number] = [20, 20, 20];
const RED: [number, number, number] = [166, 28, 28];
const BLUE: [number, number, number] = [28, 78, 138];
const TEAL: [number, number, number] = [15, 107, 92];
const GREY: [number, number, number] = [107, 107, 107];
const LAND: [number, number, number] = [185, 201, 214];
const SEA: [number, number, number] = [226, 234, 238];
const WHITE: [number, number, number] = [255, 255, 255];

type RGB = [number, number, number];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPixel(i, j, c);
  }
}

function hline(x: number, y: number, w: number, c: RGB): void {
  fillRect(x, y, w, 1, c);
}

function vline(x: number, y: number, h: number, c: RGB): void {
  fillRect(x, y, 1, h, c);
}

function strokeRect(x: number, y: number, w: number, h: number, c: RGB): void {
  hline(x, y, w, c);
  hline(x, y + h - 1, w, c);
  vline(x, y, h, c);
  vline(x + w - 1, y, h, c);
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(x, y, c);
    }
  }
}

function strokeCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    setPixel(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}

// Scanline polygon fill (vertices as [x, y] pairs).
function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  let minY = H;
  let maxY = 0;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(Math.round(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) setPixel(x, y, c);
    }
  }
}

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph is 7 rows; each row is a 5-bit number, leftmost pixel highest.
// Only capitals, digits and punctuation are needed: the whole page is set
// in capitals, newspaper style.
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 6, 4, 0, 4],
  '-': [0, 0, 0, 31, 0, 0, 0],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '"': [10, 10, 0, 0, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '/': [1, 2, 2, 4, 8, 8, 16],
  '%': [25, 26, 2, 4, 8, 11, 19],
  $: [4, 15, 20, 14, 5, 30, 4],
  '&': [12, 18, 20, 8, 21, 18, 13],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '*': [0, 21, 14, 31, 14, 21, 0],
  '#': [10, 10, 31, 10, 31, 10, 10],
  '@': [14, 17, 23, 21, 22, 16, 14],
  '<': [2, 4, 8, 16, 8, 4, 2],
  '>': [8, 4, 2, 1, 2, 4, 8],
  _: [0, 0, 0, 0, 0, 0, 31],
  '[': [14, 8, 8, 8, 8, 8, 14],
  ']': [14, 2, 2, 2, 2, 2, 14],
  '^': [4, 10, 17, 0, 0, 0, 0],
  '~': [0, 0, 9, 22, 0, 0, 0],
  '•': [0, 0, 4, 14, 14, 4, 0],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  for (let ci = 0; ci < s.length; ci++) {
    const g = FONT[s[ci]];
    if (!g) continue;
    const ox = x + ci * 6 * scale;
    for (let row = 0; row < 7; row++) {
      const bits = g[row];
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          fillRect(ox + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
  }
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// Greedy word wrap to at most maxChars per line.
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur === '') {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- content
// 3 top stories + 40 briefs = 43 stories, all reported on 19 November 2026.
interface Brief {
  h: string;
  d: string;
}

const BRIEFS: Brief[] = [
  { h: 'US AND IRAN TRADE FIRE AGAIN', d: 'US HIT A MISSILE SITE ON QESHM ON 17 NOV; IRAN STRUCK BAHRAIN AND KUWAIT.' },
  { h: 'EU PLANS EUR45BN LOAN FOR UKRAINE', d: "TO BE REPAID AFTER RUSSIA PAYS REPARATIONS; IT COVERS KYIV'S BUDGET GAP." },
  { h: 'VOYAGER 1 REACHES ONE LIGHT-DAY', d: 'NASA TO CONFIRM IT ON THURSDAY, ALMOST 50 YEARS AFTER LAUNCH.' },
  { h: 'NVIDIA STOPS H-SERIES CHIPS TO CHINA', d: "ACTING CEO COLETTE KRESS SAYS PAY RISES COME EARLY AFTER HUANG'S EXIT." },
  { h: 'FED MINUTES POINT TO MORE RATE RISES', d: 'MOST OFFICIALS SEE FURTHER HIKES IF INFLATION AND JOBS DEVELOP AS EXPECTED.' },
  { h: 'LIU YUNPING MAKES HOUSE HISTORY', d: "FIRST TAIWANESE AMERICAN AND ASIAN AMERICAN AS HOUSE DEMOCRATIC CAUCUS CHAIR." },
  { h: 'FOUR NATIONS URGE AID INTO FLOODED GAZA', d: 'AUSTRALIA, CANADA, ITALY AND UK CALL ON ISRAEL TO OPEN CROSSINGS AT ONCE.' },
  { h: 'US DETAILS $12BN IN VENEZUELA OIL CASH', d: 'REPORT COMES NEARLY A YEAR AFTER US FORCES SEIZED NICOLAS MADURO.' },
  { h: 'EISENKOT TAPPED TO FORM ISRAEL GOVERNMENT', d: 'PRESIDENT HERZOG PICKS THE EX-ARMY CHIEF OVER PRIME MINISTER NETANYAHU.' },
  { h: 'ICJ TO RULE ON MYANMAR ROHINGYA CASE', d: 'LANDMARK GENOCIDE JUDGMENT EXPECTED IN THE CASE BROUGHT BY THE GAMBIA.' },
  { h: 'NORTH KOREA FIRES MISSILES AFTER DRILL', d: 'LAUNCHES FOLLOW JOINT US-SOUTH KOREA-JAPAN EXERCISES THIS WEEK.' },
  { h: 'AUSTRALIA SANCTIONS ISRAELI SETTLERS', d: 'MEASURES TARGET ORGANISATIONS OVER WEST BANK EXPANSION.' },
  { h: 'TANKER THAT SANK OFF BULGARIA WAS HIT', d: 'LPG TANKER WAS STRUCK BY PROJECTILES, AN OFFICIAL SAYS.' },
  { h: 'INDIA AND JAPAN REVIEW DEFENCE TIES', d: 'MINISTERS MEET IN TOKYO AS THE TWO COUNTRIES DEEPEN SECURITY LINKS.' },
  { h: 'PELTOLA WINS ALASKA SENATE SEAT', d: "DEMOCRAT'S WIN SECURES A 56-44 MAJORITY IN THE US SENATE." },
  { h: 'US PLANS TOUGHER GREEN-CARD RULES', d: 'LONGER HIRING PROCESS PROPOSED FOR EMPLOYMENT-BASED VISAS.' },
  { h: "CYCLONE AKVAN NEARS INDIA'S EAST COAST", d: 'STORM LIKELY TO CROSS BETWEEN MACHILIPATNAM AND PURI.' },
  { h: 'FRANCE FACES FOURTH WEEKEND OF PROTESTS', d: 'CROWDS MARCH OVER THE RISING COST OF LIVING.' },
  { h: 'SOMALIA ACCUSES UAE OF SECRET BASES', d: 'MOGADISHU SAYS ABU DHABI BUILT BASES WITHOUT FEDERAL APPROVAL.' },
  { h: 'DEUTSCHE BANK AND $582M OF EPSTEIN CASH', d: 'BANK HANDLED TRANSACTIONS FROM 2013 TO 2018, REPORTS SAY.' },
  { h: 'NSA HIT BY CLASSIFIED NETWORK OUTAGE', d: 'INTERNAL COMMS FAILURE FIRST REPORTED BY CNN, CITING SIX SOURCES.' },
  { h: 'CANADA REWORKS ITS CHINA TIES', d: 'CARNEY AIMS TO CLINCH THE RIGHT DEAL WITH THE US AS WELL.' },
  { h: 'SENATORS WARN OF AI CYBER THREAT', d: 'AI-ENABLED ATTACKS ARE OUTPACING DEFENCES, THE WHITE HOUSE IS TOLD.' },
  { h: 'MELENCHON COULD WIN IN FRANCE', d: 'JUSTICE MINISTER WARNS THE HARD-LEFT LEADER COULD TAKE THE PRESIDENCY.' },
  { h: 'SAUDI ARABIA: DANGER HAS PASSED', d: 'ALERTS LIFTED IN THREE SOUTHERN CITIES AFTER WARNINGS.' },
  { h: 'COCAINE AND MILLIONS OF PILLS SEIZED', d: 'HAUL FOUND IN EASTERN LIBYA, OFFICIALS SAY.' },
  { h: 'DUCKETT HITS 133 AS ENGLAND LEAD', d: 'THIRD ODI AGAINST AUSTRALIA IS IN A STRONG POSITION FOR THE TOURISTS.' },
  { h: 'MICROSOFT IN TALKS TO SELL AI TO BYTEDANCE', d: 'US HOUSE COMMITTEE SEEKS A BRIEFING ON THE REPORTED DEAL.' },
  { h: 'ESA CHIEF CALLS FOR SPACE LAWS', d: 'SATELLITE SURVEILLANCE RULES URGED AS ORBIT GROWS CROWDED.' },
  { h: 'CLIMBER SURVIVES 100-METRE FALL', d: 'GERMAN MOUNTAINEER, 31, LIVES AFTER A PLUNGE IN THE TYROLEAN ALPS.' },
  { h: 'WOMAN CHARGED WITH SPYING FOR RUSSIA', d: 'ILONA W. ACCUSED OF INFORMING FOR RUSSIAN INTELLIGENCE IN BERLIN.' },
  { h: 'SUSPECTS NAMED IN LEIPZIG DRONE ATTACK', d: 'GERMAN AUTHORITIES IDENTIFY ALLEGED AGENTS BEHIND THE STRIKE.' },
  { h: 'EU PAUSES LONG-TERM UK TALKS', d: 'BLOC WAITS FOR LONDON TO CLARIFY ITS POSITION ON BREXIT.' },
  { h: 'HOUSE DEMOCRATS ORDER RECORDS KEPT', d: 'TWELVE TRUMP ALLIES TOLD TO PRESERVE FILES AHEAD OF PROBES.' },
  { h: 'GUT TOXIN LINKED TO BOWEL CANCER RISE', d: 'BACTERIAL TOXIN TIED TO A SURGE IN EARLY-ONSET CASES.' },
  { h: 'MERCK LAUNCHES RABIES VACCINE FOR PETS', d: 'SELF-AMPLIFYING MRNA SHOTS ROLL OUT ACROSS THE US.' },
  { h: 'AIR INDIA CRASH PROBE NEARS END', d: "AAIB REPORT INTO AI 171 AT 'FAG END', DELHI TELLS THE COURT." },
  { h: 'BIG CARING LISTS IN KUALA LUMPUR', d: 'PHARMACY CHAIN DEBUTS ON BURSA MALAYSIA AT RM1.08 A SHARE.' },
  { h: 'GTA VI LEADS GAME AWARDS NOMINATIONS', d: 'EIGHT NODS, INCLUDING GAME OF THE YEAR, TWO DAYS BEFORE LAUNCH.' },
  { h: 'YOUTUBE RUNS 24-HOUR GTA LAUNCH STREAM', d: 'COVERAGE FROM MIDNIGHT ET AS THE GAME UNLOCKS AROUND THE WORLD.' },
];

// ---------------------------------------------------------------- layout
// Masthead.
fillRect(20, 14, 984, 4, INK);
drawTextCentered('THE WORLD TODAY', 512, 28, 8, INK);
fillRect(20, 92, 984, 2, INK);
drawTextCentered('THURSDAY 19 NOVEMBER 2026', 512, 102, 4, RED);
drawTextCentered('43 STORIES FROM EVERY CONTINENT - ONE DAY, ONE PAGE', 512, 136, 1, GREY);
fillRect(20, 150, 984, 2, INK);

// Lead story (left) + two big second stories (right).
drawText('THE SUMMIT - SHENZHEN, CHINA', 20, 164, 2, RED);
drawText('TRUMP, XI AND PUTIN', 20, 188, 4, INK);
drawText('MEET IN SHENZHEN', 20, 220, 4, INK);
const leadLines = wrap(
  'THE THREE LEADERS HOLD TRILATERAL TALKS IN SHENZHEN DURING THE APEC SUMMIT, THE FIRST MEETING OF ITS KIND.',
  56,
);
leadLines.forEach((ln, i) => drawText(ln, 20, 256 + i * 16, 2, INK));
drawText('43 STORIES INSIDE: SUMMIT, GTA VI, RECORD IPO, GULF, VOYAGER 1', 20, 312, 1, GREY);

// Right column: GTA VI box.
strokeRect(710, 160, 294, 82, RED);
drawText('GTA VI IS HERE', 722, 170, 2, RED);
wrap(
  "ROCKSTAR'S GAME LAUNCHES WORLDWIDE AT MIDNIGHT LOCAL TIME ON PS5 AND XBOX. PRE-ORDERS TOP $1.5BN.",
  45,
).forEach((ln, i) => drawText(ln, 722, 194 + i * 10, 1, INK));

// Right column: Anthropic IPO box.
strokeRect(710, 250, 294, 82, BLUE);
drawText('RECORD IPO: $83 A SHARE', 722, 260, 2, BLUE);
wrap(
  'ANTHROPIC RAISES $81.3BN, THE BIGGEST IPO EVER, PASSING SPACEX. IT STARTS TRADING ON NASDAQ AS ANT ON THURSDAY, WORTH ABOUT $1.5 TRILLION.',
  45,
).forEach((ln, i) => drawText(ln, 722, 284 + i * 10, 1, INK));

// ---------------------------------------------------------------- map
drawText('THE WORLD AT A GLANCE', 20, 344, 2, INK);
drawText('19 NOVEMBER 2026', 830, 344, 2, RED);
const mapX = 20;
const mapY = 368;
const mapW = 984;
const mapH = 112;
fillRect(mapX, mapY, mapW, mapH, SEA);
strokeRect(mapX, mapY, mapW, mapH, INK);
// lon/lat -> map pixel
function mp(lon: number, lat: number): [number, number] {
  return [
    Math.round(mapX + ((lon + 180) / 360) * mapW),
    Math.round(mapY + ((85 - lat) / 145) * mapH),
  ];
}
function polyFromLonLat(points: Array<[number, number]>): Array<[number, number]> {
  return points.map(([lo, la]) => mp(lo, la));
}
const CONTINENTS: Array<Array<[number, number]>> = [
  // North America
  [[-168, 66], [-140, 70], [-125, 72], [-110, 73], [-95, 80], [-85, 70], [-75, 62], [-60, 55], [-55, 47], [-70, 44], [-75, 35], [-80, 26], [-90, 21], [-97, 16], [-105, 20], [-115, 30], [-125, 40], [-125, 49], [-140, 60], [-165, 60]],
  // Greenland
  [[-58, 64], [-45, 60], [-30, 68], [-40, 76], [-55, 76]],
  // South America
  [[-80, 10], [-75, 5], [-60, 0], [-50, -5], [-40, -10], [-35, -20], [-40, -30], [-50, -35], [-60, -45], [-70, -55], [-73, -40], [-75, -20], [-80, -5]],
  // Africa
  [[-17, 15], [-10, 30], [0, 35], [10, 37], [20, 32], [30, 31], [35, 28], [40, 15], [48, 11], [51, 10], [45, 0], [40, -10], [35, -20], [30, -30], [20, -35], [15, -30], [12, -18], [13, -5], [9, 4], [-8, 5]],
  // Europe
  [[-10, 36], [-9, 43], [-2, 48], [0, 50], [5, 53], [8, 57], [10, 59], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [30, 70], [20, 70], [12, 70], [5, 62], [0, 58], [-5, 50]],
  // Asia
  [[30, 70], [40, 68], [60, 70], [80, 73], [100, 77], [120, 73], [140, 72], [160, 70], [178, 66], [170, 60], [160, 55], [150, 45], [140, 40], [130, 35], [127, 40], [120, 30], [110, 20], [105, 10], [100, 8], [95, 15], [90, 22], [80, 15], [75, 8], [70, 20], [60, 25], [55, 28], [48, 30], [40, 36], [35, 36], [30, 40]],
  // Australia
  [[113, -22], [114, -30], [115, -35], [124, -33], [130, -32], [137, -35], [140, -38], [147, -39], [150, -37], [153, -27], [150, -22], [146, -19], [142, -15], [137, -12], [135, -15], [130, -13], [126, -14], [122, -17], [118, -20]],
];
for (const cont of CONTINENTS) fillPoly(polyFromLonLat(cont), LAND);
// Region labels.
drawText('N. AMERICA', mp(-100, 52)[0] - 27, mp(-100, 52)[1], 1, GREY);
drawText('S. AMERICA', mp(-60, -18)[0] - 27, mp(-60, -18)[1], 1, GREY);
drawText('EUROPE', mp(15, 56)[0] - 18, mp(15, 56)[1], 1, GREY);
drawText('AFRICA', mp(20, 5)[0] - 15, mp(20, 5)[1], 1, GREY);
drawText('ASIA', mp(90, 52)[0] - 12, mp(90, 52)[1], 1, GREY);
drawText('OCEANIA', mp(135, -28)[0] - 18, mp(135, -28)[1], 1, GREY);
// Flashpoints: 1 Shenzhen, 2 Gulf, 3 Gaza, 4 Kyiv, 5 Washington, 6 London,
// 7 Canberra, 8 Brasilia.
const DOTS: Array<[number, number, string]> = [
  [114, 22, '1'],
  [56, 27, '2'],
  [34, 31, '3'],
  [30, 50, '4'],
  [-77, 39, '5'],
  [0, 51, '6'],
  [149, -35, '7'],
  [-48, -16, '8'],
];
for (const [lo, la, n] of DOTS) {
  const [x, y] = mp(lo, la);
  fillCircle(x, y, 8, RED);
  strokeCircle(x, y, 8, WHITE);
  drawText(n, x - 3, y - 3, 1, WHITE);
}
drawTextCentered(
  '1 SHENZHEN  2 GULF  3 GAZA  4 KYIV  5 WASHINGTON  6 LONDON  7 CANBERRA  8 BRASILIA',
  512,
  486,
  1,
  INK,
);

// ---------------------------------------------------------------- briefs
fillRect(20, 502, 984, 2, INK);
drawText('THE DAY IN BRIEF - 40 STORIES', 20, 510, 2, INK);
drawText('THURSDAY 19 NOVEMBER 2026', 700, 510, 2, RED);
const COLS = [20, 522];
const COLW = 482;
for (let col = 0; col < 2; col++) {
  let y = 536;
  for (let i = 0; i < 20; i++) {
    const b = BRIEFS[col * 20 + i];
    const n = String(col * 20 + i + 1).padStart(2, '0');
    const x = COLS[col];
    drawText(n, x, y, 1, RED);
    drawText(b.h, x + 18, y, 1, INK);
    drawText(b.d, x + 18, y + 11, 1, GREY);
    y += 23;
  }
}

// Footer.
fillRect(20, 1000, 984, 2, INK);
drawTextCentered('THE WORLD TODAY - THURSDAY 19 NOVEMBER 2026 - 43 STORIES - DRAWN BY MAIN.TS', 512, 1008, 1, GREY);

// ---------------------------------------------------------------- PNG out
function crc32(buf: Buffer): number {
  let table = (crc32 as unknown as { t?: Int32Array }).t;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    (crc32 as unknown as { t?: Int32Array }).t = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG());
