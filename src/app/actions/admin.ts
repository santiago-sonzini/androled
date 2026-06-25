"use server"

import { db } from "@/server/db"
import { revalidatePath } from "next/cache"
import {
  FIGUS_EVENT_ID as EVENT_ID,
  TOTAL_FIGS,
  SEC_TOTAL,
  GOLD_COUNT,
  PRIZE_KEYS,
  PRIZE_META,
  GOLD_META,
  parseCounts,
  uniquesOf,
} from "@/server/figus"
import { grantPack } from "./album"

// ─────────────────────────────────────────────
// SEED del admin (idempotente): doradas, premios e inventario base.
// ─────────────────────────────────────────────

async function ensureSeed() {
  await db.figusGold.createMany({
    data: Array.from({ length: GOLD_COUNT }, (_, i) => ({ eventId: EVENT_ID, goldIdx: i })),
    skipDuplicates: true,
  })
  await db.figusPrize.createMany({
    data: PRIZE_KEYS.map((k) => ({ eventId: EVENT_ID, prizeKey: k })),
    skipDuplicates: true,
  })
  // Colgantes RGB: inventario físico de SEC_TOTAL (no piso `total` si ya existe).
  await db.figusInventory.upsert({
    where: { eventId_key: { eventId: EVENT_ID, key: "colgante" } },
    update: {},
    create: { eventId: EVENT_ID, key: "colgante", label: "Colgante RGB", emoji: "📿", total: SEC_TOTAL },
  })
  // Config: duración del sobre regalo (minutos). Default 10.
  await db.figusInventory.upsert({
    where: { eventId_key: { eventId: EVENT_ID, key: "gift_duration" } },
    update: {},
    create: { eventId: EVENT_ID, key: "gift_duration", label: "Timer sobre regalo (min)", emoji: "⏱️", total: 10 },
  })
  // Config: forzar doradas en próximos N sobres.
  await db.figusInventory.upsert({
    where: { eventId_key: { eventId: EVENT_ID, key: "force_gold" } },
    update: {},
    create: { eventId: EVENT_ID, key: "force_gold", label: "Force Gold pendientes", emoji: "🌟", total: 0 },
  })
  // Config: probabilidad de dorada (porcentaje). Default 6%.
  await db.figusInventory.upsert({
    where: { eventId_key: { eventId: EVENT_ID, key: "dora_prob" } },
    update: {},
    create: { eventId: EVENT_ID, key: "dora_prob", label: "Probabilidad de dorada (%)", emoji: "🎲", total: 6 },
  })
}

// ─────────────────────────────────────────────
// LOAD ADMIN — todo lo que ve el panel
// ─────────────────────────────────────────────

export async function loadAdmin() {
  await ensureSeed()

  const [albums, prizes, golds, inventory] = await Promise.all([
    db.figusAlbum.findMany({
      select: {
        guestId: true,
        counts: true,
        completedAt: true,
        guest: { select: { name: true, avatar: true, selfie: true, nroPulsera: true, mesa: true } },
      },
    }),
    db.figusPrize.findMany({ where: { eventId: EVENT_ID } }),
    db.figusGold.findMany({ where: { eventId: EVENT_ID }, orderBy: { goldIdx: "asc" } }),
    db.figusInventory.findMany({ where: { eventId: EVENT_ID }, orderBy: { createdAt: "asc" } }),
  ])

  let collected = 0
  const guests = albums
    .map((a) => {
      const counts = parseCounts(a.counts)
      for (let id = 1; id <= TOTAL_FIGS; id++) collected += counts[id] || 0
      return {
        id: a.guestId,
        name: (a.guest.name || "").trim() || "Invitado/a",
        avatar: a.guest.avatar,
        selfie: a.guest.selfie,
        nroPulsera: a.guest.nroPulsera,
        mesa: a.guest.mesa,
        uniques: uniquesOf(counts),
        counts,
        completed: a.completedAt != null,
        completedAt: a.completedAt ? a.completedAt.getTime() : null,
      }
    })
    .sort((x, y) => {
      if (x.completed && y.completed) return (x.completedAt ?? 0) - (y.completedAt ?? 0)
      if (x.completed !== y.completed) return x.completed ? -1 : 1
      return y.uniques - x.uniques
    })

  const prizeByKey = new Map(prizes.map((p) => [p.prizeKey, p]))
  const golds2 = golds.map((g) => ({
    idx: g.goldIdx,
    nm: GOLD_META[g.goldIdx]?.nm ?? `Dorada ${g.goldIdx + 1}`,
    g: GOLD_META[g.goldIdx]?.g ?? "✨",
    prize: GOLD_META[g.goldIdx]?.prize ?? "",
    img: GOLD_META[g.goldIdx]?.img ?? "",
    winnerId: g.winnerId,
    winnerName: g.winnerName,
    delivered: g.deliveredAt != null,
  }))

  const giftDurationItem = inventory.find((i) => i.key === "gift_duration")
  const forceGoldItem = inventory.find((i) => i.key === "force_gold")
  const doraProbItem = inventory.find((i) => i.key === "dora_prob")
  const CONFIG_KEYS = new Set(["force_gold", "gift_duration", "dora_prob"])

  return {
    stats: {
      guests: guests.length,
      completed: guests.filter((g) => g.completed).length,
      collected,
      doradasTaken: golds.filter((g) => g.winnerId != null).length,
    },
    guests,
    prizes: PRIZE_KEYS.map((k) => {
      const p = prizeByKey.get(k)
      return {
        key: k,
        nm: PRIZE_META[k]!.nm,
        g: PRIZE_META[k]!.g,
        img: PRIZE_META[k]!.img,
        winnerId: p?.winnerId ?? null,
        winnerName: p?.winnerName ?? null,
        delivered: p?.deliveredAt != null,
      }
    }),
    golds: golds2,
    // El inventario de regalos NO incluye las claves de config (force_gold,
    // gift_duration, dora_prob): no son regalos físicos, tienen su propia UI.
    inventory: inventory
      .filter((i) => !CONFIG_KEYS.has(i.key))
      .map((i) => ({
        key: i.key,
        label: i.label,
        emoji: i.emoji,
        total: i.total,
        delivered: i.delivered,
      })),
    giftDuration: giftDurationItem?.total ?? 10,
    doraProb: doraProbItem?.total ?? 6,
    forceGoldRemaining: forceGoldItem ? Math.max(0, forceGoldItem.total - forceGoldItem.delivered) : 0,
  }
}

type R = { ok: true } | { ok: false; error: string }

// ─────────────────────────────────────────────
// PREMIOS PRINCIPALES
// ─────────────────────────────────────────────

export async function setPrizeDelivered(prizeKey: string, delivered: boolean): Promise<R> {
  try {
    await db.figusPrize.update({
      where: { eventId_prizeKey: { eventId: EVENT_ID, prizeKey } },
      data: { deliveredAt: delivered ? new Date() : null },
    })
    revalidatePath("/admin-reino")
    return { ok: true }
  } catch (e) {
    console.error("[setPrizeDelivered]", e)
    return { ok: false, error: "No se pudo actualizar el premio" }
  }
}

export async function assignPrize(prizeKey: string, guestId: string | null): Promise<R> {
  try {
    if (guestId) {
      const g = await db.androLedGuest.findUnique({ where: { id: guestId }, select: { name: true } })
      const name = (g?.name || "").trim() || "Invitado/a"
      await db.figusPrize.update({
        where: { eventId_prizeKey: { eventId: EVENT_ID, prizeKey } },
        data: { winnerId: guestId, winnerName: name, claimedAt: new Date() },
      })
    } else {
      await db.figusPrize.update({
        where: { eventId_prizeKey: { eventId: EVENT_ID, prizeKey } },
        data: { winnerId: null, winnerName: null, claimedAt: null, deliveredAt: null },
      })
    }
    revalidatePath("/admin-reino")
    return { ok: true }
  } catch (e) {
    console.error("[assignPrize]", e)
    return { ok: false, error: "No se pudo asignar el premio" }
  }
}

// ─────────────────────────────────────────────
// DORADAS
// ─────────────────────────────────────────────

export async function setGoldDelivered(goldIdx: number, delivered: boolean): Promise<R> {
  try {
    await db.figusGold.update({
      where: { eventId_goldIdx: { eventId: EVENT_ID, goldIdx } },
      data: { deliveredAt: delivered ? new Date() : null },
    })
    revalidatePath("/admin-reino")
    return { ok: true }
  } catch (e) {
    console.error("[setGoldDelivered]", e)
    return { ok: false, error: "No se pudo actualizar la dorada" }
  }
}

// ─────────────────────────────────────────────
// INVENTARIO DE REGALOS (entregar / descontar)
// ─────────────────────────────────────────────

export async function adjustInventory(key: string, delta: number): Promise<R> {
  try {
    const item = await db.figusInventory.findUnique({
      where: { eventId_key: { eventId: EVENT_ID, key } },
    })
    if (!item) return { ok: false, error: "Regalo no encontrado" }
    const delivered = Math.max(0, Math.min(item.total, item.delivered + Math.round(delta)))
    await db.figusInventory.update({
      where: { eventId_key: { eventId: EVENT_ID, key } },
      data: { delivered },
    })
    revalidatePath("/admin-reino")
    return { ok: true }
  } catch (e) {
    console.error("[adjustInventory]", e)
    return { ok: false, error: "No se pudo actualizar el inventario" }
  }
}

export async function upsertInventoryItem(input: {
  key?: string
  label: string
  emoji: string
  total: number
}): Promise<R> {
  const label = input.label.trim()
  if (!label) return { ok: false, error: "Falta el nombre del regalo" }
  const key = (input.key || label.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 40) || "regalo"
  const total = Math.max(0, Math.round(input.total) || 0)
  const emoji = input.emoji.trim() || "🎁"
  try {
    await db.figusInventory.upsert({
      where: { eventId_key: { eventId: EVENT_ID, key } },
      update: { label, emoji, total },
      create: { eventId: EVENT_ID, key, label, emoji, total },
    })
    revalidatePath("/admin-reino")
    return { ok: true }
  } catch (e) {
    console.error("[upsertInventoryItem]", e)
    return { ok: false, error: "No se pudo guardar el regalo" }
  }
}

export async function deleteInventoryItem(key: string): Promise<R> {
  try {
    await db.figusInventory.deleteMany({ where: { eventId: EVENT_ID, key } })
    revalidatePath("/admin-reino")
    return { ok: true }
  } catch (e) {
    console.error("[deleteInventoryItem]", e)
    return { ok: false, error: "No se pudo borrar el regalo" }
  }
}

// ─────────────────────────────────────────────
// REGALAR UN SOBRE A UN INVITADO
// ─────────────────────────────────────────────

export async function giveGiftToGuest(guestId: string): Promise<R> {
  const res = await grantPack(guestId, "gift")
  if (!res.ok) return { ok: false, error: res.error }
  revalidatePath("/admin-reino")
  return { ok: true }
}

// ─────────────────────────────────────────────
// FORCE GOLD — forzar doradas en próximos N sobres
// ─────────────────────────────────────────────

export async function addForceGold(count: number): Promise<R> {
  const want = Math.max(1, Math.min(20, Math.round(count) || 3))
  try {
    // No forzar más doradas de las que quedan libres: si no, el sobrante queda
    // "pendiente" para siempre (no hay fila de dorada que reclamar). El cupo es
    // doradas libres − force ya pendiente.
    const [freeGolds, fg] = await Promise.all([
      db.figusGold.count({ where: { eventId: EVENT_ID, winnerId: null } }),
      db.figusInventory.findUnique({ where: { eventId_key: { eventId: EVENT_ID, key: "force_gold" } } }),
    ])
    const pending = fg ? Math.max(0, fg.total - fg.delivered) : 0
    const room = Math.max(0, freeGolds - pending)
    if (room <= 0) {
      return { ok: false, error: pending > 0 ? "Ya hay doradas forzadas pendientes" : "No quedan doradas libres" }
    }
    const n = Math.min(want, room)
    await db.figusInventory.upsert({
      where: { eventId_key: { eventId: EVENT_ID, key: "force_gold" } },
      update: { total: { increment: n } },
      create: { eventId: EVENT_ID, key: "force_gold", label: "Force Gold pendientes", emoji: "🌟", total: n },
    })
    revalidatePath("/admin-reino")
    return { ok: true }
  } catch (e) {
    console.error("[addForceGold]", e)
    return { ok: false, error: "No se pudo configurar force gold" }
  }
}

// ─────────────────────────────────────────────
// GIFT DURATION — configurar timer del sobre regalo (en minutos)
// ─────────────────────────────────────────────

export async function setGiftDuration(minutes: number): Promise<R> {
  const m = Math.max(1, Math.min(120, Math.round(minutes) || 10))
  try {
    await db.figusInventory.upsert({
      where: { eventId_key: { eventId: EVENT_ID, key: "gift_duration" } },
      update: { total: m },
      create: { eventId: EVENT_ID, key: "gift_duration", label: "Timer sobre regalo (min)", emoji: "⏱️", total: m },
    })
    revalidatePath("/admin-reino")
    return { ok: true }
  } catch (e) {
    console.error("[setGiftDuration]", e)
    return { ok: false, error: "No se pudo actualizar el timer" }
  }
}

// ─────────────────────────────────────────────
// DORA PROB — probabilidad de que salga una dorada (porcentaje 0-100)
// ─────────────────────────────────────────────

export async function setDoraProb(percent: number): Promise<R> {
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  try {
    await db.figusInventory.upsert({
      where: { eventId_key: { eventId: EVENT_ID, key: "dora_prob" } },
      update: { total: p },
      create: { eventId: EVENT_ID, key: "dora_prob", label: "Probabilidad de dorada (%)", emoji: "🎲", total: p },
    })
    revalidatePath("/admin-reino")
    return { ok: true }
  } catch (e) {
    console.error("[setDoraProb]", e)
    return { ok: false, error: "No se pudo actualizar la probabilidad" }
  }
}
