"use server"

import { db } from "@/server/db"
import { revalidatePath } from "next/cache"

type Rarity = "comun" | "rara" | "epica" | "m"

interface Fig {
  id: number
  r: Rarity
}

const FIGS: Fig[] = [
  { id: 1,  r: "m"     },
  { id: 2,  r: "comun" },
  { id: 3,  r: "m"     },
  { id: 4,  r: "m"     },
  { id: 5,  r: "m"     },
  { id: 6,  r: "m"     },
  { id: 7,  r: "m"     },
  { id: 8,  r: "comun" },
  { id: 9,  r: "m"     },
  { id: 10, r: "comun" },
  { id: 11, r: "rara"  },
  { id: 12, r: "rara"  },
  { id: 13, r: "rara"  },
  { id: 14, r: "epica" },
  { id: 15, r: "epica" },
]

const WEIGHTS: Record<Rarity, number> = { comun: 10, rara: 4, epica: 1, m: 10 }

// ─────────────────────────────────────────────
// PACKS — convención de estado dentro de packsLeft
//
//   "start"        → sobre pendiente (se puede abrir)
//   "used:start"   → sobre ya abierto (no vuelve a ofrecerse)
//
// Así el estado "ya usado" persiste en DB y sobrevive
// refresh / cambio de dispositivo (la pulsera es la sesión).
// ─────────────────────────────────────────────

const USED_PREFIX = "used:"

function isPending(packsLeft: string[], key: string) {
  return packsLeft.includes(key)
}

function wasUsed(packsLeft: string[], key: string) {
  return packsLeft.includes(USED_PREFIX + key)
}

function parseCounts(counts: unknown): Record<number, number> {
  if (!counts || typeof counts !== "object") return {}
  return counts as Record<number, number>
}

// eventId hardcodeado — ya no viene del guest
const EVENT_ID = process.env.FIGUS_EVENT_ID ?? ""

// FIX PERFORMANCE: antes drawCard hacía un findMany de stock por
// CADA carta y un updateMany por CADA carta — abrir un sobre de 5
// eran ~11 round trips secuenciales a la DB (varios segundos con una
// DB remota). Ahora el stock se lee UNA vez, el sorteo es en memoria
// descontando capacidad, y los increments van agrupados en una sola
// transacción junto con el update del álbum.

function drawCards(
  n: number,
  stocks: { cardId: number; issued: number; maxCount: number }[],
): number[] {
  const cap = new Map<number, number>()
  const stockMap = new Map(stocks.map((s) => [s.cardId, s]))
  for (const f of FIGS) {
    const stock = stockMap.get(f.id)
    cap.set(f.id, stock ? Math.max(0, stock.maxCount - stock.issued) : Infinity)
  }

  const drawn: number[] = []
  for (let i = 0; i < n; i++) {
    const pool: number[] = []
    for (const f of FIGS) {
      if ((cap.get(f.id) ?? 0) <= 0) continue
      for (let j = 0; j < WEIGHTS[f.r]; j++) pool.push(f.id)
    }
    if (pool.length === 0) break
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick === undefined) break
    drawn.push(pick)
    cap.set(pick, (cap.get(pick) ?? 0) - 1)
  }
  return drawn
}

// ─────────────────────────────────────────────
// LOAD ALBUM
//
// FIX: antes devolvía "Invitado no encontrado" para un guestId
// nuevo, entonces el álbum nunca se creaba, packsLeft quedaba
// vacío y el sobre de bienvenida jamás aparecía. Ahora el guest
// se crea como stub si no existe (el perfil se completa en la
// intro vía saveGuestProfile) y el álbum nace con ["start"].
// ─────────────────────────────────────────────

export async function loadAlbum(guestId: string) {
  if (!guestId) return { error: "Invitado no encontrado" }

  const guest = await db.androLedGuest.upsert({
    where: { id: guestId },
    update: {},
    create: { id: guestId, name: "", avatar: "" },
    select: { id: true, name: true, mesa: true, nroPulsera: true, avatar: true },
  })

  let album = await db.figusAlbum.findUnique({ where: { guestId } })

  if (!album) {
    album = await db.figusAlbum.create({
      data: {
        guestId,
        counts: {},
        packsLeft: ["start"],
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
    },
    album: {
      id: album.id,
      counts: parseCounts(album.counts),
      packsLeft: album.packsLeft,
    },
  }
}

// ─────────────────────────────────────────────
// OPEN PACK
//
// FIX: al abrir, el srcKey ahora se marca como "used:srcKey" en
// vez de simplemente desaparecer, para poder distinguir "todavía
// no disponible" de "ya abierto" en cargas posteriores.
// ─────────────────────────────────────────────

export async function openPack(guestId: string, srcKey: string) {
  const album = await db.figusAlbum.findUnique({ where: { guestId } })
  if (!album) return { error: "Álbum no encontrado" }

  if (!isPending(album.packsLeft, srcKey)) {
    return {
      error: wasUsed(album.packsLeft, srcKey)
        ? "Este sobre ya fue abierto"
        : "Este sobre todavía no está disponible",
    }
  }

  const n = srcKey === "start" ? 5 : 4
  const counts = parseCounts(album.counts)

  const stocks = await db.figusCardStock.findMany({
    where: { eventId: EVENT_ID },
    select: { cardId: true, issued: true, maxCount: true },
  })

  const drawnIds = drawCards(n, stocks)
  for (const cardId of drawnIds) {
    counts[cardId] = (counts[cardId] || 0) + 1
  }

  // Increments agrupados por carta (una repetida x2 = un solo update)
  const grouped = new Map<number, number>()
  for (const cardId of drawnIds) {
    grouped.set(cardId, (grouped.get(cardId) ?? 0) + 1)
  }

  const newPacksLeft = [
    ...album.packsLeft.filter((k) => k !== srcKey),
    USED_PREFIX + srcKey,
  ]

  await db.$transaction([
    ...[...grouped.entries()].map(([cardId, qty]) =>
      db.figusCardStock.updateMany({
        where: { eventId: EVENT_ID, cardId },
        data: { issued: { increment: qty } },
      }),
    ),
    db.figusAlbum.update({
      where: { guestId },
      data: { counts, packsLeft: newPacksLeft },
    }),
  ])

  revalidatePath(`/juego/${guestId}`)

  return { drawnIds, counts, packsLeft: newPacksLeft }
}

// ─────────────────────────────────────────────
// CHECK TRIVIA
//
// FIX: antes exigía que "trivia" YA estuviera en packsLeft para
// considerarla disponible (pero nada la agregaba nunca), así que
// siempre devolvía "already_used". Ahora la disponibilidad se
// evalúa contra la marca "used:trivia".
// ─────────────────────────────────────────────

export async function checkTrivia(guestId: string) {
  const album = await db.figusAlbum.findUnique({ where: { guestId } })
  if (!album) return { available: false, reason: "no_active" as const }

  if (wasUsed(album.packsLeft, "trivia")) {
    return { available: false, reason: "already_used" as const }
  }

  if (isPending(album.packsLeft, "trivia")) {
    // Ya la ganó pero no abrió el sobre todavía
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
//
// FIX: al acertar, ahora SÍ se agrega "trivia" a packsLeft en DB.
// Antes solo se agregaba en el estado del cliente, y openPack
// rechazaba el sobre con "Este sobre ya fue abierto".
// ─────────────────────────────────────────────

export async function answerTrivia(guestId: string, triviaId: string, answerIndex: number) {
  const album = await db.figusAlbum.findUnique({ where: { guestId } })
  if (!album) return { correct: false, error: "Álbum no encontrado" }

  if (wasUsed(album.packsLeft, "trivia") || isPending(album.packsLeft, "trivia")) {
    return { correct: false, error: "Ya respondiste esta trivia" }
  }

  const trivia = await db.figusTrivia.findUnique({ where: { id: triviaId } })
  if (!trivia) return { correct: false, error: "Trivia no encontrada" }

  if (trivia.activeAt && trivia.durationSeconds) {
    const now = new Date()
    const expiresAt = new Date(trivia.activeAt.getTime() + trivia.durationSeconds * 1000)
    if (now > expiresAt) return { correct: false, error: "Tiempo agotado" }
  }

  if (answerIndex !== trivia.answer) {
    return { correct: false }
  }

  await db.figusAlbum.update({
    where: { guestId },
    data: { packsLeft: { push: "trivia" } },
  })

  revalidatePath(`/juego/${guestId}`)
  return { correct: true }
}

// ─────────────────────────────────────────────
// CHECK CODIGO
//
// FIX: igual que la trivia — al validar el código ahora se agrega
// "codigo" a packsLeft en DB para que openPack lo acepte. Si el
// guest ya lo había validado pero no abrió el sobre, se devuelve
// valid:true sin duplicar el premio.
// ─────────────────────────────────────────────

export async function checkCodigo(guestId: string, code: string) {
  const album = await db.figusAlbum.findUnique({ where: { guestId } })
  if (!album) return { valid: false, error: "Álbum no encontrado" }

  if (wasUsed(album.packsLeft, "codigo")) {
    return { valid: false, error: "Ya usaste tu sobre de código" }
  }

  const yaPendiente = isPending(album.packsLeft, "codigo")

  const now = new Date()
  const codigo = await db.figusCodigo.findFirst({
    where: {
      eventId: EVENT_ID,
      code: code.trim().toUpperCase(),
      active: true,
    },
  })

  if (!codigo) return { valid: false, error: "Código incorrecto" }

  if (codigo.activeAt && codigo.durationSeconds) {
    const expiresAt = new Date(codigo.activeAt.getTime() + codigo.durationSeconds * 1000)
    if (now < codigo.activeAt) return { valid: false, error: "Código no activo aún" }
    if (now > expiresAt) return { valid: false, error: "Código expirado" }
  }

  if (codigo.usedBy.includes(guestId)) {
    // Ya lo canjeó: si el sobre sigue pendiente, dejarlo abrir; si no, rechazar
    return yaPendiente
      ? { valid: true }
      : { valid: false, error: "Ya usaste este código" }
  }

  await db.figusCodigo.update({
    where: { id: codigo.id },
    data: { usedBy: { push: guestId } },
  })

  if (!yaPendiente) {
    await db.figusAlbum.update({
      where: { guestId },
      data: { packsLeft: { push: "codigo" } },
    })
  }

  revalidatePath(`/juego/${guestId}`)
  return { valid: true }
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
): Promise<SaveGuestProfileResult> {
  try {
    await db.androLedGuest.upsert({
      where: { id: guestId },
      update: { name, avatar },
      create: { id: guestId, name, avatar },
    })
    return { ok: true }
  } catch (err) {
    console.error("[saveGuestProfile]", err)
    return { ok: false, error: "No se pudo guardar el perfil" }
  }
}