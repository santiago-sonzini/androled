"use client";

import { useState, useRef } from "react";

type NFCStatus = "idle" | "scanning" | "writing" | "success" | "error" | "unsupported";

interface NFCRecord {
  recordType: string;
  mediaType?: string;
  data: string;
}

export default function NFCPage() {
  const [status, setStatus] = useState<NFCStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [readRecords, setReadRecords] = useState<NFCRecord[]>([]);
  const [writeText, setWriteText] = useState<string>("");
  const [serialNumber, setSerialNumber] = useState<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const isSupported = typeof window !== "undefined" && "NDEFReader" in window;

  async function startScan() {
    if (!isSupported) {
      setStatus("unsupported");
      setMessage("Web NFC no está soportado en este navegador.");
      return;
    }

    try {
      abortControllerRef.current = new AbortController();
      setStatus("scanning");
      setMessage("Acercá el tag NFC...");
      setReadRecords([]);
      setSerialNumber("");

      const ndef = new (window as any).NDEFReader();
      await ndef.scan({ signal: abortControllerRef.current.signal });

      ndef.onreading = (event: any) => {
        setSerialNumber(event.serialNumber);
        const records: NFCRecord[] = [];

        for (const record of event.message.records) {
          let decoded = "";
          if (record.recordType === "text") {
            const decoder = new TextDecoder(record.encoding || "utf-8");
            decoded = decoder.decode(record.data);
          } else if (record.recordType === "url") {
            const decoder = new TextDecoder();
            decoded = decoder.decode(record.data);
          } else {
            decoded = `[${record.recordType}]`;
          }
          records.push({
            recordType: record.recordType,
            mediaType: record.mediaType,
            data: decoded,
          });
        }

        setReadRecords(records);
        setStatus("success");
        setMessage("Tag leído correctamente.");
      };

      ndef.onreadingerror = () => {
        setStatus("error");
        setMessage("No se pudo leer el tag. Intentá de nuevo.");
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        setStatus("idle");
        setMessage("");
      } else {
        setStatus("error");
        setMessage(`Error: ${err.message}`);
      }
    }
  }

  function stopScan() {
    abortControllerRef.current?.abort();
    setStatus("idle");
    setMessage("");
  }

  async function writeTag() {
    if (!isSupported) {
      setStatus("unsupported");
      setMessage("Web NFC no está soportado en este navegador.");
      return;
    }
    if (!writeText.trim()) return;

    try {
      setStatus("writing");
      setMessage("Acercá el tag NFC para escribir...");

      const ndef = new (window as any).NDEFReader();
      await ndef.write({ records: [{ recordType: "text", data: writeText }] });

      setStatus("success");
      setMessage("Escrito correctamente en el tag.");
    } catch (err: any) {
      setStatus("error");
      setMessage(`Error al escribir: ${err.message}`);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#111111",
        fontFamily: "'DM Mono', 'Courier New', monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem 1.25rem",
        gap: "2rem",
      }}
    >
      {/* Header */}
      <header style={{ textAlign: "center", marginTop: "1rem" }}>
        <div
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.3em",
            color: "#6b5ff8",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}
        >
          NFC · NDEF
        </div>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            margin: 0,
            color: "#111111",
          }}
        >
          NFC Reader / Writer
        </h1>
      </header>

      {/* Status badge */}
      {message && (
        <div
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "999px",
            fontSize: "0.78rem",
            letterSpacing: "0.02em",
            background:
              status === "error"
                ? "rgba(239,68,68,0.08)"
                : status === "success"
                ? "rgba(34,197,94,0.08)"
                : "rgba(107,95,248,0.08)",
            color:
              status === "error"
                ? "#dc2626"
                : status === "success"
                ? "#16a34a"
                : "#6b5ff8",
            border: `1px solid ${
              status === "error"
                ? "rgba(239,68,68,0.25)"
                : status === "success"
                ? "rgba(34,197,94,0.25)"
                : "rgba(107,95,248,0.25)"
            }`,
          }}
        >
          {status === "scanning" || status === "writing" ? "⟳ " : ""}
          {message}
        </div>
      )}

      {/* READ section */}
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: "16px",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#6b5ff8",
          }}
        >
          Leer tag
        </div>

        <button
          onClick={status === "scanning" ? stopScan : startScan}
          style={{
            padding: "0.85rem",
            borderRadius: "10px",
            border: "none",
            background:
              status === "scanning"
                ? "rgba(239,68,68,0.1)"
                : "#6b5ff8",
            color: status === "scanning" ? "#dc2626" : "#ffffff",
            fontSize: "0.9rem",
            fontFamily: "inherit",
            fontWeight: 600,
            letterSpacing: "0.02em",
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
        >
          {status === "scanning" ? "Detener escaneo" : "Iniciar escaneo"}
        </button>

        {readRecords.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {serialNumber && (
              <div style={{ fontSize: "0.7rem", color: "#6b5ff8", letterSpacing: "0.05em" }}>
                Serial: {serialNumber}
              </div>
            )}
            {readRecords.map((rec, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(107,95,248,0.05)",
                  border: "1px solid rgba(107,95,248,0.15)",
                  borderRadius: "8px",
                  padding: "0.75rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "#6b5ff8",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "0.3rem",
                  }}
                >
                  {rec.recordType}
                  {rec.mediaType ? ` · ${rec.mediaType}` : ""}
                </div>
                <div style={{ fontSize: "0.9rem", wordBreak: "break-all", color: "#111111" }}>
                  {rec.data}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* WRITE section */}
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: "16px",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#6b5ff8",
          }}
        >
          Escribir tag
        </div>

        <textarea
          value={writeText}
          onChange={(e) => setWriteText(e.target.value)}
          placeholder="Texto a escribir en el tag..."
          rows={3}
          style={{
            background: "#fafafa",
            border: "1px solid #e5e5e5",
            borderRadius: "8px",
            color: "#111111",
            fontFamily: "inherit",
            fontSize: "0.88rem",
            padding: "0.75rem",
            resize: "vertical",
            outline: "none",
          }}
        />

        <button
          onClick={writeTag}
          disabled={!writeText.trim() || status === "writing"}
          style={{
            padding: "0.85rem",
            borderRadius: "10px",
            border: "none",
            background:
              !writeText.trim() || status === "writing"
                ? "#f0f0f0"
                : "#16a34a",
            color:
              !writeText.trim() || status === "writing" ? "#aaaaaa" : "#ffffff",
            fontSize: "0.9rem",
            fontFamily: "inherit",
            fontWeight: 600,
            letterSpacing: "0.02em",
            cursor:
              !writeText.trim() || status === "writing" ? "not-allowed" : "pointer",
            transition: "opacity 0.15s",
          }}
        >
          {status === "writing" ? "Esperando tag..." : "Escribir en tag"}
        </button>
      </section>

      <footer
        style={{
          fontSize: "0.65rem",
          color: "#bbbbbb",
          letterSpacing: "0.05em",
          textAlign: "center",
          marginTop: "auto",
          paddingBottom: "1rem",
        }}
      >
        Requiere Chrome para Android · HTTPS
      </footer>
    </main>
  );
}