"use server"

import { db } from "@/server/db"

const EVENT_ID = process.env.FIGUS_EVENT_ID ?? ""
const TOTAL_FIGS = 15
const FALLBACK_GOAL = 3000

function parseCounts(counts: unknown): Record<number, number> {
  if (!counts || typeof counts !== "object") return {}
  return counts as Record<number, number>
}

// Ventana temporal: null = no arrancó / ya cerró / inactiva.
// Si no tiene schedule (activeAt/durationSeconds) se considera
// abierta mientras active=true (encendido/apagado manual).
function windowOf(
  activeAt: Date | null,
  durationSeconds: number | null,
  now: number,
): { endsAt: string | null; durationSeconds: number | null } | null {
  if (!activeAt || !durationSeconds) {
    return { endsAt: null, durationSeconds: null }
  }
  const start = activeAt.getTime()
  const end = start + durationSeconds * 1000
  if (now < start || now > end) return null
  return { endsAt: new Date(end).toISOString(), durationSeconds }
}

export interface PantallaPlayer {
  id: string
  name: string
  avatar: string | null
  uniques: number
  /** Primera figu que le falta (id 1-15) — para los "le falta X" del top */
  missingId: number | null
}

export interface PantallaData {
  players: PantallaPlayer[]
  /** Figuritas totales repartidas esta noche (suma de counts de todos los álbumes) */
  collected: number
  /** Meta colectiva: suma de maxCount del stock del evento (fallback 3000) */
  goal: number
  trivia: {
    id: string
    question: string
    options: string[]
    endsAt: string | null
    durationSeconds: number | null
  } | null
  codigo: {
    code: string
    endsAt: string | null
  } | null
}

// ─────────────────────────────────────────────
// LOAD PANTALLA
//
// Una sola action agregadora: la pantalla la llama al montar, cada
// vez que Supabase Realtime avisa un cambio en FigusAlbum /
// FigusTrivia / FigusCodigo / AndroLedGuest, y como polling de
// respaldo. El payload del evento realtime NO se usa como datos
// (solo como señal de invalidación): la fuente de verdad es esta
// query, que ya resuelve el join guest+álbum y nunca expone la
// respuesta correcta de la trivia.
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// LANZAR TRIVIA / CÓDIGO (operador, desde la pantalla)
//
// Cada lanzamiento desactiva la ronda activa anterior y crea una
// nueva con activeAt=now + durationSeconds, así la ventana queda
// gobernada por la misma lógica que ya usan checkTrivia/checkCodigo
// del álbum y el loadPantalla de la pantalla. La trivia se elige de
// un banco fijo evitando repetir preguntas ya lanzadas del evento.
// ─────────────────────────────────────────────

const TRIVIA_BANK: { q: string; opts: string[]; ans: number }[] = [
  { q: "¿En qué película la princesa es una sirena?", opts: ["La Sirenita", "Moana", "Frozen", "Encanto"], ans: 0 },
  { q: "¿Quién canta “Libre soy / Let It Go”?", opts: ["Moana", "Elsa", "Rapunzel", "Tiana"], ans: 1 },
  { q: "¿De qué reino es la princesa Moana?", opts: ["Arendelle", "Motunui", "Agrabah", "Corona"], ans: 1 },
  { q: "¿Cómo se llama el dragón de Mulán?", opts: ["Pascal", "Mushu", "Sven", "Abu"], ans: 1 },
  { q: "¿Qué objeto pierde Cenicienta en el baile?", opts: ["Un guante", "Una corona", "Un zapato", "Un collar"], ans: 2 },
  { q: "¿Qué princesa tiene el pelo mágico larguísimo?", opts: ["Aurora", "Rapunzel", "Bella", "Blancanieves"], ans: 1 },
  { q: "¿En qué película aparece la familia Madrigal?", opts: ["Coco", "Brave", "Encanto", "Aladdín"], ans: 2 },
  { q: "¿Cuántas figuritas hay que juntar para completar el álbum?", opts: ["10", "12", "15", "20"], ans: 2 },
]

const CODE_WORDS = ["FROZEN", "MOANA", "STITCH", "AURORA", "ENCANTO", "ARIEL", "MULAN", "BELLA"]

const DEFAULT_TRIVIA_SECONDS = 30
const DEFAULT_CODIGO_SECONDS = 45

type LaunchResult =
  | { ok: true; label: string }
  | { ok: false; error: string }

export async function lanzarTrivia(
  durationSeconds: number = DEFAULT_TRIVIA_SECONDS,
): Promise<LaunchResult> {
  try {
    await db.figusTrivia.updateMany({
      where: { eventId: EVENT_ID, active: true },
      data: { active: false },
    })

    const previas = await db.figusTrivia.findMany({
      where: { eventId: EVENT_ID },
      select: { question: true },
    })
    const yaUsadas = new Set(previas.map((t) => t.question))
    const pool = TRIVIA_BANK.filter((t) => !yaUsadas.has(t.q))
    const banco = pool.length ? pool : TRIVIA_BANK
    const pick = banco[Math.floor(Math.random() * banco.length)]!

    await db.figusTrivia.create({
      data: {
        eventId: EVENT_ID,
        question: pick.q,
        options: pick.opts,
        answer: pick.ans,
        active: true,
        activeAt: new Date(),
        durationSeconds,
      },
    })
    return { ok: true, label: pick.q }
  } catch (err) {
    console.error("[lanzarTrivia]", err)
    return { ok: false, error: "No se pudo lanzar la trivia" }
  }
}

export async function lanzarCodigo(
  durationSeconds: number = DEFAULT_CODIGO_SECONDS,
): Promise<LaunchResult> {
  try {
    await db.figusCodigo.updateMany({
      where: { eventId: EVENT_ID, active: true },
      data: { active: false },
    })

    const code = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)]!

    await db.figusCodigo.create({
      data: {
        eventId: EVENT_ID,
        code,
        active: true,
        activeAt: new Date(),
        durationSeconds,
      },
    })
    return { ok: true, label: code }
  } catch (err) {
    console.error("[lanzarCodigo]", err)
    return { ok: false, error: "No se pudo lanzar el código" }
  }
}

export async function loadPantalla(): Promise<PantallaData> {
  const now = Date.now()

  const [albums, stocks, trivia, codigo] = await Promise.all([
    db.figusAlbum.findMany({
      select: {
        guestId: true,
        counts: true,
        guest: { select: { name: true, avatar: true } },
      },
    }),
    db.figusCardStock.findMany({
      where: { eventId: EVENT_ID },
      select: { maxCount: true },
    }),
    db.figusTrivia.findFirst({
      where: { eventId: EVENT_ID, active: true },
      orderBy: { createdAt: "desc" },
    }),
    db.figusCodigo.findFirst({
      where: { eventId: EVENT_ID, active: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  let collected = 0
  const players: PantallaPlayer[] = albums.map((a) => {
    const counts = parseCounts(a.counts)
    let uniques = 0
    let missingId: number | null = null
    for (let id = 1; id <= TOTAL_FIGS; id++) {
      const q = counts[id] || 0
      collected += q
      if (q > 0) uniques++
      else if (missingId === null) missingId = id
    }
    return {
      id: a.guestId,
      name: (a.guest.name || "").trim() || "Invitado/a",
      avatar: a.guest.avatar,
      uniques,
      missingId,
    }
  })

  const goal = stocks.length
    ? stocks.reduce((s, x) => s + x.maxCount, 0)
    : FALLBACK_GOAL

  const triviaWin = trivia
    ? windowOf(trivia.activeAt, trivia.durationSeconds, now)
    : null
  const codigoWin = codigo
    ? windowOf(codigo.activeAt, codigo.durationSeconds, now)
    : null

  return {
    players,
    collected,
    goal,
    trivia:
      trivia && triviaWin
        ? {
            id: trivia.id,
            question: trivia.question,
            options: trivia.options,
            endsAt: triviaWin.endsAt,
            durationSeconds: triviaWin.durationSeconds,
          }
        : null,
    codigo:
      codigo && codigoWin
        ? { code: codigo.code, endsAt: codigoWin.endsAt }
        : null,
  }
}

// ─────────────────────────────────────────────
// CREATE TRIVIA (lanzamiento desde la pantalla)
//
// Crea y ACTIVA una trivia al instante: desactiva cualquier otra
// activa del evento (loadPantalla toma findFirst active=true) y la
// nueva nace con activeAt=ahora, así la ventana corre desde el
// lanzamiento. Realtime sobre FigusTrivia hace que la pantalla y
// los celulares la vean enseguida.
// ─────────────────────────────────────────────

type ActionResult = { ok: true } | { ok: false; error: string }

const MIN_DURATION = 5
const MAX_DURATION = 600

export async function createTrivia(input: {
  question: string
  options: string[]
  answer: number
  durationSeconds: number
}): Promise<ActionResult> {
  const question = input.question.trim()
  const options = input.options.map((o) => o.trim()).filter(Boolean)
  const durationSeconds = Math.min(
    MAX_DURATION,
    Math.max(MIN_DURATION, Math.round(input.durationSeconds) || 0),
  )

  if (!question) return { ok: false, error: "Falta la pregunta" }
  if (options.length < 2) return { ok: false, error: "Mínimo 2 opciones" }
  if (options.length > 4) return { ok: false, error: "Máximo 4 opciones" }
  if (
    !Number.isInteger(input.answer) ||
    input.answer < 0 ||
    input.answer >= options.length
  ) {
    return { ok: false, error: "Marcá cuál es la respuesta correcta" }
  }

  try {
    await db.$transaction([
      db.figusTrivia.updateMany({
        where: { eventId: EVENT_ID, active: true },
        data: { active: false },
      }),
      db.figusTrivia.create({
        data: {
          eventId: EVENT_ID,
          question,
          options,
          answer: input.answer,
          active: true,
          activeAt: new Date(),
          durationSeconds,
        },
      }),
    ])
    return { ok: true }
  } catch (err) {
    console.error("[createTrivia]", err)
    return { ok: false, error: "No se pudo lanzar la trivia" }
  }
}

// ─────────────────────────────────────────────
// CREATE CODIGO (lanzamiento desde la pantalla)
//
// Igual que la trivia: desactiva el código activo anterior y crea
// uno nuevo con la ventana corriendo desde ahora. Se guarda en
// MAYÚSCULAS porque checkCodigo compara contra code.toUpperCase().
// ─────────────────────────────────────────────

export async function createCodigo(input: {
  code: string
  durationSeconds: number
}): Promise<ActionResult> {
  const code = input.code.trim().toUpperCase()
  const durationSeconds = Math.min(
    MAX_DURATION,
    Math.max(MIN_DURATION, Math.round(input.durationSeconds) || 0),
  )

  if (!code) return { ok: false, error: "Falta el código" }
  if (code.length > 12) return { ok: false, error: "Máximo 12 caracteres" }

  try {
    await db.$transaction([
      db.figusCodigo.updateMany({
        where: { eventId: EVENT_ID, active: true },
        data: { active: false },
      }),
      db.figusCodigo.create({
        data: {
          eventId: EVENT_ID,
          code,
          active: true,
          activeAt: new Date(),
          durationSeconds,
        },
      }),
    ])
    return { ok: true }
  } catch (err) {
    console.error("[createCodigo]", err)
    return { ok: false, error: "No se pudo lanzar el código" }
  }
}