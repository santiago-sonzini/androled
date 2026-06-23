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
// Premios principales por ORDEN de completado del álbum: 1º cámara, 2º Funko
// Dante, 3º Minnie Combo. Del 4º en adelante se gana un colgante RGB (ver
// claimCompletion + SEC_TOTAL).
export const PRIZE_KEYS = ["camara", "funko_dante", "minnie"] as const
export const FEED_LIMIT = 30

export const PRIZE_META: Record<string, { nm: string; g: string; img: string }> = {
  camara:      { nm: "Cámara Instantánea",     g: "📷", img: "/prizes/camara.webp" },
  funko_dante: { nm: "Funko Pop Dante",         g: "💀", img: "/prizes/funko_dante.webp" },
  minnie:      { nm: "Disney Minnie Combo × 3", g: "🎀", img: "/prizes/minnie_combo.webp" },
  // Sentinel (NO es PRIZE_KEY): nombre para los mensajes del 4º en adelante.
  colgante:    { nm: "Colgante RGB",            g: "📿", img: "" },
}

// Doradas (cartas 16/17/18).
export const GOLD_META: { nm: string; g: string; prize: string; img: string }[] = [
  { nm: "Marti & Stitch",   g: "💙", prize: "Stitch Robótico",       img: "/prizes/stitch.webp" },
  { nm: "Marti & Simba",    g: "🦁", prize: "LEGO Simba",            img: "/prizes/lego_simba.webp" },
  { nm: "Marti Enredada",   g: "🏮", prize: "Funko Pop Enredadas",   img: "/prizes/funko_rapunzel.webp" },
]

// Nombre + glyph de cada figu (para construir el texto de los eventos del
// feed server-side). Espejo del FIGS del cliente.
export const FIG_META: Record<number, { nm: string; g: string }> = {
  1: { nm: "Marti & Pooh", g: "🍯" },
  2: { nm: "Marti & la Manzana", g: "🍎" },
  3: { nm: "Marti & Dumbo", g: "🐘" },
  4: { nm: "Marti & los Dálmatas", g: "🐶" },
  5: { nm: "Marti Bell", g: "🧚" },
  6: { nm: "Marti Sirena", g: "🐚" },
  7: { nm: "Marti Navegante", g: "🌺" },
  8: { nm: "Marti en el Circuito", g: "🏎️" },
  9: { nm: "Marti & Remy", g: "🐭" },
  10: { nm: "Marti & los Vientos", g: "🍃" },
  11: { nm: "Marti a Medianoche", g: "👠" },
  12: { nm: "Marti en Agrabah", g: "🪔" },
  13: { nm: "Marti Maléfica", g: "🖤" },
  14: { nm: "Marti & Dante", g: "💀" },
  15: { nm: "Marti en el Bayou", g: "🐸" },
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
// disponible por orden de llegada (1º cámara, 2º Funko Dante, 3º Minnie). Del
// 4º en adelante gana un colgante RGB (hasta SEC_TOTAL). Corre DENTRO de una
// transacción del caller. Devuelve la prizeKey ganada, "colgante", o null.
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

  // 4º en adelante: colgante RGB. El conteo real (quién/cuántos) se deriva del
  // orden de completado en loadReino/loadAdmin; acá solo devolvemos el sentinel
  // para el mensaje de completion, mientras queden colgantes.
  const completedCount = await tx.figusAlbum.count({ where: { completedAt: { not: null } } })
  if (completedCount - PRIZE_KEYS.length <= SEC_TOTAL) return "colgante"
  return null // completó pero ya no quedan colgantes
}
