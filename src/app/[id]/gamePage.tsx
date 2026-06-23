"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CARD_BLUR } from "./cardBlur";
import {
  loadAlbum,
  openPack,
  grantPack,
  redeemCodigo,
  saveAlbumState,
  saveGuestProfile,
} from "../actions/album";
import {
  loadReino,
  publishRequest,
  cancelRequest,
  fulfillRequest,
  connectByCode,
} from "../actions/reino";
import MagicMIntro from "@/components/juego/magic";

// ─────────────────────────────────────────────
// SUPABASE (cliente browser, singleton) — realtime como señal de
// invalidación: ante cambios en las tablas del Reino, se re-pide loadReino.
// ─────────────────────────────────────────────

let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_sb) _sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 5 } } });
  return _sb;
}

// Tablas globales del Reino (feed/doradas/premios/pedidos). FigusAlbum se
// escucha aparte, filtrado a MI fila, para no refetchear ante cada cambio
// de álbum ajeno.
const REINO_TABLES = ["FigusEvent", "FigusGold", "FigusPrize", "FigusTradeRequest"] as const;

type ReinoData = Awaited<ReturnType<typeof loadReino>>;
type ReinoFeed = ReinoData["feed"][number];
type ReinoTop = ReinoData["top"][number];
type ReinoGold = ReinoData["golds"][number];
type ReinoPrize = ReinoData["prizes"][number];
type ReinoSalonReq = ReinoData["salonRequests"][number];

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
  prize: string;
}

interface Avatar {
  g: string;
  n: string;
}

type Tab = "album" | "trade" | "prizes" | "reino" | "account";
type Screen = "intro" | "app";

interface Core {
  screen: Screen;
  tab: Tab;
  name: string;
  avatar: Avatar | null;
  selfie: string | null;
  counts: Record<number, number>;
  // packsRaw refleja packsLeft de la DB tal cual: tokens "start",
  // "codigo#5", "carta#2"… y marcas "used:start".
  packsRaw: string[];
  nroPulsera: number | null;
  mesa: number | null;
}

// Estado local del jugador (no del Reino): el sobre regalo en camino.
interface Local {
  gift: number | null;
}

type SheetMode =
  | { type: "none" }
  | { type: "pack"; token: string }
  | {
      type: "pack-reveal";
      cards: { f: Fig; isNew: boolean }[];
      token: string;
      goldWon: number | null;
      prizeNm: string | null;
    }
  | { type: "codigo-entry" }
  | { type: "ig" }
  | { type: "carta" }
  | { type: "dorada"; idx: number }
  | { type: "completion"; prizeNm: string | null }
  | { type: "pick-request" }
  | { type: "card-detail"; f: Fig; qty: number }
  | {
      type: "code-result";
      otherName: string;
      gave: { nm: string; g: string } | null;
      got: { nm: string; g: string } | null;
    };

// ─────────────────────────────────────────────
// PACK / STATE HELPERS (espejo del server)
// ─────────────────────────────────────────────

const USED_PREFIX = "used:";

function pendingPacks(raw: string[]): string[] {
  return raw.filter((k) => !k.startsWith(USED_PREFIX));
}
function usedPacks(raw: string[]): string[] {
  return raw
    .filter((k) => k.startsWith(USED_PREFIX))
    .map((k) => k.slice(USED_PREFIX.length));
}
function parseToken(token: string): { key: string; n: number } {
  const [key, raw] = token.split("#");
  const val = raw ? parseInt(raw, 10) : NaN;
  const def = PACK_DEFAULT[key ?? ""] ?? 4;
  return { key: key ?? "", n: Number.isFinite(val) && val > 0 ? val : def };
}

const PACK_DEFAULT: Record<string, number> = {
  start: 10,
  trivia: 4,
  codigo: 4,
  carta: 2,
  gift: 4,
  ig: 1,
};

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────

// 15 figus del álbum (arte real en /public/figus). Rareza según el marco
// impreso: Común ★ · Especial ★★ · Legendaria ★★★.
const FIGS: Fig[] = [
  { id: 1, g: "🍯", nm: "Marti & Pooh", film: "Winnie the Pooh", r: "comun" },
  { id: 2, g: "🍎", nm: "Marti & la Manzana", film: "Blancanieves", r: "comun" },
  { id: 3, g: "🐘", nm: "Marti & Dumbo", film: "Dumbo", r: "comun" },
  { id: 4, g: "🐶", nm: "Marti & los Dálmatas", film: "101 Dálmatas", r: "comun" },
  { id: 5, g: "🧚", nm: "Marti Bell", film: "Peter Pan", r: "comun" },
  { id: 6, g: "🐚", nm: "Marti Sirena", film: "La Sirenita", r: "rara" },
  { id: 7, g: "🌺", nm: "Marti Navegante", film: "Moana", r: "rara" },
  { id: 8, g: "🏎️", nm: "Marti en el Circuito", film: "Cars", r: "rara" },
  { id: 9, g: "🐭", nm: "Marti & Remy", film: "Ratatuille", r: "rara" },
  { id: 10, g: "🍃", nm: "Marti & los Vientos", film: "Pocahontas", r: "rara" },
  { id: 11, g: "👠", nm: "Marti a Medianoche", film: "Cenicienta", r: "rara" },
  { id: 12, g: "🪔", nm: "Marti en Agrabah", film: "Aladdín", r: "epica" },
  { id: 13, g: "🖤", nm: "Marti Maléfica", film: "Maléfica", r: "epica" },
  { id: 14, g: "💀", nm: "Marti & Dante", film: "Coco", r: "epica" },
  { id: 15, g: "🐸", nm: "Marti en el Bayou", film: "La Princesa y el Sapo", r: "epica" },
];

// Doradas (cartas 16/17/18, marco de oro ★★★★).
const GOLD: GoldCard[] = [
  { g: "💙", nm: "Marti & Stitch", prize: "Stitch Robótico" },
  { g: "🦁", nm: "Marti & Simba", prize: "LEGO Simba" },
  { g: "🏮", nm: "Marti Enredada", prize: "Funko Pop Enredadas" },
];

// Ruta del arte real de cada carta (las doradas son 16,17,18). Todas se
// precargan al entrar (ver preload en Page), así nunca hay que esperar a
// que aparezca la imagen: cuando se muestra ya está en caché.
const figImg = (id: number) => `/figus/${String(id).padStart(2, "0")}.webp`;
const ALL_CARD_IDS = Array.from({ length: 18 }, (_, i) => i + 1);

// Carta: el blur (LQIP) va como fondo del <img>, así si por algo todavía no
// cargó se ve el preview borroso al instante en vez de un hueco. Con la
// precarga, la imagen nítida ya está en caché y aparece de una.
function CardImg({ id, alt }: { id: number; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="fk-card-img"
      src={figImg(id)}
      alt={alt}
      decoding="async"
      style={{ backgroundImage: `url(${CARD_BLUR[id]})` }}
    />
  );
}

const AVATARS: Avatar[] = [
  { g: "👑", n: "Princesa" },
  { g: "🧚", n: "Hada" },
  { g: "🦋", n: "Mariposa" },
  { g: "🌹", n: "Rosa" },
  { g: "🐉", n: "Dragón" },
  { g: "🦢", n: "Cisne" },
  { g: "⭐", n: "Estrella" },
  { g: "🏰", n: "Castillo" },
];

// Fuentes de sobres (ic/título/descripción de cada tile del álbum).
const SRC_META: Record<string, { ic: string; t: string; d: string }> = {
  start: { ic: "🎁", t: "Sobre de bienvenida", d: "Tu sobre al entrar" },
  codigo: { ic: "🎤", t: "Código de entrevista", d: "+1 a +10 figus · entrevistas y sorpresas" },
  carta: { ic: "🃏", t: "Sobre escondido", d: "Buscá el sobre y canjeá su código" },
  ig: { ic: "📸", t: "Seguinos en IG", d: "@andro.show · +1 figu" },
  gift: { ic: "🎁", t: "Sobre de regalo", d: "Cae desde el Reino" },
};

const SEC_TOTAL = 10; // colgantes RGB de Marti
const INSTAGRAM_URL = "https://instagram.com/andro.show";

function fig(id: number): Fig {
  return FIGS.find((f) => f.id === id)!;
}

// Heurística simple: nombres terminados en "a" → femenino.
function inferGenero(nombre: string): "f" | "m" {
  const first = nombre.trim().toLowerCase().split(/\s+/)[0] ?? "";
  return first.endsWith("a") ? "f" : "m";
}

// Cara del invitado: la selfie si existe, si no el glyph del avatar.
function Face({
  avatar,
  selfie,
  fallback = "👑",
}: {
  avatar: Avatar | null;
  selfie: string | null;
  fallback?: string;
}) {
  if (selfie) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="fk-face-img" src={selfie} alt="" />;
  }
  return <>{avatar ? avatar.g : fallback}</>;
}

// Recorta una imagen a un cuadrado y la comprime a un data URL JPEG chico,
// todo en el dispositivo (no se sube la foto cruda).
async function selfieFromFile(file: File, size = 128): Promise<string | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
    if (bmp) {
      const m = Math.min(bmp.width, bmp.height);
      ctx.drawImage(bmp, (bmp.width - m) / 2, (bmp.height - m) / 2, m, m, 0, 0, size, size);
      return canvas.toDataURL("image/jpeg", 0.8);
    }
    // fallback para navegadores sin createImageBitmap
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const m = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
        URL.revokeObjectURL(img.src);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// CSS (injected once)
// ─────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Mulish:wght@400;500;600;700;800&display=swap');

:root {
  --bg-0:#0c0920; --bg-1:#1b1340; --bg-2:#2a1b52; --bg-3:#140d31;
  --gold-1:#f6dd99; --gold-2:#e3b85f; --gold-3:#b98a35;
  --rose:#f1a8c6; --rose-deep:#d76a98; --green:#8ce6b0;
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
  min-height: 100vh; overflow: hidden;
}

.fk-device {
  position: fixed; inset: 0; width: 100%; height: 100dvh;
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(241,168,198,.16), transparent 55%),
    radial-gradient(130% 90% at 50% 115%, rgba(124,92,255,.20), transparent 60%),
    linear-gradient(180deg, var(--bg-1) 0%, var(--bg-2) 42%, var(--bg-3) 100%);
  overflow: hidden; display: flex; flex-direction: column;
}

.fk-stars { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.fk-star { position: absolute; background: #fff; border-radius: 50%; animation: fk-tw 4s infinite ease-in-out; }
@keyframes fk-tw { 0%,100% { opacity: .12; transform: scale(.7); } 50% { opacity: .85; transform: scale(1); } }

.fk-castle { position: absolute; bottom: 0; left: 0; right: 0; height: 230px; z-index: 0; opacity: .5; pointer-events: none; }
.fk-castle svg { width: 100%; height: 100%; display: block; max-width: 560px; margin: 0 auto; }

.fk-scroll { position: relative; z-index: 2; flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
.fk-pad    { padding: 26px 22px 40px; max-width: 560px; margin: 0 auto; }
.fk-pad.app { padding-bottom: 120px; }

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
.fk-btn.sm      { padding: 11px 14px; font-size: 13px; border-radius: 12px; width: auto; }

.fk-field {
  width: 100%; background: rgba(12,9,32,.55); border: 1px solid var(--line); border-radius: 14px;
  padding: 15px 16px; color: var(--ink); font-family: 'Mulish'; font-weight: 600; font-size: 16px; outline: none;
  text-align: center;
}
.fk-field::placeholder { color: var(--muted-2); }
.fk-field:focus { border-color: var(--gold-2); box-shadow: 0 0 0 3px rgba(227,184,95,.14); }

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
.fk-avatars.dim, .fk-avhint.dim { opacity: .32; filter: grayscale(.75); transition: opacity .25s, filter .25s; }

/* selfie box */
.fk-selfiebox { display: flex; align-items: center; gap: 12px; background: var(--glass); border: 1px solid rgba(255,255,255,.06); border-radius: 16px; padding: 12px; cursor: pointer; transition: .15s; position: relative; margin-top: 8px; text-align: left; }
.fk-selfiebox.sel { border-color: var(--gold-1); background: rgba(227,184,95,.14); }
.fk-selfiebox.sel::after { content: "✓"; position: absolute; top: -7px; right: -7px; width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(180deg, var(--gold-1), var(--gold-2)); color: #2a1c08; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(227,184,95,.5); }
.fk-selfiebox .ph { width: 52px; height: 52px; border-radius: 50%; flex: 0 0 auto; overflow: hidden; background: rgba(227,184,95,.13); display: flex; align-items: center; justify-content: center; font-size: 24px; }
.fk-selfiebox .ph img { width: 100%; height: 100%; object-fit: cover; }
.fk-selfiebox .tx .t { font-weight: 800; font-size: 14px; }
.fk-selfiebox .tx .d { font-size: 11px; color: var(--muted); font-weight: 600; margin-top: 2px; }
/* foto en avatares (header, cuenta, ticket) */
.fk-face-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.fk-me { overflow: hidden; }

/* topbar */
.fk-topbar { position: relative; z-index: 3; display: flex; align-items: center; gap: 12px; padding: 18px 20px 14px; max-width: 560px; margin: 0 auto; width: 100%; }
.fk-topbar-bg { position: relative; z-index: 3; background: linear-gradient(180deg, rgba(12,9,32,.6), transparent); }
.fk-me { width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; background: rgba(227,184,95,.14); border: 1px solid var(--line); flex: 0 0 auto; }
.fk-me-info { flex: 1; min-width: 0; }
.fk-me-info .n { font-weight: 800; font-size: 15px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fk-me-info .s { font-size: 11px; color: var(--muted); font-weight: 600; }
.fk-prog { flex: 0 0 auto; text-align: right; }
.fk-prog .big { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 28px; line-height: .9; background: linear-gradient(180deg,#fff,var(--gold-1)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.fk-prog .lbl { font-size: 9px; letter-spacing: .18em; color: var(--muted); text-transform: uppercase; font-weight: 700; }
.fk-bar { height: 5px; border-radius: 99px; background: rgba(255,255,255,.08); margin: 0 auto; width: calc(100% - 40px); max-width: 520px; overflow: hidden; position: relative; z-index: 3; }
.fk-bar-fill { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--rose), var(--gold-1)); transition: width .6s cubic-bezier(.2,.8,.2,1); }

/* fig grid */
.fk-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 11px; margin-top: 6px; }
.fk-fig { position: relative; border-radius: 14px; aspect-ratio: .74; overflow: hidden; border: 1px solid rgba(255,255,255,.07); background: linear-gradient(160deg, rgba(40,28,80,.7), rgba(20,13,49,.7)); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8px 6px; }
.fk-fig.empty { background: repeating-linear-gradient(135deg, rgba(255,255,255,.025) 0 8px, transparent 8px 16px), rgba(12,9,32,.5); border-style: dashed; border-color: rgba(255,255,255,.1); }
.fk-fig.empty .q { font-family: 'Cormorant Garamond'; font-size: 32px; color: var(--muted-2); font-weight: 700; }
.fk-fig .glyph   { font-size: 34px; filter: drop-shadow(0 4px 10px rgba(0,0,0,.4)); }
.fk-fig .fname   { font-family: 'Cormorant Garamond'; font-weight: 600; font-size: 14px; line-height: 1; margin-top: 7px; color: #fff; }
.fk-fig .film    { font-size: 8.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin-top: 4px; }
.fk-fig .num     { position: absolute; top: 6px; left: 7px; font-size: 9px; font-weight: 800; color: var(--muted-2); }
.fk-fig.have::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, rgba(227,184,95,.10)); pointer-events: none; }
.fk-fig.art { padding: 0; border: 0; background: #0b0820; }
.fk-fig.art::after { display: none; }
.fk-card-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background-size: cover; background-position: center; }
.fk-fig .dupe-q { position: absolute; bottom: 6px; right: 6px; background: linear-gradient(180deg, var(--rose), var(--rose-deep)); color: #3a0f23; font-size: 9px; font-weight: 900; border-radius: 8px; padding: 2px 6px; box-shadow: 0 4px 10px rgba(0,0,0,.3); z-index: 2; }
.fk-fig.flash { animation: fk-pop .5s ease; }
@keyframes fk-pop { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
.fk-fig.m-card { border: 2px solid #f1a8c6; box-shadow: 0 0 0 1px #d76a98, 0 0 12px 3px rgba(215,106,152,.55), inset 0 0 18px rgba(241,168,198,.08); }
.fk-fig.m-card .fname { color: var(--rose); }
.fk-fig.m-card .m-badge { position: absolute; top: 6px; right: 6px; font-size: 8px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; background: linear-gradient(135deg, var(--rose), var(--rose-deep)); color: #3a0f23; border-radius: 6px; padding: 2px 5px; box-shadow: 0 2px 8px rgba(215,106,152,.5); }
.fk-fig.empty.m-card { border-style: dashed !important; border-color: #f1a8c6 !important; box-shadow: 0 0 0 1px #d76a98, 0 0 12px 3px rgba(215,106,152,.45), inset 0 0 12px rgba(241,168,198,.07) !important; }

.fk-sh { display: flex; align-items: center; gap: 10px; margin: 26px 0 12px; }
.fk-sh .ln { flex: 1; height: 1px; background: var(--line); }
.fk-sh span { font-family: 'Mulish'; font-weight: 700; font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--gold-2); }

/* gold row */
.fk-gold-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 11px; }
.fk-gcard { aspect-ratio: .74; border-radius: 14px; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8px; background: linear-gradient(160deg, #2c2143, #191130); border: 1px solid var(--line); }
.fk-gcard.locked { filter: grayscale(.5); opacity: .62; }
.fk-gcard.won { background: linear-gradient(160deg, #3a2c12, #191130); border-color: var(--gold-1); box-shadow: 0 0 22px rgba(227,184,95,.28); }
.fk-gcard.art { padding: 0; border: 0; background: #0b0820; box-shadow: 0 0 22px rgba(227,184,95,.35); }
.fk-gcard .glyph  { font-size: 30px; }
.fk-gcard .fname  { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 13px; color: var(--gold-1); margin-top: 6px; line-height: 1; }
.fk-gcard .lk     { position: absolute; top: 7px; right: 8px; font-size: 12px; opacity: .7; }

/* src cards */
.fk-src-row { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
.fk-src { flex: 1 1 calc(50% - 5px); min-width: calc(50% - 5px); background: var(--glass); border: 1px solid rgba(255,255,255,.07); border-radius: 16px; padding: 14px 12px; text-align: center; cursor: pointer; transition: .15s; position: relative; }
.fk-src:active { transform: scale(.98); }
.fk-src .ic { font-size: 22px; }
.fk-src .t  { font-weight: 800; font-size: 13px; margin-top: 8px; }
.fk-src .d  { font-size: 10.5px; color: var(--muted); font-weight: 600; margin-top: 2px; line-height: 1.3; }
.fk-src.ready { border-color: rgba(246,221,153,.5); background: rgba(227,184,95,.12); }
.fk-src.spent { opacity: .4; pointer-events: none; }
.fk-src.spent::after { content: "✓ usado"; position: absolute; top: 9px; right: 10px; font-size: 9px; font-weight: 900; letter-spacing: .06em; color: var(--green); text-transform: uppercase; }

/* sheet overlay */
.fk-sheet { position: absolute; inset: 0; z-index: 30; background: rgba(8,6,15,.86); backdrop-filter: blur(8px); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 26px; text-align: center; overflow-y: auto; opacity: 0; pointer-events: none; transition: opacity .25s; }
.fk-sheet.on { opacity: 1; pointer-events: auto; }
.fk-sheet > * { flex-shrink: 0; }

/* envelope */
.fk-envelope { width: 170px; height: 120px; border-radius: 16px; margin: 10px auto 22px; position: relative; cursor: pointer; background: linear-gradient(180deg, var(--bg-2), var(--bg-3)); border: 1px solid var(--line); box-shadow: 0 18px 50px rgba(0,0,0,.5); transition: transform .2s; }
.fk-envelope:active { transform: scale(.97); }
.fk-envelope::before { content: ""; position: absolute; inset: 0; border-radius: 16px; background: linear-gradient(135deg, transparent 40%, rgba(246,221,153,.18) 50%, transparent 60%); }
.fk-envelope.busy { opacity: .55; pointer-events: none; }
.fk-seal { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 52px; height: 52px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, var(--gold-1), var(--gold-3)); display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 6px 18px rgba(0,0,0,.4); animation: fk-beat 1.6s infinite; }
@keyframes fk-beat { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.08); } }

/* reveal cards */
.fk-rc .g  { font-size: 30px; }
.fk-rc .nm { font-family: 'Cormorant Garamond'; font-weight: 600; font-size: 12px; color: #fff; margin-top: 5px; line-height: 1; }

/* modal card */
.fk-modal-card { width: 100%; max-width: 330px; background: linear-gradient(180deg, var(--bg-2), var(--bg-3)); border: 1px solid var(--line); border-radius: 22px; padding: 24px 20px; box-shadow: 0 30px 80px rgba(0,0,0,.6); text-align: center; }
.fk-swap { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 18px 0; }
.fk-swap .mini { flex: 1; border-radius: 14px; padding: 12px 8px; text-align: center; background: rgba(12,9,32,.5); border: 1px solid rgba(255,255,255,.07); }
.fk-swap .mini .g  { font-size: 30px; }
.fk-swap .mini .nm { font-family: 'Cormorant Garamond'; font-weight: 600; font-size: 12px; margin-top: 5px; color: #fff; line-height: 1; }
.fk-swap .mini .who { font-size: 9px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-top: 6px; }
.fk-swap .arrow { font-size: 22px; color: var(--gold-1); }
.fk-codebox { display: flex; gap: 10px; align-items: center; justify-content: center; margin: 8px 0 4px; }
.fk-codebox b { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 40px; letter-spacing: .18em; color: var(--gold-1); }

/* opts (pick request) */
.fk-opts { display: grid; grid-template-columns: 1fr; gap: 9px; margin-top: 14px; max-height: 46vh; overflow-y: auto; }
.fk-opt { background: rgba(12,9,32,.55); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 13px; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 11px; cursor: pointer; color: var(--ink); text-align: left; }
.fk-opt .k { width: 30px; height: 30px; border-radius: 9px; background: rgba(246,221,153,.14); display: flex; align-items: center; justify-content: center; font-size: 18px; flex: 0 0 auto; }
.fk-opt small { margin-left: auto; font-size: 9px; color: var(--muted-2); font-weight: 800; text-transform: uppercase; }

/* done / rays / ticket */
.fk-rays { position: absolute; width: 600px; height: 600px; left: 50%; top: 34%; transform: translate(-50%,-50%); z-index: 0; border-radius: 50%; background: conic-gradient(from 0deg, rgba(246,221,153,0), rgba(246,221,153,.14), rgba(246,221,153,0) 12%, rgba(246,221,153,0), rgba(246,221,153,.14), rgba(246,221,153,0) 36%, rgba(246,221,153,0), rgba(246,221,153,.14), rgba(246,221,153,0) 62%, rgba(246,221,153,0), rgba(246,221,153,.14), rgba(246,221,153,0) 88%); animation: fk-spin 22s linear infinite; }
@keyframes fk-spin { to { transform: translate(-50%,-50%) rotate(360deg); } }
.fk-ticket { width: 225px; border-radius: 20px; padding: 22px 16px 18px; position: relative; z-index: 2; text-align: center; background: linear-gradient(165deg, #3a2c12, #171026); border: 1px solid var(--gold-1); box-shadow: 0 24px 70px rgba(227,184,95,.35), 0 0 0 4px rgba(246,221,153,.08); animation: fk-pop .6s ease; margin: 14px auto 0; }
.fk-gold-reveal { width: min(58vw, 220px); aspect-ratio: .75; margin: 14px auto 0; position: relative; z-index: 2; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 70px rgba(227,184,95,.5), 0 0 0 3px rgba(246,221,153,.2); animation: fk-pop .6s ease; }
.fk-gold-reveal img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fk-ticket .crown  { font-size: 42px; }
.fk-ticket .nm     { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 24px; color: var(--gold-1); margin-top: 6px; line-height: 1; }
.fk-ticket .sub    { font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin-top: 8px; }
.fk-ticket .ser    { margin-top: 14px; font-size: 11px; color: var(--gold-2); font-weight: 800; letter-spacing: .1em; }

/* toast */
.fk-toast { position: absolute; left: 50%; bottom: 92px; transform: translateX(-50%) translateY(20px); z-index: 40; background: rgba(12,9,32,.92); border: 1px solid var(--line); color: var(--ink); font-weight: 700; font-size: 13px; padding: 12px 18px; border-radius: 14px; opacity: 0; transition: .3s; pointer-events: none; max-width: 88%; text-align: center; }
.fk-toast.on { opacity: 1; transform: translateX(-50%) translateY(0); }

/* utils */
.fk-hint     { font-size: 12px; color: var(--muted-2); font-weight: 600; line-height: 1.45; }
.fk-pill     { display: inline-flex; align-items: center; gap: 6px; background: rgba(227,184,95,.12); border: 1px solid var(--line); border-radius: 99px; padding: 6px 12px; font-size: 11px; font-weight: 800; color: var(--gold-1); letter-spacing: .04em; }
.fk-footnote { text-align: center; font-size: 10px; color: var(--muted-2); font-weight: 600; letter-spacing: .12em; text-transform: uppercase; margin-top: 30px; }
.fk-center   { text-align: center; }
.mt8  { margin-top: 8px; }
.mt14 { margin-top: 14px; }
.mt20 { margin-top: 20px; }

/* ── bottom nav ── */
.fk-nav { position: absolute; left: 0; right: 0; bottom: 0; z-index: 8; display: flex; gap: 6px; padding: 10px 14px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, transparent, rgba(8,6,15,.9) 34%); backdrop-filter: blur(10px); max-width: 560px; margin: 0 auto; }
.fk-nav button { flex: 1; appearance: none; border: 0; background: transparent; cursor: pointer; color: var(--muted-2); font-family: 'Mulish'; font-weight: 800; font-size: 9.5px; letter-spacing: .03em; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 2px; border-radius: 14px; position: relative; transition: color .2s, background .2s; }
.fk-nav button .ic { font-size: 21px; line-height: 1; filter: grayscale(.5); transition: filter .2s, transform .2s; }
.fk-nav button.act { color: var(--gold-1); background: rgba(227,184,95,.1); }
.fk-nav button.act .ic { filter: none; transform: translateY(-1px); }
.fk-nav button.gold { color: var(--gold-2); }
.fk-nav button.gold.act { color: var(--gold-1); background: rgba(227,184,95,.16); }
.fk-nav .dot { position: absolute; top: 4px; right: calc(50% - 20px); min-width: 17px; height: 17px; border-radius: 9px; padding: 0 4px; background: linear-gradient(180deg, var(--rose), var(--rose-deep)); color: #3a0f23; font-size: 10px; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,.35); }

/* ── cards / sections ── */
.fk-card { background: var(--glass); border: 1px solid rgba(255,255,255,.07); border-radius: 18px; padding: 16px; }
.fk-wall { border: 1px solid rgba(241,168,198,.3); border-radius: 18px; padding: 18px 16px; background: linear-gradient(165deg, rgba(215,106,152,.12), rgba(34,24,66,.4)); text-align: center; }

/* ── req rows (trade / prizes) ── */
.fk-req { display: flex; align-items: center; gap: 11px; padding: 12px 13px; border-radius: 14px; margin-top: 9px; background: rgba(12,9,32,.5); border: 1px solid rgba(255,255,255,.06); }
.fk-req .fg { width: 42px; height: 42px; border-radius: 12px; background: rgba(241,168,198,.12); border: 1px solid rgba(241,168,198,.25); display: flex; align-items: center; justify-content: center; font-size: 21px; flex: 0 0 auto; }
.fk-req .tx { flex: 1; min-width: 0; }
.fk-req .tx .a { font-size: 13.5px; font-weight: 700; line-height: 1.25; }
.fk-req .tx .a b { color: var(--gold-1); }
.fk-req .tx .b { font-size: 10.5px; color: var(--muted-2); font-weight: 700; margin-top: 2px; }
.fk-req.mine { border-color: rgba(241,168,198,.35); background: linear-gradient(90deg, rgba(241,168,198,.12), rgba(34,24,66,.3)); }
.fk-req.given { opacity: .4; filter: grayscale(.8); }
.fk-req .chk { color: var(--green); font-weight: 900; font-size: 16px; flex: 0 0 auto; }
.fk-codebig { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 42px; letter-spacing: .2em; color: var(--gold-1); text-align: center; }

/* ── feed ── */
.fk-feed .ev { display: flex; align-items: flex-start; gap: 10px; padding: 11px 13px; margin-bottom: 9px; border-radius: 13px; background: rgba(34,24,66,.45); border: 1px solid rgba(255,255,255,.05); font-size: 13.5px; font-weight: 600; line-height: 1.35; animation: fk-slin .5s cubic-bezier(.2,.8,.2,1); }
.fk-feed .ev.mine { border-color: rgba(246,221,153,.28); background: rgba(227,184,95,.08); }
.fk-feed .ev .ic { font-size: 16px; flex: 0 0 auto; line-height: 1.3; }
.fk-feed .ev b { color: #fff; font-weight: 800; }
.fk-feed .ev .g { color: var(--gold-1); font-weight: 800; }
.fk-feed .ev .r { color: var(--rose); font-weight: 800; }
.fk-feed .ev .t { display: block; font-size: 9.5px; color: var(--muted-2); font-weight: 800; letter-spacing: .08em; margin-top: 4px; text-transform: uppercase; }
@keyframes fk-slin { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

/* ── top 8 ── */
.fk-lb { display: flex; align-items: center; gap: 10px; padding: 11px 12px 9px; border-radius: 12px; margin-top: 8px; background: rgba(12,9,32,.5); border: 1px solid rgba(255,255,255,.06); flex-wrap: wrap; }
.fk-lb .rk { width: 23px; height: 23px; border-radius: 7px; background: rgba(246,221,153,.13); color: var(--gold-1); flex: 0 0 auto; font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; }
.fk-lb .lnm { font-weight: 800; font-size: 13px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fk-lb .ct { font-size: 12px; font-weight: 800; color: var(--muted); }
.fk-lb .bar { flex-basis: 100%; height: 4px; border-radius: 2px; background: rgba(255,255,255,.08); overflow: hidden; }
.fk-lb .bar i { display: block; height: 100%; border-radius: 2px; transition: width .6s ease; background: linear-gradient(90deg, var(--rose), var(--gold-1)); }
.fk-lb.me { border-color: rgba(246,221,153,.42); background: rgba(227,184,95,.09); }
.fk-lb.done { border-color: rgba(140,230,176,.55); background: rgba(140,230,176,.09); }
.fk-lb.done .rk { background: rgba(140,230,176,.16); color: var(--green); }
.fk-lb.done .won { font-size: 11px; font-weight: 900; color: var(--green); text-align: right; }
.fk-lb.done .bar i { background: var(--green); }

/* ── gift bar ── */
.fk-giftbar { position: absolute; left: 50%; bottom: 140px; transform: translateX(-50%); z-index: 20; background: linear-gradient(180deg, var(--gold-1), var(--gold-2)); color: #2a1c08; font-weight: 800; font-size: 12.5px; padding: 11px 18px; border-radius: 99px; box-shadow: 0 10px 30px rgba(227,184,95,.45), inset 0 1px 0 rgba(255,255,255,.55); cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.fk-giftbar.ready { animation: fk-giftbeat 1.2s infinite; }
@keyframes fk-giftbeat { 0%,100% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.07); } }

/* ── reveal de a una: carta grande con flip (estilo martireino) ── */
.fk-stage { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; }
.fk-stage .count { font-size: 11px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; color: var(--muted); }
.fk-stage .dots { display: flex; gap: 6px; }
.fk-stage .dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.16); transition: background .3s, transform .3s; }
.fk-stage .dots i.done { background: var(--gold-2); }
.fk-stage .dots i.cur { background: var(--gold-1); transform: scale(1.35); }
.fk-stage .next { min-height: 48px; display: flex; align-items: center; }
.fk-stage .nexthint { font-size: 12px; color: var(--muted-2); font-weight: 700; animation: fk-beat2 1.6s infinite; }
@keyframes fk-beat2 { 0%,100% { opacity: .5; } 50% { opacity: 1; } }

.fk-bigcard { width: min(62vw, 240px); aspect-ratio: .75; perspective: 900px; cursor: pointer; animation: fk-cardenter .45s cubic-bezier(.2,.9,.3,1.2); }
@keyframes fk-cardenter { from { opacity: 0; transform: translateY(36px) scale(.85); } to { opacity: 1; transform: translateY(0) scale(1); } }
.fk-bigcard .in { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .65s cubic-bezier(.3,.9,.3,1); will-change: transform; }
.fk-bigcard.go .in { transform: rotateY(180deg); }
.fk-bcface { position: absolute; inset: 0; border-radius: 18px; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden; }
.fk-bcface.fr { display: flex; align-items: center; justify-content: center; background: repeating-linear-gradient(45deg, rgba(213,13,162,.10) 0 9px, transparent 9px 18px), linear-gradient(165deg, #241a4d, #140d31); border: 1px solid rgba(255,255,255,.12); }
.fk-bcface.fr .mono { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 60px; background: linear-gradient(115deg, #f1a8c6, #f6dd99); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 18px rgba(241,168,198,.5)); }
.fk-bcface.bk { transform: rotateY(180deg); padding: 7px; background: linear-gradient(160deg,#f3ead6,#d4bd8a 30%,#faf4e6 52%,#c4a96f 75%,#efe5cd); }
.fk-bigcard.r-rara .fk-bcface.bk { background: linear-gradient(160deg,#e3f0e8,#b9c8d6 28%,#efe8f6 50%,#a9bfb4 72%,#dcd2ea); }
.fk-bigcard.r-m .fk-bcface.bk { background: linear-gradient(160deg,#f7d9e9,#d76a98 30%,#fbe6f0 52%,#c45b86 75%,#f3c9de); }
.fk-bigcard.r-epica .fk-bcface.bk { background: linear-gradient(160deg,#7a52b0,#caa64a 22%,#46286f 45%,#e3c878 62%,#33205c 85%,#8a5fc4); }
.fk-bcface.bk.art { padding: 0; background: #0b0820; }
.fk-bc-img { width: 100%; height: 100%; object-fit: cover; border-radius: 18px; }
.fk-bc-in { position: relative; width: 100%; height: 100%; border-radius: 13px; overflow: hidden; display: flex; flex-direction: column; background: linear-gradient(170deg,#f6f1e4,#e9dfc8); }
.fk-bigcard.r-rara .fk-bc-in { background: linear-gradient(170deg,#f2f6f0,#e0e8e4); }
.fk-bigcard.r-m .fk-bc-in { background: linear-gradient(170deg,#fbeef4,#f0dce6); }
.fk-bigcard.r-epica .fk-bc-in { background: linear-gradient(170deg,#f1ecf6,#dcd1e8); }
.fk-bc-art { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; background: radial-gradient(circle at 50% 40%, rgba(227,184,95,.28), transparent 70%); }
.fk-bigcard.r-rara .fk-bc-art { background: radial-gradient(circle at 50% 40%, rgba(150,200,175,.32), transparent 70%); }
.fk-bigcard.r-m .fk-bc-art { background: radial-gradient(circle at 50% 40%, rgba(215,106,152,.35), transparent 70%); }
.fk-bigcard.r-epica .fk-bc-art { background: radial-gradient(circle at 50% 40%, rgba(150,100,200,.3), transparent 70%); }
.fk-bc-art .glyph { font-size: 84px; filter: drop-shadow(0 8px 18px rgba(60,40,20,.35)); }
.fk-bc-art .film { position: absolute; bottom: 10px; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #6a5a3a; }
.fk-bc-no { position: absolute; top: 9px; left: 9px; width: 34px; height: 34px; border-radius: 50%; z-index: 2; background: #f3eee2; border: 2px solid rgba(29,42,74,.35); color: #1d2a4a; font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 19px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 9px rgba(0,0,0,.35); }
.fk-bc-rar { position: absolute; top: 9px; right: 9px; min-width: 46px; height: 46px; border-radius: 50%; z-index: 2; padding: 0 5px; background: #f3eee2; border: 2px solid rgba(29,42,74,.3); box-shadow: 0 3px 9px rgba(0,0,0,.3); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
.fk-bc-rar b { font-size: 6.5px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #1d2a4a; line-height: 1; }
.fk-bc-rar span { font-size: 8.5px; letter-spacing: 1.5px; color: #41597a; line-height: 1; }
.fk-bigcard.r-epica .fk-bc-rar { background: #3a2566; border-color: rgba(227,184,95,.6); }
.fk-bigcard.r-epica .fk-bc-rar b { color: var(--gold-1); }
.fk-bigcard.r-epica .fk-bc-rar span { color: var(--gold-2); }
.fk-bc-plate { margin: 0 9px 10px; background: linear-gradient(180deg,#faf7ee,#e8e2d2); border-radius: 11px; padding: 9px 8px 8px; text-align: center; box-shadow: inset 0 1px 0 #fff, 0 3px 10px rgba(0,0,0,.3); position: relative; z-index: 2; }
.fk-bc-plate .nm { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 19px; line-height: 1; color: #1d2a4a; letter-spacing: .02em; text-transform: uppercase; }
.fk-bc-plate .fm { font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #41597a; margin-top: 4px; }
.fk-bigcard .tagwrap { position: absolute; left: 50%; top: -13px; transform: translateX(-50%) scale(0); z-index: 3; transition: transform .3s cubic-bezier(.3,1.4,.5,1); }
.fk-bigcard.go .tagwrap { transform: translateX(-50%) scale(1); transition-delay: .5s; }
.fk-tag { display: inline-block; padding: 5px 13px; border-radius: 99px; font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; box-shadow: 0 6px 16px rgba(0,0,0,.4); }
.fk-tag.new { background: linear-gradient(180deg,#a9f5c9,#5ecf91); color: #0c3a22; }
.fk-tag.rep { background: linear-gradient(180deg, var(--rose), var(--rose-deep)); color: #3a0f23; }
.fk-bcface.bk::after { content: ""; position: absolute; inset: -40%; z-index: 4; pointer-events: none; opacity: 0; background: linear-gradient(115deg, transparent 42%, rgba(255,255,255,.5) 50%, transparent 58%); transform: translateX(-70%); }
.fk-bigcard.go .fk-bcface.bk::after { animation: fk-shine 1s ease .55s 1; }
@keyframes fk-shine { 0% { opacity: 1; transform: translateX(-70%); } 100% { opacity: 0; transform: translateX(70%); } }
.fk-bigcard.r-epica.go { animation: fk-halo 1.4s ease .6s 1; }
@keyframes fk-halo { 0%,100% { filter: drop-shadow(0 0 0 rgba(246,221,153,0)); } 40% { filter: drop-shadow(0 0 34px rgba(246,221,153,.75)); } }

/* resumen del sobre: mini flips */
.fk-reveal { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; max-width: 344px; }
.fk-flip { width: 84px; aspect-ratio: .74; perspective: 600px; opacity: 0; transform: translateY(14px); animation: fk-rin .4s forwards; }
@keyframes fk-rin { to { opacity: 1; transform: translateY(0); } }
.fk-flip .inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .55s cubic-bezier(.3,.9,.3,1); }
.fk-flip.go .inner { transform: rotateY(180deg); }
.fk-face { position: absolute; inset: 0; border-radius: 12px; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 5px; border: 1px solid rgba(255,255,255,.09); }
.fk-face.fr { background: repeating-linear-gradient(45deg, rgba(246,221,153,.07) 0 7px, transparent 7px 14px), linear-gradient(165deg,#241a4d,#140d31); }
.fk-face.fr .mono { font-family: 'Cormorant Garamond'; font-weight: 700; font-size: 26px; color: var(--gold-2); }
.fk-face.bk { transform: rotateY(180deg); background: linear-gradient(165deg, rgba(43,30,86,.97), rgba(18,11,44,.97)); }
.fk-face.bk.art { padding: 0; background: #0b0820; overflow: hidden; }
.fk-face-art { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; }
.fk-face.bk.art .tag { position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); padding: 1px 8px; border-radius: 99px; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
.fk-face.bk.art .tag.new { background: linear-gradient(180deg,#a9f5c9,#5ecf91); color: #0c3a22; }
.fk-face.bk.art .tag.rep { background: linear-gradient(180deg,var(--rose),var(--rose-deep)); color: #3a0f23; }
.fk-face.bk .g { font-size: 29px; }
.fk-face.bk .nm { font-family: 'Cormorant Garamond'; font-weight: 600; font-size: 11.5px; color: #fff; margin-top: 5px; line-height: 1.05; }
.fk-face.bk .tag { font-size: 7.5px; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; margin-top: 5px; }
.fk-flip.new .fk-face.bk .tag { color: var(--green); }
.fk-flip.rep .fk-face.bk .tag { color: var(--rose); }
.fk-flip.rara .fk-face.bk { box-shadow: inset 0 0 0 1px rgba(241,168,198,.55); }
.fk-flip.epica .fk-face.bk { box-shadow: inset 0 0 0 1px var(--gold-1); }
.fk-flip.m .fk-face.bk { box-shadow: inset 0 0 0 1px var(--rose-deep); }
`;

// ─────────────────────────────────────────────
// STARFIELD / CASTLE
// ─────────────────────────────────────────────

function Starfield() {
  // Posiciones DETERMINÍSTICAS (no Math.random) para que SSR y cliente
  // coincidan y no haya mismatch de hidratación al renderizar el álbum directo.
  const stars = useRef(
    Array.from({ length: 46 }, (_, i) => {
      const r = (n: number) => {
        const x = Math.sin((i + 1) * n) * 10000;
        return x - Math.floor(x);
      };
      return {
        key: i,
        left: `${(r(12.9898) * 100).toFixed(3)}%`,
        top: `${(r(78.233) * 70).toFixed(3)}%`,
        size: `${(r(3.7) * 2 + 1).toFixed(2)}px`,
        delay: `${(r(5.1) * 4).toFixed(2)}s`,
      };
    }),
  );
  return (
    <div className="fk-stars">
      {stars.current.map((s) => (
        <i
          key={s.key}
          className="fk-star"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}
    </div>
  );
}

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
          <rect x="60" y="170" width="9" height="16" rx="3" />
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

function Topbar({
  name,
  avatar,
  selfie,
  uniques,
}: {
  name: string;
  avatar: Avatar | null;
  selfie: string | null;
  uniques: number;
}) {
  return (
    <div className="fk-topbar-bg">
      <div className="fk-topbar">
        <div className="fk-me">
          <Face avatar={avatar} selfie={selfie} />
        </div>
        <div className="fk-me-info">
          <div className="n">{name || "Invitado/a"}</div>
          <div className="s">{!selfie && avatar ? `${avatar.n} · ` : ""}Reino de Marti</div>
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
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="fk-sh">
      <div className="ln" />
      <span>{label}</span>
      <div className="ln" />
    </div>
  );
}

// ─────────────────────────────────────────────
// FIG CARD
// ─────────────────────────────────────────────

function FigCard({ f, qty, onClick }: { f: Fig; qty: number; onClick?: () => void }) {
  const num = String(f.id).padStart(2, "0");
  if (qty === 0) {
    return (
      <div className="fk-fig empty" onClick={onClick}>
        <span className="num">{num}</span>
        <span className="q">?</span>
        <div className="film" style={{ marginTop: 6 }}>
          {f.film}
        </div>
      </div>
    );
  }
  // La carta real (con marco/número/nombre/rareza) llena la celda.
  return (
    <div className={`fk-fig have art${qty > 1 ? " flash" : ""}`} onClick={onClick} style={{ cursor: onClick ? "pointer" : undefined }}>
      <CardImg id={f.id} alt={f.nm} />
      {qty > 1 && <span className="dupe-q">x{qty}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// INTRO SCREEN (acceso por pulsera — se mantiene)
// ─────────────────────────────────────────────

interface IntroScreenProps {
  name: string;
  avatar: Avatar | null;
  selfie: string | null;
  onAvatarSelect: (a: Avatar) => void;
  onSelfie: (dataUrl: string | null) => void;
  onEnter: (nombre: string, avatar: Avatar | null, selfie: string | null) => void;
  onToast: (msg: string) => void;
}

function IntroScreen({
  name,
  avatar,
  selfie,
  onAvatarSelect,
  onSelfie,
  onEnter,
  onToast,
}: IntroScreenProps) {
  const [localName, setLocalName] = useState(name);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasName = localName.trim().length > 0;

  useEffect(() => {
    if (name) setLocalName((prev) => prev || name);
  }, [name]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = await selfieFromFile(f);
    if (url) onSelfie(url);
    else onToast("No se pudo usar esa foto 😕");
  };

  const handleEnter = () => {
    const trimmed = localName.trim();
    if (!trimmed) return onToast("Poné tu nombre 🙂");
    if (!avatar && !selfie) return onToast("Elegí un personaje o sacate una selfie ✨");
    onEnter(trimmed, selfie ? null : avatar, selfie);
  };

  return (
    <div className="fk-pad">
      <div className="fk-center">
        <div className="fk-kicker">Los XV de Marti</div>
        <h1 className="fk-title" style={{ marginTop: hasName ? 40 : 6 }}>
          {hasName ? (
            <>
              ¡{inferGenero(localName) === "f" ? "Bienvenida" : "Bienvenido"},{" "}
              <b style={{ color: "var(--ink)" }}>{localName.trim()}</b>!
            </>
          ) : (
            <>Figus del Reino</>
          )}
        </h1>
        <p className="fk-lead mt14">
          Juntá las <b style={{ color: "var(--ink)" }}>15 figuritas</b> de Marti convertida en
          princesa. Con tus sobres no alcanza: para completar el álbum vas a tener que{" "}
          <b style={{ color: "var(--rose)" }}>cambiar con la gente</b>.
        </p>
      </div>

      <div className="mt20 fk-center">
        <label className="fk-hint">Tu nombre</label>
        <input
          className="fk-field mt8"
          maxLength={18}
          placeholder="¿Cómo te llamás?"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
        />
      </div>

      <div className="mt20">
        <label className="fk-hint fk-center" style={{ display: "block" }}>
          Tu cara en el Reino
        </label>
        <div
          className={`fk-selfiebox${selfie ? " sel" : ""}`}
          onClick={() => fileRef.current?.click()}
        >
          <div className="ph">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {selfie ? <img src={selfie} alt="" /> : "🤳"}
          </div>
          <div className="tx">
            <div className="t">{selfie ? "¡Esa cara! Tocá para cambiarla" : "Sacate una selfie"}</div>
            <div className="d">Aparece en tu perfil y en tu carta dorada</div>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => void handleFile(e)} />

        <p className={`fk-hint fk-center mt14 fk-avhint${selfie ? " dim" : ""}`}>— o elegí un personaje —</p>
        <div className={`fk-avatars${selfie ? " dim" : ""}`}>
          {AVATARS.map((a) => (
            <div
              key={a.n}
              className={`fk-av${!selfie && avatar?.n === a.n ? " sel" : ""}`}
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
  golds: ReinoGold[];
  done: boolean;
  readyTokens: string[];
  cartasFound: number;
  igUsed: boolean;
  giftDurationMs: number;
  onOpenToken: (token: string) => void;
  onSource: (key: string) => void;
  onOpenTrade: () => void;
  onCardTap: (f: Fig, qty: number) => void;
  onRefresh: () => void;
}

function AlbumScreen({
  counts,
  golds,
  done,
  readyTokens,
  cartasFound,
  igUsed,
  giftDurationMs,
  onOpenToken,
  onSource,
  onOpenTrade,
  onCardTap,
  onRefresh,
}: AlbumScreenProps) {
  const owned = (id: number) => (counts[id] || 0) > 0;
  const uniques = FIGS.filter((f) => owned(f.id)).length;
  const needCount = 15 - uniques;
  const giftMinutes = Math.round(giftDurationMs / 60_000);

  const tiles: { key: string; ready?: string; spent?: boolean; hint?: string; action?: string }[] = [
    { key: "codigo" },
    { key: "carta" },
    { key: "ig", spent: igUsed },
    { key: "gift", hint: `⏱️ Cada ${giftMinutes} min · toca en Cuenta`, action: "account" },
  ];

  return (
    <div className="fk-pad app">
      <div className="fk-grid">
        {FIGS.map((f) => (
          <FigCard key={f.id} f={f} qty={counts[f.id] || 0} onClick={() => onCardTap(f, counts[f.id] || 0)} />
        ))}
      </div>

      {readyTokens.length > 0 && (
        <>
          <SectionHeader label="Sobres sin abrir" />
          <div className="fk-wall">
            <span className="fk-pill">
              🎁 Tenés {readyTokens.length} sobre{readyTokens.length > 1 ? "s" : ""} listo
              {readyTokens.length > 1 ? "s" : ""}
            </span>
            <button className="fk-btn mt14" onClick={() => onOpenToken(readyTokens[0]!)}>
              Abrir sobre
            </button>
          </div>
        </>
      )}

      {done ? (
        <>
          <SectionHeader label="👑 Reino completo" />
          <div className="fk-wall">
            <span className="fk-pill">✦ Completaste el álbum</span>
            <p className="fk-hint mt14">
              Tu carta dorada de Marti te espera en el Mercadito del Reino. Tus repetidas ahora
              valen oro: regalalas y salvá el álbum de alguien.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="fk-sh">
            <div className="ln" />
            <span>Conseguir sobres</span>
            <div className="ln" />
            <button className="fk-btn ghost sm" onClick={onRefresh} style={{ padding: "7px 12px" }}>
              ⟳ Actualizar
            </button>
          </div>
          <p className="fk-hint fk-center">
            Canjeá <b style={{ color: "var(--ink)" }}>códigos de las entrevistas</b> o encontrá los{" "}
            <b style={{ color: "var(--ink)" }}>sobres escondidos</b> por el salón.
          </p>
          <div className="fk-src-row">
            {tiles.map((tile) => {
              const m = SRC_META[tile.key]!;
              const desc = tile.hint ?? (
                tile.key === "carta" && cartasFound > 0
                  ? `${cartasFound} canjeado${cartasFound > 1 ? "s" : ""}`
                  : m.d
              );
              return (
                <div
                  key={tile.key}
                  className={`fk-src${tile.spent ? " spent" : ""}`}
                  onClick={() => !tile.spent && onSource(tile.key)}
                >
                  <div className="ic">{m.ic}</div>
                  <div className="t">{m.t}</div>
                  <div className="d">{desc}</div>
                </div>
              );
            })}
          </div>

          {needCount > 0 && needCount <= 5 && (
            <div className="fk-wall mt20">
              <span className="fk-pill">🔒 Te faltan {needCount}</span>
              <p className="fk-hint mt14">
                Las que faltan son las más raras del Reino — cerralo{" "}
                <b style={{ color: "var(--rose)" }}>cambiando con alguien</b> o canjeando más
                códigos.
              </p>
              <button className="fk-btn rose mt14" onClick={onOpenTrade}>
                Ir a cambiar
              </button>
            </div>
          )}
        </>
      )}

      <SectionHeader label="Doradas · pura suerte" />
      <div className="fk-gold-row">
        {(golds.length
          ? golds
          : GOLD.map((g, i) => ({ idx: i, nm: g.nm, g: g.g, mine: false, taken: false, winnerName: null }))
        ).map((g) =>
          g.mine ? (
            <div key={g.idx} className="fk-gcard art won">
              <CardImg id={16 + g.idx} alt={g.nm} />
            </div>
          ) : (
            <div key={g.idx} className="fk-gcard locked">
              <span className="lk">🔒</span>
              <span className="glyph">{g.g}</span>
              <div className="fname">{g.nm}</div>
              {g.taken && g.winnerName && (
                <small style={{ fontSize: 8, color: "var(--muted-2)", marginTop: 2 }}>
                  de {g.winnerName}
                </small>
              )}
            </div>
          ),
        )}
      </div>
      <p className="fk-footnote">No hacen falta para ganar · cada dorada tiene su premio especial 🎁</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// TRADE SCREEN (cambiar figus)
// ─────────────────────────────────────────────

interface TradeScreenProps {
  counts: Record<number, number>;
  done: boolean;
  busy: boolean;
  myRequest: { id: string; figId: number } | null;
  salonRequests: ReinoSalonReq[];
  tradeCode: string;
  onPubRequest: () => void;
  onCancelRequest: () => void;
  onFulfill: (requestId: string) => void;
  onConnect: (code: string) => void;
}

function TradeScreen({
  done,
  busy,
  myRequest,
  salonRequests,
  tradeCode,
  onPubRequest,
  onCancelRequest,
  onFulfill,
  onConnect,
}: TradeScreenProps) {
  const [input, setInput] = useState("");

  if (done) {
    return (
      <div className="fk-pad app">
        <div className="fk-wall" style={{ marginTop: "8vh" }}>
          <span className="fk-pill">👑 Ya completaste el Reino</span>
          <p className="fk-hint mt14">
            Tus repetidas ahora valen oro: regalalas y salvá el álbum de alguien.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fk-pad app">
      <SectionHeader label="Se busca" />
      <div className="fk-card">
        <p className="fk-hint">
          Elegí una figu que te falte y tu pedido sale al salón. Cuando alguien la tenga repetida,
          te la pasa y vas a verlo acá.
        </p>
        {myRequest != null ? (
          <div className="fk-req mine">
            <div className="fg">{fig(myRequest.figId).g}</div>
            <div className="tx">
              <div className="a">
                Estás buscando <b>{fig(myRequest.figId).nm}</b>
              </div>
              <div className="b">Todo el Reino ve tu pedido</div>
            </div>
            <button className="fk-btn ghost sm" disabled={busy} onClick={onCancelRequest}>
              ✕
            </button>
          </div>
        ) : (
          <button className="fk-btn rose mt14" disabled={busy} onClick={onPubRequest}>
            🙋 Pedir una figu
          </button>
        )}
      </div>

      <SectionHeader label="Pedidos del salón" />
      <div className="fk-card">
        {salonRequests.length ? (
          salonRequests.map((r) => {
            const f = fig(r.figId);
            return (
              <div className="fk-req" key={r.id}>
                <div className="fg">{f.g}</div>
                <div className="tx">
                  <div className="a">
                    <b>{r.guestName}</b> busca <b>{f.nm}</b>
                  </div>
                  <div className="b">{r.canFulfill ? "La tenés repetida" : "No la tenés repetida"}</div>
                </div>
                {r.canFulfill && (
                  <button className="fk-btn sm" disabled={busy} onClick={() => onFulfill(r.id)}>
                    Ofrecer
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <p className="fk-hint">Nadie está buscando ahora mismo…</p>
        )}
      </div>

      <SectionHeader label="Canje directo" />
      <div className="fk-card fk-center">
        <p className="fk-hint">¿Están cara a cara? Mostrale tu código o tipeá el suyo.</p>
        <div className="fk-codebig mt8">{tradeCode}</div>
        <p className="fk-hint" style={{ margin: "2px 0 12px" }}>
          tu código
        </p>
        <input
          className="fk-field"
          inputMode="numeric"
          maxLength={5}
          placeholder="– – – –"
          style={{ letterSpacing: ".4em", fontSize: 22 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="fk-btn mt14"
          disabled={busy}
          onClick={() => {
            onConnect(input);
            setInput("");
          }}
        >
          {busy ? "Conectando…" : "Conectar"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PRIZES SCREEN (premios)
// ─────────────────────────────────────────────

interface PrizesScreenProps {
  prizes: ReinoPrize[];
  colgantesLeft: number;
  myColgantes: number;
  golds: ReinoData["golds"];
}

function PrizesScreen({ prizes, colgantesLeft, myColgantes, golds }: PrizesScreenProps) {
  const HOW: Record<string, string> = {
    camara:      "1ª en completar el álbum",
    funko_dante: "2ª en completar el álbum",
    minnie:      "3ª en completar el álbum",
  };
  return (
    <div className="fk-pad app">
      <SectionHeader label="Premios · primeras 3 en completar" />
      <div className="fk-card" style={{ padding: "6px 16px 16px" }}>
        {prizes.map((p, i) => (
          <div key={p.key} className={`fk-req${p.winnerName ? " given" : ""}`}>
            {p.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.img} alt={p.nm} style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 8, flexShrink: 0 }} />
            ) : (
              <div className="fg" style={{ fontSize: 24 }}>{p.g}</div>
            )}
            <div className="tx">
              <div className="a">
                <b>{i + 1}º · {p.nm}</b>
              </div>
              <div className="b">
                {p.winnerName ? `✓ ${p.mine ? "¡Lo ganaste vos!" : `Ganado por ${p.winnerName}`}` : HOW[p.key]}
              </div>
            </div>
            {p.winnerName && <span className="chk">✓</span>}
          </div>
        ))}
      </div>

      <SectionHeader label={`Colgantes RGB · quedan ${colgantesLeft} de ${SEC_TOTAL}`} />
      <div className="fk-card fk-center">
        <div style={{ fontSize: 25, letterSpacing: 5, lineHeight: 1.5 }}>
          {colgantesLeft > 0 ? "📿".repeat(Math.min(colgantesLeft, 10)) : "✨ ¡Volaron todos! ✨"}
        </div>
        <p className="fk-hint mt14">
          {SEC_TOTAL} colgantes RGB de Marti — para quienes completen el álbum{" "}
          <b style={{ color: "var(--gold-1)" }}>del 4to lugar en adelante</b>.
        </p>
        {myColgantes > 0 && <div className="fk-pill mt14">📿 ¡Ganaste un colgante RGB!</div>}
      </div>

      <SectionHeader label="Doradas · premios especiales" />
      <p className="fk-hint fk-center" style={{ marginBottom: 10 }}>
        Cada dorada sale <b style={{ color: "var(--gold-1)" }}>una sola vez</b> y gana su premio.
      </p>
      <div className="fk-card" style={{ padding: "6px 16px 16px" }}>
        {golds.map((gld) => (
          <div className={`fk-req${gld.mine ? " mine" : ""}${gld.taken ? " given" : ""}`} key={gld.idx}>
            <div className="fg" style={{ fontSize: 24 }}>{gld.g}</div>
            <div className="tx">
              <div className="a">
                <b>🎁 {gld.prize || "Premio especial"}</b>
              </div>
              <div className="b">
                Dorada <b>{gld.nm}</b>
                {gld.taken
                  ? ` · ✓ ${gld.mine ? "¡La sacaste vos!" : `la sacó ${gld.winnerName ?? "alguien"}`}`
                  : " · todavía libre ✨"}
              </div>
            </div>
            {gld.taken && <span className="chk">✓</span>}
          </div>
        ))}
      </div>
      <p className="fk-footnote">Los premios se retiran en el Mercadito del Reino</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// REINO SCREEN (top 8 + feed)
// ─────────────────────────────────────────────

interface ReinoScreenProps {
  feed: ReinoFeed[];
  top: ReinoTop[];
  onSync: () => void;
}

function ReinoScreen({ feed, top, onSync }: ReinoScreenProps) {
  return (
    <div className="fk-pad app">
      <div className="fk-sh">
        <div className="ln" />
        <span>Top 8 del Reino</span>
        <div className="ln" />
        <button className="fk-btn ghost sm" onClick={onSync} style={{ padding: "7px 12px" }}>
          ⟳ Actualizar
        </button>
      </div>
      <div className="fk-card" style={{ paddingTop: 6 }}>
        {top.length ? (
          top.map((r, i) => (
            <div key={i} className={`fk-lb${r.done ? " done" : ""}${r.mine ? " me" : ""}`}>
              <span className="rk">{i + 1}</span>
              <span className="lnm">{r.mine ? "Vos" : r.name}</span>
              {r.done ? (
                <span className="won">Reino completo 👑</span>
              ) : (
                <span className="ct">{r.uniques}/15</span>
              )}
              <div className="bar">
                <i style={{ width: `${Math.round((r.uniques / 15) * 100)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="fk-hint">Todavía no hay nadie en el Reino…</p>
        )}
      </div>

      <SectionHeader label="Pasó en el Reino" />
      <div className="fk-feed">
        {feed.length ? (
          feed.map((e) => (
            <div className={`ev${e.mine ? " mine" : ""}`} key={e.id}>
              <span className="ic">{e.kind}</span>
              <div dangerouslySetInnerHTML={{ __html: e.text }} />
            </div>
          ))
        ) : (
          <p className="fk-hint">Todavía no pasó nada… abrí tu sobre 🎁</p>
        )}
      </div>
      <p className="fk-footnote">Se actualiza solo · en vivo</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// ACCOUNT SCREEN (cuenta)
// ─────────────────────────────────────────────

interface AccountScreenProps {
  name: string;
  avatar: Avatar | null;
  selfie: string | null;
  nroPulsera: number | null;
  mesa: number | null;
  counts: Record<number, number>;
  doradas: number;
  colgantes: number;
  tradeCode: string;
  onEdit: () => void;
  onSimGift: () => void;
}

function AccountScreen({
  name,
  avatar,
  selfie,
  nroPulsera,
  mesa,
  counts,
  doradas,
  colgantes,
  tradeCode,
  onEdit,
  onSimGift,
}: AccountScreenProps) {
  const u = FIGS.filter((f) => (counts[f.id] || 0) > 0).length;
  const reps = FIGS.reduce((a, f) => a + Math.max(0, (counts[f.id] || 0) - 1), 0);
  const dor = doradas;

  const stat = (n: number | string, l: string) => (
    <div className="mini" style={{ flex: 1 }}>
      <div
        className="g"
        style={{
          fontSize: 24,
          fontFamily: "'Cormorant Garamond'",
          fontWeight: 700,
          color: "var(--gold-1)",
        }}
      >
        {n}
      </div>
      <div className="who">{l}</div>
    </div>
  );

  return (
    <div className="fk-pad app">
      <div className="fk-card fk-center" style={{ marginTop: 4 }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: "50%",
            margin: "0 auto",
            overflow: "hidden",
            background: "rgba(227,184,95,.13)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
          }}
        >
          <Face avatar={avatar} selfie={selfie} />
        </div>
        <h2
          className="fk-serif"
          style={{ fontWeight: 700, fontSize: 28, margin: "10px 0 6px", color: "#fff" }}
        >
          {name || "Invitado/a"}
        </h2>
        {nroPulsera != null && (
          <div className="fk-pill">
            Pulsera #{nroPulsera}
            {mesa != null ? ` · Mesa ${mesa}` : ""}
          </div>
        )}
      </div>

      <div className="fk-swap" style={{ margin: "12px 0" }}>
        {stat(`${u}/15`, "figus")}
        {stat(reps, "repetidas")}
        {stat(dor, "doradas")}
        {stat(colgantes, "colgantes")}
      </div>

      <div className="fk-card fk-center">
        <p className="fk-hint">Tu código de canje directo</p>
        <div className="fk-codebig mt8">{tradeCode || "····"}</div>
        <p className="fk-hint" style={{ marginTop: 2 }}>
          Dáselo a quien quiera cambiar con vos
        </p>
      </div>

      <SectionHeader label="Opciones" />
      <button className="fk-btn ghost" onClick={onEdit}>
        ✏️ Cambiar nombre o personaje
      </button>
      <button className="fk-btn ghost mt8" onClick={onSimGift}>
        🛰️ Recibir un sobre regalo
      </button>
      <p className="fk-footnote">Tu pulsera es tu cuenta · el progreso queda guardado</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// PACK SHEET
// ─────────────────────────────────────────────

function PackSheet({ token, busy, onOpen }: { token: string; busy: boolean; onOpen: () => void }) {
  const { key, n } = parseToken(token);
  const kick =
    key === "start"
      ? "Tu sobre de bienvenida"
      : key === "gift"
        ? "¡Regalo del Reino!"
        : "¡Un sobre más!";
  return (
    <>
      <div className="fk-kicker">{kick}</div>
      <div className={`fk-envelope${busy ? " busy" : ""}`} onClick={onOpen}>
        <div className="fk-seal">✦</div>
      </div>
      <p className="fk-lead" style={{ maxWidth: 260 }}>
        {busy ? "Abriendo…" : "Tocá el sobre para abrirlo"}
      </p>
      <p className="fk-hint mt8">
        {n} figu{n > 1 ? "s" : ""} adentro
      </p>
    </>
  );
}

// ─────────────────────────────────────────────
// CODIGO ENTRY SHEET
// ─────────────────────────────────────────────

function CodigoEntrySheet({
  busy,
  onSubmit,
  onClose,
  onToast,
}: {
  busy: boolean;
  onSubmit: (code: string) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [code, setCode] = useState("");
  const handleSubmit = () => {
    if (!code.trim()) return onToast("Tipeá el código de la entrevista");
    onSubmit(code);
  };
  return (
    <div className="fk-modal-card">
      <div className="fk-kicker fk-center">🎤 Código de entrevista</div>
      <p className="fk-hint fk-center mt8">
        Conseguí códigos en las <b style={{ color: "var(--gold-1)" }}>entrevistas</b> y sorpresas de
        la noche. Valen <b style={{ color: "var(--gold-1)" }}>+1, +3, +5 o +10</b> figus.
      </p>
      <input
        className="fk-field mt14"
        maxLength={12}
        placeholder="CÓDIGO"
        style={{ letterSpacing: ".3em", textTransform: "uppercase", fontSize: 20 }}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button className="fk-btn mt14" disabled={busy} onClick={handleSubmit}>
        {busy ? "Verificando…" : "Canjear"}
      </button>
      <button className="fk-btn ghost mt8" onClick={onClose}>
        Cerrar
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// IG / CARTA SHEETS
// ─────────────────────────────────────────────

function IgSheet({ busy, onOk, onClose }: { busy: boolean; onOk: () => void; onClose: () => void }) {
  return (
    <div className="fk-modal-card">
      <div className="fk-kicker">📸 Seguinos en Instagram</div>
      <div className="fk-codebig mt8" style={{ fontSize: 26, letterSpacing: ".04em" }}>
        @andro.show
      </div>
      <p className="fk-hint mt8">Seguinos y llevate una figu de regalo.</p>
      <a
        className="fk-btn mt14"
        style={{ display: "block", textDecoration: "none" }}
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Abrir Instagram
      </a>
      <button className="fk-btn rose mt8" disabled={busy} onClick={onOk}>
        ¡Ya los sigo! ✓
      </button>
      <button className="fk-btn ghost mt8" onClick={onClose}>
        Ahora no
      </button>
    </div>
  );
}

function CartaSheet({
  busy,
  cartasFound,
  onSubmit,
  onClose,
  onToast,
}: {
  busy: boolean;
  cartasFound: number;
  onSubmit: (code: string) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [code, setCode] = useState("");
  const handleSubmit = () => {
    if (!code.trim()) return onToast("Tipeá el código del sobre escondido");
    onSubmit(code);
  };
  return (
    <div className="fk-modal-card">
      <div className="fk-kicker fk-center">🃏 Sobre escondido</div>
      <p className="fk-hint fk-center mt8">
        Buscá los sobres físicos escondidos por el salón. Cada uno trae un{" "}
        <b style={{ color: "var(--gold-1)" }}>código</b> adentro: canjealo acá. Cada código sirve{" "}
        <b style={{ color: "var(--gold-1)" }}>una sola vez</b>.
      </p>
      <input
        className="fk-field mt14"
        maxLength={12}
        placeholder="CÓDIGO DEL SOBRE"
        style={{ letterSpacing: ".3em", textTransform: "uppercase", fontSize: 20 }}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button className="fk-btn mt14" disabled={busy} onClick={handleSubmit}>
        {busy ? "Verificando…" : "Canjear sobre"}
      </button>
      {cartasFound > 0 && (
        <p className="fk-hint fk-center mt8">Ya canjeaste {cartasFound} {cartasFound === 1 ? "sobre" : "sobres"} 🃏</p>
      )}
      <button className="fk-btn ghost mt8" onClick={onClose}>
        Cerrar
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// PACK REVEAL SHEET (reveal de a una)
// ─────────────────────────────────────────────

const RARITY_PARTICLE_COLORS: Record<Rarity, string[]> = {
  comun: ["#cbb9e8", "#b6abd4", "#fff"],
  rara: ["#f1a8c6", "#d76a98", "#fce4ef"],
  epica: ["#f6dd99", "#e3b85f", "#fffbe8"],
  m: ["#f1a8c6", "#d76a98", "#ff8fc0", "#fce4ef"],
};

function vibrate(p: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(p);
    } catch {
      /* ignore */
    }
  }
}

// Reveal de a una carta con flip (front monograma ✦ → back figu), como
// martireino: tocás la carta, se da vuelta con brillo/confetti, y pasás a
// la siguiente; al final un resumen con todas.
function PackRevealSheet({
  cards,
  onClose,
}: {
  cards: { f: Fig; isNew: boolean }[];
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [summary, setSummary] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: string; rot: number; rotV: number }[]
  >([]);
  const rafRef = useRef<number>(0);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      const p = c?.parentElement;
      if (!c || !p) return;
      c.width = p.offsetWidth;
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
      particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0.02);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.alpha -= 0.024;
        p.rot += p.rotV;
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

  useEffect(
    () => () => {
      if (flipTimer.current) clearTimeout(flipTimer.current);
    },
    [],
  );

  const spawn = (colors: string[], count: number) => {
    const canvas = canvasRef.current;
    const card = cardRef.current;
    if (!canvas || !card) return;
    const sr = card.getBoundingClientRect();
    const pr = canvas.parentElement!.getBoundingClientRect();
    const cx = sr.left - pr.left + sr.width / 2;
    const cy = sr.top - pr.top + sr.height / 2;
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 6;
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 2.5,
        r: 2.5 + Math.random() * 4,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)] ?? "#fff",
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.2,
      });
    }
  };

  const total = cards.length;
  const c = cards[i]!;

  const advance = () => {
    if (flipTimer.current) clearTimeout(flipTimer.current);
    if (i < total - 1) {
      setI(i + 1);
      setFlipped(false);
      setShowNext(false);
    } else {
      setSummary(true);
    }
  };

  const onTap = () => {
    if (!flipped) {
      setFlipped(true);
      const big = c.isNew && (c.f.r === "epica" || c.f.r === "m");
      vibrate(big ? [18, 50, 18] : c.isNew ? [14, 40] : 12);
      if (c.isNew) spawn(RARITY_PARTICLE_COLORS[c.f.r], big ? 60 : 30);
      if (flipTimer.current) clearTimeout(flipTimer.current);
      flipTimer.current = setTimeout(() => setShowNext(true), 700);
    } else {
      advance();
    }
  };

  const canvas = (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 15 }}
    />
  );

  if (summary) {
    return (
      <>
        {canvas}
        <div className="fk-kicker">Tu sobre</div>
        <div className="fk-reveal mt14">
          {cards.map((cc, k) => (
            <div
              key={k}
              className={`fk-flip go ${cc.isNew ? "new" : "rep"} ${cc.f.r}`}
              style={{ animationDelay: `${k * 0.06}s` }}
            >
              <div className="inner">
                <div className="fk-face fr">
                  <span className="mono">✦</span>
                </div>
                <div className="fk-face bk art">
                  <CardImg id={cc.f.id} alt={cc.f.nm} />
                  <div className={`tag ${cc.isNew ? "new" : "rep"}`}>{cc.isNew ? "Nueva" : "Rep"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button className="fk-btn mt20" style={{ maxWidth: 240 }} onClick={onClose}>
          Ver mi álbum
        </button>
      </>
    );
  }

  return (
    <>
      {canvas}
      <div className="fk-stage">
        <div className="count">
          Figu {i + 1} de {total}
        </div>
        <div className="dots">
          {cards.map((_, k) => (
            <i key={k} className={k < i ? "done" : k === i ? "cur" : ""} />
          ))}
        </div>

        <div
          ref={cardRef}
          className={`fk-bigcard r-${c.f.r}${flipped ? " go" : ""}`}
          onClick={onTap}
        >
          <div className="tagwrap">
            <span className={`fk-tag ${c.isNew ? "new" : "rep"}`}>
              {c.isNew ? "¡Nueva!" : "Repetida"}
            </span>
          </div>
          <div className="in">
            <div className="fk-bcface fr">
              <span className="mono">✦</span>
            </div>
            <div className="fk-bcface bk art">
              <CardImg id={c.f.id} alt={c.f.nm} />
            </div>
          </div>
        </div>

        <div className="next">
          {showNext ? (
            <button className="fk-btn sm" onClick={advance}>
              {i < total - 1 ? "Siguiente ✦" : "Ver resumen"}
            </button>
          ) : (
            <span className="nexthint">Tocá la carta para darla vuelta</span>
          )}
        </div>
      </div>
    </>
  );
}


// ─────────────────────────────────────────────
// DORADA OVERLAY
// ─────────────────────────────────────────────

function DoradaOverlay({ idx, onClose }: { idx: number; onClose: () => void }) {
  const g = GOLD[idx]!;
  return (
    <>
      <div className="fk-rays" />
      <div style={{ position: "relative", zIndex: 2 }} className="fk-center">
        <div className="fk-kicker">✨ ¡Figurita dorada! ✨</div>
        <div className="fk-gold-reveal">
          <CardImg id={16 + idx} alt={g.nm} />
        </div>
        <div className="fk-pill mt14" style={{ fontSize: 13, padding: "10px 18px" }}>
          🎁 ¡Te llevás {g.prize}!
        </div>
        <p className="fk-hint mt8">Retiralo en el Mercadito del Reino</p>
        <button className="fk-btn mt20" style={{ maxWidth: 220 }} onClick={onClose}>
          ¡Vamos!
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// COMPLETION OVERLAY
// ─────────────────────────────────────────────

function CompletionOverlay({
  name,
  avatar,
  selfie,
  prizeNm,
  onStay,
}: {
  name: string;
  avatar: Avatar | null;
  selfie: string | null;
  prizeNm: string | null;
  onStay: () => void;
}) {
  return (
    <>
      <div className="fk-rays" />
      <div style={{ position: "relative", zIndex: 2 }} className="fk-center">
        <div className="fk-kicker">¡Completaste el Reino!</div>
        <div className="fk-ticket">
          {selfie ? (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                overflow: "hidden",
                margin: "0 auto",
                border: "2px solid var(--gold-1)",
              }}
            >
              <Face avatar={avatar} selfie={selfie} />
            </div>
          ) : (
            <div className="crown">{avatar ? avatar.g : "👑"}</div>
          )}
          <div className="nm">{name || "Vos"}</div>
          <div className="sub">Carta dorada de Marti</div>
          <div style={{ fontSize: 28, marginTop: 10 }}>🤍</div>
        </div>
        {prizeNm ? (
          <div className="fk-pill mt14" style={{ fontSize: 13, padding: "10px 18px" }}>
            🏆 ¡Ganaste {prizeNm}!
          </div>
        ) : (
          <div className="fk-pill mt14" style={{ fontSize: 13, padding: "10px 18px" }}>
            👑 Reino completo — pasá por el Mercadito
          </div>
        )}
        <p className="fk-lead mt14" style={{ maxWidth: 280, marginInline: "auto" }}>
          Pasá por el <b style={{ color: "var(--gold-1)" }}>Mercadito del Reino</b>: Marti te entrega
          la carta en mano.
        </p>
        <button className="fk-btn mt20" style={{ maxWidth: 240 }} onClick={onStay}>
          Seguir mirando el Reino
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// TRADE SHEETS
// ─────────────────────────────────────────────

function PickRequestSheet({
  counts,
  onPick,
  onClose,
}: {
  counts: Record<number, number>;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const missing = FIGS.filter((f) => (counts[f.id] || 0) === 0);
  return (
    <div className="fk-modal-card">
      <div className="fk-kicker fk-center">¿Cuál te falta?</div>
      <div className="fk-opts">
        {missing.map((f) => (
          <div key={f.id} className="fk-opt" onClick={() => onPick(f.id)}>
            <span className="k">{f.g}</span>
            {f.nm}
            <small>{f.film}</small>
          </div>
        ))}
      </div>
      <button className="fk-btn ghost mt14" onClick={onClose}>
        Cerrar
      </button>
    </div>
  );
}

// Resultado de un canje directo por código (cara a cara).
function CodeResultSheet({
  otherName,
  gave,
  got,
  onClose,
}: {
  otherName: string;
  gave: { nm: string; g: string } | null;
  got: { nm: string; g: string } | null;
  onClose: () => void;
}) {
  return (
    <div className="fk-modal-card">
      <div className="fk-kicker fk-center">Cambio con</div>
      <h2 className="fk-serif fk-center" style={{ margin: "4px 0 0", fontSize: 30, color: "#fff" }}>
        {otherName}
      </h2>
      <div className="fk-swap">
        {gave && (
          <>
            <div className="mini">
              <div className="g">{gave.g}</div>
              <div className="nm">{gave.nm}</div>
              <div className="who">le diste</div>
            </div>
            <div className="arrow">⇄</div>
          </>
        )}
        {got ? (
          <div className="mini">
            <div className="g">{got.g}</div>
            <div className="nm">{got.nm}</div>
            <div className="who">te llevaste</div>
          </div>
        ) : (
          <div className="mini" style={{ maxWidth: 160 }}>
            <div className="g">🤍</div>
            <div className="nm">Le diste una mano</div>
            <div className="who">gesto del Reino</div>
          </div>
        )}
      </div>
      <button className="fk-btn" onClick={onClose}>
        ¡Genial!
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// CARD DETAIL SHEET
// ─────────────────────────────────────────────

function CardDetailSheet({
  f,
  qty,
  busy,
  onPubRequest,
  onClose,
}: {
  f: Fig;
  qty: number;
  busy: boolean;
  onPubRequest: (figId: number) => void;
  onClose: () => void;
}) {
  const rarityLabel: Record<string, string> = {
    comun: "Común",
    rara: "Rara",
    epica: "Épica",
    m: "Mítica",
  };
  return (
    <div className="fk-modal-card" style={{ alignItems: "center", gap: 12 }}>
      <button
        className="fk-btn ghost sm"
        onClick={onClose}
        style={{ alignSelf: "flex-end", padding: "4px 10px", fontSize: 18, lineHeight: 1 }}
      >
        ✕
      </button>
      <div style={{ position: "relative", width: "min(62vw, 240px)", aspectRatio: "0.75", borderRadius: 14, overflow: "hidden", boxShadow: "0 4px 24px #0006" }}>
        {qty > 0 ? (
          <CardImg id={f.id} alt={f.nm} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
            {f.g}
          </div>
        )}
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{f.nm}</div>
        <div style={{ fontSize: 13, color: "#aaa" }}>{rarityLabel[f.r] ?? f.r} · #{String(f.id).padStart(2, "0")}</div>
        {qty > 1 && (
          <div style={{ marginTop: 6, fontSize: 13, color: "#f9c74f", fontWeight: 600 }}>
            Tenés {qty} copias
          </div>
        )}
      </div>
      {qty >= 2 && (
        <button
          className="fk-btn"
          disabled={busy}
          onClick={() => onPubRequest(f.id)}
          style={{ marginTop: 4 }}
        >
          📢 Publicar para cambio
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// NAV + GIFT BAR + TOAST
// ─────────────────────────────────────────────

function Nav({ tab, unread, onTab }: { tab: Tab; unread: number; onTab: (t: Tab) => void }) {
  const items: { k: Tab; ic: string; label: string; gold?: boolean }[] = [
    { k: "album", ic: "📔", label: "Álbum" },
    { k: "trade", ic: "🔄", label: "Cambiar" },
    { k: "prizes", ic: "🏆", label: "Premios", gold: true },
    { k: "reino", ic: "🏰", label: "Reino" },
    { k: "account", ic: "👤", label: "Cuenta" },
  ];
  return (
    <nav className="fk-nav">
      {items.map((it) => (
        <button
          key={it.k}
          className={`${it.gold ? "gold" : ""}${tab === it.k ? " act" : ""}`}
          onClick={() => onTab(it.k)}
        >
          <span className="ic">{it.ic}</span>
          {it.label}
          {it.k === "reino" && unread > 0 && <span className="dot">{Math.min(unread, 9)}</span>}
        </button>
      ))}
    </nav>
  );
}

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return <div className={`fk-toast${visible ? " on" : ""}`}>{message}</div>;
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────


const PRIZE_NM: Record<string, string> = {
  camara: "Cámara Instantánea",
  funko_dante: "Funko Pop Dante",
  minnie: "Disney Minnie Combo × 3",
  colgante: "Colgante RGB",
};

// Dato inicial resuelto en el server (SSR) y pasado por la page.
type AlbumLoad = Awaited<ReturnType<typeof loadAlbum>>;

export default function Page({ guestId, initial }: { guestId: string; initial: AlbumLoad }) {
  // El perfil + counts ya vienen resueltos del server (SSR). Si el invitado
  // ya tiene perfil, arrancamos directo en el álbum (sin intro ni carga).
  const profile = initial && !("error" in initial) ? initial : null;
  const initialAvatar = profile?.guest.avatar
    ? AVATARS.find((a) => a.n === profile.guest.avatar) ?? null
    : null;
  const hasProfile = !!(profile?.guest.name && (initialAvatar || profile.guest.selfie));

  const [giftDurationMs, setGiftDurationMs] = useState<number>(
    profile?.album.giftDurationMs ?? 600_000
  );

  const [core, setCore] = useState<Core>(() => ({
    screen: hasProfile ? "app" : "intro",
    tab: "album",
    name: profile?.guest.name ?? "",
    avatar: initialAvatar,
    selfie: profile?.guest.selfie ?? null,
    counts: profile?.album.counts ?? {},
    packsRaw: profile?.album.packsLeft ?? [],
    nroPulsera: profile?.guest.nroPulsera ?? null,
    mesa: profile?.guest.mesa ?? null,
  }));
  const [reino, setReino] = useState<ReinoData | null>(null);
  const [local, setLocal] = useState<Local>({ gift: null });

  const [sheet, setSheet] = useState<SheetMode>({ type: "none" });
  const [toast, setToast] = useState({ msg: "", visible: false });
  const [pending, setPending] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const [unread, setUnread] = useState(0);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introPlayed = useRef(false);
  // Returning user (ya tiene perfil) → no se reproduce la intro mágica.
  const [introPlaying, setIntroPlaying] = useState(!hasProfile);
  const hydratedRef = useRef(false);
  const welcomeOffered = useRef(false);
  const completionShownRef = useRef(false);
  const pendingPrizeRef = useRef<string | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const reinoFirstRef = useRef(true); // primer loadReino: no re-mostrar completion

  // refs espejo para leer estado fresco en callbacks
  const tabRef = useRef<Tab>(core.tab);
  tabRef.current = core.tab;
  const sheetRef = useRef<SheetMode>(sheet);
  sheetRef.current = sheet;
  const completionPendingRef = useRef(false);
  const pendingCompletionPrizeRef = useRef<string | null>(null);

  // ── inyectar CSS una vez ──
  useEffect(() => {
    const id = "fk-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);

  // ── precargar TODAS las cartas apenas se monta (arranca durante la intro
  //    mágica), así cuando se muestran ya están en caché y aparecen al
  //    instante: el usuario nunca espera a que cargue una imagen ──
  useEffect(() => {
    const imgs = ALL_CARD_IDS.map((id) => {
      const im = new Image();
      im.decoding = "async";
      im.src = figImg(id);
      return im;
    });
    return () => {
      for (const im of imgs) im.src = "";
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2300);
  }, []);

  // ── refrescar el Reino real (feed/top/premios/doradas/pedidos) + sincronizar
  //    mis counts/packsLeft (cambian cuando otros canjean conmigo). ──
  const refreshReino = useCallback(async () => {
    try {
      const r = await loadReino(guestId);
      setReino(r);
      setCore((s) => ({ ...s, counts: r.myCounts, packsRaw: r.myPacksLeft }));
      if (r.giftDurationMs) setGiftDurationMs(r.giftDurationMs);

      const topId = r.feed[0]?.id ?? null;
      if (tabRef.current === "reino") {
        setUnread(0);
        lastSeenRef.current = topId;
      } else if (topId && topId !== lastSeenRef.current) {
        const idx = lastSeenRef.current ? r.feed.findIndex((e) => e.id === lastSeenRef.current) : -1;
        setUnread(idx < 0 ? r.feed.length : idx);
      }

      if (r.completed && !completionShownRef.current) {
        if (reinoFirstRef.current) {
          // ya estaba completo al cargar: no re-mostrar el overlay (el álbum
          // ya indica "Reino completo"). Solo se muestra en una completion fresca.
          completionShownRef.current = true;
        } else {
          const pn = r.prizes.find((p) => p.mine)?.nm ?? null;
          if (sheetRef.current.type === "none") {
            completionShownRef.current = true;
            setSheet({ type: "completion", prizeNm: pn });
          } else {
            // hay un sheet abierto (reveal, etc.): se muestra al cerrarse
            completionPendingRef.current = true;
            pendingCompletionPrizeRef.current = pn;
          }
        }
      }
      reinoFirstRef.current = false;
    } catch {
      /* la próxima sync / evento realtime reintenta */
    }
  }, [guestId]);

  // ── carga inicial liviana: el perfil + counts ya vienen del server, así que
  //    acá solo el sobre regalo pendiente (necesita Date.now, client-only) y
  //    la carga del Reino (feed/top/premios/doradas). ──
  useEffect(() => {
    const st = profile?.album.state as { gift?: number } | undefined;
    if (st && typeof st.gift === "number" && st.gift > Date.now()) setLocal({ gift: st.gift });
    hydratedRef.current = true;
    void refreshReino();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── realtime: ante cambios en las tablas del Reino, refrescar (debounced
  //    1.5s para no tormentear con cada apertura de sobre del salón) ──
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void refreshReino(), 1500);
    };
    const ch = sb.channel(`figus-reino-${guestId}`);
    for (const table of REINO_TABLES) {
      ch.on("postgres_changes", { event: "*", schema: "public", table }, bump);
    }
    // mis counts cambian si alguien canjea conmigo → escuchar solo MI fila
    ch.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "FigusAlbum", filter: `guestId=eq.${guestId}` },
      bump,
    );
    ch.subscribe();
    return () => {
      if (t) clearTimeout(t);
      void sb.removeChannel(ch);
    };
  }, [guestId, refreshReino]);

  // ── persistir el contador del sobre regalo ──
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      void saveAlbumState(guestId, { state: { gift: local.gift } });
    }, 600);
    return () => clearTimeout(t);
  }, [local.gift, guestId]);

  // ── tick del contador del sobre regalo ──
  useEffect(() => {
    if (!local.gift) return;
    const i = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [local.gift]);

  // ── completion diferida: si el álbum se completó mientras había un sheet
  //    abierto, mostrar el overlay al cerrarse ──
  useEffect(() => {
    if (sheet.type === "none" && completionPendingRef.current) {
      completionPendingRef.current = false;
      showCompletion(pendingCompletionPrizeRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.type]);

  // ── sobre de bienvenida ──
  useEffect(() => {
    if (core.screen !== "app") return;
    if (welcomeOffered.current) return;
    if (sheet.type !== "none") return;
    if (!pendingPacks(core.packsRaw).includes("start")) return;
    const t = setTimeout(() => {
      welcomeOffered.current = true;
      setSheet({ type: "pack", token: "start" });
    }, 350);
    return () => clearTimeout(t);
  }, [core.screen, core.packsRaw, sheet.type]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ── derivados ──
  const uniques = FIGS.filter((f) => (core.counts[f.id] || 0) > 0).length;
  const done = uniques >= 15;
  const readyTokens = pendingPacks(core.packsRaw).filter((t) => t !== "start");
  const igUsed = usedPacks(core.packsRaw).includes("ig");
  const cartasFound = core.packsRaw.filter(
    (t) => parseToken(t).key === "carta" || t === USED_PREFIX + "carta",
  ).length;

  // ── tab switch (pull on enter) ──
  const handleTab = (t: Tab) => {
    setCore((s) => ({ ...s, tab: t }));
    if (t === "reino" || t === "prizes" || t === "trade") void refreshReino();
    if (t === "reino") {
      setUnread(0);
      lastSeenRef.current = reino?.feed[0]?.id ?? null;
    }
  };

  const afterGain = useCallback(() => {
    const u = FIGS.filter((f) => (core.counts[f.id] || 0) > 0).length;
    if (u >= 15) return;
    const startUsed = usedPacks(core.packsRaw).includes("start");
    const ig = usedPacks(core.packsRaw).includes("ig");
    if (readyTokens.length === 0 && startUsed && ig) {
      showToast("Te quedan huecos… ¡toca cambiar! 🔄");
    }
  }, [core.counts, core.packsRaw, readyTokens.length, showToast]);

  const showCompletion = useCallback((prizeNm: string | null) => {
    if (completionShownRef.current) return;
    completionShownRef.current = true;
    setSheet({ type: "completion", prizeNm });
  }, []);

  // ── PRE-APERTURA del sobre ──
  // openPack se dispara en background apenas aparece el sobre (antes del tap):
  // corre mientras el invitado mira el sobre animado, así al tocarlo el
  // resultado ya está resuelto y el reveal es INSTANTÁNEO (sin esperar al
  // server). El sobre es modal (no se puede cerrar sin abrir), así que
  // consumirlo al mostrarlo es seguro; si recargara antes del tap, las figus
  // ya quedaron persistidas y el álbum se resincroniza.
  const packPrefetch = useRef<Map<string, Promise<Awaited<ReturnType<typeof openPack>>>>>(new Map());
  const prefetchPack = useCallback(
    (token: string) => {
      if (packPrefetch.current.has(token)) return;
      const p = openPack(guestId, token);
      p.catch(() => undefined);
      packPrefetch.current.set(token, p);
    },
    [guestId],
  );

  // Pre-abrir el sobre apenas aparece su sheet (incluido el de bienvenida).
  useEffect(() => {
    if (sheet.type === "pack") prefetchPack(sheet.token);
  }, [sheet, prefetchPack]);

  // ── abrir sobre ──
  const resyncAlbum = useCallback(async () => {
    try {
      const d = await loadAlbum(guestId);
      if (d && !("error" in d)) {
        setCore((s) => ({ ...s, counts: d.album.counts, packsRaw: d.album.packsLeft }));
      }
    } catch {
      /* ignore */
    }
  }, [guestId]);

  const handleOpenEnvelope = async (token: string) => {
    if (pending) return;
    setPending(true);
    try {
      // Si el sheet ya disparó el prefetch, a esta altura la promesa suele
      // estar resuelta y el await es instantáneo.
      const cached = packPrefetch.current.get(token);
      const res = await (cached ?? openPack(guestId, token));
      if ("error" in res && res.error) {
        showToast(res.error);
        setSheet({ type: "none" });
        if (res.error.includes("ya fue abierto")) void resyncAlbum();
        return;
      }
      if (!("drawnIds" in res)) return;

      // "Nueva vs repetida" se decide contra el snapshot PREVIO al sobre que
      // manda el server (res.before). NO usar core.counts: el sobre se
      // pre-abre (prefetch) y persiste antes del tap, así que un resync
      // (realtime de mi fila / pull) puede haber metido estas mismas figus en
      // core.counts → todo se marcaría "repetida". res.before es inmune a eso.
      const prev: Record<number, number> = { ...(res.before ?? core.counts) };
      const cards = (res.drawnIds ?? []).map((id) => {
        const f = fig(id);
        const before = prev[id] || 0;
        prev[id] = before + 1;
        return { f, isNew: before === 0 };
      });

      setCore((s) => ({
        ...s,
        counts: res.counts ?? { ...s.counts },
        packsRaw: res.packsLeft ?? s.packsRaw,
      }));

      if (cards.length === 0) {
        showToast("No quedan cartas disponibles 😢");
        setSheet({ type: "none" });
        return;
      }

      const goldWon = res.goldWon ?? null;
      const prizeNm = res.prize ? PRIZE_NM[res.prize] ?? null : null;
      setSheet({ type: "pack-reveal", cards, token, goldWon, prizeNm });
      void refreshReino();
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      // Consumido (o fallido): se descarta para que un retry re-pida.
      packPrefetch.current.delete(token);
      setPending(false);
    }
  };

  const handleRevealClose = (goldWon: number | null, prizeNm: string | null) => {
    setSheet({ type: "none" });
    if (goldWon != null) {
      pendingPrizeRef.current = prizeNm;
      setSheet({ type: "dorada", idx: goldWon });
      return;
    }
    if (prizeNm) {
      showCompletion(prizeNm);
      return;
    }
    afterGain();
  };

  const handleDoradaClose = () => {
    setSheet({ type: "none" });
    const pn = pendingPrizeRef.current;
    pendingPrizeRef.current = null;
    if (pn) showCompletion(pn);
    else afterGain();
  };

  // ── sources ──
  const handleSource = (key: string) => {
    if (key === "codigo") return setSheet({ type: "codigo-entry" });
    if (key === "ig") return setSheet({ type: "ig" });
    if (key === "carta") return setSheet({ type: "carta" });
  };

  const grantAndOpen = async (kind: "carta" | "ig") => {
    if (pending) return;
    setPending(true);
    try {
      const res = await grantPack(guestId, kind);
      if (!res.ok) {
        showToast(res.error);
        setSheet({ type: "none" });
        return;
      }
      setCore((s) => ({ ...s, packsRaw: res.packsLeft }));
      setSheet({ type: "pack", token: res.token });
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  const handleSubmitCodigo = async (code: string) => {
    if (pending) return;
    setPending(true);
    try {
      const res = await redeemCodigo(guestId, code);
      if (!res.valid) {
        showToast(res.error ?? "Código incorrecto");
        return;
      }
      setCore((s) => ({ ...s, packsRaw: res.packsLeft }));
      setSheet({ type: "pack", token: res.token });
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  // ── cambios reales ──
  const handlePubRequest = () => setSheet({ type: "pick-request" });

  const handlePickRequest = async (figId: number) => {
    setSheet({ type: "none" });
    if (pending) return;
    setPending(true);
    try {
      const res = await publishRequest(guestId, figId);
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      showToast("Tu pedido salió al Reino 🙋");
      await refreshReino();
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  const handleCancelRequest = async () => {
    if (pending) return;
    setPending(true);
    try {
      await cancelRequest(guestId);
      await refreshReino();
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  const handleFulfill = async (requestId: string) => {
    if (pending) return;
    setPending(true);
    try {
      const res = await fulfillRequest(guestId, requestId);
      await refreshReino();
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      const got = res.gotFigId != null ? fig(res.gotFigId) : null;
      showToast(
        got
          ? `Le pasaste una figu a ${res.requesterName} y te llevaste ${got.nm} 🤝`
          : `Le diste una mano a ${res.requesterName} 🤍`,
      );
      if (res.prize) showCompletion(PRIZE_NM[res.prize] ?? null);
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  const handleConnect = async (code: string) => {
    if (pending) return;
    const clean = code.trim();
    if (!/^\d{4,5}$/.test(clean)) {
      showToast("Tipeá el código de la otra persona");
      return;
    }
    setPending(true);
    try {
      const res = await connectByCode(guestId, clean);
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      await refreshReino();
      pendingPrizeRef.current = res.prize ? PRIZE_NM[res.prize] ?? null : null;
      setSheet({ type: "code-result", otherName: res.otherName, gave: res.gave, got: res.got });
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  // ── sobre regalo ──
  const handleSimGift = () => {
    const giftPending = pendingPacks(core.packsRaw).some((t) => parseToken(t).key === "gift");
    if (local.gift || giftPending) {
      showToast("Ya tenés un sobre regalo en camino 🎁");
      return;
    }
    setLocal({ gift: Date.now() + giftDurationMs });
    showToast("Mirá el contador acá abajo 👇");
  };

  const handleCardTap = (f: Fig, qty: number) => {
    setSheet({ type: "card-detail", f, qty });
  };

  const handleRefreshAlbum = async () => {
    try {
      const d = await loadAlbum(guestId);
      if (d && !("error" in d)) {
        setCore((s) => ({ ...s, counts: d.album.counts, packsRaw: d.album.packsLeft }));
        if (d.album.giftDurationMs) setGiftDurationMs(d.album.giftDurationMs);
      }
    } catch {
      /* ignore */
    }
  };

  const handlePubRequestForFig = async (figId: number) => {
    if (pending) return;
    setPending(true);
    try {
      const res = await publishRequest(guestId, figId);
      if (!res.ok) { showToast(res.error ?? "Error al publicar"); return; }
      showToast("Pedido publicado ✨");
      setSheet({ type: "none" });
      await refreshReino();
    } catch {
      showToast("Error de conexión");
    } finally {
      setPending(false);
    }
  };

  const handleGiftOpen = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await grantPack(guestId, "gift");
      if (!res.ok) {
        setLocal({ gift: null });
        showToast(res.error);
        return;
      }
      setLocal({ gift: null });
      setCore((s) => ({ ...s, packsRaw: res.packsLeft }));
      setSheet({ type: "pack", token: res.token });
    } catch {
      showToast("Error de conexión, probá de nuevo");
    } finally {
      setPending(false);
    }
  };

  // ── perfil ──
  const handleEnterAlbum = async (nombre: string, av: Avatar | null, selfie: string | null) => {
    setCore((s) => ({ ...s, name: nombre, avatar: av, selfie, screen: "app", tab: "album" }));
    const res = await saveGuestProfile(guestId, nombre, av?.n ?? "", selfie);
    if (!res.ok) showToast(res.error);
    void refreshReino();
  };

  const handleEditProfile = () => setCore((s) => ({ ...s, screen: "intro" }));

  // ── gift bar display ──
  const giftDisplay = (() => {
    void nowTick;
    if (!local.gift) return null;
    const left = local.gift - Date.now();
    if (left <= 0) return { ready: true, text: "🎁 ¡Tu sobre llegó! Tocá para abrirlo" };
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return { ready: false, text: `🎁 Sobre de regalo en ${m}:${String(s).padStart(2, "0")}` };
  })();

  const sheetOn = sheet.type !== "none";
  const inApp = core.screen === "app";

  const handleIntroComplete = useCallback(() => {
    introPlayed.current = true;
    setIntroPlaying(false);
  }, []);

  if (introPlaying && !introPlayed.current) {
    return <MagicMIntro onComplete={handleIntroComplete} />;
  }

  return (
    <div className="fk-device">
      <Starfield />
      <Castle />

      {inApp && (
        <Topbar name={core.name} avatar={core.avatar} selfie={core.selfie} uniques={uniques} />
      )}

      <div className="fk-scroll">
        {core.screen === "intro" && (
          <IntroScreen
            name={core.name}
            avatar={core.avatar}
            selfie={core.selfie}
            onAvatarSelect={(a) => setCore((s) => ({ ...s, avatar: a, selfie: null }))}
            onSelfie={(dataUrl) => setCore((s) => ({ ...s, selfie: dataUrl, avatar: dataUrl ? null : s.avatar }))}
            onEnter={(nombre, av, selfie) => void handleEnterAlbum(nombre, av, selfie)}
            onToast={showToast}
          />
        )}

        {inApp && core.tab === "album" && (
          <AlbumScreen
            counts={core.counts}
            golds={reino?.golds ?? []}
            done={done}
            readyTokens={readyTokens}
            cartasFound={cartasFound}
            igUsed={igUsed}
            giftDurationMs={giftDurationMs}
            onOpenToken={(token) => setSheet({ type: "pack", token })}
            onSource={handleSource}
            onOpenTrade={() => handleTab("trade")}
            onCardTap={handleCardTap}
            onRefresh={() => void handleRefreshAlbum()}
          />
        )}

        {inApp && core.tab === "trade" && (
          <TradeScreen
            counts={core.counts}
            done={done}
            busy={pending}
            myRequest={reino?.myRequest ?? null}
            salonRequests={reino?.salonRequests ?? []}
            tradeCode={reino?.tradeCode ?? ""}
            onPubRequest={handlePubRequest}
            onCancelRequest={() => void handleCancelRequest()}
            onFulfill={(id) => void handleFulfill(id)}
            onConnect={(code) => void handleConnect(code)}
          />
        )}

        {inApp && core.tab === "prizes" && (
          <PrizesScreen
            prizes={reino?.prizes ?? []}
            colgantesLeft={reino?.colgantesLeft ?? SEC_TOTAL}
            myColgantes={reino?.myColgantes ?? 0}
            golds={reino?.golds ?? []}
          />
        )}

        {inApp && core.tab === "reino" && (
          <ReinoScreen
            feed={reino?.feed ?? []}
            top={reino?.top ?? []}
            onSync={() => {
              void refreshReino();
              showToast("Reino actualizado ✨");
            }}
          />
        )}

        {inApp && core.tab === "account" && (
          <AccountScreen
            name={core.name}
            avatar={core.avatar}
            selfie={core.selfie}
            nroPulsera={core.nroPulsera}
            mesa={core.mesa}
            counts={core.counts}
            doradas={reino?.golds.filter((g) => g.mine).length ?? 0}
            colgantes={reino?.myColgantes ?? 0}
            tradeCode={reino?.tradeCode ?? ""}
            onEdit={handleEditProfile}
            onSimGift={handleSimGift}
          />
        )}
      </div>

      {inApp && giftDisplay && !sheetOn && (
        <div
          className={`fk-giftbar${giftDisplay.ready ? " ready" : ""}`}
          onClick={() => giftDisplay.ready && void handleGiftOpen()}
        >
          {giftDisplay.text}
        </div>
      )}

      {inApp && !sheetOn && <Nav tab={core.tab} unread={unread} onTab={handleTab} />}

      <div className={`fk-sheet${sheetOn ? " on" : ""}`}>
        {sheet.type === "pack" && (
          <PackSheet token={sheet.token} busy={pending} onOpen={() => void handleOpenEnvelope(sheet.token)} />
        )}
        {sheet.type === "pack-reveal" && (
          <PackRevealSheet
            cards={sheet.cards}
            onClose={() => handleRevealClose(sheet.goldWon, sheet.prizeNm)}
          />
        )}
        {sheet.type === "codigo-entry" && (
          <CodigoEntrySheet
            busy={pending}
            onSubmit={(code) => void handleSubmitCodigo(code)}
            onClose={() => setSheet({ type: "none" })}
            onToast={showToast}
          />
        )}
        {sheet.type === "ig" && (
          <IgSheet busy={pending} onOk={() => void grantAndOpen("ig")} onClose={() => setSheet({ type: "none" })} />
        )}
        {sheet.type === "carta" && (
          <CartaSheet
            busy={pending}
            cartasFound={cartasFound}
            onSubmit={(code) => void handleSubmitCodigo(code)}
            onClose={() => setSheet({ type: "none" })}
            onToast={showToast}
          />
        )}
        {sheet.type === "dorada" && <DoradaOverlay idx={sheet.idx} onClose={handleDoradaClose} />}
        {sheet.type === "completion" && (
          <CompletionOverlay
            name={core.name}
            avatar={core.avatar}
            selfie={core.selfie}
            prizeNm={sheet.prizeNm}
            onStay={() => {
              setSheet({ type: "none" });
              handleTab("reino");
            }}
          />
        )}
        {sheet.type === "pick-request" && (
          <PickRequestSheet
            counts={core.counts}
            onPick={(id) => void handlePickRequest(id)}
            onClose={() => setSheet({ type: "none" })}
          />
        )}
        {sheet.type === "code-result" && (
          <CodeResultSheet
            otherName={sheet.otherName}
            gave={sheet.gave}
            got={sheet.got}
            onClose={() => {
              setSheet({ type: "none" });
              const pn = pendingPrizeRef.current;
              pendingPrizeRef.current = null;
              if (pn) showCompletion(pn);
            }}
          />
        )}
        {sheet.type === "card-detail" && (
          <CardDetailSheet
            f={sheet.f}
            qty={sheet.qty}
            busy={pending}
            onPubRequest={(figId) => void handlePubRequestForFig(figId)}
            onClose={() => setSheet({ type: "none" })}
          />
        )}
      </div>

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
}
