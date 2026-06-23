"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import { createId } from "@paralleldrive/cuid2";
import {
  loadPantalla,
  lanzarCodigo,
  type PantallaData,
} from "../actions/pantalla";

// ─────────────────────────────────────────────
// SUPABASE (cliente browser, singleton)
//
// Realtime se usa SOLO como señal de invalidación: ante cualquier
// cambio en las tablas del juego se re-pide loadPantalla (server
// action = fuente de verdad). Requiere que las tablas estén en la
// publicación de realtime:
//   alter publication supabase_realtime
//     add table "FigusAlbum", "FigusTrivia", "FigusCodigo", "AndroLedGuest";
// ─────────────────────────────────────────────

let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { realtime: { params: { eventsPerSecond: 5 } } },
    );
  }
  return _sb;
}

const REALTIME_TABLES = [
  "FigusAlbum",
  "FigusTrivia",
  "FigusCodigo",
  "AndroLedGuest",
] as const;

// ─────────────────────────────────────────────
// DATA ESTÁTICA (espejo del álbum)
// ─────────────────────────────────────────────

const FIGS: { id: number; g: string; film: string }[] = [
  { id: 1, g: "🍯", film: "Winnie the Pooh" },
  { id: 2, g: "🍎", film: "Blancanieves" },
  { id: 3, g: "🐘", film: "Dumbo" },
  { id: 4, g: "🐶", film: "101 Dálmatas" },
  { id: 5, g: "🧚", film: "Peter Pan" },
  { id: 6, g: "🐚", film: "La Sirenita" },
  { id: 7, g: "🌺", film: "Moana" },
  { id: 8, g: "🏎️", film: "Cars" },
  { id: 9, g: "🐭", film: "Ratatuille" },
  { id: 10, g: "🍃", film: "Pocahontas" },
  { id: 11, g: "👠", film: "Cenicienta" },
  { id: 12, g: "🪔", film: "Aladdín" },
  { id: 13, g: "🖤", film: "Maléfica" },
  { id: 14, g: "💀", film: "Coco" },
  { id: 15, g: "🐸", film: "La Princesa y el Sapo" },
];

const AVATAR_GLYPHS: Record<string, string> = {
  Princesa: "👑",
  Hada: "🧚",
  Mariposa: "🦋",
  Rosa: "🌹",
  Dragón: "🐉",
  Cisne: "🦢",
  Estrella: "⭐",
  Castillo: "🏰",
};

function avatarGlyph(avatar: string | null): string {
  return (avatar && AVATAR_GLYPHS[avatar]) || "👑";
}

// Cara del invitado en la pantalla: selfie si tiene, si no el glyph.
function faceOf(p: { avatar: string | null; selfie: string | null }): React.ReactNode {
  if (p.selfie) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.selfie} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />;
  }
  return avatarGlyph(p.avatar);
}

function figOf(id: number | null) {
  return id === null ? null : (FIGS.find((f) => f.id === id) ?? null);
}

type SceneKey = "ambient" | "trivia" | "win" | "code" | "dorada" | "take" | "race";

const ROW_H = 46;
const TOTAL_FIGS = 15;
const TAKEOVER_MS = 9000;
const POST_TRIVIA_MS = 5500;
const RING_C = 264; // 2πr con r=42

// ─────────────────────────────────────────────
// CSS (inyectado una vez, prefijo ps- para no chocar
// con los estilos fk- del álbum)
// ─────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500;1,600&family=Mulish:wght@400;500;600;700;800;900&display=swap');

.ps-fit{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#06040d;
  font-family:'Mulish',sans-serif;
  --bg-1:#1b1340;--bg-2:#2a1b52;--bg-3:#120b2c;
  --gold-1:#f6dd99;--gold-2:#e3b85f;--gold-3:#b98a35;
  --rose:#f1a8c6;--rose-deep:#d76a98;
  --ink:#f6f0e6;--muted:#bcb1da;--muted-2:#8a7eb0;
  --line:rgba(246,221,153,.18);--glass:rgba(34,24,66,.5);
  --green:#86e6ad}
.ps-fit *,.ps-fit *::before,.ps-fit *::after{box-sizing:border-box;margin:0;padding:0}

/* escenario fijo 1280x720, escalado por JS */
.ps-screen{position:relative;width:1280px;height:720px;transform-origin:center center;
  color:var(--ink);overflow:hidden;border-radius:14px;
  background:
    radial-gradient(120% 70% at 50% -8%, rgba(241,168,198,.16), transparent 55%),
    radial-gradient(120% 80% at 50% 120%, rgba(124,92,255,.22), transparent 60%),
    linear-gradient(180deg,var(--bg-1) 0%,var(--bg-2) 45%,var(--bg-3) 100%);
  box-shadow:0 40px 120px rgba(0,0,0,.6)}

.ps-stars{position:absolute;inset:0;z-index:0;pointer-events:none}
.ps-stars i{position:absolute;background:#fff;border-radius:50%;animation:ps-tw 4s infinite ease-in-out}
@keyframes ps-tw{0%,100%{opacity:.1;transform:scale(.7)}50%{opacity:.8;transform:scale(1)}}

.ps-castle{position:absolute;left:0;right:0;bottom:0;height:360px;z-index:0;opacity:.55;pointer-events:none}
.ps-castle svg{width:100%;height:100%;display:block}

/* ---- header ---- */
.ps-head{position:absolute;top:34px;left:48px;right:48px;display:flex;align-items:flex-start;justify-content:space-between;z-index:5}
.ps-kicker{font-weight:800;font-size:15px;letter-spacing:.42em;text-transform:uppercase;color:var(--gold-2)}
.ps-head h1{font-family:'Cormorant Garamond';font-weight:700;font-size:58px;line-height:.85;margin-top:2px;
  background:linear-gradient(180deg,#fff 0%,var(--gold-1) 55%,var(--gold-2) 100%);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  filter:drop-shadow(0 3px 22px rgba(227,184,95,.25))}
.ps-head .sub{color:var(--muted);font-weight:600;font-size:16px;letter-spacing:.06em;margin-top:6px}

/* ---- progreso colectivo (hero izquierda) ---- */
.ps-hero{position:absolute;left:48px;bottom:54px;width:560px;z-index:4}
.ps-hero .lbl{font-weight:800;font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-2)}
.ps-hero .count{font-family:'Cormorant Garamond';font-weight:700;font-size:74px;line-height:.9;margin-top:4px;color:#fff}
.ps-hero .count b{background:linear-gradient(180deg,var(--rose),var(--gold-1));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.ps-hero .count small{font-size:34px;color:var(--muted-2);font-weight:600}
.ps-hero .of{color:var(--muted);font-weight:600;font-size:16px;margin-top:8px;letter-spacing:.04em}
.ps-hero .bar{height:12px;border-radius:99px;background:rgba(255,255,255,.08);margin-top:16px;overflow:hidden;width:480px}
.ps-hero .bar > i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--rose),var(--gold-1));transition:width 1s cubic-bezier(.2,.8,.2,1);box-shadow:0 0 22px rgba(246,221,153,.5)}

/* ---- leaderboard (derecha) ---- */
.ps-board{position:absolute;top:150px;right:48px;width:480px;z-index:5}
.ps-board-h{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}
.ps-board-h .t{font-family:'Cormorant Garamond';font-weight:700;font-size:34px;color:#fff;line-height:1}
.ps-board-h .p{font-weight:800;font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-2)}
.ps-rows{position:relative;height:476px}
.ps-row{position:absolute;left:0;right:0;height:44px;display:flex;align-items:center;gap:12px;padding:0 14px;border-radius:12px;
  transition:transform .85s cubic-bezier(.22,.9,.25,1), background .4s, opacity .4s;
  background:linear-gradient(90deg,rgba(34,24,66,.55),rgba(34,24,66,.2));pointer-events:none}
.ps-row.lead{background:linear-gradient(90deg,rgba(227,184,95,.16),rgba(34,24,66,.15));box-shadow:0 0 0 1px var(--line) inset}
.ps-row .rk{width:26px;font-family:'Cormorant Garamond';font-weight:700;font-size:24px;color:var(--muted-2);text-align:center;flex:0 0 auto}
.ps-row.lead .rk{color:var(--gold-1)}
.ps-row .av{width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:17px;flex:0 0 auto}
.ps-row .nm{font-weight:700;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto;max-width:150px}
.ps-row .miss{font-size:11.5px;color:var(--rose);font-weight:700;display:flex;align-items:center;gap:4px;margin-left:6px;opacity:.95;white-space:nowrap}
.ps-row .miss .mg{font-size:14px}
.ps-row .ct{margin-left:auto;font-family:'Cormorant Garamond';font-weight:700;font-size:24px;color:#fff;flex:0 0 auto}
.ps-row .ct small{font-size:14px;color:var(--muted-2)}
.ps-row .ct.ps-bump{animation:ps-bump .5s ease}
@keyframes ps-bump{0%{transform:scale(1);color:var(--gold-1)}40%{transform:scale(1.35);color:var(--gold-1)}100%{transform:scale(1)}}

/* ---- QR ---- */
.ps-qr{position:absolute;left:48px;top:170px;z-index:4;display:flex;align-items:center;gap:16px;
  background:var(--glass);border:1px solid var(--line);border-radius:18px;padding:16px 20px 16px 16px;
  opacity:0;transform:translateY(8px);transition:.5s}
.ps-qr.on{opacity:1;transform:translateY(0)}
.ps-qr .code{width:84px;height:84px;border-radius:10px;background:#fff;padding:7px}
.ps-qr .txt .a{font-weight:900;font-size:16px;color:var(--ink)}
.ps-qr .txt .b{font-size:12.5px;color:var(--muted);font-weight:600;margin-top:2px;max-width:150px;line-height:1.3}

/* ---- overlay genérico ---- */
.ps-ov{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;opacity:0;pointer-events:none;transition:opacity .45s;backdrop-filter:blur(2px)}
.ps-ov.on{opacity:1;pointer-events:auto}
.ps-ov-dim{background:rgba(8,6,15,.55)}
.ps-ov-strong{background:rgba(8,6,15,.82)}

/* trivia */
.ps-triv{width:760px;max-width:84%}
.ps-triv .tag{display:inline-flex;align-items:center;gap:8px;background:rgba(241,168,198,.16);border:1px solid var(--line);
  border-radius:99px;padding:8px 18px;font-weight:800;font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:var(--rose)}
.ps-triv .q{font-family:'Cormorant Garamond';font-weight:700;font-size:50px;line-height:1.05;margin:22px 0 26px;color:#fff}
.ps-triv .opts{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ps-triv .opt{background:var(--glass);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px;
  font-weight:700;font-size:22px;display:flex;align-items:center;gap:14px}
.ps-triv .opt .k{width:34px;height:34px;border-radius:9px;background:rgba(246,221,153,.16);color:var(--gold-1);
  display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond';font-weight:700;font-size:20px;flex:0 0 auto}
.ps-ring{position:relative;width:96px;height:96px;margin:28px auto 0}
.ps-ring svg{transform:rotate(-90deg)}
.ps-ring .num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-family:'Cormorant Garamond';font-weight:700;font-size:40px;color:var(--gold-1)}

/* cierre de trivia */
.ps-win{width:680px;max-width:84%}
.ps-win .small{font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:var(--gold-2);font-size:15px}
.ps-win .who{display:flex;align-items:center;justify-content:center;gap:18px;margin:18px 0}
.ps-win .who .av{width:84px;height:84px;border-radius:22px;background:rgba(246,221,153,.16);border:1px solid var(--line);
  display:flex;align-items:center;justify-content:center;font-size:46px}
.ps-win .who .nm{font-family:'Cormorant Garamond';font-weight:700;font-size:64px;color:#fff;line-height:.9}
.ps-win .prize{display:inline-flex;align-items:center;gap:12px;background:linear-gradient(180deg,var(--rose),var(--rose-deep));
  color:#3a0f23;font-weight:900;font-size:22px;padding:14px 26px;border-radius:16px;box-shadow:0 16px 40px rgba(215,106,152,.4)}
.ps-win .prize .pi{font-size:28px}

/* código sorpresa */
.ps-code-ov .small{font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:var(--rose);font-size:16px}
.ps-code-ov .say{font-family:'Cormorant Garamond';font-weight:600;font-size:30px;color:var(--muted);margin-top:14px}
.ps-code-ov .word{font-family:'Cormorant Garamond';font-weight:700;font-size:150px;line-height:.9;margin:6px 0 4px;letter-spacing:.06em;
  background:linear-gradient(180deg,#fff,var(--gold-1));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  filter:drop-shadow(0 6px 36px rgba(246,221,153,.4));animation:ps-beat 1.4s infinite}
@keyframes ps-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
.ps-code-ov .reward{font-weight:800;font-size:22px;color:var(--ink);margin-top:16px}
.ps-code-ov .cd{margin-top:18px;font-weight:800;font-size:18px;color:var(--gold-1);letter-spacing:.1em}

/* rayos */
.ps-rays{position:absolute;width:1400px;height:1400px;left:50%;top:50%;transform:translate(-50%,-50%);z-index:0;border-radius:50%;
  background:conic-gradient(from 0deg,rgba(246,221,153,0),rgba(246,221,153,.16) 4%,rgba(246,221,153,0) 9%,
    rgba(246,221,153,0),rgba(246,221,153,.16) 29%,rgba(246,221,153,0) 34%,rgba(246,221,153,0),
    rgba(246,221,153,.16) 54%,rgba(246,221,153,0) 59%,rgba(246,221,153,0),rgba(246,221,153,.16) 79%,rgba(246,221,153,0) 84%);
  animation:ps-spin 24s linear infinite;opacity:0;transition:opacity .5s}
.ps-ov.on .ps-rays{opacity:1}
@keyframes ps-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}

/* completó el Reino */
.ps-takeover .small{font-weight:900;letter-spacing:.34em;text-transform:uppercase;color:var(--gold-2);font-size:17px;position:relative;z-index:2}
.ps-takeover .big{font-family:'Cormorant Garamond';font-weight:700;font-size:120px;line-height:.85;margin:10px 0 6px;position:relative;z-index:2;
  background:linear-gradient(180deg,#fff,var(--gold-1));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  filter:drop-shadow(0 6px 40px rgba(246,221,153,.45))}
.ps-takeover .line{font-family:'Cormorant Garamond';font-weight:500;font-style:italic;font-size:34px;color:var(--ink);position:relative;z-index:2}
.ps-takeover .prize{display:inline-flex;align-items:center;gap:14px;margin-top:26px;position:relative;z-index:2;
  background:linear-gradient(180deg,var(--gold-1),var(--gold-2));color:#2a1c08;font-weight:900;font-size:26px;
  padding:16px 32px;border-radius:18px;box-shadow:0 18px 50px rgba(227,184,95,.5)}
.ps-takeover .prize .pi{font-size:32px}
.ps-spark{position:absolute;border-radius:50%;z-index:1;background:var(--gold-1);opacity:0}
.ps-ov.on .ps-spark{animation:ps-sp 1.6s ease-out infinite}
@keyframes ps-sp{0%{opacity:0;transform:translateY(0) scale(.4)}20%{opacity:1}100%{opacity:0;transform:translateY(-120px) scale(1)}}

/* dorada */
.ps-dorada .small{font-weight:900;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-2);font-size:16px;position:relative;z-index:2}
.ps-dorada .big{font-family:'Cormorant Garamond';font-weight:700;font-size:96px;line-height:.9;margin:12px 0 4px;position:relative;z-index:2;
  background:linear-gradient(180deg,#fff,var(--gold-1));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.ps-dorada .line{font-family:'Cormorant Garamond';font-style:italic;font-size:30px;color:var(--ink);position:relative;z-index:2}
.ps-dorada .prize{display:inline-flex;align-items:center;gap:14px;margin-top:24px;position:relative;z-index:2;
  background:linear-gradient(180deg,var(--gold-1),var(--gold-2));color:#2a1c08;font-weight:900;font-size:24px;
  padding:15px 30px;border-radius:18px;box-shadow:0 18px 50px rgba(227,184,95,.5)}
.ps-dorada .prize .pi{font-size:30px}

/* carrera final */
.ps-race .small{font-weight:900;letter-spacing:.3em;text-transform:uppercase;color:var(--rose);font-size:17px}
.ps-race h2{font-family:'Cormorant Garamond';font-weight:700;font-size:52px;color:#fff;margin:8px 0 30px}
.ps-race .three{display:flex;gap:26px;align-items:flex-end}
.ps-race .cmp{width:250px;background:linear-gradient(180deg,rgba(40,28,80,.7),rgba(20,13,49,.7));border:1px solid var(--line);
  border-radius:22px;padding:26px 18px;text-align:center;position:relative}
.ps-race .cmp.first{border-color:var(--gold-1);box-shadow:0 0 0 2px rgba(246,221,153,.25),0 20px 50px rgba(227,184,95,.25);transform:translateY(-14px)}
.ps-race .cmp .av{font-size:56px}
.ps-race .cmp .nm{font-family:'Cormorant Garamond';font-weight:700;font-size:38px;color:#fff;margin-top:6px;line-height:.9}
.ps-race .cmp .ct{font-weight:900;font-size:20px;color:var(--gold-1);margin-top:10px}
.ps-race .cmp .miss{font-size:13px;color:var(--rose);font-weight:700;margin-top:8px}
.ps-race .cmp .crown{position:absolute;top:-26px;left:50%;transform:translateX(-50%);font-size:34px}

/* ---- barra de control (operador) ---- */
.ps-ctrl{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:100;display:flex;gap:7px;flex-wrap:wrap;
  justify-content:center;background:rgba(8,6,15,.82);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:9px 11px;
  max-width:94vw;backdrop-filter:blur(8px)}
.ps-ctrl button{appearance:none;border:1px solid rgba(246,221,153,.25);background:rgba(34,24,66,.6);color:var(--ink);
  font-family:'Mulish';font-weight:800;font-size:12px;padding:9px 13px;border-radius:9px;cursor:pointer;white-space:nowrap}
.ps-ctrl button:active{transform:scale(.96)}
.ps-ctrl button.act{background:linear-gradient(180deg,var(--gold-1),var(--gold-2));color:#2a1c08;border-color:transparent}
.ps-ctrl .sep{width:1px;background:rgba(255,255,255,.12);margin:2px 3px}
.ps-ctrl .hint{align-self:center;font-size:10.5px;color:var(--muted-2);font-weight:700;letter-spacing:.05em;padding:0 4px}
.ps-ctrl button.launch{background:linear-gradient(180deg,var(--rose),var(--rose-deep));color:#3a0f23;border-color:transparent}
.ps-ctrl button:disabled{opacity:.45;cursor:not-allowed}
.ps-ctrl .status{align-self:center;font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:0 4px;max-width:220px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--green)}
.ps-ctrl .status.err{color:var(--rose)}
.ps-ctrl-toggle{position:fixed;right:14px;bottom:14px;z-index:101;appearance:none;cursor:pointer;
  background:rgba(8,6,15,.82);border:1px solid rgba(255,255,255,.12);color:var(--muted);
  font-family:'Mulish';font-weight:800;font-size:12px;padding:9px 14px;border-radius:99px;backdrop-filter:blur(8px)}
.ps-ctrl-toggle:active{transform:scale(.96)}
`;

// ─────────────────────────────────────────────
// SUBCOMPONENTES ESTÁTICOS
// ─────────────────────────────────────────────

function Starfield() {
  const stars = useRef(
    Array.from({ length: 70 }, (_, i) => ({
      key: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 65}%`,
      size: `${Math.random() * 2.4 + 1}px`,
      delay: `${Math.random() * 4}s`,
    })),
  );
  return (
    <div className="ps-stars">
      {stars.current.map((s) => (
        <i
          key={s.key}
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

function Castle() {
  return (
    <div className="ps-castle">
      <svg viewBox="0 0 1280 360" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="ps-cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a2a66" />
            <stop offset="1" stopColor="#150d31" />
          </linearGradient>
        </defs>
        <g fill="url(#ps-cg)">
          <rect x="120" y="230" width="120" height="130" />
          <polygon points="120,230 180,150 240,230" />
          <rect x="1040" y="230" width="120" height="130" />
          <polygon points="1040,230 1100,150 1160,230" />
          <rect x="470" y="180" width="340" height="180" />
          <rect x="540" y="90" width="64" height="270" />
          <polygon points="540,90 572,28 604,90" />
          <rect x="676" y="90" width="64" height="270" />
          <polygon points="676,90 708,28 740,90" />
          <rect x="600" y="60" width="80" height="300" />
          <polygon points="600,60 640,-6 680,60" />
          <rect x="380" y="260" width="520" height="100" />
        </g>
        <g fill="#f6dd99">
          <rect x="632" y="96" width="16" height="26" rx="6" />
          <rect x="565" y="120" width="14" height="22" rx="6" />
          <rect x="701" y="120" width="14" height="22" rx="6" />
          <rect x="165" y="262" width="16" height="26" rx="6" />
          <rect x="1099" y="262" width="16" height="26" rx="6" />
          <rect x="618" y="250" width="44" height="78" rx="20" />
        </g>
      </svg>
    </div>
  );
}

function QrCard({ on, url }: { on: boolean; url: string | null }) {
  // QR real apuntando a /[cuid]. La creación del guest/álbum para
  // ese id ya la maneja la ruta /:id (loadAlbum la crea al vuelo
  // si no existe). El cuid se genera una sola vez en el cliente
  // al montar la pantalla — ver más abajo.
  return (
    <div className={`ps-qr${on ? " on" : ""}`}>
      <div className="code">
        {url && (
          <QRCodeSVG
            value={url}
            size={70}
            bgColor="#ffffff"
            fgColor="#0c0920"
            level="M"
            style={{ display: "block", width: "100%", height: "100%" }}
          />
        )}
      </div>
      <div className="txt">
        <div className="a">Escaneá y jugá</div>
        <div className="b">Tocá tu pulsera o escaneá · sin instalar nada</div>
      </div>
    </div>
  );
}

function Sparks() {
  const sparks = useRef(
    Array.from({ length: 22 }, (_, i) => {
      const sz = Math.random() * 8 + 4;
      return {
        key: i,
        width: `${sz}px`,
        height: `${sz}px`,
        left: `${Math.random() * 100}%`,
        top: `${40 + Math.random() * 40}%`,
        background: Math.random() > 0.5 ? "#f6dd99" : "#f1a8c6",
        animationDelay: `${Math.random() * 1.4}s`,
      };
    }),
  );
  return (
    <>
      {sparks.current.map(({ key, ...style }) => (
        <div key={key} className="ps-spark" style={style} />
      ))}
    </>
  );
}

// Anillo de cuenta regresiva de la trivia
function CountdownRing({
  endsAt,
  durationSeconds,
  now,
}: {
  endsAt: string | null;
  durationSeconds: number | null;
  now: number;
}) {
  if (!endsAt || !durationSeconds) return null;
  const remainingMs = Math.max(0, Date.parse(endsAt) - now);
  const frac = Math.min(1, 1 - remainingMs / (durationSeconds * 1000));
  return (
    <div className="ps-ring">
      <svg width="96" height="96">
        <circle
          cx="48"
          cy="48"
          r="42"
          stroke="rgba(255,255,255,.1)"
          strokeWidth="7"
          fill="none"
        />
        <circle
          cx="48"
          cy="48"
          r="42"
          stroke="#f6dd99"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={(RING_C * frac).toFixed(1)}
        />
      </svg>
      <div className="num">{Math.ceil(remainingMs / 1000)}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL — Pantalla del salón
// ─────────────────────────────────────────────

export default function PantallaSalon() {
  const nombre = "Martina";
  const [data, setData] = useState<PantallaData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [scale, setScale] = useState(1);
  const [manual, setManual] = useState<"auto" | SceneKey>("auto");
  const [takeoverName, setTakeoverName] = useState<string | null>(null);
  const [postTrivia, setPostTrivia] = useState(false);
  const [bumped, setBumped] = useState<Set<string>>(new Set());
  const [qrTarget, setQrTarget] = useState<string | null>(null);
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const [launching, setLaunching] = useState<"trivia" | "codigo" | null>(null);
  const [launchMsg, setLaunchMsg] = useState<{ text: string; err: boolean } | null>(null);
  const launchMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevUniques = useRef<Map<string, number>>(new Map());
  const prevTriviaId = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const takeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL del QR: /[cuid] con un id generado una vez en el cliente.
  // El origin solo existe en el browser, por eso se resuelve en un
  // efecto (SSR-safe). La ruta /:id ya crea el guest+álbum al vuelo
  // (vía loadAlbum) la primera vez que alguien la visita.
  useEffect(() => {
    if (true) setQrTarget(`${window.location.origin}/${createId()}`);
  }, []);

  // CSS inyectado una vez
  useEffect(() => {
    const id = "ps-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);

  // ── Datos: carga inicial + polling de respaldo ──
  const refresh = useCallback(async () => {
    try {
      setData(await loadPantalla());
    } catch {
      // se reintenta en el próximo tick de polling / evento realtime
    }
  }, []);

  const refreshDebounced = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void refresh(), 300);
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), 20000);
    return () => clearInterval(iv);
  }, [refresh]);

  // ── Realtime: cualquier cambio en las tablas del juego invalida ──
  useEffect(() => {
    const sb = getSupabase();
    let ch = sb.channel("figus-pantalla");
    for (const table of REALTIME_TABLES) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        refreshDebounced,
      );
    }
    ch.subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [refreshDebounced]);

  // ── Reloj (cuentas regresivas + expiración de ventanas) ──
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  // ── Escalado del escenario 1280x720 ──
  // Con la barra colapsada se recupera su alto para el escenario.
  useEffect(() => {
    const fit = () => {
      const pad = 16;
      const ctrlH = ctrlOpen ? 64 : 0;
      const w = window.innerWidth - pad * 2;
      const h = window.innerHeight - pad * 2 - ctrlH;
      setScale(Math.min(w / 1280, h / 720));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [ctrlOpen]);

  // ── Detección de cambios: bump de contadores + "completó el Reino" ──
  useEffect(() => {
    if (!data) return;
    const inc: string[] = [];
    let completed: string | null = null;
    for (const p of data.players) {
      const prev = prevUniques.current.get(p.id);
      if (prev !== undefined && p.uniques > prev) inc.push(p.id);
      if (prev !== undefined && prev < TOTAL_FIGS && p.uniques >= TOTAL_FIGS) {
        completed = p.name;
      }
      prevUniques.current.set(p.id, p.uniques);
    }
    if (inc.length) {
      setBumped(new Set(inc));
      if (bumpTimer.current) clearTimeout(bumpTimer.current);
      bumpTimer.current = setTimeout(() => setBumped(new Set()), 600);
    }
    if (completed) {
      setTakeoverName(completed);
      if (takeTimer.current) clearTimeout(takeTimer.current);
      takeTimer.current = setTimeout(() => setTakeoverName(null), TAKEOVER_MS);
    }
  }, [data]);

  // ── Ventanas activas (derivadas del reloj) ──
  const triviaActive =
    data?.trivia && (!data.trivia.endsAt || now < Date.parse(data.trivia.endsAt))
      ? data.trivia
      : null;
  const codigoActive =
    data?.codigo && (!data.codigo.endsAt || now < Date.parse(data.codigo.endsAt))
      ? data.codigo
      : null;

  // Cierre de trivia → banner "se cerró" unos segundos
  useEffect(() => {
    const cur = triviaActive?.id ?? null;
    if (prevTriviaId.current && !cur) {
      setPostTrivia(true);
      if (postTimer.current) clearTimeout(postTimer.current);
      postTimer.current = setTimeout(() => setPostTrivia(false), POST_TRIVIA_MS);
    }
    prevTriviaId.current = cur;
  }, [triviaActive?.id]);

  // Limpieza de timers al desmontar
  useEffect(
    () => () => {
      for (const t of [
        debounceTimer.current,
        bumpTimer.current,
        takeTimer.current,
        postTimer.current,
        launchMsgTimer.current,
      ]) {
        if (t) clearTimeout(t);
      }
    },
    [],
  );

  // ── Lanzar código desde la barra de control (la trivia fue eliminada) ──
  const showLaunchMsg = useCallback((text: string, err: boolean) => {
    setLaunchMsg({ text, err });
    if (launchMsgTimer.current) clearTimeout(launchMsgTimer.current);
    launchMsgTimer.current = setTimeout(() => setLaunchMsg(null), 4000);
  }, []);

  const handleLaunch = useCallback(
    async (kind: "codigo") => {
      if (launching) return;
      setLaunching(kind);
      try {
        const res = await lanzarCodigo();
        if (!res.ok) {
          showLaunchMsg(res.error, true);
          return;
        }
        // Volver a modo auto para que la nueva ronda tome la pantalla,
        // y refrescar ya (sin esperar al evento realtime)
        setManual("auto");
        refreshDebounced();
        showLaunchMsg(`🔢 Código: ${res.label}`, false);
      } catch {
        showLaunchMsg("Error de conexión", true);
      } finally {
        setLaunching(null);
      }
    },
    [launching, refreshDebounced, showLaunchMsg],
  );

  // ── Escena efectiva ──
  // Manual (operador) pisa todo; en "auto" manda la DB:
  // completó > trivia > cierre de trivia > código > ambiente.
  const scene: SceneKey =
    manual !== "auto"
      ? manual
      : takeoverName
        ? "take"
        : triviaActive
          ? "trivia"
          : postTrivia
            ? "win"
            : codigoActive
              ? "code"
              : "ambient";

  // ── Leaderboard derivado ──
  const players = data?.players ?? [];
  const sorted = useMemo(
    () =>
      [...players].sort(
        (a, b) => b.uniques - a.uniques || a.name.localeCompare(b.name),
      ),
    [players],
  );
  const top10 = sorted.slice(0, 10);
  const indexOf = useMemo(() => {
    const m = new Map<string, number>();
    sorted.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [sorted]);
  const leader = sorted[0] ?? null;
  const top3 = sorted.slice(0, 3);

  const collected = data?.collected ?? 0;
  const goal = data?.goal ?? 3000;
  const barPct = Math.min(100, (collected / Math.max(1, goal)) * 100);

  const codigoRemaining = codigoActive?.endsAt
    ? Math.max(0, Math.ceil((Date.parse(codigoActive.endsAt) - now) / 1000))
    : null;

  const KS = ["A", "B", "C", "D"];

  return (
    <div className="ps-fit">
      <div className="ps-screen" style={{ transform: `scale(${scale})` }}>
        <Starfield />
        <Castle />

        {/* header */}
        <div className="ps-head">
          <div>
            <div className="ps-kicker">Los quince de</div>
            <h1>{nombre}</h1>
            <div className="sub">
              Figus del Reino · juntá las 15 y completá el álbum
            </div>
          </div>
        </div>

        {/* QR (solo en ambiente) */}
        <QrCard on={scene === "ambient"} url={qrTarget} />

        {/* progreso colectivo */}
        <div className="ps-hero">
          <div className="lbl">El Reino, entre todos</div>
          <div className="count">
            <b>{collected.toLocaleString("es-AR")}</b>
            <small> / {goal.toLocaleString("es-AR")}</small>
          </div>
          <div className="of">
            figuritas de {nombre} ya descubiertas esta noche
          </div>
          <div className="bar">
            <i style={{ width: `${barPct}%` }} />
          </div>
        </div>

        {/* leaderboard */}
        <div className="ps-board">
          <div className="ps-board-h">
            <div className="t">Top 10</div>
            <div className="p">· los que más llevan</div>
          </div>
          <div className="ps-rows">
            {sorted.slice(0, 14).map((p) => {
              const idx = indexOf.get(p.id) ?? 99;
              const inTop = idx < 10;
              const isLead = idx < 3;
              const miss = isLead ? figOf(p.missingId) : null;
              return (
                <div
                  key={p.id}
                  className={`ps-row${isLead ? " lead" : ""}`}
                  style={{
                    transform: `translateY(${Math.min(idx, 10) * ROW_H}px)`,
                    opacity: inTop ? 1 : 0,
                  }}
                >
                  <div className="rk">{idx + 1}</div>
                  <div className="av" style={{overflow:"hidden"}}>{faceOf(p)}</div>
                  <div className="nm">{p.name}</div>
                  <div className="miss">
                    {miss && (
                      <>
                        <span className="mg">{miss.g}</span> falta {miss.film}
                      </>
                    )}
                  </div>
                  <div className={`ct${bumped.has(p.id) ? " ps-bump" : ""}`}>
                    {p.uniques}
                    <small>/15</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── OVERLAYS ── */}

        {/* trivia en vivo */}
        <div className={`ps-ov ps-ov-dim${scene === "trivia" ? " on" : ""}`}>
          <div className="ps-triv">
            <span className="tag">💡 Trivia Disney</span>
            {triviaActive ? (
              <>
                <div className="q">{triviaActive.question}</div>
                <div className="opts">
                  {triviaActive.options.map((o, i) => (
                    <div key={i} className="opt">
                      <span className="k">{KS[i] ?? "·"}</span>
                      {o}
                    </div>
                  ))}
                </div>
                <CountdownRing
                  endsAt={triviaActive.endsAt}
                  durationSeconds={triviaActive.durationSeconds}
                  now={now}
                />
              </>
            ) : (
              <div className="q">No hay trivia activa ahora</div>
            )}
          </div>
        </div>

        {/* cierre de trivia (los que acertaron ganaron sobre) */}
        <div className={`ps-ov ps-ov-dim${scene === "win" ? " on" : ""}`}>
          <div className="ps-win">
            <div className="small">Se cerró la trivia</div>
            <div className="who">
              <div className="av">💡</div>
              <div className="nm">¡Tiempo!</div>
            </div>
            <div className="prize">
              <span className="pi">🎁</span>
              <span>Los que acertaron ganaron 1 sobre</span>
            </div>
          </div>
        </div>

        {/* código sorpresa */}
        <div
          className={`ps-ov ps-ov-dim ps-code-ov${scene === "code" ? " on" : ""}`}
        >
          <div className="small">¡Código sorpresa!</div>
          <div className="say">{nombre} dice por micrófono:</div>
          <div className="word">{codigoActive?.code ?? "—"}</div>
          <div className="reward">
            Todos los que lo tipean suman{" "}
            <b style={{ color: "var(--gold-1)" }}>1 sobre</b> 🎁
          </div>
          <div className="cd">
            {codigoRemaining !== null
              ? `se cierra en ${codigoRemaining}s`
              : codigoActive
                ? "¡abierto ahora!"
                : "no hay código activo"}
          </div>
        </div>

        {/* figurita dorada (escena manual del operador) */}
        <div
          className={`ps-ov ps-ov-dim ps-dorada${scene === "dorada" ? " on" : ""}`}
        >
          <div className="ps-rays" />
          <div className="small">✨ ¡Figurita dorada! ✨</div>
          <div className="big">{leader?.name ?? "—"}</div>
          <div className="line">
            sacó la{" "}
            <b style={{ fontStyle: "normal", color: "var(--gold-1)" }}>
              {nombre} · El Vals
            </b>{" "}
            👑
          </div>
          <div className="prize">
            <span className="pi">🕛</span>Se gana el Reloj Disney
          </div>
        </div>

        {/* completó el Reino */}
        <div
          className={`ps-ov ps-ov-strong ps-takeover${scene === "take" ? " on" : ""}`}
        >
          <div className="ps-rays" />
          {scene === "take" && <Sparks />}
          <div className="small">¡Completó el Reino!</div>
          <div className="big">{takeoverName ?? leader?.name ?? "—"}</div>
          <div className="line">juntó las 15 figuritas de {nombre}</div>
          <div className="prize">
            <span className="pi">📷</span>
            <span>Gana la cámara de fotos</span>
          </div>
        </div>

        {/* carrera final */}
        <div
          className={`ps-ov ps-ov-strong ps-race${scene === "race" ? " on" : ""}`}
        >
          <div className="small">🔥 La carrera final</div>
          <h2>¿Quién cierra primero por la cámara?</h2>
          <div className="three">
            {top3.map((p, i) => {
              const miss = figOf(p.missingId);
              return (
                <div key={p.id} className={`cmp${i === 0 ? " first" : ""}`}>
                  {i === 0 && <div className="crown">👑</div>}
                  <div className="av" style={{overflow:"hidden"}}>{faceOf(p)}</div>
                  <div className="nm">{p.name}</div>
                  <div className="ct">{p.uniques}/15</div>
                  <div className="miss">
                    {miss ? `le falta ${miss.g} ${miss.film}` : "¡la tiene casi!"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* barra de control del operador (colapsable) */}
      {ctrlOpen ? (
        <div className="ps-ctrl">
          <span className="hint">CONTROL ·</span>
          <button
            className={manual === "auto" ? "act" : ""}
            onClick={() => setManual("auto")}
          >
            ▶ Auto
          </button>
          <span className="sep" />
          {(
            [
              ["ambient", "Ambiente"],
              ["code", "Código"],
              ["dorada", "Dorada 🕛"],
              ["take", "Completó 📷"],
              ["race", "Carrera final"],
            ] as [SceneKey, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              className={manual === k ? "act" : ""}
              onClick={() => setManual(k)}
            >
              {label}
            </button>
          ))}
          <span className="sep" />
          <span className="hint">LANZAR ·</span>
          <button
            className="launch"
            disabled={launching !== null}
            onClick={() => void handleLaunch("codigo")}
          >
            {launching === "codigo" ? "Lanzando…" : "🔢 Código (45s)"}
          </button>
          {launchMsg && (
            <span className={`status${launchMsg.err ? " err" : ""}`}>
              {launchMsg.text}
            </span>
          )}
          <span className="sep" />
          <button onClick={() => setCtrlOpen(false)}>✕</button>
        </div>
      ) : (
        <button className="ps-ctrl-toggle" onClick={() => setCtrlOpen(true)}>
          ⚙ Control
        </button>
      )}
    </div>
  );
}