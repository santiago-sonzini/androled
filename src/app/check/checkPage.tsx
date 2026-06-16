"use client";

import { useState, useRef } from "react";
import { createGuest, pulseraEntregada, updateGuestNroPulsera } from "../actions/guests";
import type { AndroLedGuest } from "@prisma/client";
import { toast } from "@/components/ui/use-toast";

interface NFCPageProps {
  guests: AndroLedGuest[];
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function genId() {
  return "local_" + Math.random().toString(36).slice(2, 12);
}

type ScanStatus = "idle" | "scanning" | "reading" | "writing" | "match" | "mismatch" | "error" | "continuous" | "devolucion";

export default function NFCPage({ guests: initialGuests }: NFCPageProps) {
  const [guests, setGuests] = useState<AndroLedGuest[]>(initialGuests);
  const [search, setSearch] = useState("");
  const [checkedId, setCheckedId] = useState<string | null>(null);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanMessage, setScanMessage] = useState("");
  const [readGuest, setReadGuest] = useState<AndroLedGuest | null>(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [writeMode, setWriteMode] = useState<"existing" | "new">("existing");
  const [writingNroPulsera, setWritingNroPulsera] = useState("");
  const [newName, setNewName] = useState("");
  const [newMesa, setNewMesa] = useState("");
  const [newPulsera, setNewPulsera] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [continuousGuest, setContinuousGuest] = useState<AndroLedGuest | null>(null);
  const [devolucionGuest, setDevolucionGuest] = useState<AndroLedGuest | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isSupported = typeof window !== "undefined" && "NDEFReader" in window;

  function addLog(msg: string) {
    setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  }

  async function setEntregada(id: string, value: boolean) {
    const res = await pulseraEntregada(id, value);
    if (res.error) toast({ title: "Error al actualizar la pulsa", description: "no se pudo entregar" });
    else toast({ title: "Pulsera actualizada", description: "Pulsera actualizada correctamente" });
    setGuests(prev => prev.map(g => g.id === id ? { ...g, pulseraEntregada: value } : g));
  }

  async function startVerify() {
    if (!checkedId) return;
    if (!isSupported) { setScanStatus("error"); setScanMessage("Web NFC no está soportado."); return; }
    try {
      abortControllerRef.current = new AbortController();
      setScanStatus("scanning");
      setScanMessage("Acercá la pulsera NFC...");
      addLog("Iniciando verificación...");
      const ndef = new (window as any).NDEFReader();
      await ndef.scan({ signal: abortControllerRef.current.signal });
      ndef.onreading = (event: any) => {
        abortControllerRef.current?.abort();
        addLog(`Records recibidos: ${event.message.records.length}`);
        for (const record of event.message.records) {
          addLog(`Record type: ${record.recordType}, lang: ${record.lang ?? "n/a"}`);
          if (record.recordType === "text" || record.recordType === "url") {
            const decoder = new TextDecoder(record.encoding || "utf-8");
            const text = decoder.decode(record.data);
            addLog(`Texto decodificado: ${text}`);
            const scannedId = text.includes("/") ? text.split("/").pop() : text;
            addLog(`ID extraído: ${scannedId}`);
            if (scannedId === checkedId) {
              setVerified(prev => new Set(prev).add(checkedId));
              setScanStatus("match");
              setScanMessage("✓ Verificado correctamente.");
            } else {
              setScanStatus("mismatch");
              setScanMessage("✗ La pulsera no corresponde al invitado seleccionado.");
            }
            return;
          }
        }
        addLog("No se encontró record de tipo text/url");
        setScanStatus("error");
        setScanMessage("No se pudo leer el ID del tag.");
      };
      ndef.onreadingerror = () => { addLog("onreadingerror disparado"); setScanStatus("error"); setScanMessage("Error al leer el tag."); };
    } catch (err: any) {
      if (err.name === "AbortError") { setScanStatus("idle"); setScanMessage(""); }
      else { addLog(`Excepción: ${err.message}`); setScanStatus("error"); setScanMessage(`Error: ${err.message}`); }
    }
  }

  function cancelScan() {
    abortControllerRef.current?.abort();
    setScanStatus("idle");
    setScanMessage("");
    setContinuousGuest(null);
    setDevolucionGuest(null);
  }

  async function startRead() {
    if (!isSupported) { setScanStatus("error"); setScanMessage("Web NFC no está soportado."); return; }
    try {
      abortControllerRef.current = new AbortController();
      setScanStatus("reading");
      setScanMessage("Acercá la pulsera NFC...");
      setReadGuest(null);
      addLog("Iniciando lectura única...");
      const ndef = new (window as any).NDEFReader();
      await ndef.scan({ signal: abortControllerRef.current.signal });
      ndef.onreading = (event: any) => {
        abortControllerRef.current?.abort();
        addLog(`Records recibidos: ${event.message.records.length}`);
        for (const record of event.message.records) {
          addLog(`Record type: ${record.recordType}, lang: ${record.lang ?? "n/a"}`);
          if (record.recordType === "text" || record.recordType === "url") {
            const decoder = new TextDecoder(record.encoding || "utf-8");
            const text = decoder.decode(record.data);
            addLog(`Texto decodificado: ${text}`);
            const scannedId = text.includes("/") ? text.split("/").pop() : text;
            addLog(`ID extraído: ${scannedId}`);
            const found = scannedId ? guests.find(g => g.id === scannedId) ?? null : null;
            setReadGuest(found);
            setScanStatus(found ? "match" : "error");
            setScanMessage(found ? `Leído: ${found.name}` : "ID no encontrado en la lista.");
            return;
          }
        }
        addLog("No se encontró record de tipo text/url");
        setScanStatus("error");
        setScanMessage("No se pudo leer el ID del tag.");
      };
      ndef.onreadingerror = () => { addLog("onreadingerror disparado"); setScanStatus("error"); setScanMessage("Error al leer el tag."); };
    } catch (err: any) {
      if (err.name === "AbortError") { setScanStatus("idle"); setScanMessage(""); }
      else { addLog(`Excepción: ${err.message}`); setScanStatus("error"); setScanMessage(`Error: ${err.message}`); }
    }
  }

  async function startContinuousRead() {
    if (!isSupported) { setScanStatus("error"); setScanMessage("Web NFC no está soportado."); return; }
    try {
      abortControllerRef.current = new AbortController();
      setScanStatus("continuous");
      setScanMessage("Modo continuo activo. Acercá pulseras...");
      setContinuousGuest(null);
      addLog("Iniciando lectura continua...");
      const ndef = new (window as any).NDEFReader();
      await ndef.scan({ signal: abortControllerRef.current.signal });
      ndef.onreading = (event: any) => {
        addLog(`[Continuo] Records recibidos: ${event.message.records.length}`);
        for (const record of event.message.records) {
          addLog(`[Continuo] Record type: ${record.recordType}`);
          if (record.recordType === "text" || record.recordType === "url") {
            const decoder = new TextDecoder(record.encoding || "utf-8");
            const text = decoder.decode(record.data);
            addLog(`[Continuo] Texto: ${text}`);
            const scannedId = text.includes("/") ? text.split("/").pop() : text;
            const found = scannedId ? guests.find(g => g.id === scannedId) ?? null : null;
            if (found) {
              setContinuousGuest(found);
              addLog(`[Continuo] Encontrado: ${found.name} / Pulsera #${found.nroPulsera ?? "—"}`);
            } else {
              setContinuousGuest(null);
              addLog(`[Continuo] ID no encontrado: ${scannedId}`);
            }
            return;
          }
        }
        addLog("[Continuo] No se encontró record de tipo text/url");
      };
      ndef.onreadingerror = () => { addLog("[Continuo] onreadingerror"); };
    } catch (err: any) {
      if (err.name === "AbortError") { setScanStatus("idle"); setScanMessage(""); setContinuousGuest(null); }
      else { addLog(`Excepción: ${err.message}`); setScanStatus("error"); setScanMessage(`Error: ${err.message}`); }
    }
  }

  async function startDevolucionRead() {
    if (!isSupported) { setScanStatus("error"); setScanMessage("Web NFC no está soportado."); return; }
    try {
      abortControllerRef.current = new AbortController();
      setScanStatus("devolucion");
      setScanMessage("Modo devolución activo. Acercá pulseras...");
      setDevolucionGuest(null);
      addLog("Iniciando modo devolución...");
      const ndef = new (window as any).NDEFReader();
      await ndef.scan({ signal: abortControllerRef.current.signal });
      ndef.onreading = (event: any) => {
        addLog(`[Devolución] Records recibidos: ${event.message.records.length}`);
        for (const record of event.message.records) {
          if (record.recordType === "text" || record.recordType === "url") {
            const decoder = new TextDecoder(record.encoding || "utf-8");
            const text = decoder.decode(record.data);
            const scannedId = text.includes("/") ? text.split("/").pop() : text;
            const found = scannedId ? guests.find(g => g.id === scannedId) ?? null : null;
            setDevolucionGuest(found);
            addLog(`[Devolución] ${found ? `Encontrado: ${found.name}` : `ID no encontrado: ${scannedId}`}`);
            return;
          }
        }
        addLog("[Devolución] No se encontró record de tipo text/url");
      };
      ndef.onreadingerror = () => { addLog("[Devolución] onreadingerror"); };
    } catch (err: any) {
      if (err.name === "AbortError") { setScanStatus("idle"); setScanMessage(""); setDevolucionGuest(null); }
      else { addLog(`Excepción: ${err.message}`); setScanStatus("error"); setScanMessage(`Error: ${err.message}`); }
    }
  }

  function openWriteModal() {
    if (!checkedId) return;
    setWriteMode("existing");
    setWritingNroPulsera("");
    setShowWriteModal(true);
  }

  async function startWrite() {
    if (!checkedId || !writingNroPulsera.trim()) return;
    if (!isSupported) { setScanStatus("error"); setScanMessage("Web NFC no está soportado."); setShowWriteModal(false); return; }
    setShowWriteModal(false);
    try {
      abortControllerRef.current = new AbortController();
      setScanStatus("writing");
      setScanMessage("Acercá la pulsera NFC para grabar...");
      const ndef = new (window as any).NDEFReader();
      await ndef.write(
        { records: [{ recordType: "text", data: `https://www.androled.com/${checkedId}` }] },
        { signal: abortControllerRef.current.signal }
      );
      const res = await updateGuestNroPulsera(checkedId, parseInt(writingNroPulsera));
      if (res.error) throw res.error;
      setGuests(prev => prev.map(g => g.id === checkedId ? { ...g, nroPulsera: parseInt(writingNroPulsera) } : g));
      setScanStatus("match");
      setScanMessage(`✓ Grabado correctamente. Pulsera #${writingNroPulsera}`);
      setWritingNroPulsera("");
    } catch (err: any) {
      if (err.name === "AbortError") { setScanStatus("idle"); setScanMessage(""); }
      else { setScanStatus("error"); setScanMessage(`Error al grabar: ${err.message}`); }
    }
  }

  function openNewGuestModal() {
    setWriteMode("new");
    setNewName(""); setNewMesa(""); setNewPulsera(""); setNewPhone("");
    setShowWriteModal(true);
  }

  async function startWriteNewGuest() {
    if (!newName.trim() || !newPulsera.trim()) return;
    if (!isSupported) { setScanStatus("error"); setScanMessage("Web NFC no está soportado."); setShowWriteModal(false); return; }
    const newId = genId();
    setShowWriteModal(false);
    try {
      abortControllerRef.current = new AbortController();
      setScanStatus("writing");
      setScanMessage("Acercá la pulsera NFC para grabar...");
      const ndef = new (window as any).NDEFReader();
      await ndef.write(
        { records: [{ recordType: "text", data: `https://www.androled.com/${newId}` }] },
        { signal: abortControllerRef.current.signal }
      );
      const newGuest: AndroLedGuest = {
        id: newId, name: newName.trim(), email: null,
        phone: newPhone.trim() || null, hasDietRestriction: false, dietRestrictionComment: null,
        rsvp: true, isMainGuest: true, comments: null, createdAt: new Date(),
        plusOne: false, goesWith: null, mesa: newMesa.trim() ? parseInt(newMesa.trim()) : null,
        nroPulsera: newPulsera.trim() ? parseInt(newPulsera.trim()) : null, pulseraEntregada: false,
        avatar: null, selfie: null,
      };
      await createGuest(newGuest);
      setGuests(prev => [newGuest, ...prev]);
      setCheckedId(newId);
      setScanStatus("match");
      setScanMessage(`✓ Nuevo invitado grabado. Pulsera #${newPulsera}`);
    } catch (err: any) {
      if (err.name === "AbortError") { setScanStatus("idle"); setScanMessage(""); }
      else { setScanStatus("error"); setScanMessage(`Error al grabar: ${err.message}`); }
    }
  }

  const filteredGuests = search.trim()
    ? guests.filter(g => {
        const q = normalize(search);
        return normalize(g.name).includes(q) || normalize(g.email ?? "").includes(q) || normalize(g.goesWith ?? "").includes(q);
      })
    : guests;

  const selectedGuest = checkedId ? guests.find(g => g.id === checkedId) : null;
  const isVerified = checkedId ? verified.has(checkedId) : false;
  const isEntregada = selectedGuest?.pulseraEntregada ?? false;

  const th: React.CSSProperties = { padding: "0.65rem 0.75rem", textAlign: "left", color: "#6b5ff8", letterSpacing: "0.08em", fontSize: "0.62rem", textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "0.55rem 0.75rem", fontSize: "0.8rem", verticalAlign: "middle" };

  const badgeColor = scanStatus === "match"
    ? { bg: "rgba(34,197,94,0.08)", text: "#16a34a", border: "rgba(34,197,94,0.25)" }
    : scanStatus === "mismatch" || scanStatus === "error"
    ? { bg: "rgba(239,68,68,0.08)", text: "#dc2626", border: "rgba(239,68,68,0.25)" }
    : scanStatus === "continuous"
    ? { bg: "rgba(245,158,11,0.08)", text: "#d97706", border: "rgba(245,158,11,0.25)" }
    : { bg: "rgba(107,95,248,0.08)", text: "#6b5ff8", border: "rgba(107,95,248,0.25)" };

  const inputStyle: React.CSSProperties = { display: "block", marginTop: "0.4rem", width: "100%", padding: "0.7rem 0.9rem", borderRadius: "8px", border: "1px solid #e5e5e5", fontFamily: "inherit", fontSize: "0.9rem", color: "#111", background: "#fafafa", outline: "none", boxSizing: "border-box" };

  const isBusy = scanStatus === "scanning" || scanStatus === "reading" || scanStatus === "writing" || scanStatus === "continuous" || scanStatus === "devolucion";

  return (
    <main style={{ fontFamily: "'DM Mono','Courier New',monospace", minHeight: "100vh", background: "#fff", color: "#111", display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem 1.25rem", gap: "2rem" }}>

      <header style={{ textAlign: "center", marginTop: "1rem" }}>
        <div style={{ fontSize: "0.65rem", letterSpacing: "0.3em", color: "#6b5ff8", textTransform: "uppercase", marginBottom: "0.5rem" }}>NFC · Check-in</div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.04em", margin: 0 }}>Verificación Pulseras</h1>
      </header>

      <section style={{ width: "100%", maxWidth: "420px", background: "#fff", border: "1px solid #e5e5e5", borderRadius: "16px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#6b5ff8" }}>
          {scanStatus === "scanning" ? "Esperando pulsera..." : scanStatus === "continuous" ? "Modo continuo activo" : scanStatus === "devolucion" ? "Modo devolución activo" : "Invitado seleccionado"}
        </div>

        {selectedGuest && scanStatus !== "continuous" && scanStatus !== "devolucion" ? (
          <div style={{ background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: "10px", padding: "0.85rem" }}>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{selectedGuest.name}</div>
            {selectedGuest.email && <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.2rem" }}>{selectedGuest.email}</div>}
            {selectedGuest.phone && <div style={{ fontSize: "0.75rem", color: "#888" }}>{selectedGuest.phone}</div>}
            <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.2rem", display: "flex", gap: "1rem" }}>
              {selectedGuest.mesa && <span>Mesa {selectedGuest.mesa}</span>}
              {selectedGuest.nroPulsera && <span>Pulsera #{selectedGuest.nroPulsera}</span>}
              {selectedGuest.pulseraEntregada !== undefined && (
                <span style={{ color: selectedGuest.pulseraEntregada ? "#16a34a" : "#f59e0b" }}>
                  {selectedGuest.pulseraEntregada ? "✓ Entregada" : "⏳ Pendiente"}
                </span>
              )}
            </div>
          </div>
        ) : scanStatus !== "continuous" && scanStatus !== "devolucion" ? (
          <div style={{ color: "#bbb", fontSize: "0.82rem" }}>Seleccioná un invitado de la tabla</div>
        ) : null}

        {/* Continuous read result */}
        {scanStatus === "continuous" && (
          <div style={{ borderRadius: "12px", border: continuousGuest ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(245,158,11,0.25)", background: continuousGuest ? "rgba(34,197,94,0.05)" : "rgba(245,158,11,0.05)", padding: "1.1rem", minHeight: "80px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.3rem" }}>
            {continuousGuest ? (
              <>
                <div style={{ fontWeight: 700, fontSize: "1.15rem", color: "#111" }}>{continuousGuest.name}</div>
                <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "#555", marginTop: "0.2rem" }}>
                  {continuousGuest.mesa && <span>Mesa <strong>{continuousGuest.mesa}</strong></span>}
                  <span>Pulsera <strong>#{continuousGuest.nroPulsera ?? "—"}</strong></span>
                  <span style={{ color: continuousGuest.pulseraEntregada ? "#16a34a" : "#f59e0b" }}>
                    {continuousGuest.pulseraEntregada ? "✓ Entregada" : "⏳ Pendiente"}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ color: "#d97706", fontSize: "0.82rem", textAlign: "center" }}>⟳ Acercá una pulsera...</div>
            )}
          </div>
        )}

        {/* Devolucion read result */}
        {scanStatus === "devolucion" && (
          <div style={{ borderRadius: "12px", border: devolucionGuest ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(239,68,68,0.15)", background: devolucionGuest ? "rgba(239,68,68,0.05)" : "rgba(239,68,68,0.02)", padding: "1.1rem", minHeight: "80px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.5rem" }}>
            {devolucionGuest ? (
              <>
                <div style={{ fontWeight: 700, fontSize: "1.15rem", color: "#111" }}>{devolucionGuest.name}</div>
                <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "#555" }}>
                  {devolucionGuest.mesa && <span>Mesa <strong>{devolucionGuest.mesa}</strong></span>}
                  <span>Pulsera <strong>#{devolucionGuest.nroPulsera ?? "—"}</strong></span>
                  <span style={{ color: devolucionGuest.pulseraEntregada ? "#16a34a" : "#f59e0b" }}>
                    {devolucionGuest.pulseraEntregada ? "✓ Entregada" : "⏳ Pendiente"}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await setEntregada(devolucionGuest.id, false);
                    setGuests(prev => prev.map(g => g.id === devolucionGuest.id ? { ...g, pulseraEntregada: false } : g));
                    setDevolucionGuest(prev => prev ? { ...prev, pulseraEntregada: false } : null);
                  }}
                  style={{ marginTop: "0.25rem", padding: "0.7rem", borderRadius: "8px", border: "none", background: "#dc2626", color: "#fff", fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: "pointer", transition: "opacity 0.15s" }}
                >
                  Confirmar devolución
                </button>
              </>
            ) : (
              <div style={{ color: "#dc2626", fontSize: "0.82rem", textAlign: "center", opacity: 0.7 }}>↩ Acercá una pulsera...</div>
            )}
          </div>
        )}

        {scanMessage && scanStatus !== "continuous" && scanStatus !== "devolucion" && (
          <div style={{ padding: "0.5rem 1rem", borderRadius: "8px", fontSize: "0.8rem", background: badgeColor.bg, color: badgeColor.text, border: `1px solid ${badgeColor.border}` }}>
            {scanStatus === "scanning" ? "⟳ " : ""}{scanMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={scanStatus === "scanning" ? cancelScan : startVerify}
            disabled={!checkedId && scanStatus !== "scanning"}
            style={{ flex: 1, padding: "0.85rem", borderRadius: "10px", border: "none", background: scanStatus === "scanning" ? "rgba(239,68,68,0.1)" : (!checkedId ? "#f0f0f0" : "#6b5ff8"), color: scanStatus === "scanning" ? "#dc2626" : (!checkedId ? "#aaa" : "#fff"), fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: (!checkedId && scanStatus !== "scanning") ? "not-allowed" : "pointer", transition: "background 0.15s" }}
          >
            {scanStatus === "scanning" ? "Cancelar" : "Verificar"}
          </button>
          <button
            onClick={scanStatus === "reading" ? cancelScan : startRead}
            disabled={scanStatus === "scanning" || scanStatus === "continuous" || scanStatus === "devolucion"}
            style={{ flex: 1, padding: "0.85rem", borderRadius: "10px", border: "1px solid #e5e5e5", background: scanStatus === "reading" ? "rgba(239,68,68,0.1)" : "#fff", color: scanStatus === "reading" ? "#dc2626" : (scanStatus === "scanning" || scanStatus === "continuous" || scanStatus === "devolucion" ? "#aaa" : "#111"), fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: (scanStatus === "scanning" || scanStatus === "continuous" || scanStatus === "devolucion") ? "not-allowed" : "pointer", transition: "background 0.15s" }}
          >
            {scanStatus === "reading" ? "Cancelar" : "Leer"}
          </button>
          <button
            onClick={scanStatus === "writing" ? cancelScan : openWriteModal}
            disabled={(!checkedId && scanStatus !== "writing") || scanStatus === "scanning" || scanStatus === "reading" || scanStatus === "continuous" || scanStatus === "devolucion"}
            style={{ flex: 1, padding: "0.85rem", borderRadius: "10px", border: "1px solid #e5e5e5", background: scanStatus === "writing" ? "rgba(239,68,68,0.1)" : ((!checkedId || scanStatus === "scanning" || scanStatus === "reading" || scanStatus === "continuous" || scanStatus === "devolucion") ? "#f9f9f9" : "#fff"), color: scanStatus === "writing" ? "#dc2626" : ((!checkedId || scanStatus === "scanning" || scanStatus === "reading" || scanStatus === "continuous" || scanStatus === "devolucion") ? "#bbb" : "#111"), fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
          >
            {scanStatus === "writing" ? "Cancelar" : "Grabar tag"}
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => checkedId && setEntregada(checkedId, true)}
            style={{ flex: 1, padding: "0.85rem", borderRadius: "10px", border: "none", background: isVerified && !isEntregada ? "rgba(34,197,94,0.9)" : "#f0f0f0", color: isVerified && !isEntregada ? "#fff" : "#aaa", fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: isVerified && !isEntregada ? "pointer" : "not-allowed", transition: "background 0.15s" }}
          >
            Entregar
          </button>
          <button
            onClick={() => checkedId && setEntregada(checkedId, false)}
            disabled={!isEntregada}
            style={{ flex: 1, padding: "0.85rem", borderRadius: "10px", border: "1px solid #e5e5e5", background: isEntregada ? "#fff" : "#f9f9f9", color: isEntregada ? "#111" : "#bbb", fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: isEntregada ? "pointer" : "not-allowed", transition: "background 0.15s" }}
          >
            Devuelta
          </button>
          <button
            onClick={openNewGuestModal}
            disabled={isBusy}
            style={{ flex: 1, padding: "0.85rem", borderRadius: "10px", border: "1px solid #e5e5e5", background: "#fff", color: isBusy ? "#bbb" : "#6b5ff8", fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: isBusy ? "not-allowed" : "pointer", transition: "background 0.15s" }}
          >
            + Nuevo
          </button>
        </div>

        {/* Continuous read button */}
        <button
          onClick={scanStatus === "continuous" ? cancelScan : startContinuousRead}
          disabled={scanStatus === "scanning" || scanStatus === "reading" || scanStatus === "writing" || scanStatus === "devolucion"}
          style={{ width: "100%", padding: "0.85rem", borderRadius: "10px", border: scanStatus === "continuous" ? "none" : "1px solid rgba(245,158,11,0.4)", background: scanStatus === "continuous" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.06)", color: scanStatus === "continuous" ? "#dc2626" : "#d97706", fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: (scanStatus === "scanning" || scanStatus === "reading" || scanStatus === "writing" || scanStatus === "devolucion") ? "not-allowed" : "pointer", transition: "background 0.15s", letterSpacing: "0.04em", opacity: (scanStatus === "scanning" || scanStatus === "reading" || scanStatus === "writing" || scanStatus === "devolucion") ? 0.4 : 1 }}
        >
          {scanStatus === "continuous" ? "⏹ Detener lectura continua" : "⟳ Iniciar lectura continua"}
        </button>

        {/* Devolucion button */}
        <button
          onClick={scanStatus === "devolucion" ? cancelScan : startDevolucionRead}
          disabled={scanStatus === "scanning" || scanStatus === "reading" || scanStatus === "writing" || scanStatus === "continuous"}
          style={{ width: "100%", padding: "0.85rem", borderRadius: "10px", border: scanStatus === "devolucion" ? "none" : "1px solid rgba(239,68,68,0.3)", background: scanStatus === "devolucion" ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.04)", color: "#dc2626", fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: (scanStatus === "scanning" || scanStatus === "reading" || scanStatus === "writing" || scanStatus === "continuous") ? "not-allowed" : "pointer", transition: "background 0.15s", letterSpacing: "0.04em", opacity: (scanStatus === "scanning" || scanStatus === "reading" || scanStatus === "writing" || scanStatus === "continuous") ? 0.4 : 1 }}
        >
          {scanStatus === "devolucion" ? "⏹ Detener modo devolución" : "↩ Iniciar modo devolución"}
        </button>

        {readGuest && scanStatus !== "continuous" && scanStatus !== "devolucion" && (
          <div style={{ background: "rgba(107,95,248,0.05)", border: "1px solid rgba(107,95,248,0.15)", borderRadius: "10px", padding: "0.85rem" }}>
            <div style={{ fontSize: "0.62rem", color: "#6b5ff8", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.4rem" }}>Pulsera leída</div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{readGuest.name}</div>
            {readGuest.email && <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.2rem" }}>{readGuest.email}</div>}
            {readGuest.goesWith && <div style={{ fontSize: "0.75rem", color: "#888" }}>con {readGuest.goesWith}</div>}
            <div style={{ fontSize: "0.78rem", color: "#444", marginTop: "0.4rem", display: "flex", gap: "1.5rem" }}>
              <span>Mesa: <strong>{readGuest.mesa || "—"}</strong></span>
              <span>Pulsera: <strong>{readGuest.nroPulsera || "—"}</strong></span>
              {readGuest.pulseraEntregada !== undefined && (
                <span style={{ color: readGuest.pulseraEntregada ? "#16a34a" : "#f59e0b" }}>
                  {readGuest.pulseraEntregada ? "✓ Entregada" : "Pendiente"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Debug logs */}
        {debugLogs.length > 0 && (
          <div style={{ background: "#0f0f0f", borderRadius: "10px", padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div style={{ fontSize: "0.6rem", color: "#6b5ff8", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.35rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Debug logs</span>
              <button onClick={() => setDebugLogs([])} style={{ background: "transparent", border: "none", color: "#555", fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit" }}>limpiar</button>
            </div>
            {debugLogs.map((log, i) => (
              <div key={i} style={{ fontSize: "0.65rem", color: i === 0 ? "#e2e2e2" : "#666", fontFamily: "'DM Mono','Courier New',monospace" }}>{log}</div>
            ))}
          </div>
        )}
      </section>

      <section style={{ width: "100%", maxWidth: "900px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#6b5ff8" }}>Lista de invitados</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, mail o acompañante..." style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", border: "1px solid #e5e5e5", fontFamily: "inherit", fontSize: "0.88rem", color: "#111", background: "#fafafa", outline: "none" }} />
        <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9f9f9", borderBottom: "1px solid #e5e5e5" }}>
                <th style={{ ...th, width: "36px" }}></th>
                <th style={th}>Nombre</th>
                <th style={th}>Mail</th>
                <th style={th}>Con</th>
                <th style={th}>Mesa</th>
                <th style={th}>Pulsera</th>
                <th style={th}>Estado</th>
                <th style={th}>ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.sort((a, b) => (a.nroPulsera ? a.nroPulsera : 1) - (b.nroPulsera ? b.nroPulsera : 1)).map((g, i) => {
                const isChecked = checkedId === g.id;
                const isVer = verified.has(g.id);
                const rowBg = g.pulseraEntregada ? "rgba(34,197,94,0.07)" : isVer ? "rgba(34,197,94,0.04)" : isChecked ? "rgba(107,95,248,0.06)" : i % 2 === 0 ? "#fff" : "#fafafa";
                return (
                  <tr key={g.id} onClick={() => { if (scanStatus !== "scanning" && scanStatus !== "continuous" && scanStatus !== "devolucion") setCheckedId(isChecked ? null : g.id); }} style={{ borderBottom: "1px solid #f0f0f0", background: rowBg, cursor: (scanStatus === "scanning" || scanStatus === "continuous" || scanStatus === "devolucion") ? "default" : "pointer" }}>
                    <td style={{ ...td, textAlign: "center" }}>
                      {isVer ? (
                        <span style={{ color: "#16a34a", fontSize: "1rem" }}>✓</span>
                      ) : (
                        <span style={{ display: "inline-block", width: "16px", height: "16px", borderRadius: "4px", border: `2px solid ${isChecked ? "#6b5ff8" : "#ddd"}`, background: isChecked ? "#6b5ff8" : "transparent", verticalAlign: "middle" }} />
                      )}
                    </td>
                    <td style={{ ...td, fontWeight: isChecked ? 700 : 400 }}>{g.name}</td>
                    <td style={{ ...td, color: g.email ? "#555" : "#ccc", fontSize: "0.72rem" }}>{g.email || "—"}</td>
                    <td style={{ ...td, color: g.goesWith ? "#555" : "#ccc" }}>{g.goesWith || "—"}</td>
                    <td style={{ ...td, color: g.mesa ? "#111" : "#ccc" }}>{g.mesa || "—"}</td>
                    <td style={{ ...td, color: g.nroPulsera ? "#111" : "#ccc" }}>{g.nroPulsera || "—"}</td>
                    <td style={td}>
                      {g.pulseraEntregada ? (
                        <span style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", borderRadius: "6px", background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>Entregada</span>
                      ) : isVer ? (
                        <span style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", borderRadius: "6px", background: "rgba(107,95,248,0.08)", color: "#6b5ff8" }}>Verificada</span>
                      ) : (
                        <span style={{ color: "#ccc", fontSize: "0.7rem" }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, color: "#bbb", fontSize: "0.65rem" }}>{g.id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: "0.7rem", color: "#bbb", textAlign: "right" }}>
          {filteredGuests.length} invitados · {verified.size} verificados · {guests.filter(g => g.pulseraEntregada).length} entregadas
        </div>
      </section>

      <footer style={{ fontSize: "0.65rem", color: "#bbb", textAlign: "center", paddingBottom: "1rem" }}>
        Requiere Chrome para Android · HTTPS
      </footer>

      {showWriteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1.5rem" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "1.75rem", width: "100%", maxWidth: "340px", display: "flex", flexDirection: "column", gap: "1rem", fontFamily: "'DM Mono','Courier New',monospace" }}>
            {writeMode === "existing" ? (
              <>
                <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#6b5ff8" }}>Grabar tag NFC</div>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>{guests.find(g => g.id === checkedId)?.name}</div>
                <label style={{ fontSize: "0.8rem", color: "#555" }}>
                  Número de pulsera
                  <input autoFocus value={writingNroPulsera} onChange={e => setWritingNroPulsera(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && writingNroPulsera.trim()) startWrite(); }} placeholder="Ej: 42" style={inputStyle} />
                </label>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => setShowWriteModal(false)} style={{ flex: 1, padding: "0.75rem", borderRadius: "10px", border: "1px solid #e5e5e5", background: "#fff", color: "#111", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                  <button onClick={startWrite} disabled={!writingNroPulsera.trim()} style={{ flex: 1, padding: "0.75rem", borderRadius: "10px", border: "none", background: writingNroPulsera.trim() ? "#6b5ff8" : "#f0f0f0", color: writingNroPulsera.trim() ? "#fff" : "#aaa", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, cursor: writingNroPulsera.trim() ? "pointer" : "not-allowed" }}>Grabar</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#6b5ff8" }}>Nuevo invitado + tag NFC</div>
                <label style={{ fontSize: "0.8rem", color: "#555" }}>
                  Nombre <span style={{ color: "#dc2626" }}>*</span>
                  <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre completo" style={inputStyle} />
                </label>
                <label style={{ fontSize: "0.8rem", color: "#555" }}>
                  Mesa
                  <input value={newMesa} onChange={e => setNewMesa(e.target.value)} placeholder="Ej: 3" style={inputStyle} />
                </label>
                <label style={{ fontSize: "0.8rem", color: "#555" }}>
                  Número de pulsera <span style={{ color: "#dc2626" }}>*</span>
                  <input value={newPulsera} onChange={e => setNewPulsera(e.target.value)} placeholder="Ej: 42" style={inputStyle} />
                </label>
                <label style={{ fontSize: "0.8rem", color: "#555" }}>
                  Teléfono
                  <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Ej: +54 9 353 000-0000" style={inputStyle} />
                </label>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => setShowWriteModal(false)} style={{ flex: 1, padding: "0.75rem", borderRadius: "10px", border: "1px solid #e5e5e5", background: "#fff", color: "#111", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                  <button onClick={startWriteNewGuest} disabled={!newName.trim() || !newPulsera.trim()} style={{ flex: 1, padding: "0.75rem", borderRadius: "10px", border: "none", background: newName.trim() && newPulsera.trim() ? "#6b5ff8" : "#f0f0f0", color: newName.trim() && newPulsera.trim() ? "#fff" : "#aaa", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, cursor: newName.trim() && newPulsera.trim() ? "pointer" : "not-allowed" }}>Grabar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}