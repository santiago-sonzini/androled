"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  loadAdmin,
  setPrizeDelivered,
  assignPrize,
  setGoldDelivered,
  adjustInventory,
  upsertInventoryItem,
  deleteInventoryItem,
  giveGiftToGuest,
} from "../actions/admin";
import { lanzarTrivia, lanzarCodigo } from "../actions/pantalla";

// ── supabase realtime (señal de invalidación) ──
let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_sb) _sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 5 } } });
  return _sb;
}
const TABLES = ["FigusAlbum", "FigusPrize", "FigusGold", "FigusInventory"] as const;

const AVATAR_GLYPHS: Record<string, string> = {
  Princesa: "👑", Hada: "🧚", Mariposa: "🦋", Rosa: "🌹",
  Dragón: "🐉", Cisne: "🦢", Estrella: "⭐", Castillo: "🏰",
};

type AdminData = Awaited<ReturnType<typeof loadAdmin>>;
type Guest = AdminData["guests"][number];

function Face({ g, size }: { g: { avatar: string | null; selfie: string | null }; size: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.32, overflow: "hidden",
        background: "rgba(227,184,95,.14)", border: "1px solid rgba(246,221,153,.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.5, flex: "0 0 auto",
      }}
    >
      {g.selfie ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={g.selfie} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        (g.avatar && AVATAR_GLYPHS[g.avatar]) || "👑"
      )}
    </div>
  );
}

const CSS = `
.ar-wrap { min-height: 100vh; background: linear-gradient(180deg,#150f33,#0c0920); color: #f6f0e6; font-family: 'Mulish',system-ui,sans-serif; padding: 18px 16px 80px; }
.ar-in { max-width: 920px; margin: 0 auto; }
.ar-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.ar-top h1 { font-size: 22px; font-weight: 900; margin: 0; }
.ar-top .sp { flex: 1; }
.ar-kick { font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #e3b85f; font-weight: 800; }
.ar-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 18px; }
.ar-stat { background: rgba(34,24,66,.55); border: 1px solid rgba(246,221,153,.14); border-radius: 14px; padding: 12px; text-align: center; }
.ar-stat .n { font-size: 26px; font-weight: 900; color: #f6dd99; line-height: 1; }
.ar-stat .l { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #b6abd4; font-weight: 800; margin-top: 6px; }
.ar-sec-h { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: #e3b85f; font-weight: 800; margin: 22px 0 10px; display: flex; align-items: center; gap: 10px; }
.ar-sec-h::after { content: ""; flex: 1; height: 1px; background: rgba(246,221,153,.18); }
.ar-card { background: rgba(34,24,66,.5); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ar-card .em { font-size: 26px; flex: 0 0 auto; }
.ar-card .info { flex: 1; min-width: 140px; }
.ar-card .info .t { font-weight: 800; font-size: 15px; }
.ar-card .info .s { font-size: 12px; color: #b6abd4; font-weight: 600; margin-top: 2px; }
.ar-card .info .s b { color: #f6dd99; }
.ar-btn { appearance: none; border: 0; cursor: pointer; font-weight: 800; font-size: 13px; padding: 9px 13px; border-radius: 11px; color: #2a1c08; background: linear-gradient(180deg,#f6dd99,#e3b85f); transition: filter .15s, transform .1s; }
.ar-btn:active { transform: translateY(1px); }
.ar-btn:disabled { opacity: .5; cursor: default; }
.ar-btn.ghost { background: transparent; color: #f6dd99; box-shadow: inset 0 0 0 1px rgba(246,221,153,.3); }
.ar-btn.green { background: linear-gradient(180deg,#a9f5c9,#5ecf91); color: #0c3a22; }
.ar-btn.rose { background: linear-gradient(180deg,#f1a8c6,#d76a98); color: #3a0f23; }
.ar-btn.red { background: transparent; color: #f1a8c6; box-shadow: inset 0 0 0 1px rgba(241,168,198,.35); }
.ar-btn.sm { padding: 6px 10px; font-size: 12px; border-radius: 9px; }
.ar-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ar-chip { font-size: 11px; font-weight: 900; padding: 4px 9px; border-radius: 99px; letter-spacing: .04em; }
.ar-chip.ok { background: rgba(140,230,176,.16); color: #8ce6b0; }
.ar-chip.no { background: rgba(255,255,255,.07); color: #b6abd4; }
.ar-input, .ar-select { background: rgba(12,9,32,.6); border: 1px solid rgba(246,221,153,.2); border-radius: 10px; padding: 8px 10px; color: #f6f0e6; font-family: inherit; font-weight: 600; font-size: 13px; outline: none; }
.ar-input:focus, .ar-select:focus { border-color: #e3b85f; }
.ar-inv .cnt { font-family: 'Cormorant Garamond',serif; font-weight: 700; font-size: 30px; color: #f6dd99; min-width: 64px; text-align: center; line-height: 1; }
.ar-guest { display: flex; align-items: center; gap: 11px; padding: 9px 11px; border-radius: 12px; background: rgba(12,9,32,.4); border: 1px solid rgba(255,255,255,.05); margin-bottom: 7px; }
.ar-guest .nm { font-weight: 800; font-size: 14px; line-height: 1.1; }
.ar-guest .meta { font-size: 11px; color: #8a7eb0; font-weight: 700; margin-top: 2px; }
.ar-bar { flex: 1; height: 6px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; min-width: 60px; max-width: 120px; }
.ar-bar i { display: block; height: 100%; background: linear-gradient(90deg,#f1a8c6,#f6dd99); }
.ar-msg { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); background: rgba(12,9,32,.95); border: 1px solid rgba(246,221,153,.25); padding: 11px 18px; border-radius: 12px; font-weight: 700; font-size: 13px; z-index: 50; }
`;

export default function AdminReinoPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [newItem, setNewItem] = useState({ label: "", emoji: "🎁", total: "10" });
  const [codeVal, setCodeVal] = useState("3");
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  const toast = useCallback((m: string) => {
    setMsg(m);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(""), 2600);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setData(await loadAdmin());
    } catch {
      toast("Error cargando el panel");
    }
  }, [toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  // realtime
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => { if (t) clearTimeout(t); t = setTimeout(() => void refresh(), 800); };
    const ch = sb.channel("admin-reino");
    for (const table of TABLES) ch.on("postgres_changes", { event: "*", schema: "public", table }, bump);
    ch.subscribe();
    return () => { if (t) clearTimeout(t); void sb.removeChannel(ch); };
  }, [refresh]);

  // helper que corre una action, refresca y avisa
  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const r = await fn();
        if (!r.ok) toast(r.error ?? "No se pudo");
        else if (okMsg) toast(okMsg);
        await refresh();
      } catch {
        toast("Error de conexión");
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh, toast],
  );

  const guests = useMemo(() => data?.guests ?? [], [data]);
  const filteredGuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) => g.name.toLowerCase().includes(q) || String(g.nroPulsera ?? "").includes(q));
  }, [guests, search]);

  if (!data) {
    return (
      <div className="ar-wrap">
        <div className="ar-in">Cargando panel…</div>
      </div>
    );
  }

  return (
    <div className="ar-wrap">
      <div className="ar-in">
        <div className="ar-top">
          <div>
            <div className="ar-kick">Los XV de Marti</div>
            <h1>🎁 Admin · Regalos del Reino</h1>
          </div>
          <div className="sp" />
          <button className="ar-btn ghost" onClick={() => void refresh()}>⟳ Actualizar</button>
        </div>

        {/* stats */}
        <div className="ar-stats">
          <div className="ar-stat"><div className="n">{data.stats.guests}</div><div className="l">Invitados</div></div>
          <div className="ar-stat"><div className="n">{data.stats.completed}</div><div className="l">Completaron</div></div>
          <div className="ar-stat"><div className="n">{data.stats.collected}</div><div className="l">Figus repartidas</div></div>
          <div className="ar-stat"><div className="n">{data.stats.doradasTaken}/3</div><div className="l">Doradas tomadas</div></div>
        </div>

        {/* premios principales */}
        <div className="ar-sec-h">Premios principales</div>
        {data.prizes.map((p) => {
          return (
            <div className="ar-card" key={p.key}>
              <span className="em">{p.g}</span>
              <div className="info">
                <div className="t">{p.nm}</div>
                <div className="s">
                  {p.winnerName ? <>Ganó <b>{p.winnerName}</b></> : "Sin asignar"}
                </div>
              </div>
              <div className="ar-row">
                {p.winnerName && (
                  <span className={`ar-chip ${p.delivered ? "ok" : "no"}`}>
                    {p.delivered ? "✓ Entregado" : "Pendiente"}
                  </span>
                )}
                <select
                  className="ar-select"
                  value={p.winnerId ?? ""}
                  onChange={(e) => void run(() => assignPrize(p.key, e.target.value || null))}
                  disabled={busy}
                >
                  <option value="">— sin asignar —</option>
                  {guests.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}{g.nroPulsera ? ` #${g.nroPulsera}` : ""}</option>
                  ))}
                </select>
                {p.winnerName && (
                  <button
                    className={`ar-btn sm ${p.delivered ? "ghost" : "green"}`}
                    disabled={busy}
                    onClick={() => void run(() => setPrizeDelivered(p.key, !p.delivered))}
                  >
                    {p.delivered ? "Desmarcar" : "Marcar entregado"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* doradas */}
        <div className="ar-sec-h">Cartas doradas</div>
        {data.golds.map((g) => (
          <div className="ar-card" key={g.idx}>
            <span className="em">{g.g}</span>
            <div className="info">
              <div className="t">{g.nm}</div>
              <div className="s">{g.winnerName ? <>La sacó <b>{g.winnerName}</b></> : "Todavía libre"}</div>
            </div>
            {g.winnerName && (
              <div className="ar-row">
                <span className={`ar-chip ${g.delivered ? "ok" : "no"}`}>{g.delivered ? "✓ Entregada" : "Pendiente"}</span>
                <button
                  className={`ar-btn sm ${g.delivered ? "ghost" : "green"}`}
                  disabled={busy}
                  onClick={() => void run(() => setGoldDelivered(g.idx, !g.delivered))}
                >
                  {g.delivered ? "Desmarcar" : "Marcar entregada"}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* inventario de regalos */}
        <div className="ar-sec-h">Inventario de regalos</div>
        {data.inventory.map((it) => {
          const left = it.total - it.delivered;
          return (
            <div className="ar-card ar-inv" key={it.key}>
              <span className="em">{it.emoji}</span>
              <div className="info">
                <div className="t">{it.label}</div>
                <div className="s">Entregados <b>{it.delivered}</b> · quedan <b>{left}</b> de {it.total}</div>
              </div>
              <div className="ar-row">
                <button className="ar-btn sm ghost" disabled={busy || it.delivered <= 0} onClick={() => void run(() => adjustInventory(it.key, -1))}>↩ Devolver</button>
                <span className="cnt">{left}</span>
                <button className="ar-btn sm rose" disabled={busy || left <= 0} onClick={() => void run(() => adjustInventory(it.key, 1), `Entregaste un ${it.label}`)}>Entregar uno</button>
                <button className="ar-btn sm red" disabled={busy} onClick={() => { if (confirm(`¿Borrar "${it.label}" del inventario?`)) void run(() => deleteInventoryItem(it.key)); }}>✕</button>
              </div>
            </div>
          );
        })}
        {/* agregar / editar regalo */}
        <div className="ar-card" style={{ alignItems: "flex-end" }}>
          <div className="info" style={{ minWidth: 0 }}>
            <div className="s" style={{ marginBottom: 6 }}>Agregar o editar un regalo (mismo nombre = editar)</div>
            <div className="ar-row">
              <input className="ar-input" style={{ width: 56 }} value={newItem.emoji} onChange={(e) => setNewItem((s) => ({ ...s, emoji: e.target.value }))} placeholder="🎁" />
              <input className="ar-input" style={{ flex: 1, minWidth: 120 }} value={newItem.label} onChange={(e) => setNewItem((s) => ({ ...s, label: e.target.value }))} placeholder="Nombre del regalo" />
              <input className="ar-input" style={{ width: 70 }} inputMode="numeric" value={newItem.total} onChange={(e) => setNewItem((s) => ({ ...s, total: e.target.value }))} placeholder="Total" />
            </div>
          </div>
          <button
            className="ar-btn"
            disabled={busy || !newItem.label.trim()}
            onClick={() =>
              void run(
                () => upsertInventoryItem({ label: newItem.label, emoji: newItem.emoji, total: parseInt(newItem.total) || 0 }),
                "Regalo guardado",
              ).then(() => setNewItem({ label: "", emoji: "🎁", total: "10" }))
            }
          >
            Guardar
          </button>
        </div>

        {/* operador */}
        <div className="ar-sec-h">Operador</div>
        <div className="ar-card">
          <div className="info">
            <div className="t">Lanzar a la pantalla</div>
            <div className="s">Activa una trivia o un código para que los invitados ganen un sobre.</div>
          </div>
          <div className="ar-row">
            <button className="ar-btn sm ghost" disabled={busy} onClick={() => void run(() => lanzarTrivia(), "💡 Trivia lanzada")}>💡 Lanzar trivia</button>
            <input className="ar-input" style={{ width: 64 }} inputMode="numeric" value={codeVal} onChange={(e) => setCodeVal(e.target.value)} title="figus que da el código" />
            <button className="ar-btn sm" disabled={busy} onClick={() => void run(async () => { const r = await lanzarCodigo(45, parseInt(codeVal) || 4); toast(r.ok ? `🔢 ${r.label}` : r.error); return r; })}>🔢 Lanzar código</button>
          </div>
        </div>

        {/* invitados */}
        <div className="ar-sec-h">Invitados ({guests.length})</div>
        <input
          className="ar-input"
          style={{ width: "100%", marginBottom: 10 }}
          placeholder="Buscar por nombre o pulsera…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filteredGuests.map((g: Guest) => (
          <div className="ar-guest" key={g.id}>
            <Face g={g} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nm">
                {g.name}
                {g.completed && <span className="ar-chip ok" style={{ marginLeft: 8 }}>👑 Completó</span>}
              </div>
              <div className="meta">
                {g.nroPulsera ? `Pulsera #${g.nroPulsera}` : "sin pulsera"}
                {g.mesa != null ? ` · Mesa ${g.mesa}` : ""} · {g.uniques}/15
              </div>
            </div>
            <div className="ar-bar"><i style={{ width: `${(g.uniques / 15) * 100}%` }} /></div>
            <button className="ar-btn sm ghost" disabled={busy} onClick={() => void run(() => giveGiftToGuest(g.id), `🎁 Sobre regalo para ${g.name}`)}>🎁 Sobre</button>
          </div>
        ))}
        {filteredGuests.length === 0 && <div className="ar-guest" style={{ justifyContent: "center", color: "#8a7eb0" }}>Sin resultados</div>}
      </div>

      {msg && <div className="ar-msg">{msg}</div>}
    </div>
  );
}
