// Helpers compartidos del juego de figuritas (NO es "use server": exporta
// constantes y un helper de logging que usan las server actions).

import { db } from "@/server/db"
import { Prisma } from "@prisma/client"

// Corre una transacción interactiva en aislamiento Serializable y reintenta
// ante un conflicto de serialización (P2034) — necesario porque los counts
// se guardan como un blob JSON (read-modify-write), no como increments
// atómicos: sin esto, dos cambios concurrentes sobre el mismo álbum pisarían
// uno al otro (figus duplicadas o perdidas).
export async function serializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  tries = 5,
): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === "P2034" && i < tries - 1) continue // conflicto/deadlock: reintentar
      throw e
    }
  }
}

export const FIGUS_EVENT_ID = process.env.FIGUS_EVENT_ID ?? ""

export const TOTAL_FIGS = 15
export const SEC_TOTAL = 10 // colgantes RGB
export const GOLD_COUNT = 3 // cartas doradas
export const PRIZE_KEYS = ["camara", "reloj", "peluche"] as const
export const FEED_LIMIT = 30

export const PRIZE_META: Record<string, { nm: string; g: string }> = {
  camara: { nm: "Cámara instantánea", g: "📷" },
  reloj: { nm: "Reloj Disney", g: "⌚" },
  peluche: { nm: "Peluche Disney", g: "🧸" },
}

export const GOLD_META: { nm: string; g: string }[] = [
  { nm: "Marti · El Vals", g: "👑" },
  { nm: "Marti & Papá", g: "🤍" },
  { nm: "Marti Reina", g: "✨" },
]

// Nombre + glyph de cada figu (para construir el texto de los eventos del
// feed server-side). Espejo del FIGS del cliente.
export const FIG_META: Record<number, { nm: string; g: string }> = {
  1: { nm: "Marti Sirena", g: "🐚" },
  2: { nm: "Marti de Hielo", g: "❄️" },
  3: { nm: "Marti Navegante", g: "🌺" },
  4: { nm: "Marti Guerrera", g: "🗡️" },
  5: { nm: "Marti Jazmín", g: "🪔" },
  6: { nm: "Marti Bella", g: "🌹" },
  7: { nm: "Marti Cenicienta", g: "👠" },
  8: { nm: "Marti Rapunzel", g: "💜" },
  9: { nm: "Marti Blanca", g: "🍎" },
  10: { nm: "Marti Aurora", g: "🌿" },
  11: { nm: "Marti Pocahontas", g: "🍃" },
  12: { nm: "Marti Valiente", g: "🏹" },
  13: { nm: "Marti Tiana", g: "🐸" },
  14: { nm: "Marti Encanto", g: "🦋" },
  15: { nm: "Marti Maléfica", g: "🖤" },
}

export function figMeta(id: number) {
  return FIG_META[id] ?? { nm: `Figu ${id}`, g: "❔" }
}

// Escapa para insertar texto en el HTML del feed (los nombres de invitado).
export function esc(s: string): string {
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!,
  )
}

export function parseCounts(counts: unknown): Record<number, number> {
  if (!counts || typeof counts !== "object") return {}
  return counts as Record<number, number>
}

export function uniquesOf(counts: Record<number, number>): number {
  let u = 0
  for (let id = 1; id <= TOTAL_FIGS; id++) if ((counts[id] || 0) > 0) u++
  return u
}

// Inserta un evento en el feed del Reino. `text` ya viene armado y escapado.
export async function logEvent(kind: string, text: string, actorId?: string | null) {
  try {
    await db.figusEvent.create({
      data: { eventId: FIGUS_EVENT_ID, kind, text, actorId: actorId ?? null },
    })
  } catch (err) {
    console.error("[logEvent]", err)
  }
}

// Marca el álbum como completo (una sola vez) y reclama el próximo premio
// disponible (1º cámara, 2º reloj, 3º peluche). Corre DENTRO de una
// transacción del caller. Devuelve la prizeKey ganada o null.
export async function claimCompletion(
  tx: Prisma.TransactionClient,
  guestId: string,
  name: string,
  counts: Record<number, number>,
): Promise<string | null> {
  if (uniquesOf(counts) < TOTAL_FIGS) return null

  const upd = await tx.figusAlbum.updateMany({
    where: { guestId, completedAt: null },
    data: { completedAt: new Date() },
  })
  if (upd.count === 0) return null // ya estaba completo (no re-reclama)

  for (const key of PRIZE_KEYS) {
    const claim = await tx.figusPrize.updateMany({
      where: { eventId: FIGUS_EVENT_ID, prizeKey: key, winnerId: null },
      data: { winnerId: guestId, winnerName: name, claimedAt: new Date() },
    })
    if (claim.count > 0) return key
  }
  return null // completó pero no quedan premios (4º en adelante)
}
