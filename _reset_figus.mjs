import { readFileSync, writeFileSync } from 'node:fs'
for (const l of readFileSync('.env','utf8').split('\n')){const m=l.match(/^([A-Z_]+)="?(.*?)"?$/);if(m)process.env[m[1]]=m[2]}
process.env.DATABASE_URL = process.env.DIRECT_URL
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()

// ---- backup de las tablas del juego ----
const backup = {
  album: await db.figusAlbum.findMany(),
  event: await db.figusEvent.findMany(),
  trade: await db.figusTradeRequest.findMany(),
  gold:  await db.figusGold.findMany(),
  prize: await db.figusPrize.findMany(),
  inventory: await db.figusInventory.findMany(),
  cardStock: await db.figusCardStock.findMany(),
}
const stamp = process.env.STAMP || 'backup'
writeFileSync(`_backup_figus_${stamp}.json`, JSON.stringify(backup, null, 2))
console.log('Backup figus guardado.')

// ---- reset de RESULTADOS (conserva config: trivias, codigos, items de inventario) ----
const [delEvent, delTrade, delAlbum, gold, prize, stock, invGifts, invForce] = await db.$transaction([
  db.figusEvent.deleteMany({}),
  db.figusTradeRequest.deleteMany({}),
  db.figusAlbum.deleteMany({}),
  db.figusGold.updateMany({ data: { winnerId: null, winnerName: null, wonAt: null, deliveredAt: null } }),
  db.figusPrize.updateMany({ data: { winnerId: null, winnerName: null, claimedAt: null, deliveredAt: null } }),
  db.figusCardStock.updateMany({ data: { issued: 0 } }),
  db.figusInventory.updateMany({ where: { key: { notIn: ['gift_duration', 'force_gold'] } }, data: { delivered: 0 } }),
  db.figusInventory.updateMany({ where: { key: 'force_gold' }, data: { total: 0, delivered: 0 } }),
])

console.log('Feed borrado          :', delEvent.count)
console.log('Pedidos cambio borrados:', delTrade.count)
console.log('Albums borrados       :', delAlbum.count)
console.log('Doradas limpiadas     :', gold.count)
console.log('Premios limpiados     :', prize.count)
console.log('CardStock reset        :', stock.count)
console.log('Regalos delivered=0    :', invGifts.count)
console.log('force_gold reset 0/0   :', invForce.count)

// ---- verificacion ----
const golds = await db.figusGold.count({ where: { winnerId: { not: null } } })
const prizes = await db.figusPrize.count({ where: { winnerId: { not: null } } })
console.log('--- VERIF: doradas con ganador:', golds, '| premios con ganador:', prizes,
            '| trivias:', await db.figusTrivia.count(), '| codigos:', await db.figusCodigo.count())
await db.$disconnect()
