"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  crearCodigoEntrevista,
  loadEntrevista,
  cancelarCodigoEntrevista,
  type EntrevistaCodigo,
  type CodigoKind,
} from "../actions/entrevista";

// ── supabase realtime (señal de invalidación, igual que admin-reino) ──
let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_sb) _sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 5 } } });
  return _sb;
}

// Figus que da el sobre. Espejo de los valores típicos de entrevista (+1/+3/+5/+10).
const VALUES = [1, 2, 3, 5, 10];

const KINDS: { k: CodigoKind; ic: string; label: string }[] = [
  { k: "codigo", ic: "🎤", label: "Entrevista" },
  { k: "carta", ic: "🃏", label: "Sobre escondido" },
];

// El layout raíz importa [id]/styles.css globalmente (body { cursor: none }).
// Acá no hay cursor custom → lo restauramos en .ent-wrap.
const CSS = `
.ent-wrap { min-height: 100vh; background: linear-gradient(180deg,#150f33,#0c0920); color: #f6f0e6; font-family: 'Mulish',system-ui,sans-serif; padding: 22px 16px 90px; cursor: auto; }
.ent-in { max-width: 560px; margin: 0 auto; }
.ent-kick { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: #e3b85f; font-weight: 800; }
.ent-h1 { font-size: 28px; font-weight: 900; margin: 6px 0 8px; }
.ent-sub { font-size: 14px; color: #c8bee6; line-height: 1.5; margin: 0 0 20px; }
.ent-sub b { color: #f6dd99; }
.ent-vals { display: flex; gap: 10px; margin-bottom: 14px; }
.ent-chip { flex: 1; appearance: none; border: 1px solid rgba(246,221,153,.25); background: rgba(34,24,66,.55); color: #f6f0e6; font-weight: 800; font-size: 17px; padding: 14px 0; border-radius: 13px; cursor: pointer; transition: transform .1s, background .15s, border-color .15s; }
.ent-chip:active { transform: translateY(1px); }
.ent-chip.act { background: linear-gradient(180deg,#f6dd99,#e3b85f); color: #2a1c08; border-color: transparent; }
.ent-gen { width: 100%; appearance: none; border: 0; cursor: pointer; font-weight: 900; font-size: 17px; padding: 17px; border-radius: 15px; color: #2a1c08; background: linear-gradient(180deg,#f6dd99,#e3b85f); transition: filter .15s, transform .1s; }
.ent-gen:active { transform: translateY(1px); }
.ent-gen:disabled { opacity: .55; cursor: default; }
.ent-msg { margin-top: 12px; font-size: 14px; font-weight: 700; text-align: center; }
.ent-msg.err { color: #f1a8c6; }
.ent-big { margin-top: 18px; background: rgba(246,221,153,.1); border: 1px solid rgba(246,221,153,.3); border-radius: 18px; padding: 22px 16px; text-align: center; }
.ent-big-l { font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #e3b85f; font-weight: 800; }
.ent-code { font-size: 62px; font-weight: 900; letter-spacing: .14em; color: #fff; margin: 8px 0 6px; font-family: 'Mulish',system-ui,sans-serif; }
.ent-big-v { font-size: 14px; color: #c8bee6; font-weight: 700; }
.ent-sec { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: #e3b85f; font-weight: 800; margin: 28px 0 12px; display: flex; align-items: center; gap: 10px; }
.ent-sec::after { content: ""; flex: 1; height: 1px; background: rgba(246,221,153,.18); }
.ent-empty { font-size: 13px; color: #b6abd4; }
.ent-row { display: flex; align-items: center; gap: 12px; background: rgba(34,24,66,.5); border: 1px solid rgba(255,255,255,.07); border-radius: 13px; padding: 11px 13px; margin-bottom: 9px; }
.ent-row.done { opacity: .62; }
.ent-row-code { font-size: 21px; font-weight: 900; letter-spacing: .1em; color: #f6dd99; min-width: 72px; }
.ent-row.done .ent-row-code { color: #9ad7b3; text-decoration: line-through; }
.ent-row-info { flex: 1; }
.ent-row-v { font-weight: 800; font-size: 14px; }
.ent-row-s { font-size: 12px; color: #b6abd4; font-weight: 600; margin-top: 2px; }
.ent-cancel { appearance: none; border: 0; cursor: pointer; background: transparent; color: #f1a8c6; box-shadow: inset 0 0 0 1px rgba(241,168,198,.35); font-weight: 800; font-size: 12px; padding: 7px 11px; border-radius: 9px; }
`;

export default function EntrevistaPage() {
  const [value, setValue] = useState(5);
  const [kind, setKind] = useState<CodigoKind>("codigo");
  const [codes, setCodes] = useState<EntrevistaCodigo[]>([]);
  const [last, setLast] = useState<{ code: string; value: number; packKind: CodigoKind } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  const refresh = useCallback(async () => {
    try {
      setCodes(await loadEntrevista());
    } catch {
      /* la próxima sync reintenta */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // realtime: cuando un invitado canjea, FigusCodigo cambia → refrescamos el
  // estado de la lista (✓ canjeado) sin recargar.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void refresh(), 800);
    };
    const ch = sb.channel("entrevista-codigos");
    ch.on("postgres_changes", { event: "*", schema: "public", table: "FigusCodigo" }, bump);
    ch.subscribe();
    return () => {
      if (t) clearTimeout(t);
      void sb.removeChannel(ch);
    };
  }, [refresh]);

  const showMsg = useCallback((text: string) => {
    setMsg(text);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 4000);
  }, []);

  const generar = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await crearCodigoEntrevista(value, kind);
      if (r.ok) {
        setLast({ code: r.code, value: r.value, packKind: r.packKind });
        setMsg(null);
        void refresh();
      } else {
        showMsg(r.error);
      }
    } catch {
      showMsg("Error de conexión, probá de nuevo");
    } finally {
      setBusy(false);
    }
  };

  const cancelar = async (id: string) => {
    try {
      await cancelarCodigoEntrevista(id);
      void refresh();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="ent-wrap">
      <div className="ent-in">
        <div className="ent-kick">Figus del Reino · Códigos</div>
        <h1 className="ent-h1">Generá un código</h1>
        <p className="ent-sub">
          Elegí el tipo de sobre y cuántas figus da. Generá un código único y decíselo al invitado:
          lo canjea en su app. Cada código sirve <b>una sola vez</b> y no caduca.
        </p>

        <div className="ent-vals">
          {KINDS.map((kk) => (
            <button
              key={kk.k}
              className={`ent-chip${kind === kk.k ? " act" : ""}`}
              style={{ fontSize: 15 }}
              onClick={() => setKind(kk.k)}
            >
              {kk.ic} {kk.label}
            </button>
          ))}
        </div>

        <div className="ent-vals">
          {VALUES.map((v) => (
            <button
              key={v}
              className={`ent-chip${value === v ? " act" : ""}`}
              onClick={() => setValue(v)}
            >
              +{v}
            </button>
          ))}
        </div>

        <button className="ent-gen" disabled={busy} onClick={() => void generar()}>
          {busy
            ? "Generando…"
            : `${kind === "carta" ? "🃏" : "🎟️"} Generar código (+${value} figus)`}
        </button>
        {msg && <div className="ent-msg err">{msg}</div>}

        {last && (
          <div className="ent-big">
            <div className="ent-big-l">
              {last.packKind === "carta" ? "Código de sobre escondido" : "Código para el invitado"}
            </div>
            <div className="ent-code">{last.code}</div>
            <div className="ent-big-v">
              {last.packKind === "carta" ? "🃏 sobre escondido · " : ""}vale +{last.value} figus · un solo uso
            </div>
          </div>
        )}

        <div className="ent-sec">Códigos generados</div>
        {codes.length === 0 ? (
          <div className="ent-empty">Todavía no generaste códigos.</div>
        ) : (
          codes.map((c) => (
            <div className={`ent-row${c.redeemed ? " done" : ""}`} key={c.id}>
              <div className="ent-row-code">{c.code}</div>
              <div className="ent-row-info">
                <div className="ent-row-v">
                  {c.packKind === "carta" ? "🃏 " : "🎤 "}+{c.value} figus
                </div>
                <div className="ent-row-s">
                  {c.redeemed ? `✓ Canjeado por ${c.redeemedByName}` : "⏳ Sin canjear"}
                </div>
              </div>
              {!c.redeemed && (
                <button className="ent-cancel" onClick={() => void cancelar(c.id)}>
                  Anular
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
