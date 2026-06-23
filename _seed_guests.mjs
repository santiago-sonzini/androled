import { readFileSync, writeFileSync } from 'node:fs'

// ---- cargar .env (sin dotenv); usar conexion DIRECTA para el batch ----
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/)
  if (m) process.env[m[1]] = m[2]
}
process.env.DATABASE_URL = process.env.DIRECT_URL

const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()

// ---- leer asignacion.csv (id desde la URL, mesa -> Int, nroPulsera) ----
const csv = readFileSync('/Users/santiagosonzini/Desktop/guests/asignacion.csv', 'utf8').replace(/^﻿/, '')
const records = csv.split('\n').slice(1)
  .filter(l => /^\d+,/.test(l))
  .map(l => {
    const [nro, name, mesa, url] = l.split(',')
    const id = url.split('/').pop().trim()
    const mesaNum = parseInt((mesa.match(/\d+/) || [null])[0], 10)
    return { id, name: name.trim(), mesa: mesaNum, nroPulsera: parseInt(nro, 10) }
  })

// validaciones
if (records.length === 0) throw new Error('No hay registros en asignacion.csv')
if (records.some(r => !r.id || !r.name || !Number.isInteger(r.mesa))) throw new Error('Registro invalido')
const ids = new Set(records.map(r => r.id))
if (ids.size !== records.length) throw new Error('IDs duplicados')
console.log('Registros a insertar:', records.length, '| mesas:', Math.min(...records.map(r=>r.mesa)), '-', Math.max(...records.map(r=>r.mesa)))

// ---- backup de lo actual ----
const before = await db.androLedGuest.findMany()
const albumsBefore = await db.figusAlbum.findMany()
const stamp = process.env.STAMP || 'backup'
writeFileSync(`_backup_androledguests_${stamp}.json`, JSON.stringify({ guests: before, albums: albumsBefore }, null, 2))
console.log('Backup guardado:', before.length, 'guests +', albumsBefore.length, 'figusAlbum')

// ---- limpiar y agregar (transaccion) ----
const [del, ins] = await db.$transaction([
  db.androLedGuest.deleteMany({}),
  db.androLedGuest.createMany({ data: records }),
])
console.log('Borrados:', del.count, '| Insertados:', ins.count)

const total = await db.androLedGuest.count()
const withMesa = await db.androLedGuest.count({ where: { mesa: { not: null } } })
console.log('AndroLedGuest total ahora:', total, '| con mesa:', withMesa)
await db.$disconnect()
