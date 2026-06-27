-- ─────────────────────────────────────────────────────────────
-- RESET "Figus del Reino" — deja la DB lista para jugar de cero.
--   • Borra TODO el progreso de figus (álbumes, feed, cambios, códigos).
--   • Resetea premios principales y doradas (quedan sin ganador).
--   • Resetea stock de cartas y "entregados" del inventario.
--   • Mantiene invitados con su PULSERA y MESA, pero resetea el perfil de
--     figus (nombre/avatar/selfie) para que cada uno vuelva a elegir personaje.
-- Idempotente: se puede correr más de una vez sin problema.
-- ─────────────────────────────────────────────────────────────

-- Progreso de figus (se recrea solo y fresco cuando cada invitado entra).
DELETE FROM "FigusAlbum";
DELETE FROM "FigusEvent"        WHERE "eventId" = '';
DELETE FROM "FigusTradeRequest" WHERE "eventId" = '';
DELETE FROM "FigusCodigo"       WHERE "eventId" = '';

-- Premios principales y doradas: sin ganador, sin entregar.
UPDATE "FigusPrize" SET "winnerId" = NULL, "winnerName" = NULL, "claimedAt" = NULL, "deliveredAt" = NULL WHERE "eventId" = '';
UPDATE "FigusGold"  SET "winnerId" = NULL, "winnerName" = NULL, "wonAt" = NULL,    "deliveredAt" = NULL WHERE "eventId" = '';

-- Stock de cartas disponible de nuevo.
UPDATE "FigusCardStock" SET "issued" = 0 WHERE "eventId" = '';

-- Inventario: nada entregado; sin doradas forzadas pendientes.
UPDATE "FigusInventory" SET "delivered" = 0 WHERE "eventId" = '';
UPDATE "FigusInventory" SET "total" = 0 WHERE "eventId" = '' AND "key" = 'force_gold';

-- Invitados: conservar pulsera/mesa, resetear perfil de figus.
UPDATE "AndroLedGuest" SET "name" = '', "avatar" = NULL, "selfie" = NULL;
