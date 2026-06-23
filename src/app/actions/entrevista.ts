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

type CrearResult =
  | { ok: true; code: string; value: number }
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

export async function crearCodigoEntrevista(value: number): Promise<CrearResult> {
  const figus = Math.min(10, Math.max(1, Math.round(value) || 4))

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
          // sin ventana: no caduca hasta que se canjee
          activeAt: null,
          durationSeconds: null,
        },
      })
      return { ok: true, code, value: figus }
    }
    return { ok: false, error: "No se pudo generar un código libre, probá de nuevo" }
  } catch (err) {
    console.error("[crearCodigoEntrevista]", err)
    return { ok: false, error: "No se pudo generar el código" }
  }
}

export interface EntrevistaCodigo {
  id: string
  code: string
  value: number
  redeemed: boolean
  redeemedByName: string | null
  createdAt: string
}

// ─────────────────────────────────────────────
// LOAD ENTREVISTA — lista de códigos de entrevista recientes con su estado de
// canje, para que el entrevistador vea en vivo cuáles ya se usaron.
// ─────────────────────────────────────────────

export async function loadEntrevista(): Promise<EntrevistaCodigo[]> {
  const codigos = await db.figusCodigo.findMany({
    where: { eventId: EVENT_ID, singleUse: true },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, code: true, value: true, usedBy: true, createdAt: true },
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
