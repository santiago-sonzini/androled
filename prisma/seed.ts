import { db } from "@/server/db"
async function main() {
    await db.androLedGuest.createMany({
        data: [
            { id: "cmpsf71sce570e7e81f85bcfa", name: "PAVONI SEBASTIAN", mesa: 14, nroPulsera: null, eventId: "cmoc7axa50000ssna3axq0i0e" },
            { id: "cmpsf71si5097f03875dd9299", name: "OVIEDO MARIA", mesa: 14, nroPulsera: null, eventId: "cmoc7axa50000ssna3axq0i0e" },
        ],
        skipDuplicates: true,
    })
}
main()
    .catch(console.error)
    .finally(() => db.$disconnect())