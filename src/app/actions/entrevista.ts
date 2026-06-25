"use server"

import { db } from "@/server/db"

// eventId hardcodeado — mismo criterio que el resto de figus (ver memoria
// figus-event-id-mismatch: el código lee FIGUS_EVENT_ID, que hoy resuelve a "").
const EVENT_ID = process.env.FIGUS_EVENT_ID ?? ""

// Alfabeto sin caracteres ambiguos (0/O, 1/I) para dictarlo de viva voz en la
// entrevista sin confusiones.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CODE_LEN = 4

function randomCode(): string {
  let out = ""
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}

export type CodigoKind = "codigo" | "carta"

type CrearResult =
  | { ok: true; code: string; value: number; packKind: CodigoKind }
  | { ok: false; error: string }

// ─────────────────────────────────────────────
// CREAR CÓDIGO DE ENTREVISTA
//
// A diferencia de lanzarCodigo/createCodigo (broadcast de /pantalla):
//   • NO desactiva el código activo anterior → conviven muchos a la vez.
//   • Sin ventana (activeAt/durationSeconds = null) → no caduca.
//   • singleUse = true → lo canjea UN solo invitado y se quema.
// El código es único entre los activos para que redeemCodigo (findFirst by
// code, active:true) nunca quede ambiguo.
// ─────────────────────────────────────────────

export async function crearCodigoEntrevista(
  value: number,
  packKind: CodigoKind = "codigo",
): Promise<CrearResult> {
  const figus = Math.min(10, Math.max(1, Math.round(value) || 4))
  const kind: CodigoKind = packKind === "carta" ? "carta" : "codigo"

  try {
    // Genera un código que no choque con ningún código activo (entrevista o
    // broadcast). 12 intentos cubren de sobra el espacio (32^4 ≈ 1M).
    for (let i = 0; i < 12; i++) {
      const code = randomCode()
      const clash = await db.figusCodigo.findFirst({
        where: { eventId: EVENT_ID, code, active: true },
        select: { id: true },
      })
      if (clash) continue
      await db.figusCodigo.create({
        data: {
          eventId: EVENT_ID,
          code,
          value: figus,
          active: true,
          singleUse: true,
          packKind: kind,
          // sin ventana: no caduca hasta que se canjee
          activeAt: null,
          durationSeconds: null,
        },
      })
      return { ok: true, code, value: figus, packKind: kind }
    }
    return { ok: false, error: "No se pudo generar un código libre, probá de nuevo" }
  } catch (err) {
    console.error("[crearCodigoEntrevista]", err)
    return { ok: false, error: "No se pudo generar el código" }
  }
}

// ─────────────────────────────────────────────
// LOTE DE SOBRES ESCONDIDOS — genera N códigos single-use (packKind="carta")
// para imprimir atrás de cartas físicas. Cada uno se canjea UNA sola vez.
// ─────────────────────────────────────────────

export async function crearCodigosEscondido(
  count: number,
  value: number,
): Promise<{ ok: true; codes: { code: string; value: number }[] } | { ok: false; error: string }> {
  const n = Math.max(1, Math.min(80, Math.round(count) || 10))
  const figus = Math.min(10, Math.max(1, Math.round(value) || 2))
  try {
    const codes: { code: string; value: number }[] = []
    for (let i = 0; i < n; i++) {
      const r = await crearCodigoEntrevista(figus, "carta")
      if (r.ok) codes.push({ code: r.code, value: r.value })
    }
    if (!codes.length) return { ok: false, error: "No se pudieron generar códigos" }
    return { ok: true, codes }
  } catch (err) {
    console.error("[crearCodigosEscondido]", err)
    return { ok: false, error: "No se pudieron generar los códigos" }
  }
}

export interface EntrevistaCodigo {
  id: string
  code: string
  value: number
  packKind: CodigoKind
  redeemed: boolean
  redeemedByName: string | null
  createdAt: string
}

// ─────────────────────────────────────────────
// LOAD ENTREVISTA — lista de códigos de entrevista recientes con su estado de
// canje, para que el entrevistador vea en vivo cuáles ya se usaron.
// ─────────────────────────────────────────────

export async function loadEntrevista(packKind?: CodigoKind): Promise<EntrevistaCodigo[]> {
  const codigos = await db.figusCodigo.findMany({
    where: { eventId: EVENT_ID, singleUse: true, ...(packKind ? { packKind } : {}) },
    orderBy: { createdAt: "desc" },
    take: packKind === "carta" ? 300 : 40,
    select: { id: true, code: true, value: true, packKind: true, usedBy: true, createdAt: true },
  })

  // Nombre del invitado que lo canjeó (usedBy[0], porque es de un solo uso).
  const guestIds = Array.from(
    new Set(codigos.map((c) => c.usedBy[0]).filter((g): g is string => !!g)),
  )
  const guests = guestIds.length
    ? await db.androLedGuest.findMany({
        where: { id: { in: guestIds } },
        select: { id: true, name: true },
      })
    : []
  const nameById = new Map(guests.map((g) => [g.id, (g.name || "").trim()]))

  return codigos.map((c) => {
    const redeemer = c.usedBy[0]
    return {
      id: c.id,
      code: c.code,
      value: c.value,
      packKind: (c.packKind === "carta" ? "carta" : "codigo") as CodigoKind,
      redeemed: c.usedBy.length > 0,
      redeemedByName: redeemer ? nameById.get(redeemer) || "Invitado/a" : null,
      createdAt: c.createdAt.toISOString(),
    }
  })
}

// ─────────────────────────────────────────────
// CANCELAR CÓDIGO — el entrevistador puede anular uno aún sin canjear (p. ej.
// si se equivocó de figus). Si ya se canjeó, no se toca.
// ─────────────────────────────────────────────

export async function cancelarCodigoEntrevista(id: string): Promise<{ ok: boolean }> {
  const res = await db.figusCodigo.updateMany({
    where: { id, eventId: EVENT_ID, singleUse: true, usedBy: { isEmpty: true } },
    data: { active: false },
  })
  return { ok: res.count > 0 }
}
