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
  FEED_LIMIT,
  figMeta,
  esc,
  parseCounts,
  uniquesOf,
  logEvent,
  claimCompletion,
  serializable,
} from "@/server/figus"

// ─────────────────────────────────────────────
// SEED + TRADE CODE
// ─────────────────────────────────────────────

async function ensureReinoSeed() {
  await db.figusGold.createMany({
    data: Array.from({ length: GOLD_COUNT }, (_, i) => ({ eventId: EVENT_ID, goldIdx: i })),
    skipDuplicates: true,
  })
  await db.figusPrize.createMany({
    data: PRIZE_KEYS.map((k) => ({ eventId: EVENT_ID, prizeKey: k })),
    skipDuplicates: true,
  })
}

async function ensureTradeCode(guestId: string, current: string | null): Promise<string> {
  if (current) return current
  for (let i = 0; i < 8; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    try {
      await db.figusAlbum.update({ where: { guestId }, data: { tradeCode: code } })
      return code
    } catch {
      /* colisión de unique: reintentar */
    }
  }
  const code = String(Math.floor(10000 + Math.random() * 90000))
  await db.figusAlbum.update({ where: { guestId }, data: { tradeCode: code } }).catch(() => undefined)
  return code
}

// ─────────────────────────────────────────────
// LOAD REINO — agregador (feed, top 8, premios, doradas, pedidos)
// + mis counts/packsLeft frescos para resincronizar tras cambios de otros.
// ─────────────────────────────────────────────

export async function loadReino(guestId: string) {
  await ensureReinoSeed()

  const me = await db.figusAlbum.findUnique({
    where: { guestId },
    select: { counts: true, packsLeft: true, tradeCode: true, completedAt: true },
  })
  const tradeCode = await ensureTradeCode(guestId, me?.tradeCode ?? null)

  const [albums, events, golds, prizes, myReqRow, openReqs, giftDurationItem] = await Promise.all([
    db.figusAlbum.findMany({
      select: { guestId: true, counts: true, completedAt: true, guest: { select: { name: true } } },
    }),
    db.figusEvent.findMany({
      where: { eventId: EVENT_ID },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
    }),
    db.figusGold.findMany({ where: { eventId: EVENT_ID }, orderBy: { goldIdx: "asc" } }),
    db.figusPrize.findMany({ where: { eventId: EVENT_ID } }),
    db.figusTradeRequest.findFirst({ where: { guestId, status: "open" }, orderBy: { createdAt: "desc" } }),
    db.figusTradeRequest.findMany({
      where: { eventId: EVENT_ID, status: "open", NOT: { guestId } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.figusInventory.findUnique({
      where: { eventId_key: { eventId: EVENT_ID, key: "gift_duration" } },
      select: { total: true },
    }),
  ])

  const myCounts = parseCounts(me?.counts)

  // top 8: completos primero (por orden de llegada), después por figus
  const top = albums
    .map((a) => {
      const counts = parseCounts(a.counts)
      return {
        guestId: a.guestId,
        name: (a.guest.name || "").trim() || "Invitado/a",
        uniques: uniquesOf(counts),
        done: a.completedAt != null,
        completedAt: a.completedAt ? a.completedAt.getTime() : null,
      }
    })
    .sort((x, y) => {
      if (x.done && y.done) return (x.completedAt ?? 0) - (y.completedAt ?? 0)
      if (x.done !== y.done) return x.done ? -1 : 1
      return y.uniques - x.uniques
    })
    .slice(0, 8)
    .map((r) => ({ name: r.name, uniques: r.uniques, done: r.done, mine: r.guestId === guestId }))

  const prizeByKey = new Map(prizes.map((p) => [p.prizeKey, p]))
  const prizesOut = PRIZE_KEYS.map((k) => {
    const p = prizeByKey.get(k)
    return {
      key: k,
      nm: PRIZE_META[k]!.nm,
      g: PRIZE_META[k]!.g,
      img: PRIZE_META[k]!.img,
      winnerName: p?.winnerName ?? null,
      mine: p?.winnerId === guestId,
    }
  })

  const claimedGolds = golds.filter((g) => g.winnerId != null)
  const goldsOut = golds.map((g) => ({
    idx: g.goldIdx,
    nm: GOLD_META[g.goldIdx]?.nm ?? `Dorada ${g.goldIdx + 1}`,
    g: GOLD_META[g.goldIdx]?.g ?? "✨",
    prize: GOLD_META[g.goldIdx]?.prize ?? "",
    mine: g.winnerId === guestId,
    taken: g.winnerId != null,
    winnerName: g.winnerName ?? null,
  }))
  const doraLog = [...claimedGolds]
    .sort((a, b) => (b.wonAt?.getTime() ?? 0) - (a.wonAt?.getTime() ?? 0))
    .slice(0, 12)
    .map((g) => ({
      name: g.winnerName ?? "Alguien",
      goldNm: GOLD_META[g.goldIdx]?.nm ?? "dorada",
      goldPrize: GOLD_META[g.goldIdx]?.prize ?? "",
      mine: g.winnerId === guestId,
    }))

  const salonRequests = openReqs.map((r) => ({
    id: r.id,
    guestName: r.guestName,
    figId: r.figId,
    canFulfill: (myCounts[r.figId] || 0) > 1, // tengo esa figu repetida
  }))

  const giftDurationMs = giftDurationItem && giftDurationItem.total > 0
    ? giftDurationItem.total * 60_000
    : 600_000

  return {
    myCounts,
    myPacksLeft: me?.packsLeft ?? [],
    completed: me?.completedAt != null,
    tradeCode,
    feed: events.map((e) => ({ id: e.id, kind: e.kind, text: e.text, mine: e.actorId === guestId })),
    top,
    prizes: prizesOut,
    golds: goldsOut,
    colgantesLeft: Math.max(0, SEC_TOTAL - claimedGolds.length),
    myColgantes: claimedGolds.filter((g) => g.winnerId === guestId).length,
    doraLog,
    myRequest: myReqRow ? { id: myReqRow.id, figId: myReqRow.figId } : null,
    salonRequests,
    giftDurationMs,
  }
}

// ─────────────────────────────────────────────
// SE BUSCA — publicar / cancelar pedido
// ─────────────────────────────────────────────

export async function publishRequest(guestId: string, figId: number) {
  const album = await db.figusAlbum.findUnique({
    where: { guestId },
    select: { counts: true, guest: { select: { name: true } } },
  })
  if (!album) return { ok: false as const, error: "Álbum no encontrado" }
  const name = (album.guest.name || "").trim() || "Invitado/a"

  await db.figusTradeRequest.updateMany({
    where: { guestId, status: "open" },
    data: { status: "cancelled" },
  })
  await db.figusTradeRequest.create({
    data: { eventId: EVENT_ID, guestId, guestName: name, figId, status: "open" },
  })

  const f = figMeta(figId)
  await logEvent("🙋", `<b>${esc(name)}</b> busca <span class="g">${esc(f.nm)} ${f.g}</span>`, guestId)
  revalidatePath(`/${guestId}`)
  return { ok: true as const }
}

export async function cancelRequest(guestId: string) {
  await db.figusTradeRequest.updateMany({
    where: { guestId, status: "open" },
    data: { status: "cancelled" },
  })
  revalidatePath(`/${guestId}`)
  return { ok: true as const }
}

// ─────────────────────────────────────────────
// CAMBIO ATÓMICO entre dos álbumes (núcleo del trade real)
//
// A da figA → B y B da figB → A, en una transacción. Solo se mueve una
// repetida (count > 1); nunca la última de una figu. Devuelve si cada
// lado realmente entregó. Reclama premio si alguno completa.
// ─────────────────────────────────────────────

async function swapAtomic(
  aId: string,
  aName: string,
  aGives: number | null,
  bId: string,
  bName: string,
  bGives: number | null,
  requireA = false,
): Promise<
  | { ok: true; aGave: boolean; bGave: boolean; aPrize: string | null; bPrize: string | null }
  | { ok: false; error: string }
> {
  return serializable(async (tx) => {
    const a = await tx.figusAlbum.findUnique({ where: { guestId: aId }, select: { counts: true } })
    const b = await tx.figusAlbum.findUnique({ where: { guestId: bId }, select: { counts: true } })
    if (!a || !b) return { ok: false as const, error: "Álbum no encontrado" }

    const ac = parseCounts(a.counts)
    const bc = parseCounts(b.counts)

    // Cada lado entrega su figu SOLO si la tiene repetida (count > 1).
    let aGave = false
    if (aGives != null && (ac[aGives] || 0) > 1) {
      ac[aGives] = (ac[aGives] || 0) - 1
      bc[aGives] = (bc[aGives] || 0) + 1
      aGave = true
    }
    let bGave = false
    if (bGives != null && (bc[bGives] || 0) > 1) {
      bc[bGives] = (bc[bGives] || 0) - 1
      ac[bGives] = (ac[bGives] || 0) + 1
      bGave = true
    }

    // requireA: el cambio carece de sentido si A (p. ej. el helper de un
    // pedido) no llegó a entregar su figu. Se aborta sin escribir (rollback).
    if (requireA && !aGave) {
      return { ok: false as const, error: "Ya no tenés esa figu repetida" }
    }
    if (!aGave && !bGave) {
      return { ok: false as const, error: "Ya no tienen figus para cambiar" }
    }

    await tx.figusAlbum.update({ where: { guestId: aId }, data: { counts: ac } })
    await tx.figusAlbum.update({ where: { guestId: bId }, data: { counts: bc } })

    const aPrize = await claimCompletion(tx, aId, aName, ac)
    const bPrize = await claimCompletion(tx, bId, bName, bc)
    return { ok: true as const, aGave, bGave, aPrize, bPrize }
  })
}

// ─────────────────────────────────────────────
// OFRECER a un pedido del salón
//
// El que ofrece (helper) da la figu pedida; a cambio recibe una repetida
// del solicitante que a él le falte (la elige el server). Si no hay, el
// solicitante la recibe igual (gesto), pero normalmente hay match.
// ─────────────────────────────────────────────

export async function fulfillRequest(helperId: string, requestId: string) {
  const req = await db.figusTradeRequest.findUnique({ where: { id: requestId } })
  if (!req || req.status !== "open") return { ok: false as const, error: "Ese pedido ya no está" }
  if (req.guestId === helperId) return { ok: false as const, error: "Es tu propio pedido" }

  const helper = await db.figusAlbum.findUnique({
    where: { guestId: helperId },
    select: { counts: true, guest: { select: { name: true } } },
  })
  const requester = await db.figusAlbum.findUnique({
    where: { guestId: req.guestId },
    select: { counts: true },
  })
  if (!helper || !requester) return { ok: false as const, error: "Álbum no encontrado" }

  const helperName = (helper.guest.name || "").trim() || "Invitado/a"
  const helperCounts = parseCounts(helper.counts)
  const requesterCounts = parseCounts(requester.counts)

  if ((helperCounts[req.figId] || 0) <= 1) {
    return { ok: false as const, error: "No tenés esa figu repetida" }
  }

  // elegir qué recibe el helper: una repetida del solicitante que al helper le falte
  let back: number | null = null
  for (let id = 1; id <= TOTAL_FIGS; id++) {
    if ((requesterCounts[id] || 0) > 1 && (helperCounts[id] || 0) === 0) {
      back = id
      break
    }
  }

  // Claim atómico del pedido: si dos helpers ofrecen a la vez, solo uno gana
  // (count=1) y hace el swap; el otro ve count=0 y no entrega doble.
  const claim = await db.figusTradeRequest.updateMany({
    where: { id: requestId, status: "open" },
    data: { status: "done" },
  })
  if (claim.count === 0) return { ok: false as const, error: "Ese pedido ya no está" }

  const res = await swapAtomic(helperId, helperName, req.figId, req.guestId, req.guestName, back, true)
  if (!res.ok) {
    // el swap no se concretó (p. ej. ya no tenés la repetida): reabrir el pedido
    await db.figusTradeRequest.updateMany({ where: { id: requestId }, data: { status: "open" } })
    return res
  }

  const want = figMeta(req.figId)
  await logEvent(
    "🤝",
    `<b>${esc(helperName)}</b> le pasó <span class="g">${esc(want.nm)} ${want.g}</span> a <b>${esc(req.guestName)}</b> — ¡genia!`,
    helperId,
  )
  await announcePrizes(res.aPrize, helperName, res.bPrize, req.guestName)

  revalidatePath(`/${helperId}`)
  return {
    ok: true as const,
    gaveFigId: req.figId,
    gotFigId: res.bGave ? back : null,
    requesterName: req.guestName,
    prize: res.aPrize,
  }
}

// ─────────────────────────────────────────────
// CANJE DIRECTO por código (dos personas cara a cara)
//
// Busca al dueño del código, calcula un cambio justo mutuo (cada uno da
// una repetida que al otro le falta) y lo ejecuta atómicamente.
// ─────────────────────────────────────────────

export async function connectByCode(guestId: string, code: string) {
  const clean = code.trim()
  if (!/^\d{4,5}$/.test(clean)) return { ok: false as const, error: "Código inválido" }

  const me = await db.figusAlbum.findUnique({
    where: { guestId },
    select: { counts: true, tradeCode: true, guest: { select: { name: true } } },
  })
  if (!me) return { ok: false as const, error: "Álbum no encontrado" }
  if (me.tradeCode === clean) return { ok: false as const, error: "Ese es tu propio código 🙂" }

  const other = await db.figusAlbum.findUnique({
    where: { tradeCode: clean },
    select: { guestId: true, counts: true, guest: { select: { name: true } } },
  })
  if (!other) return { ok: false as const, error: "No existe ese código" }

  const myName = (me.guest.name || "").trim() || "Invitado/a"
  const otherName = (other.guest.name || "").trim() || "Invitado/a"
  const myCounts = parseCounts(me.counts)
  const otherCounts = parseCounts(other.counts)

  // yo doy: una repetida mía que al otro le falta
  let iGive: number | null = null
  for (let id = 1; id <= TOTAL_FIGS; id++) {
    if ((myCounts[id] || 0) > 1 && (otherCounts[id] || 0) === 0) {
      iGive = id
      break
    }
  }
  // el otro da: una repetida suya que a mí me falta
  let theyGive: number | null = null
  for (let id = 1; id <= TOTAL_FIGS; id++) {
    if ((otherCounts[id] || 0) > 1 && (myCounts[id] || 0) === 0) {
      theyGive = id
      break
    }
  }

  if (iGive == null && theyGive == null) {
    return { ok: false as const, error: "No tienen figus para cambiar entre ustedes" }
  }

  // swapAtomic: A=yo doy iGive (puede ser null → regalo del otro), B=otro da theyGive
  const res = await swapAtomic(guestId, myName, iGive, other.guestId, otherName, theyGive)
  if (!res.ok) return res

  const giveF = res.aGave && iGive != null ? figMeta(iGive) : null
  const getF = res.bGave && theyGive != null ? figMeta(theyGive) : null
  await logEvent(
    "🔄",
    `<b>${esc(myName)}</b> y <b>${esc(otherName)}</b> cambiaron figus`,
    guestId,
  )
  await announcePrizes(res.aPrize, myName, res.bPrize, otherName)

  revalidatePath(`/${guestId}`)
  return {
    ok: true as const,
    otherName,
    gave: giveF ? { nm: giveF.nm, g: giveF.g } : null,
    got: getF ? { nm: getF.nm, g: getF.g } : null,
    prize: res.aPrize,
  }
}

async function announcePrizes(
  aPrize: string | null,
  aName: string,
  bPrize: string | null,
  bName: string,
) {
  for (const [prize, name] of [
    [aPrize, aName],
    [bPrize, bName],
  ] as const) {
    if (prize) {
      const p = PRIZE_META[prize]
      await logEvent(
        "🎆",
        `<b>${esc(name)}</b> completó el Reino 👑${p ? ` — ¡ganó ${p.nm}!` : ""}`,
        null,
      )
    }
  }
}
