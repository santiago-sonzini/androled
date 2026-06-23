"use server"

import { db } from "@/server/db"
import { revalidatePath } from "next/cache"
import {
  logEvent,
  esc,
  claimCompletion,
  serializable,
  GOLD_META,
  PRIZE_META,
} from "@/server/figus"

// Probabilidad de dorada por tipo de sobre. Acotada por el stock global
// (3 cartas): una vez reclamadas, no salen más aunque el roll pegue.
const DOR_BY_KEY: Record<string, number> = {
  start: 0.05,
  codigo: 0.06,
  carta: 0.08,
  gift: 0.06,
  trivia: 0.06,
  ig: 0,
}

type Rarity = "comun" | "rara" | "epica" | "m"

interface Fig {
  id: number
  r: Rarity
}

// Rareza real impresa en cada carta: Común ★ (1-5), Especial ★★ (6-11),
// Legendaria ★★★ (12-15). Las legendarias son el muro que obliga a cambiar.
const FIGS: Fig[] = [
  { id: 1,  r: "comun" },
  { id: 2,  r: "comun" },
  { id: 3,  r: "comun" },
  { id: 4,  r: "comun" },
  { id: 5,  r: "comun" },
  { id: 6,  r: "rara"  },
  { id: 7,  r: "rara"  },
  { id: 8,  r: "rara"  },
  { id: 9,  r: "rara"  },
  { id: 10, r: "rara"  },
  { id: 11, r: "rara"  },
  { id: 12, r: "epica" },
  { id: 13, r: "epica" },
  { id: 14, r: "epica" },
  { id: 15, r: "epica" },
]

const WEIGHTS: Record<Rarity, number> = { comun: 10, rara: 4, epica: 1, m: 10 }

// ─────────────────────────────────────────────
// PACKS — tokens dentro de packsLeft
//
// Cada sobre pendiente es un token. Puede llevar un valor opcional
// con "#" para sobres de tamaño variable (sobres por entrevista):
//
//   "start"      → bienvenida (6 figus)
//   "trivia"     → ganar la trivia (4 figus)
//   "codigo#5"   → código de entrevista que vale +5
//   "carta#2"    → sobre escondido encontrado (+2)
//   "gift#4"     → sobre regalo del Reino (+4)
//   "ig#1"       → seguir a Instagram (+1)
//   "used:start" → sobre de una sola vez ya abierto
//
// Así el estado persiste en DB y sobrevive refresh / cambio de
// dispositivo (la pulsera es la sesión).
// ─────────────────────────────────────────────

const USED_PREFIX = "used:"

// Tamaño por defecto de cada tipo de sobre cuando el token no trae "#valor".
const PACK_DEFAULT: Record<string, number> = {
  start: 10,
  trivia: 4,
  codigo: 4,
  carta: 2,
  gift: 4,
  ig: 1,
}

// Sobres de una sola vez: al abrirse se marcan "used:<key>" para no
// volver a ofrecerse. El resto (codigo/carta/gift) son repetibles.
const ONE_TIME = new Set(["start", "trivia", "ig"])

// Tope de sobres escondidos por invitado (espejo de CARTAS_MAX en el cliente).
const MAX_CARTAS = 3

function parseToken(token: string): { key: string; n: number } {
  const [key, raw] = token.split("#")
  const val = raw ? parseInt(raw, 10) : NaN
  const n = Number.isFinite(val) && val > 0 ? val : PACK_DEFAULT[key ?? ""] ?? 4
  return { key: key ?? "", n }
}

function isPending(packsLeft: string[], token: string) {
  return packsLeft.includes(token)
}

function wasUsed(packsLeft: string[], key: string) {
  return packsLeft.includes(USED_PREFIX + key)
}

function parseCounts(counts: unknown): Record<number, number> {
  if (!counts || typeof counts !== "object") return {}
  return counts as Record<number, number>
}

function parseState(state: unknown): Record<string, unknown> {
  if (!state || typeof state !== "object") return {}
  return state as Record<string, unknown>
}

// eventId hardcodeado — ya no viene del guest
const EVENT_ID = process.env.FIGUS_EVENT_ID ?? ""

// ─────────────────────────────────────────────
// SORTEO + PITY
//
// El stock se lee UNA vez y el sorteo descuenta capacidad en memoria.
// La regla "pity" garantiza un mínimo de figus nuevas mientras el
// álbum arranca: nunca un sobre 100% repetidas (las épicas quedan
// afuera del relleno — son el muro que obliga a cambiar).
// ─────────────────────────────────────────────

function drawCards(
  n: number,
  stocks: { cardId: number; issued: number; maxCount: number }[],
  userCounts: Record<number, number> = {},
): number[] {
  const cap = new Map<number, number>()
  const stockMap = new Map(stocks.map((s) => [s.cardId, s]))
  for (const f of FIGS) {
    const stock = stockMap.get(f.id)
    cap.set(f.id, stock ? Math.max(0, stock.maxCount - stock.issued) : Infinity)
  }

  // Máximo 2 copias por carta por usuario. Si ya tiene 2+, no puede recibir más.
  const MAX_USER_COPIES = 2
  const canDraw = (id: number) => (userCounts[id] || 0) < MAX_USER_COPIES

  const drawn: number[] = []
  for (let i = 0; i < n; i++) {
    // Pool respetando el cap de usuario (preferencia)
    let pool: number[] = []
    for (const f of FIGS) {
      if ((cap.get(f.id) ?? 0) <= 0) continue
      if (!canDraw(f.id)) continue
      for (let j = 0; j < WEIGHTS[f.r]; j++) pool.push(f.id)
    }
    // Fallback sin cap de usuario si el pool quedó vacío (todos al tope)
    if (pool.length === 0) {
      for (const f of FIGS) {
        if ((cap.get(f.id) ?? 0) <= 0) continue
        for (let j = 0; j < WEIGHTS[f.r]; j++) pool.push(f.id)
      }
    }
    if (pool.length === 0) break
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick === undefined) break
    drawn.push(pick)
    cap.set(pick, (cap.get(pick) ?? 0) - 1)
    // También actualizar el contador local para que la siguiente iteración lo considere
    userCounts = { ...userCounts, [pick]: (userCounts[pick] || 0) + 1 }
  }
  return drawn
}

function applyPity(
  draws: number[],
  minNew: number,
  counts: Record<number, number>,
): number[] {
  const owned = (id: number) => (counts[id] || 0) > 0
  const isNewInPack = (id: number, i: number) =>
    !owned(id) && draws.indexOf(id) === i
  let newCount = draws.filter((id, i) => isNewInPack(id, i)).length
  const cands = FIGS.filter(
    (f) => !owned(f.id) && f.r !== "epica" && !draws.includes(f.id),
  ).map((f) => f.id)
  while (newCount < minNew && cands.length) {
    const i = draws.findIndex((id, k) => !isNewInPack(id, k))
    if (i < 0) break
    const swap = cands.splice(Math.floor(Math.random() * cands.length), 1)[0]
    if (swap === undefined) break
    draws[i] = swap
    newCount++
  }
  return draws
}

// ─────────────────────────────────────────────
// LOAD ALBUM
//
// Crea el guest stub y el álbum con ["start"] si no existen. Devuelve
// counts, packsLeft y el blob `state` (Reino/premios/doradas/trade)
// para que el cliente hidrate el juego donde lo dejó.
// ─────────────────────────────────────────────

const DEFAULT_GIFT_DURATION_MS = 600_000 // 10 minutos

export async function loadAlbum(guestId: string) {
  if (!guestId) return { error: "Invitado no encontrado" }

  const [guest, giftDurationItem] = await Promise.all([
    db.androLedGuest.upsert({
      where: { id: guestId },
      update: {},
      create: { id: guestId, name: "", avatar: "" },
      select: { id: true, name: true, mesa: true, nroPulsera: true, avatar: true, selfie: true },
    }),
    db.figusInventory.findUnique({
      where: { eventId_key: { eventId: EVENT_ID, key: "gift_duration" } },
      select: { total: true },
    }),
  ])

  const giftDurationMs = giftDurationItem && giftDurationItem.total > 0
    ? giftDurationItem.total * 60_000
    : DEFAULT_GIFT_DURATION_MS

  let album = await db.figusAlbum.findUnique({ where: { guestId } })

  if (!album) {
    album = await db.figusAlbum.create({
      data: {
        guestId,
        counts: {},
        packsLeft: ["start"],
        state: {},
      },
    })
  }

  return {
    guest: {
      id: guest.id,
      name: guest.name,
      mesa: guest.mesa,
      nroPulsera: guest.nroPulsera,
      avatar: guest.avatar,
      selfie: guest.selfie,
    },
    album: {
      id: album.id,
      counts: parseCounts(album.counts),
      packsLeft: album.packsLeft,
      state: parseState(album.state),
      giftDurationMs,
    },
  }
}

// ─────────────────────────────────────────────
// OPEN PACK
//
// Abre el sobre del token exacto (incluido su tamaño variable). Aplica
// pity, descuenta stock y persiste counts. El server también decide la
// dorada (stock global atómico), registra el evento del feed y reclama el
// premio si el álbum se completa.
// ─────────────────────────────────────────────

export async function openPack(guestId: string, token: string) {
  const meta = await db.figusAlbum.findUnique({
    where: { guestId },
    select: { guest: { select: { name: true } } },
  })
  if (!meta) return { error: "Álbum no encontrado" }
  const name = (meta.guest.name || "").trim() || "Invitado/a"
  const { key, n } = parseToken(token)

  // TODO se hace dentro de una transacción Serializable (con retry): la
  // validación del token, el sorteo, el descuento de stock, la dorada y el
  // premio. Así dos aperturas/cambios concurrentes sobre el mismo álbum no
  // se pisan (counts es un blob JSON, no un increment atómico).
  const out = await serializable(async (tx) => {
    const album = await tx.figusAlbum.findUnique({
      where: { guestId },
      select: { counts: true, packsLeft: true },
    })
    if (!album) return { error: "Álbum no encontrado" }
    if (!isPending(album.packsLeft, token)) {
      return {
        error: wasUsed(album.packsLeft, key)
          ? "Este sobre ya fue abierto"
          : "Este sobre todavía no está disponible",
      }
    }

    const before = parseCounts(album.counts)
    const counts = parseCounts(album.counts)

    const stocks = await tx.figusCardStock.findMany({
      where: { eventId: EVENT_ID },
      select: { cardId: true, issued: true, maxCount: true },
    })

    const uniques = FIGS.filter((f) => (counts[f.id] || 0) > 0).length
    const minNew = Math.min(n,
      key === "start" ? 3 :
      key === "carta" ? n :
      uniques < 10 ? 1 : 0
    )
    const drawnIds = applyPity(drawCards(n, stocks, { ...before }), minNew, counts)

    for (const cardId of drawnIds) counts[cardId] = (counts[cardId] || 0) + 1

    const grouped = new Map<number, number>()
    for (const cardId of drawnIds) grouped.set(cardId, (grouped.get(cardId) ?? 0) + 1)
    for (const [cardId, qty] of grouped) {
      await tx.figusCardStock.updateMany({
        where: { eventId: EVENT_ID, cardId },
        data: { issued: { increment: qty } },
      })
    }

    // Quita UNA sola ocurrencia del token; los de una sola vez dejan "used:".
    const at = album.packsLeft.indexOf(token)
    const newPacksLeft =
      at < 0
        ? [...album.packsLeft]
        : [...album.packsLeft.slice(0, at), ...album.packsLeft.slice(at + 1)]
    if (ONE_TIME.has(key)) {
      if (!newPacksLeft.includes(USED_PREFIX + key)) newPacksLeft.push(USED_PREFIX + key)
    } else if (key === "carta") {
      newPacksLeft.push(USED_PREFIX + "carta")
    }

    await tx.figusAlbum.update({
      where: { guestId },
      data: { counts, packsLeft: newPacksLeft },
    })

    // Dorada: roll + claim atómico. Si hay "force_gold" pendientes en inventario,
    // la probabilidad sube a 1 y se descuenta el contador.
    let goldWon: number | null = null
    let baseDor = DOR_BY_KEY[key] ?? 0.06
    const fgItem = await tx.figusInventory.findUnique({
      where: { eventId_key: { eventId: EVENT_ID, key: "force_gold" } },
    })
    const forceGoldRemaining = fgItem ? Math.max(0, fgItem.total - fgItem.delivered) : 0
    if (forceGoldRemaining > 0) {
      baseDor = 1
      await tx.figusInventory.update({
        where: { eventId_key: { eventId: EVENT_ID, key: "force_gold" } },
        data: { delivered: { increment: 1 } },
      })
    }
    if (Math.random() < baseDor) {
      const gold = await tx.figusGold.findFirst({
        where: { eventId: EVENT_ID, winnerId: null },
        orderBy: { goldIdx: "asc" },
      })
      if (gold) {
        const claim = await tx.figusGold.updateMany({
          where: { id: gold.id, winnerId: null },
          data: { winnerId: guestId, winnerName: name, wonAt: new Date() },
        })
        if (claim.count > 0) goldWon = gold.goldIdx
      }
    }

    const prize = await claimCompletion(tx, guestId, name, counts)
    const newCount = drawnIds.filter(
      (id, i) => (before[id] || 0) === 0 && drawnIds.indexOf(id) === i,
    ).length

    return { drawnIds, counts, before, packsLeft: newPacksLeft, goldWon, prize, newCount }
  })

  if ("error" in out) return { error: out.error }

  // Eventos del feed (best-effort, fuera de la transacción).
  const rep = out.drawnIds.length - out.newCount
  await logEvent(
    "🎁",
    `<b>${esc(name)}</b> abrió un sobre — <span class="g">${out.newCount} nueva${out.newCount === 1 ? "" : "s"}</span>, ${rep} repetida${rep === 1 ? "" : "s"}`,
    guestId,
  )
  if (out.goldWon != null) {
    const gm = GOLD_META[out.goldWon]
    await logEvent(
      "✨",
      `<span class="r">¡${esc(name)} sacó una dorada!</span> ${gm?.nm ?? "Dorada"} ${gm?.g ?? "✨"} — ¡ganó ${gm?.prize ?? "un premio especial"}! 🎁`,
      guestId,
    )
  }
  if (out.prize) {
    const pm = PRIZE_META[out.prize]
    await logEvent(
      "🎆",
      `<b>${esc(name)}</b> completó el Reino 👑${pm ? ` — ¡ganó ${pm.nm}!` : ""}`,
      guestId,
    )
  }

  revalidatePath(`/${guestId}`)

  return {
    drawnIds: out.drawnIds,
    counts: out.counts,
    // Snapshot de counts PREVIO al sobre: es la base para que el cliente
    // decida "nueva vs repetida" sin depender de su core.counts (que un
    // resync —realtime/pull— pudo haber ya actualizado con este mismo sobre).
    before: out.before,
    packsLeft: out.packsLeft,
    goldWon: out.goldWon,
    prize: out.prize,
  }
}

// ─────────────────────────────────────────────
// GRANT PACK (sobres honor-system: carta escondida, regalo, instagram)
//
// Agrega un token a packsLeft. No valida contra backend (son sobres
// que el invitado "encuentra" o que dispara el Reino); el cliente
// limita carta a 3 e instagram a 1 vía el estado.
// ─────────────────────────────────────────────

const GRANTABLE: Record<string, string> = {
  carta: "carta#2",
  gift: "gift#4",
  ig: "ig#1",
}

export async function grantPack(guestId: string, kind: "carta" | "gift" | "ig") {
  const token = GRANTABLE[kind]
  if (!token) return { ok: false as const, error: "Sobre desconocido" }

  const album = await db.figusAlbum.findUnique({
    where: { guestId },
    select: { packsLeft: true },
  })
  if (!album) return { ok: false as const, error: "Álbum no encontrado" }

  // Topes server-side (el cliente también limita en UI, pero acá es la
  // fuente de verdad para no acuñar sobres infinitos y vaciar el stock).
  if (kind === "ig" && (album.packsLeft.includes(token) || wasUsed(album.packsLeft, "ig"))) {
    return { ok: false as const, error: "Ya tenés tu sobre de Instagram" }
  }
  if (kind === "carta") {
    // cartas otorgadas = pendientes (carta#N, no solo carta#2) + abiertas
    // (marca used:carta). Contar por key parseada, no por el literal, porque
    // los códigos de sobre escondido pueden valer carta#1/3/5/10.
    const granted = album.packsLeft.filter(
      (t) => parseToken(t).key === "carta" || t === USED_PREFIX + "carta",
    ).length
    if (granted >= MAX_CARTAS) {
      return { ok: false as const, error: "Ya encontraste todos los sobres escondidos" }
    }
  }
  if (kind === "gift" && album.packsLeft.some((t) => parseToken(t).key === "gift")) {
    return { ok: false as const, error: "Ya tenés un sobre regalo en camino" }
  }

  const updated = await db.figusAlbum.update({
    where: { guestId },
    data: { packsLeft: { push: token } },
    select: { packsLeft: true },
  })

  revalidatePath(`/${guestId}`)
  return { ok: true as const, token, packsLeft: updated.packsLeft }
}

// ─────────────────────────────────────────────
// SAVE ALBUM STATE
//
// Persiste el estado local del jugador (sobre regalo en camino). El Reino
// real (feed/premios/doradas/cambios) vive en sus propias tablas.
// ─────────────────────────────────────────────

export async function saveAlbumState(
  guestId: string,
  payload: { state?: Record<string, unknown> },
) {
  try {
    if (!payload.state) return { ok: true as const }
    const state: object = payload.state
    await db.figusAlbum.update({ where: { guestId }, data: { state } })
    return { ok: true as const }
  } catch (err) {
    console.error("[saveAlbumState]", err)
    return { ok: false as const, error: "No se pudo guardar el progreso" }
  }
}

// ─────────────────────────────────────────────
// CHECK TRIVIA
// ─────────────────────────────────────────────

export async function checkTrivia(guestId: string) {
  const album = await db.figusAlbum.findUnique({ where: { guestId } })
  if (!album) return { available: false, reason: "no_active" as const }

  if (wasUsed(album.packsLeft, "trivia")) {
    return { available: false, reason: "already_used" as const }
  }

  if (isPending(album.packsLeft, "trivia")) {
    return { available: false, reason: "already_won" as const }
  }

  const now = new Date()
  const trivia = await db.figusTrivia.findFirst({
    where: { eventId: EVENT_ID, active: true },
  })

  if (!trivia) return { available: false, reason: "no_active" as const }

  if (trivia.activeAt && trivia.durationSeconds) {
    const expiresAt = new Date(trivia.activeAt.getTime() + trivia.durationSeconds * 1000)
    if (now < trivia.activeAt) return { available: false, reason: "not_yet" as const }
    if (now > expiresAt) return { available: false, reason: "expired" as const }
  }

  return {
    available: true,
    trivia: {
      id: trivia.id,
      question: trivia.question,
      options: trivia.options,
    },
  }
}

// ─────────────────────────────────────────────
// ANSWER TRIVIA
// ─────────────────────────────────────────────

export async function answerTrivia(guestId: string, triviaId: string, answerIndex: number) {
  const album = await db.figusAlbum.findUnique({ where: { guestId } })
  if (!album) return { correct: false as const, error: "Álbum no encontrado" }

  if (wasUsed(album.packsLeft, "trivia") || isPending(album.packsLeft, "trivia")) {
    return { correct: false as const, error: "Ya respondiste esta trivia" }
  }

  const trivia = await db.figusTrivia.findUnique({ where: { id: triviaId } })
  if (!trivia) return { correct: false as const, error: "Trivia no encontrada" }

  if (trivia.activeAt && trivia.durationSeconds) {
    const now = new Date()
    const expiresAt = new Date(trivia.activeAt.getTime() + trivia.durationSeconds * 1000)
    if (now > expiresAt) return { correct: false as const, error: "Tiempo agotado" }
  }

  if (answerIndex !== trivia.answer) {
    return { correct: false as const }
  }

  const updated = await db.figusAlbum.update({
    where: { guestId },
    data: { packsLeft: { push: "trivia" } },
    select: { packsLeft: true },
  })

  revalidatePath(`/${guestId}`)
  return { correct: true as const, packsLeft: updated.packsLeft }
}

// ─────────────────────────────────────────────
// REDEEM CODIGO (sobres por entrevista, +N variable)
//
// Valida el código activo, lo marca usado por este invitado y agrega
// un token "codigo#<value>" a packsLeft. A diferencia de la versión
// anterior NO es de una sola vez: cada código distinto de la noche
// (entrevistas, sorpresas) suma su propio sobre.
// ─────────────────────────────────────────────

export async function redeemCodigo(guestId: string, code: string) {
  const album = await db.figusAlbum.findUnique({
    where: { guestId },
    select: { id: true },
  })
  if (!album) return { valid: false as const, error: "Álbum no encontrado" }

  const now = new Date()
  const codigo = await db.figusCodigo.findFirst({
    where: {
      eventId: EVENT_ID,
      code: code.trim().toUpperCase(),
      active: true,
    },
  })

  if (!codigo) return { valid: false as const, error: "Código incorrecto" }

  if (codigo.activeAt && codigo.durationSeconds) {
    const expiresAt = new Date(codigo.activeAt.getTime() + codigo.durationSeconds * 1000)
    if (now < codigo.activeAt) return { valid: false as const, error: "Código no activo aún" }
    if (now > expiresAt) return { valid: false as const, error: "Código expirado" }
  }

  // Código de entrevista (un solo uso): si ya lo canjeó alguien, está quemado.
  if (codigo.singleUse && codigo.usedBy.length > 0) {
    return { valid: false as const, error: "Este código ya fue usado" }
  }
  if (codigo.usedBy.includes(guestId)) {
    return { valid: false as const, error: "Ya usaste este código" }
  }

  const value = Math.min(10, Math.max(1, codigo.value || PACK_DEFAULT.codigo || 4))
  // "carta" = sobre escondido (garantiza figus nuevas); "codigo" = entrevista.
  const token = codigo.packKind === "carta" ? `carta#${value}` : `codigo#${value}`

  // Claim atómico + entrega del sobre en UNA transacción. El claim
  // (updateMany NOT usedBy has) gana solo si dos requests no compiten;
  // y si el push del token falla, la transacción revierte el claim, así
  // el código nunca queda consumido sin haber entregado el sobre.
  const packsLeft = await db.$transaction(async (tx) => {
    // Single-use: gana el primer canje (usedBy vacío). Multi (broadcast): gana
    // mientras este guest no lo haya usado. Ambos atómicos vía updateMany.
    const claim = await tx.figusCodigo.updateMany({
      where: codigo.singleUse
        ? { id: codigo.id, usedBy: { isEmpty: true } }
        : { id: codigo.id, NOT: { usedBy: { has: guestId } } },
      data: { usedBy: { push: guestId } },
    })
    if (claim.count === 0) return null
    const updated = await tx.figusAlbum.update({
      where: { guestId },
      data: { packsLeft: { push: token } },
      select: { packsLeft: true },
    })
    return updated.packsLeft
  })

  if (!packsLeft) {
    return {
      valid: false as const,
      error: codigo.singleUse ? "Este código ya fue usado" : "Ya usaste este código",
    }
  }

  revalidatePath(`/${guestId}`)
  return { valid: true as const, value, token, packsLeft }
}

// Wrapper de compatibilidad (no usar en código nuevo).
export async function checkCodigo(guestId: string, code: string) {
  const res = await redeemCodigo(guestId, code)
  return res.valid
    ? { valid: true as const }
    : { valid: false as const, error: res.error }
}

// ─────────────────────────────────────────────
// SAVE GUEST PROFILE
// ─────────────────────────────────────────────

type SaveGuestProfileResult =
  | { ok: true }
  | { ok: false; error: string }

export async function saveGuestProfile(
  guestId: string,
  name: string,
  avatar: string,
  selfie?: string | null,
): Promise<SaveGuestProfileResult> {
  try {
    // La selfie es un data URL chico (~128px JPEG); si supera ~200KB la
    // descartamos para no llenar la fila (debería venir comprimida del cliente).
    const safeSelfie = selfie && selfie.startsWith("data:image") && selfie.length < 200_000 ? selfie : null
    await db.androLedGuest.upsert({
      where: { id: guestId },
      update: { name, avatar, selfie: safeSelfie },
      create: { id: guestId, name, avatar, selfie: safeSelfie },
    })
    return { ok: true }
  } catch (err) {
    console.error("[saveGuestProfile]", err)
    return { ok: false, error: "No se pudo guardar el perfil" }
  }
}
