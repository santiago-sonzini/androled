"use client"
import { useState, useCallback, useRef, useEffect } from "react";
import { loadAlbum, openPack, checkTrivia, answerTrivia, checkCodigo } from "../actions/album";
import MagicMIntro from "@/components/juego/magic";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type Rarity = "comun" | "rara" | "epica" | "m";

interface Fig {
  id: number;
  g: string;
  nm: string;
  film: string;
  r: Rarity;
}

interface GoldCard {
  g: string;
  nm: string;
}

interface Avatar {
  g: string;
  n: string;
}

type Screen = "intro" | "album" | "done";

interface State {
  screen: Screen;
  name: string;
  avatar: Avatar | null;
  counts: Record<number, number>;
  packsLeft: string[];
  usedPacks: string[];
  guestIdx: number;
}

interface TriviaData {
  id: string;
  question: string;
  options: string[];
}

type SheetMode =
  | { type: "none" }
  | { type: "pack"; srcKey: string }
  | { type: "pack-reveal"; cards: { f: Fig; isNew: boolean }[]; srcKey: string }
  | { type: "codigo-entry" }
  | { type: "trivia"; trivia: TriviaData }
  | { type: "trade-code" }
  | { type: "trade-propose" };

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────

// La "M" en grilla de 3 columnas (ids 1,3,4,5,6,7,9):
//
//  Col:  1    2    3
//  Row1: [1]       [3]   ←  pata izq  +  pata der
//  Row2: [4]  [5]  [6]   ←  centro: V del medio
//  Row3: [7]       [9]   ←  base izq  +  base der
//
// ids 2,8,10-15 son comunes/raras/épicas normales

const FIGS: Fig[] = [
  { id: 1,  g: "🐚", nm: "Marti Sirena",    film: "La Sirenita",          r: "m"     },
  { id: 2,  g: "❄️", nm: "Marti de Hielo",  film: "Frozen",               r: "comun" },
  { id: 3,  g: "🌺", nm: "Marti Navegante", film: "Moana",                r: "m"     },
  { id: 4,  g: "🗡️", nm: "Marti Guerrera",  film: "Mulán",                r: "m"     },
  { id: 5,  g: "🪔", nm: "Marti Jazmín",    film: "Aladdín",              r: "m"     },
  { id: 6,  g: "🌹", nm: "Marti Bella",     film: "La Bella y la Bestia", r: "m"     },
  { id: 7,  g: "👠", nm: "Marti Cenicienta",film: "Cenicienta",           r: "m"     },
  { id: 8,  g: "💜", nm: "Marti Rapunzel",  film: "Enredados",            r: "comun" },
  { id: 9,  g: "🍎", nm: "Marti Blanca",    film: "Blancanieves",         r: "m"     },
  { id: 10, g: "🌿", nm: "Marti Aurora",    film: "La Bella Durmiente",   r: "comun" },
  { id: 11, g: "🍃", nm: "Marti Pocahontas",film: "Pocahontas",           r: "rara"  },
  { id: 12, g: "🏹", nm: "Marti Valiente",  film: "Brave",                r: "rara"  },
  { id: 13, g: "🐸", nm: "Marti Tiana",     film: "La Princesa y el Sapo",r: "rara"  },
  { id: 14, g: "🦋", nm: "Marti Encanto",   film: "Encanto",              r: "epica" },
  { id: 15, g: "🖤", nm: "Marti Maléfica",  film: "Maléfica",             r: "epica" },
];

const GOLD: GoldCard[] = [
  { g: "👑", nm: "Marti · El Vals" },
  { g: "🤍", nm: "Marti & Papá" },
  { g: "✨", nm: "Marti Reina" },
];

const AVATARS: Avatar[] = [
  { g: "👑", n: "Princesa" }, { g: "🧚", n: "Hada" },
  { g: "🦋", n: "Mariposa" }, { g: "🌹", n: "Rosa" },
  { g: "🐉", n: "Dragón"  }, { g: "🦢", n: "Cisne" },
  { g: "⭐", n: "Estrella"}, { g: "🏰", n: "Castillo" },
];

const GUESTS = [
  "Sofi · mesa 4", "Tomi · mesa 7", "la Tía Susana",
  "Juli · mesa 2", "Nacho · barra", "Cande · mesa 9",
];

const SRC_META: Record<string, { ic: string; t: string; d: string }> = {
  start:  { ic: "🎁", t: "Sobre de bienvenida",  d: "Tu sobre al entrar" },
  codigo: { ic: "🔢", t: "Código en pantalla",    d: "Apareció en la pantalla — ¡tipealo!" },
  trivia: { ic: "💡", t: "Trivia Disney",          d: "Ganaste la pregunta" },
  carta:  { ic: "🃏", t: "Carta escondida",        d: "Encontraste una carta NFC" },
};

// ─────────────────────────────────────────────
// CSS (injected once)
// ─────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Mulish:wght@400;500;600;700;800&display=swap');

:root {
  --bg-0:#0c0920; --bg-1:#1b1340; --bg-2:#2a1b52; --bg-3:#140d31;
  --gold-1:#f6dd99; --gold-2:#e3b85f; --gold-3:#b98a35;
  --rose:#f1a8c6; --rose-deep:#d76a98;
  --ink:#f6f0e6; --muted:#b6abd4; --muted-2:#8a7eb0;
  --line:rgba(246,221,153,.18);
  --glass:rgba(34,24,66,.55);
}
*, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  font-family: 'Mulish', sans-serif;
  background: #08060f;
  color: var(--ink);
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; overflow: hidden;
}

/* device */
.fk-device {
  position: relative; width: 100%; max-width: 430px; height: 100vh; max-height: 920px;
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(241,168,198,.16), transparent 55%),
    radial-gradient(130% 90% at 50% 115%, rgba(124,92,255,.20), transparent 60%),
    linear-gradient(180deg, var(--bg-1) 0%, var(--bg-2) 42%, var(--bg-3) 100%);
  overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 40px 120px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.04) inset;
}
@media(min-width:480px) {
  .fk-device { border-radius: 38px; height: 92vh; }
  body { padding: 18px; }
}

/* stars */
.fk-stars { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.fk-star {
  position: absolute; background: #fff; border-radius: 50%;
  animation: fk-tw 4s infinite ease-in-out;
}
@keyframes fk-tw {
  0%,100% { opacity: .12; transform: scale(.7); }
  50%      { opacity: .85; transform: scale(1); }
}

/* castle */
.fk-castle { position: absolute; bottom: 0; left: 0; right: 0; height: 230px; z-index: 0; opacity: .5; pointer-events: none; }
.fk-castle svg { width: 100%; height: 100%; display: block; }

/* scroll area */
.fk-scroll { position: relative; z-index: 2; flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
.fk-pad    { padding: 26px 22px 40px; }

/* typography */
.fk-kicker { font-family: 'Mulish'; font-weight: 700; font-size: 11px; letter-spacing: .34em; text-transform: uppercase; color: var(--gold-2); }
.fk-title  {
  font-family: 'Cormorant Garamond'; font-weight: 700; line-height: .92; margin: 6px 0 0;
  font-size: clamp(46px, 15vw, 62px);
  background: linear-gradient(180deg, #fff 0%, var(--gold-1) 45%, var(--gold-2) 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 18px rgba(227,184,95,.25));
}
.fk-serif { font-family: 'Cormorant Garamond'; }
.fk-lead  { color: var(--muted); font-size: 15px; line-height: 1.5; font-weight: 500; }

/* buttons */
.fk-btn {
  appearance: none; border: 0; cursor: pointer;
  font-family: 'Mulish'; font-weight: 800; font-size: 15px; letter-spacing: .02em;
  padding: 16px 22px; border-radius: 16px; width: 100%; color: #2a1c08;
  background: linear-gradient(180deg, var(--gold-1), var(--gold-2));
  box-shadow: 0 10px 30px rgba(227,184,95,.35), 0 1px 0 rgba(255,255,255,.6) inset;
  transition: transform .12s ease, filter .2s ease;
}
.fk-btn:active  { transform: translateY(2px) scale(.99); filter: brightness(.97); }
.fk-btn:disabled { opacity: .4; filter: grayscale(.4); cursor: not-allowed; }
.fk-btn.ghost   { background: transparent; color: var(--gold-1); box-shadow: 0 0 0 1px var(--line) inset; }
.fk-btn.rose    { background: linear-gradient(180deg, var(--rose), var(--rose-deep)); color: #3a0f23; box-shadow: 0 10px 30px rgba(215,106,152,.35); }

/* inputs */
.fk-field {
  width: 100%; background: rgba(12,9,32,.55); border: 1px solid var(--line); border-radius: 14px;
  padding: 15px 16px; color: var(--ink); font-family: 'Mulish'; font-weight: 600; font-size: 16px; outline: none;
}
.fk-field::placeholder { color: var(--muted-2); }
.fk-field:focus { border-color: var(--gold-2); box-shadow: 0 0 0 3px rgba(227,184,95,.14); }

/* avatar grid */
.fk-avatars { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-top: 14px; }
.fk-av {
  aspect-ratio: 1; border-radius: 16px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 3px;
  background: var(--glass); border: 1px solid rgba(255,255,255,.06);
  cursor: pointer; transition: .15s; font-size: 26px; position: relative;
}
.fk-av small { font-size: 9px; font-weight: 700; color: var(--muted); letter-spacing: .04em; }
.fk-av.sel { border-color: var(--gold-1); background: rgba(227,184,95,.14); transform: translateY(-2px); }
.fk-av.sel::after {
  content: "✓"; position: absolute; top: -7px; right: -7px; width: 20px; height: 20px; border-radius: 50%;
  background: linear-gradient(180deg, var(--gold-1), var(--gold-2)); color: #2a1c08; font-size: 11px; font-weight: 900;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(227,184,95,.5);
}

/* topbar */
.fk-topbar {
  position: relative; z-index: 3; display: flex; align-items: center; gap: 12px; padding: 18px 20px 14px;
  background: linear-gradient(180deg, rgba(12,9,32,.6), transparent);
}
.fk-me {
  width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
  font-size: 24px; background: rgba(227,184,95,.14); border: 1px solid var(--line); flex: 0 0 auto;
}
.fk-me-info { flex: 1; min-width: 0; }
.fk-me-info .n { font-weight: 800; font-size: 15px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fk-me-info .s { font-size: 11px; color: var(--muted); font-weight: 600; }
.fk-prog { flex: 0 0 auto; text-align: right; }
.fk-prog .big {
  font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 28px; line-height: .9;
  background: linear-gradient(180deg,#fff,var(--gold-1)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.fk-prog .lbl { font-size: 9px; letter-spacing: .18em; color: var(--muted); text-transform: uppercase; font-weight: 700; }
.fk-bar { height: 5px; border-radius: 99px; background: rgba(255,255,255,.08); margin: 0 20px; overflow: hidden; position: relative; z-index: 3; }
.fk-bar-fill { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--rose), var(--gold-1)); transition: width .6s cubic-bezier(.2,.8,.2,1); }

/* fig grid */
.fk-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 11px; margin-top: 6px; }
.fk-fig {
  position: relative; border-radius: 14px; aspect-ratio: .72; overflow: hidden;
  border: 1px solid rgba(255,255,255,.07);
  background: linear-gradient(160deg, rgba(40,28,80,.7), rgba(20,13,49,.7));
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 8px 6px;
}
.fk-fig.empty {
  background: repeating-linear-gradient(135deg, rgba(255,255,255,.025) 0 8px, transparent 8px 16px), rgba(12,9,32,.5);
  border-style: dashed; border-color: rgba(255,255,255,.1);
}
.fk-fig.empty .q { font-family: 'Cormorant Garamond'; font-size: 32px; color: var(--muted-2); font-weight: 700; }
.fk-fig .glyph   { font-size: 34px; filter: drop-shadow(0 4px 10px rgba(0,0,0,.4)); }
.fk-fig .fname   { font-family: 'Cormorant Garamond'; font-weight: 600; font-size: 14px; line-height: 1; margin-top: 7px; color: #fff; }
.fk-fig .film    { font-size: 8.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin-top: 4px; }
.fk-fig .num     { position: absolute; top: 6px; left: 7px; font-size: 9px; font-weight: 800; color: var(--muted-2); }
.fk-fig.have::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 55%, rgba(227,184,95,.10)); pointer-events: none;
}
.fk-fig .dupe-q {
  position: absolute; bottom: 6px; right: 6px;
  background: linear-gradient(180deg, var(--rose), var(--rose-deep));
  color: #3a0f23; font-size: 9px; font-weight: 900; border-radius: 8px; padding: 2px 6px;
  box-shadow: 0 4px 10px rgba(0,0,0,.3);
}
.fk-fig.flash { animation: fk-pop .5s ease; }
@keyframes fk-pop {
  0%   { transform: scale(.6); opacity: 0; }
  60%  { transform: scale(1.08); }
  100% { transform: scale(1); }
}

/* ── carta especial "M" ── */
.fk-fig.m-card {
  border: 2px solid #f1a8c6;
  box-shadow:
    0 0 0 1px #d76a98,
    0 0 12px 3px rgba(215,106,152,.55),
    inset 0 0 18px rgba(241,168,198,.08);
}
.fk-fig.m-card .fname { color: var(--rose); }
.fk-fig.m-card .m-badge {
  position: absolute; top: 6px; right: 6px;
  font-size: 8px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase;
  background: linear-gradient(135deg, var(--rose), var(--rose-deep));
  color: #3a0f23; border-radius: 6px; padding: 2px 5px;
  box-shadow: 0 2px 8px rgba(215,106,152,.5);
}
/* carta M vacía: borde rosa punteado — !important para pisar .empty */
.fk-fig.empty.m-card {
  border-style: dashed !important;
  border-color: #f1a8c6 !important;
  box-shadow: 0 0 0 1px #d76a98, 0 0 12px 3px rgba(215,106,152,.45), inset 0 0 12px rgba(241,168,198,.07) !important;
}

/* section header */
.fk-sh { display: flex; align-items: center; gap: 10px; margin: 26px 0 12px; }
.fk-sh .ln { flex: 1; height: 1px; background: var(--line); }
.fk-sh span { font-family: 'Mulish'; font-weight: 700; font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--gold-2); }

/* gold row */
.fk-gold-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 11px; }
.fk-gcard {
  aspect-ratio: .72; border-radius: 14px; position: relative; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 8px;
  background: linear-gradient(160deg, #2c2143, #191130); border: 1px solid var(--line);
  filter: grayscale(.5); opacity: .62;
}
.fk-gcard .glyph  { font-size: 30px; }
.fk-gcard .fname  { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 13px; color: var(--gold-1); margin-top: 6px; line-height: 1; }
.fk-gcard .lk     { position: absolute; top: 7px; right: 8px; font-size: 12px; opacity: .7; }

/* src cards */
.fk-src-row { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
.fk-src {
  flex: 1; background: var(--glass); border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px; padding: 14px 12px; text-align: left; cursor: pointer; transition: .15s;
}
.fk-src:active { transform: scale(.98); }
.fk-src .ic { font-size: 22px; }
.fk-src .t  { font-weight: 800; font-size: 13px; margin-top: 8px; }
.fk-src .d  { font-size: 10.5px; color: var(--muted); font-weight: 600; margin-top: 2px; line-height: 1.3; }
.fk-src.spent { opacity: .4; pointer-events: none; }

/* sheet overlay */
.fk-sheet {
  position: absolute; inset: 0; z-index: 30;
  background: rgba(8,6,15,.86); backdrop-filter: blur(8px);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 26px; text-align: center;
  opacity: 0; pointer-events: none; transition: opacity .25s;
}
.fk-sheet.on { opacity: 1; pointer-events: auto; }

/* envelope */
.fk-envelope {
  width: 170px; height: 120px; border-radius: 16px; margin: 10px auto 22px;
  position: relative; cursor: pointer;
  background: linear-gradient(180deg, var(--bg-2), var(--bg-3)); border: 1px solid var(--line);
  box-shadow: 0 18px 50px rgba(0,0,0,.5); transition: transform .2s;
}
.fk-envelope:active { transform: scale(.97); }
.fk-envelope::before {
  content: ""; position: absolute; inset: 0; border-radius: 16px;
  background: linear-gradient(135deg, transparent 40%, rgba(246,221,153,.18) 50%, transparent 60%);
}
.fk-envelope.busy { opacity: .55; pointer-events: none; }
.fk-seal {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
  width: 52px; height: 52px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--gold-1), var(--gold-3));
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; box-shadow: 0 6px 18px rgba(0,0,0,.4);
  animation: fk-beat 1.6s infinite;
}
@keyframes fk-beat {
  0%,100% { transform: translate(-50%,-50%) scale(1); }
  50%      { transform: translate(-50%,-50%) scale(1.08); }
}

/* reveal cards */
.fk-reveal { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; max-width: 340px; }
.fk-rc {
  width: 84px; border-radius: 12px; padding: 10px 6px; text-align: center;
  background: linear-gradient(160deg, rgba(40,28,80,.95), rgba(20,13,49,.95));
  border: 1px solid rgba(255,255,255,.08);
  opacity: 0; transform: translateY(14px) scale(.9);
  animation: fk-rin .42s forwards;
}
.fk-rc .g  { font-size: 30px; }
.fk-rc .nm { font-family: 'Cormorant Garamond'; font-weight: 600; font-size: 12px; color: #fff; margin-top: 5px; line-height: 1; }
.fk-rc .tag { font-size: 8px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; margin-top: 5px; }
.fk-rc.new .tag  { color: #7ee0a8; }
.fk-rc.rep .tag  { color: var(--rose); }
.fk-rc.rara  { box-shadow: 0 0 0 1px rgba(241,168,198,.5), 0 8px 22px rgba(215,106,152,.25); }
.fk-rc.epica { box-shadow: 0 0 0 1px var(--gold-1), 0 8px 26px rgba(227,184,95,.4); }
/* carta M en reveal */
.fk-rc.m { box-shadow: 0 0 0 2px #d76a98, 0 8px 22px rgba(215,106,152,.45); border-color: rgba(241,168,198,.6); }
@keyframes fk-rin { to { opacity: 1; transform: translateY(0) scale(1); } }

/* modal card */
.fk-modal-card {
  width: 100%; max-width: 330px;
  background: linear-gradient(180deg, var(--bg-2), var(--bg-3));
  border: 1px solid var(--line); border-radius: 22px; padding: 24px 20px;
  box-shadow: 0 30px 80px rgba(0,0,0,.6);
}
.fk-swap { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 18px 0; }
.fk-swap .mini {
  flex: 1; border-radius: 14px; padding: 12px 8px; text-align: center;
  background: rgba(12,9,32,.5); border: 1px solid rgba(255,255,255,.07);
}
.fk-swap .mini .g  { font-size: 30px; }
.fk-swap .mini .nm { font-family: 'Cormorant Garamond'; font-weight: 600; font-size: 12px; margin-top: 5px; color: #fff; line-height: 1; }
.fk-swap .mini .who { font-size: 9px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-top: 6px; }
.fk-swap .arrow { font-size: 22px; color: var(--gold-1); }
.fk-codebox { display: flex; gap: 10px; align-items: center; justify-content: center; margin: 8px 0 4px; }
.fk-codebox b { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 40px; letter-spacing: .18em; color: var(--gold-1); }

/* done screen */
.fk-rays {
  position: absolute; width: 600px; height: 600px; left: 50%; top: 34%;
  transform: translate(-50%,-50%); z-index: 0; border-radius: 50%;
  background: conic-gradient(from 0deg,
    rgba(246,221,153,0), rgba(246,221,153,.14), rgba(246,221,153,0) 12%,
    rgba(246,221,153,0), rgba(246,221,153,.14), rgba(246,221,153,0) 36%,
    rgba(246,221,153,0), rgba(246,221,153,.14), rgba(246,221,153,0) 62%,
    rgba(246,221,153,0), rgba(246,221,153,.14), rgba(246,221,153,0) 88%);
  animation: fk-spin 22s linear infinite;
}
@keyframes fk-spin { to { transform: translate(-50%,-50%) rotate(360deg); } }
.fk-goldcard {
  width: 210px; border-radius: 20px; padding: 22px 16px 18px; position: relative; z-index: 2; text-align: center;
  background: linear-gradient(165deg, #3a2c12, #171026);
  border: 1px solid var(--gold-1);
  box-shadow: 0 24px 70px rgba(227,184,95,.35), 0 0 0 4px rgba(246,221,153,.08);
  animation: fk-pop .6s ease;
}
.fk-goldcard .crown  { font-size: 42px; }
.fk-goldcard .nm     { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 24px; color: var(--gold-1); margin-top: 6px; line-height: 1; }
.fk-goldcard .sub    { font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin-top: 8px; }
.fk-goldcard .serial { margin-top: 14px; font-size: 11px; color: var(--gold-2); font-weight: 800; letter-spacing: .1em; }

/* toast */
.fk-toast {
  position: absolute; left: 50%; bottom: 26px;
  transform: translateX(-50%) translateY(20px);
  z-index: 40; background: rgba(12,9,32,.92); border: 1px solid var(--line);
  color: var(--ink); font-weight: 700; font-size: 13px;
  padding: 12px 18px; border-radius: 14px; opacity: 0;
  transition: .3s; pointer-events: none; max-width: 88%; text-align: center;
}
.fk-toast.on { opacity: 1; transform: translateX(-50%) translateY(0); }

/* utils */
.fk-hint     { font-size: 12px; color: var(--muted-2); font-weight: 600; line-height: 1.45; }
.fk-pill     { display: inline-flex; align-items: center; gap: 6px; background: rgba(227,184,95,.12); border: 1px solid var(--line); border-radius: 99px; padding: 6px 12px; font-size: 11px; font-weight: 800; color: var(--gold-1); letter-spacing: .04em; }
.fk-footnote { text-align: center; font-size: 10px; color: var(--muted-2); font-weight: 600; letter-spacing: .12em; text-transform: uppercase; margin-top: 30px; }
.fk-center   { text-align: center; }
.mt8  { margin-top: 8px; }
.mt14 { margin-top: 14px; }
.mt20 { margin-top: 20px; }
`;

// ─────────────────────────────────────────────
// STARFIELD
// ─────────────────────────────────────────────

function Starfield() {
  const stars = Array.from({ length: 46 }, (_, i) => ({
    key: i,
    left:  `${Math.random() * 100}%`,
    top:   `${Math.random() * 70}%`,
    size:  `${Math.random() * 2 + 1}px`,
    delay: `${Math.random() * 4}s`,
  }));

  return (
    <div className="fk-stars">
      {stars.map((s) => (
        <i
          key={s.key}
          className="fk-star"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// CASTLE
// ─────────────────────────────────────────────

function Castle() {
  return (
    <div className="fk-castle">
      <svg viewBox="0 0 430 230" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a2a66" />
            <stop offset="1" stopColor="#160f33" />
          </linearGradient>
        </defs>
        <g fill="url(#cg)">
          <rect x="40" y="150" width="60" height="80" />
          <polygon points="40,150 70,108 100,150" />
          <rect x="330" y="150" width="60" height="80" />
          <polygon points="330,150 360,108 390,150" />
          <rect x="150" y="120" width="130" height="110" />
          <rect x="178" y="70" width="34" height="160" />
          <polygon points="178,70 195,30 212,70" />
          <rect x="218" y="70" width="34" height="160" />
          <polygon points="218,70 235,30 252,70" />
          <rect x="120" y="170" width="190" height="60" />
        </g>
        <g fill="#f6dd99" opacity=".8">
          <rect x="190" y="92" width="8" height="14" rx="3" />
          <rect x="232" y="92" width="8" height="14" rx="3" />
          <rect x="60"  y="170" width="9" height="16" rx="3" />
          <rect x="361" y="170" width="9" height="16" rx="3" />
          <rect x="205" y="150" width="20" height="34" rx="9" />
        </g>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
// TOPBAR
// ─────────────────────────────────────────────

interface TopbarProps {
  name: string;
  avatar: Avatar | null;
  uniques: number;
}

function Topbar({ name, avatar, uniques }: TopbarProps) {
  return (
    <>
      <div className="fk-topbar">
        <div className="fk-me">{avatar ? avatar.g : "👑"}</div>
        <div className="fk-me-info">
          <div className="n">{name || "Invitada"}</div>
          <div className="s">{avatar ? avatar.n : ""} · Reino de Marti</div>
        </div>
        <div className="fk-prog">
          <div className="big">
            {uniques}
            <span style={{ fontSize: 16, color: "var(--muted-2)" }}>/15</span>
          </div>
          <div className="lbl">Figus</div>
        </div>
      </div>
      <div className="fk-bar">
        <i className="fk-bar-fill" style={{ width: `${(uniques / 15) * 100}%` }} />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="fk-sh">
      <span>{label}</span>
      <div className="ln" />
    </div>
  );
}

// ─────────────────────────────────────────────
// FIG CARD
// ─────────────────────────────────────────────

function FigCard({ f, qty }: { f: Fig; qty: number }) {
  const num = String(f.id).padStart(2, "0");
  const isM = f.r === "m";

  if (qty === 0) {
    return (
      <div className={`fk-fig empty${isM ? " m-card" : ""}`}>
        <span className="num">{num}</span>
        <span className="q">?</span>
        <div className="film" style={{ marginTop: 6 }}>{f.film}</div>
      </div>
    );
  }

  return (
    <div className={`fk-fig have${qty > 1 ? " flash" : ""}${isM ? " m-card" : ""}`}>
      <span className="num">{num}</span>
      {isM && <span className="m-badge">✦ M</span>}
      <span className="glyph">{f.g}</span>
      <div className="fname">{f.nm}</div>
      <div className="film">{f.film}</div>
      {qty > 1 && <span className="dupe-q">x{qty}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// INTRO SCREEN
// ─────────────────────────────────────────────

interface IntroScreenProps {
  name: string;
  avatar: Avatar | null;
  onNameChange: (v: string) => void;
  onAvatarSelect: (a: Avatar) => void;
  onEnter: () => void;
  onToast: (msg: string) => void;
}

function IntroScreen({ name, avatar, onNameChange, onAvatarSelect, onEnter, onToast }: IntroScreenProps) {
  const handleEnter = () => {
    if (!name)   { onToast("Poné tu nombre 🙂"); return; }
    if (!avatar) { onToast("Elegí un personaje ✨"); return; }
    onEnter();
  };

  return (
    <div className="fk-pad">
      <div className="fk-center">
        <div className="fk-kicker">Los XV de Marti</div>
        <h1 className="fk-title">Figus<br />del Reino</h1>
        <p className="fk-lead mt14">
          Juntá las <b style={{ color: "var(--ink)" }}>15 figuritas</b> de Marti convertida en princesa.
          Con tu sobre no alcanza: para completar el álbum vas a tener que{" "}
          <b style={{ color: "var(--rose)" }}>cambiar con la gente</b>.
        </p>
      </div>

      <div className="mt20">
        <label className="fk-hint">Tu nombre</label>
        <input
          className="fk-field mt8"
          maxLength={18}
          placeholder="¿Cómo te llamás?"
          value={name}
          onChange={(e) => onNameChange(e.target.value.trim())}
        />
      </div>

      <div className="mt20">
        <label className="fk-hint">Elegí tu personaje</label>
        <div className="fk-avatars">
          {AVATARS.map((a) => (
            <div
              key={a.n}
              className={`fk-av${avatar?.n === a.n ? " sel" : ""}`}
              onClick={() => onAvatarSelect(a)}
            >
              {a.g}
              <small>{a.n}</small>
            </div>
          ))}
        </div>
      </div>

      <button className="fk-btn mt20" onClick={handleEnter}>
        Entrar al Reino
      </button>
      <p className="fk-footnote">Tu pulsera guarda tu álbum · no hace falta instalar nada</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// ALBUM SCREEN
// ─────────────────────────────────────────────

interface AlbumScreenProps {
  counts: Record<number, number>;
  sources: string[];
  onOpenSource: (srcKey: string) => void;
  onOpenTrade: () => void;
}

function AlbumScreen({ counts, sources, onOpenSource, onOpenTrade }: AlbumScreenProps) {
  const owned    = (id: number) => (counts[id] || 0) > 0;
  const needList = FIGS.filter((f) => !owned(f.id));

  return (
    <div className="fk-pad">
      <div className="fk-grid">
        {FIGS.map((f) => (
          <FigCard key={f.id} f={f} qty={counts[f.id] || 0} />
        ))}
      </div>

      {sources.length > 0 ? (
        <>
          <SectionHeader label="Conseguir sobres" />
          <p className="fk-hint">Los sobres son contados: solo caen en momentos puntuales de la noche.</p>
          <div className="fk-src-row">
            {sources.slice(0, 2).map((k) => (
              <div key={k} className="fk-src" onClick={() => onOpenSource(k)}>
                <div className="ic">{SRC_META[k]?.ic}</div>
                <div className="t">{SRC_META[k]?.t}</div>
                <div className="d">{SRC_META[k]?.d}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <SectionHeader label={`Te faltan ${needList.length}`} />
          <div className="fk-modal-card" style={{ maxWidth: "none" }}>
            <span className="fk-pill">🔒 Estas no salen más en sobres</span>
            <p className="fk-hint mt14">
              Ya abriste todos tus sobres. Las que te faltan son las más raras —
              la única forma de cerrar el álbum es{" "}
              <b style={{ color: "var(--rose)" }}>cambiando con alguien</b>.
            </p>
            <button className="fk-btn rose mt14" onClick={onOpenTrade}>
              Cambiar figus
            </button>
          </div>
        </>
      )}

      <SectionHeader label="Doradas · el flex" />
      <div className="fk-gold-row">
        {GOLD.map((g) => (
          <div key={g.nm} className="fk-gcard">
            <span className="lk">🔒</span>
            <span className="glyph">{g.g}</span>
            <div className="fname">{g.nm}</div>
          </div>
        ))}
      </div>
      <p className="fk-footnote">Las doradas no hacen falta para ganar · son de pura suerte</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// PACK SHEET
// ─────────────────────────────────────────────

interface PackSheetProps {
  srcKey: string;
  busy: boolean;
  onOpen: () => void;
}

function PackSheet({ srcKey, busy, onOpen }: PackSheetProps) {
  return (
    <>
      <div className="fk-kicker">{srcKey === "start" ? "Tu sobre de bienvenida" : "¡Un sobre más!"}</div>
      <div className={`fk-envelope${busy ? " busy" : ""}`} onClick={onOpen}>
        <div className="fk-seal">✦</div>
      </div>
      <p className="fk-lead" style={{ maxWidth: 260 }}>
        {busy ? "Abriendo…" : "Tocá el sobre para abrirlo"}
      </p>
    </>
  );
}

// ─────────────────────────────────────────────
// CODIGO ENTRY SHEET
// ─────────────────────────────────────────────

interface CodigoEntrySheetProps {
  busy: boolean;
  onSubmit: (code: string) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

function CodigoEntrySheet({ busy, onSubmit, onClose, onToast }: CodigoEntrySheetProps) {
  const [code, setCode] = useState("");

  const handleSubmit = () => {
    if (!code.trim()) { onToast("Tipeá el código de la pantalla"); return; }
    onSubmit(code);
  };

  return (
    <div className="fk-modal-card">
      <div className="fk-kicker fk-center">Código en pantalla</div>
      <p className="fk-hint fk-center mt8">
        Cuando aparezca el código en la pantalla grande, tipealo acá para ganar un sobre.
      </p>
      <input
        className="fk-field mt14"
        maxLength={8}
        placeholder="CÓDIGO"
        style={{ textAlign: "center", letterSpacing: ".3em", textTransform: "uppercase", fontSize: 20 }}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button className="fk-btn mt14" disabled={busy} onClick={handleSubmit}>
        {busy ? "Verificando…" : "Canjear"}
      </button>
      <button className="fk-btn ghost mt8" onClick={onClose}>Cerrar</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// TRIVIA SHEET
// ─────────────────────────────────────────────

interface TriviaSheetProps {
  trivia: TriviaData;
  busy: boolean;
  onAnswer: (answerIndex: number) => void;
  onClose: () => void;
}

function TriviaSheet({ trivia, busy, onAnswer, onClose }: TriviaSheetProps) {
  return (
    <div className="fk-modal-card">
      <div className="fk-kicker fk-center">Trivia Disney</div>
      <h2
        className="fk-serif fk-center"
        style={{ margin: "10px 0 14px", fontSize: 22, color: "#fff", lineHeight: 1.2 }}
      >
        {trivia.question}
      </h2>
      {trivia.options.map((opt, i) => (
        <button key={i} className="fk-btn ghost mt8" disabled={busy} onClick={() => onAnswer(i)}>
          {opt}
        </button>
      ))}
      <button className="fk-btn ghost mt14" style={{ opacity: .6 }} onClick={onClose}>Cerrar</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// PACK REVEAL SHEET
// ─────────────────────────────────────────────

const RARITY_PARTICLE_COLORS: Record<Rarity, string[] | null> = {
  comun: null,
  rara:  ["#f1a8c6", "#d76a98", "#fce4ef"],
  epica: ["#f6dd99", "#e3b85f", "#fffbe8"],
  m:     ["#f1a8c6", "#d76a98", "#ff8fc0", "#fce4ef"],
};

interface PackRevealSheetProps {
  cards: { f: Fig; isNew: boolean }[];
  onClose: () => void;
}

function PackRevealSheet({ cards, onClose }: PackRevealSheetProps) {
  const [cur, setCur]           = useState(-1);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [busy, setBusy]         = useState(false);
  const [showCta, setShowCta]   = useState(false);
  const [kicker, setKicker]     = useState("");
  const [flashOn, setFlashOn]   = useState(false);
  const [thumbsVisible, setThumbsVisible] = useState<number[]>([]);

  const stageRef      = useRef<HTMLDivElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const activeCardRef = useRef<HTMLDivElement | null>(null);
  const particlesRef  = useRef<{
    x:number;y:number;vx:number;vy:number;r:number;alpha:number;
    color:string;rot:number;rotV:number;
  }[]>([]);
  const rafRef        = useRef<number>(0);

  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      const p = c?.parentElement;
      if (!c || !p) return;
      c.width  = p.offsetWidth;
      c.height = p.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0.02);
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy;
        p.vy += .22; p.alpha -= .024; p.rot += p.rotV;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
        ctx.restore();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Revelar la primera carta automáticamente al montar
  useEffect(() => {
    const t = setTimeout(() => handleTap(), 120);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spawn = (colors: string[]) => {
    const canvas  = canvasRef.current;
    const stage   = stageRef.current;
    if (!canvas || !stage) return;
    const sr = stage.getBoundingClientRect();
    const pr = canvas.parentElement!.getBoundingClientRect();
    const cx = sr.left - pr.left + sr.width  / 2;
    const cy = sr.top  - pr.top  + sr.height / 2;
    for (let i = 0; i < 44; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 6;
      particlesRef.current.push({
        x: cx, y: cy,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2.5,
        r: 2.5 + Math.random() * 4, alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)] ?? "#fff",
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - .5) * .2,
      });
    }
  };

  const makeCardEl = (c: { f: Fig; isNew: boolean }, idx: number): HTMLDivElement => {
    const el = document.createElement("div");
    const borderMap: Record<Rarity, string> = {
      comun: "rgba(255,255,255,.09)",
      rara:  "rgba(241,168,198,.55)",
      epica: "#f6dd99",
      m:     "#f1a8c6",
    };
    const shadowMap: Record<Rarity, string> = {
      comun: "0 14px 44px rgba(0,0,0,.55)",
      rara:  "0 0 0 1.5px rgba(241,168,198,.45),0 14px 36px rgba(215,106,152,.3)",
      epica: "0 0 0 1.5px #f6dd99,0 14px 44px rgba(227,184,95,.4)",
      m:     "0 0 0 2px #d76a98, 0 0 18px 4px rgba(215,106,152,.6), 0 14px 44px rgba(215,106,152,.35)",
    };
    const mBadge = c.f.r === "m"
      ? `<div style="margin-top:6px;font-size:8px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;
           border-radius:6px;padding:2px 8px;
           background:linear-gradient(135deg,#f1a8c6,#d76a98);
           color:#3a0f23;display:inline-block">✦ ESPECIAL M</div>`
      : "";
    Object.assign(el.style, {
      position:      "absolute",
      inset:         "0",
      borderRadius:  "14px",
      display:       "flex",
      flexDirection: "column",
      alignItems:    "center",
      justifyContent:"center",
      textAlign:     "center",
      padding:       "12px 8px",
      background:    "linear-gradient(160deg,#2c1f5a,#160f33)",
      border:        `2px solid ${borderMap[c.f.r]}`,
      boxShadow:     shadowMap[c.f.r],
      willChange:    "transform,opacity",
      transform:     "translateY(140px) rotate(-20deg) scale(.75)",
      opacity:       "0",
      transition:    "none",
    });
    el.innerHTML = `
      <span style="font-size:9px;font-weight:800;color:var(--muted-2);align-self:flex-start">${String(idx + 1).padStart(2, "0")}</span>
      <span style="font-size:60px;margin:4px 0 8px;filter:drop-shadow(0 4px 14px rgba(0,0,0,.5))">${c.f.g}</span>
      <div style="font-family:'Cormorant Garamond',serif;font-weight:700;font-size:18px;color:${c.f.r === "m" ? "#f1a8c6" : "#fff"};line-height:1.1">${c.f.nm}</div>
      <div style="font-size:9px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-top:5px">${c.f.film}</div>
      ${mBadge}
      <div style="margin-top:${c.f.r === "m" ? "6" : "10"}px;font-weight:900;font-size:9px;letter-spacing:.07em;text-transform:uppercase;border-radius:8px;padding:3px 10px;
        background:${c.isNew ? "rgba(126,224,168,.18)" : "rgba(241,168,198,.15)"};
        color:${c.isNew ? "#7ee0a8" : "var(--rose)"};
        border:1px solid ${c.isNew ? "rgba(126,224,168,.3)" : "rgba(241,168,198,.25)"}">
        ${c.isNew ? "¡NUEVA!" : "repetida"}
      </div>`;
    return el;
  };

  const EXIT_DIRS = [[0,-1],[1,-.5],[-1,-.5],[.7,-.7],[-.7,-.7]] as const;

  const handleTap = () => {
    if (busy || cur >= cards.length - 1) return;
    setBusy(true);

    const next  = cur + 1;
    const c     = cards[next];
    const stage = stageRef.current!;

    const incoming = makeCardEl(c ?? { f: FIGS[0]!, isNew: false }, next);
    stage.appendChild(incoming);

    if (activeCardRef.current) {
      const old = activeCardRef.current;
      const [dx, dy] = EXIT_DIRS[Math.floor(Math.random() * EXIT_DIRS.length)] ?? [0,0];
      Object.assign(old.style, {
        transition: "transform .38s cubic-bezier(.4,0,1,1),opacity .3s",
        transform:  `translate(${dx * 360}px,${dy * 360}px) rotate(${dx * 22}deg) scale(.55)`,
        opacity:    "0",
      });
      setTimeout(() => old.remove(), 420);
    }

    setFlashOn(true);
    setTimeout(() => setFlashOn(false), 80);

    const colors = RARITY_PARTICLE_COLORS[c?.f.r ?? "comun"];
    if (colors) spawn(colors);

    setKicker(
      c?.f.r === "epica" ? "✦ ¡Épica!" :
      c?.f.r === "m"     ? "✦ ¡Especial M!" :
      c?.f.r === "rara"  ? "★ Rara" : ""
    );

    requestAnimationFrame(() => requestAnimationFrame(() => {
      Object.assign(incoming.style, {
        transition: "transform .48s cubic-bezier(.15,.8,.25,1.1), opacity .22s",
        transform:  "translateY(0) rotate(0deg) scale(1)",
        opacity:    "1",
      });
    }));

    activeCardRef.current = incoming;
    setCur(next);

    setTimeout(() => {
      setRevealed(prev => {
        const updated = [...prev, next];
        setThumbsVisible(updated);
        updateCounter(updated.length);
        if (updated.length === cards.length) {
          setKicker("¡Conseguiste!");
          setTimeout(() => setShowCta(true), 280);
        }
        return updated;
      });
      setBusy(false);
    }, 260);
  };

  const [counterText, setCounterText] = useState("");
  const updateCounter = (n: number) => {
    if (n <= 0) { setCounterText(""); return; }
    if (n >= cards.length) { setCounterText("¡Todas reveladas! 🎉"); return; }
    setCounterText(`${n} de ${cards.length} reveladas`);
  };

  const isDone    = revealed.length >= cards.length;
  const remaining = cards.length - 1 - cur;

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 15 }}
      />

      <div style={{
        position: "absolute", inset: 0, borderRadius: "inherit",
        background: "#fff", zIndex: 20, pointerEvents: "none",
        opacity: flashOn ? .55 : 0,
        transition: flashOn ? "none" : "opacity .08s",
      }} />

      <div className="fk-kicker" style={{ minHeight: 16 }}>{kicker}</div>

      <div style={{ position: "relative", width: 158, height: 222, margin: "0 auto 18px", flexShrink: 0, opacity: cur >= 0 ? 1 : 0, transition: "opacity .2s" }}>
        {!isDone && Array.from({ length: Math.min(remaining > 0 ? remaining : cards.length - 1, 3) }).map((_, i) => {
          const depth    = i + 1;
          const maxDepth = Math.min(remaining > 0 ? remaining : cards.length - 1, 3);
          const idx      = maxDepth - depth;
          return (
            <div key={i} style={{
              position:     "absolute",
              inset:        0,
              borderRadius: "14px",
              background:   "linear-gradient(160deg,#1e1542,#100b2a)",
              border:       "1px solid rgba(255,255,255,0.06)",
              transform:    `translateY(${(idx + 1) * 5}px) translateX(${(idx % 2 === 0 ? 1 : -1) * (idx + 1) * 3}px) rotate(${(idx % 2 === 0 ? 1 : -1) * (idx + 1) * 2.5}deg) scale(${1 - (idx + 1) * 0.025})`,
              zIndex:       -(idx + 1),
              opacity:      0.55 - idx * 0.12,
            }} />
          );
        })}

        <div
          ref={stageRef}
          style={{ position: "absolute", inset: 0, cursor: isDone ? "default" : "pointer", zIndex: 1 }}
          onClick={isDone ? undefined : handleTap}
        />
      </div>

      <div style={{ display: "flex", gap: 7, alignItems: "flex-end", justifyContent: "center", minHeight: 74, marginBottom: 14 }}>
        {cards.map((c, i) => {
          const show = thumbsVisible.includes(i);
          const borderMap: Record<Rarity, string> = {
            comun: "rgba(255,255,255,.08)",
            rara:  "rgba(241,168,198,.4)",
            epica: "rgba(246,221,153,.55)",
            m:     "#d76a98",
          };
          const shadowMap: Record<Rarity, string> = {
            comun: "none",
            rara:  "none",
            epica: "none",
            m:     "0 0 8px 2px rgba(215,106,152,.5)",
          };
          return (
            <div key={i} style={{
              width: 50, height: 68, borderRadius: 10, flexShrink: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "5px 3px", textAlign: "center",
              background: "linear-gradient(160deg,rgba(40,28,80,.9),rgba(20,13,49,.9))",
              border: `${c.f.r === "m" ? "2px" : "1px"} solid ${borderMap[c.f.r]}`,
              boxShadow: shadowMap[c.f.r],
              opacity: show ? 1 : 0,
              transform: show ? "scale(1) translateY(0)" : "scale(.7) translateY(8px)",
              transition: "opacity .32s, transform .32s cubic-bezier(.2,.8,.2,1)",
            }}>
              <div style={{ fontSize: 20 }}>{c.f.g}</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: 10, color: c.f.r === "m" ? "#f1a8c6" : "#fff", marginTop: 3, lineHeight: 1.1 }}>
                {c.f.nm.split(" ").slice(1).join(" ")}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fk-hint" style={{ textAlign: "center", marginBottom: 12, minHeight: 16, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
        {counterText && (
          revealed.length < cards.length
            ? <><span style={{ color: "var(--gold-1)" }}>{revealed.length}</span> de {cards.length} reveladas</>
            : <>{counterText}</>
        )}
      </div>

      <button
        className="fk-btn"
        style={{
          maxWidth: 240,
          opacity: showCta ? 1 : 0,
          transform: showCta ? "translateY(0)" : "translateY(10px)",
          transition: "opacity .3s, transform .3s",
          pointerEvents: showCta ? "auto" : "none",
        }}
        onClick={onClose}
      >
        Ver mi álbum
      </button>
    </>
  );
}

// ─────────────────────────────────────────────
// TRADE CODE SHEET
// ─────────────────────────────────────────────

interface TradeCodeSheetProps {
  onConnect: (code: string) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

function TradeCodeSheet({ onConnect, onClose, onToast }: TradeCodeSheetProps) {
  const code = useRef(String(Math.floor(1000 + Math.random() * 9000)));
  const [input, setInput] = useState("");

  const handleConnect = () => {
    if (input.trim().length < 4) { onToast("Tipeá los 4 números"); return; }
    onConnect(input.trim());
  };

  return (
    <div className="fk-modal-card">
      <div className="fk-kicker fk-center">Cambiar figus</div>
      <p className="fk-hint fk-center mt8">
        Mostrale este código a la persona con la que querés cambiar, o tipeá el de ella. Es 1 a 1, tranqui.
      </p>
      <div className="fk-codebox"><b>{code.current}</b></div>
      <p className="fk-center fk-hint" style={{ margin: "2px 0 16px" }}>tu código</p>
      <input
        className="fk-field"
        inputMode="numeric"
        maxLength={4}
        placeholder="– – – –"
        style={{ textAlign: "center", letterSpacing: ".4em", fontSize: 22 }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <button className="fk-btn mt14" onClick={handleConnect}>Conectar</button>
      <button className="fk-btn ghost mt8" onClick={onClose}>Cerrar</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// TRADE PROPOSE SHEET
// ─────────────────────────────────────────────

interface TradeProposeSheetProps {
  counts: Record<number, number>;
  guestIdx: number;
  onAccept: (giveId: number, wantId: number) => void;
  onSkip: () => void;
  onClose: () => void;
}

function TradeProposeSheet({ counts, guestIdx, onAccept, onSkip, onClose }: TradeProposeSheetProps) {
  const owned   = (id: number) => (counts[id] || 0) > 0;
  const need    = FIGS.filter((f) => !owned(f.id));
  const dupes   = FIGS.filter((f) => (counts[f.id] || 0) > 1);

  if (!need.length) {
    return (
      <div className="fk-modal-card">
        <div className="fk-kicker fk-center">¡Ya tenés todas!</div>
        <button className="fk-btn mt20" onClick={onClose}>Cerrar</button>
      </div>
    );
  }

  const want  = need[0];
  const give  = dupes[0] || FIGS.find((f) => owned(f.id))!;
  const guest = GUESTS[guestIdx % GUESTS.length];
  const guestName = guest?.split(" · ")[0];
  const guestSub  = guest?.includes("·") ? guest.split("· ")[1] : "";

  return (
    <div className="fk-modal-card">
      <div className="fk-kicker fk-center">Conectaste con</div>
      <h2 className="fk-serif fk-center" style={{ margin: "4px 0 0", fontSize: 30, color: "#fff" }}>
        {guestName}
      </h2>
      <p className="fk-center fk-hint">{guestSub} · te propone:</p>
      <div className="fk-swap">
        <div className="mini">
          <div className="g">{give.g}</div>
          <div className="nm">{give.nm}</div>
          <div className="who">vos das</div>
        </div>
        <div className="arrow">⇄</div>
        <div className="mini">
          <div className="g">{want?.g}</div>
          <div className="nm">{want?.nm}</div>
          <div className="who">ella da</div>
        </div>
      </div>
      <button className="fk-btn rose" onClick={() => onAccept(give.id, want?.id ?? 0)}>Aceptar cambio</button>
      <button className="fk-btn ghost mt8" onClick={onSkip}>Buscar otra persona</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// DONE SCREEN
// ─────────────────────────────────────────────

interface DoneScreenProps {
  name: string;
  onReset: () => void;
}

function DoneScreen({ name, onReset }: DoneScreenProps) {
  const serial = useRef(String(Math.floor(1 + Math.random() * 200)).padStart(3, "0"));

  return (
    <div
      style={{
        position: "relative", minHeight: "78vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
      }}
    >
      <div className="fk-rays" />
      <div className="fk-kicker" style={{ position: "relative", zIndex: 2 }}>¡Completaste el reino!</div>
      <div className="fk-goldcard mt14">
        <div className="crown">👑</div>
        <div className="nm">{name}</div>
        <div className="sub">Carta dorada de Marti</div>
        <div style={{ fontSize: 30, marginTop: 10 }}>🤍</div>
        <div className="serial">N.º {serial.current} / 200</div>
      </div>
      <p className="fk-lead mt20" style={{ position: "relative", zIndex: 2, maxWidth: 280 }}>
        Sos de las pocas que lo logró. Mostrá esta pantalla en el{" "}
        <b style={{ color: "var(--gold-1)" }}>Mercadito del Reino</b> para recibir tu carta dorada de verdad,
        de mano de Marti.
      </p>
      <div className="fk-pill mt14" style={{ position: "relative", zIndex: 2 }}>
        ✦ Tu nombre va a la pantalla grande
      </div>
      <button
        className="fk-btn ghost mt20"
        style={{ position: "relative", zIndex: 2, maxWidth: 200 }}
        onClick={onReset}
      >
        Reiniciar demo
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div className={`fk-toast${visible ? " on" : ""}`}>{message}</div>
  );
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────

type AlbumData = Awaited<ReturnType<typeof loadAlbum>>

export default function Page({ params }: { params: { guestId: string } }) {
  const guestId = params.guestId;

  const [state, setState] = useState<State>({
    screen: "intro",
    name: "",
    avatar: null,
    counts: {},
    packsLeft: [],
    usedPacks: [],
    guestIdx: 0,
  });

  const [sheet, setSheet] = useState<SheetMode>({ type: "none" });
  const [toast, setToast] = useState({ msg: "", visible: false });
  const [pending, setPending] = useState(false); // bloquea doble submit en server actions
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [introPlaying, setIntroPlaying] = useState(true);
  const [albumData, setAlbumData] = useState<AlbumData | null>(null);

  useEffect(() => {
    const id = "fk-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200);
  }, []);

  // loadAlbum corre en paralelo mientras se reproduce la intro
  useEffect(() => {
    loadAlbum(guestId).then(setAlbumData);
  }, [guestId]);

  // Hidratar el estado local con los datos del server cuando llegan
  useEffect(() => {
    if (!albumData) return;
    if ("error" in albumData) {
      showToast(albumData.error ?? "Error cargando el álbum");
      return;
    }
    setState((s) => ({
      ...s,
      name: s.name || albumData.guest.name || "",
      counts: albumData.album.counts,
      packsLeft: albumData.album.packsLeft,
    }));
  }, [albumData, showToast]);

  const uniques = () => FIGS.filter((f) => (state.counts[f.id] || 0) > 0).length;

  // Fuentes visibles en el álbum: sobres pendientes en DB + fuentes canjeables
  // (codigo/trivia se ganan vía server action y todavía no se usaron en esta sesión)
  const sources = (() => {
    const out: string[] = [];
    for (const k of ["start", "codigo", "trivia", "carta"]) {
      if (state.packsLeft.includes(k)) out.push(k);
      else if ((k === "codigo" || k === "trivia") && !state.usedPacks.includes(k)) out.push(k);
    }
    return out;
  })();

  // ── ABRIR FUENTE ──────────────────────────
  // Si el sobre ya está habilitado en packsLeft → sheet del sobre.
  // Si es "codigo"/"trivia" y todavía no se ganó → flujo de canje primero.
  const handleOpenSource = (srcKey: string) => {
    if (state.packsLeft.includes(srcKey)) {
      setSheet({ type: "pack", srcKey });
      return;
    }
    if (srcKey === "codigo") { setSheet({ type: "codigo-entry" }); return; }
    if (srcKey === "trivia") { void handleStartTrivia(); return; }
  };

  // ── OPEN PACK (server) ────────────────────
  const handleOpenEnvelope = async (srcKey: string) => {
    if (pending) return;
    setPending(true);
    try {
      const res = await openPack(guestId, srcKey);
      if ("error" in res && res.error) {
        showToast(res.error);
        setSheet({ type: "none" });
        return;
      }
      if (!("drawnIds" in res)) return;
      if (!res) return;
      // Reconstruir las cartas reveladas con isNew calculado contra los counts previos
      const prev = { ...state.counts };
      const cards = res.drawnIds?.map((id) => {
        const f = FIGS.find((x) => x.id === id)!;
        const before = prev[id] || 0;
        prev[id] = before + 1;
        return { f, isNew: before === 0 };
      });

      setState((s) => ({
        ...s,
        counts: res.counts ?? { ...s.counts },
        packsLeft: res.packsLeft ?? s.packsLeft,
        usedPacks: [...s.usedPacks, srcKey],
      }));

      if (cards?.length === 0) {
        showToast("No quedan cartas disponibles 😢");
        setSheet({ type: "none" });
        return;
      }
      setSheet({ type: "pack-reveal", cards: cards ?? [], srcKey });
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  // ── CODIGO (server) ───────────────────────
  const handleSubmitCodigo = async (code: string) => {
    if (pending) return;
    setPending(true);
    try {
      const res = await checkCodigo(guestId, code);
      if (!res.valid) {
        showToast(res.error ?? "Código incorrecto");
        return;
      }
      setState((s) => ({
        ...s,
        packsLeft: s.packsLeft.includes("codigo") ? s.packsLeft : [...s.packsLeft, "codigo"],
      }));
      setSheet({ type: "pack", srcKey: "codigo" });
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  // ── TRIVIA (server) ───────────────────────
  const handleStartTrivia = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await checkTrivia(guestId);
      if (!res.available || !("trivia" in res) || !res.trivia) {
        const reason = "reason" in res ? res.reason : undefined;
        showToast(
          reason === "not_yet"      ? "La trivia todavía no empezó ⏳" :
          reason === "expired"      ? "La trivia ya terminó 😅" :
          reason === "already_used" ? "Ya jugaste esta trivia" :
          "No hay trivia activa ahora"
        );
        return;
      }
      setSheet({
        type: "trivia",
        trivia: {
          id: res.trivia.id,
          question: res.trivia.question,
          options: res.trivia.options as string[],
        },
      });
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  const handleAnswerTrivia = async (triviaId: string, answerIndex: number) => {
    if (pending) return;
    setPending(true);
    try {
      const res = await answerTrivia(guestId, triviaId, answerIndex);
      if (!res.correct) {
        showToast(res.error ?? "Respuesta incorrecta 😅");
        setSheet({ type: "none" });
        return;
      }
      setState((s) => ({
        ...s,
        packsLeft: s.packsLeft.includes("trivia") ? s.packsLeft : [...s.packsLeft, "trivia"],
      }));
      setSheet({ type: "pack", srcKey: "trivia" });
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  const handleRevealClose = () => {
    setSheet({ type: "none" });
    const u = uniques();
    if (sources.length === 0 && u < 15) {
      showToast("Te quedan huecos… ¡toca cambiar! 🔄");
    }
  };

  const handleOpenTrade   = () => setSheet({ type: "trade-code" });
  const handleConnectCode = () => setSheet({ type: "trade-propose" });

  // NOTA: el intercambio sigue siendo local — no existe server action de trade.
  const handleAcceptSwap = (giveId: number, wantId: number) => {
    setState((s) => {
      const c = { ...s.counts };
      c[giveId] = Math.max(0, (c[giveId] || 0) - 1);
      c[wantId] = (c[wantId] || 0) + 1;
      const u = FIGS.filter((f) => (c[f.id] || 0) > 0).length;
      return { ...s, counts: c, guestIdx: s.guestIdx + 1, screen: u >= 15 ? "done" : s.screen };
    });
    setSheet({ type: "none" });
    const want = FIGS.find((f) => f.id === wantId)!;
    const stillMissing = FIGS.filter((f) => {
      const newQty = f.id === wantId
        ? (state.counts[f.id] || 0) + 1
        : (state.counts[f.id] || 0);
      return newQty === 0;
    }).length;
    if (stillMissing > 0) showToast(`¡Conseguiste ${want.nm}! Te faltan ${stillMissing} 🔄`);
  };

  const handleSkipSwap = () => {
    setState((s) => ({ ...s, guestIdx: s.guestIdx + 1 }));
    setSheet({ type: "trade-propose" });
  };

  const handleEnterAlbum = () => {
    setState((s) => ({ ...s, screen: "album" }));
    if (state.packsLeft.includes("start")) {
      setTimeout(() => setSheet({ type: "pack", srcKey: "start" }), 350);
    }
  };

  const handleReset = () => {
    setState({
      screen: "intro", name: "", avatar: null,
      counts: {}, packsLeft: [], usedPacks: [], guestIdx: 0,
    });
    setSheet({ type: "none" });
    loadAlbum(guestId).then(setAlbumData);
  };

  const sheetOn = sheet.type !== "none";
  const showBar = state.screen === "album";

  if (introPlaying) {
    return <MagicMIntro onComplete={() => setIntroPlaying(false)} />;
  }

  return (
    <div className="fk-device">
      <Starfield />
      <Castle />

      {showBar && (
        <div id="bar-wrap">
          <Topbar name={state.name} avatar={state.avatar} uniques={uniques()} />
        </div>
      )}

      <div className="fk-scroll">
        {state.screen === "intro" && (
          <IntroScreen
            name={state.name}
            avatar={state.avatar}
            onNameChange={(v) => setState((s) => ({ ...s, name: v }))}
            onAvatarSelect={(a) => setState((s) => ({ ...s, avatar: a }))}
            onEnter={handleEnterAlbum}
            onToast={showToast}
          />
        )}
        {state.screen === "album" && (
          <AlbumScreen
            counts={state.counts}
            sources={sources}
            onOpenSource={handleOpenSource}
            onOpenTrade={handleOpenTrade}
          />
        )}
        {state.screen === "done" && (
          <div className="fk-pad">
            <DoneScreen name={state.name} onReset={handleReset} />
          </div>
        )}
      </div>

      <div className={`fk-sheet${sheetOn ? " on" : ""}`}>
        {sheet.type === "pack" && (
          <PackSheet
            srcKey={sheet.srcKey}
            busy={pending}
            onOpen={() => void handleOpenEnvelope(sheet.srcKey)}
          />
        )}
        {sheet.type === "pack-reveal" && (
          <PackRevealSheet cards={sheet.cards} onClose={handleRevealClose} />
        )}
        {sheet.type === "codigo-entry" && (
          <CodigoEntrySheet
            busy={pending}
            onSubmit={(code) => void handleSubmitCodigo(code)}
            onClose={() => setSheet({ type: "none" })}
            onToast={showToast}
          />
        )}
        {sheet.type === "trivia" && (
          <TriviaSheet
            trivia={sheet.trivia}
            busy={pending}
            onAnswer={(i) => void handleAnswerTrivia(sheet.trivia.id, i)}
            onClose={() => setSheet({ type: "none" })}
          />
        )}
        {sheet.type === "trade-code" && (
          <TradeCodeSheet
            onConnect={handleConnectCode}
            onClose={() => setSheet({ type: "none" })}
            onToast={showToast}
          />
        )}
        {sheet.type === "trade-propose" && (
          <TradeProposeSheet
            counts={state.counts}
            guestIdx={state.guestIdx}
            onAccept={handleAcceptSwap}
            onSkip={handleSkipSwap}
            onClose={() => setSheet({ type: "none" })}
          />
        )}
      </div>

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
}