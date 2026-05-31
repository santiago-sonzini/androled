"use server"
import { db } from "@/server/db"

async function main() {
    await db.androLedGuest.updateMany({
        data: {
            pulseraEntregada: true,
        }
    })
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect())