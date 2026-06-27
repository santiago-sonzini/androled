"use server";

import { z } from "zod";
import { sendEmail } from "./sendEmail";
import { db } from "@/server/db";
import { get_event_complete } from "./events";
import { RSVPFormSchema } from "@/components/forms/confirm-asistance";
import { AndroLedGuest } from "@prisma/client";

// ─── Guests ───────────────────────────────────────────────────────────────────

const DIET_LABELS: Record<string, string> = {
  none: "Sin restricción",
  veg:  "Vegetariano",
  vgn:  "Vegano",
  cel:  "Celíaco",
  oth:  "Otra",
};

export async function create_guests({
  guests_info,
  event_id,
}: {
  guests_info: z.infer<typeof RSVPFormSchema>;
  event_id: string;
}) {
  try {
    if (!guests_info || !event_id) {
      return JSON.parse(
        JSON.stringify({ error: "Missing guests info or event ID", status: 400 })
      );
    }

    const dietLabel = guests_info.diet ? DIET_LABELS[guests_info.diet] : null;

    // ── Guest principal ───────────────────────────────────────────────────────
    const guestData = {
      eventId: event_id,
      name: guests_info.name ?? "",
      email: guests_info.email || null,
      phone: guests_info.phone || null,
      hasDietRestriction: guests_info.diet !== "none" && !!guests_info.diet,
      dietRestrictionComment: guests_info.diet === "oth"
        ? guests_info.dietRestrictionComment || null
        : dietLabel,
      rsvp: guests_info.attend === "yes",
      isMainGuest: true,
      goesWith: null,
      comments: guests_info.comments || null,
    };

    // ── Acompañantes ──────────────────────────────────────────────────────────
    const companions = guests_info.attend === "yes"
      ? (guests_info.companions ?? []).map(c => {
          const companionDietLabel = DIET_LABELS[c.diet] ?? null;
          return {
            eventId: event_id,
            name: c.name,
            email: null,
            phone: null,
            hasDietRestriction: c.diet !== "none",
            dietRestrictionComment: c.diet === "oth"
              ? c.dietRestrictionComment || null
              : companionDietLabel,
            rsvp: true,
            isMainGuest: false,
            goesWith: guests_info.name,
            comments: null,
          };
        })
      : [];

    console.log("🚀 ~ create_guests ~ guestData:", guestData);
    console.log("🚀 ~ create_guests ~ companions:", companions);

    // ── Persistencia ──────────────────────────────────────────────────────────
    await db.guest.create({ data: guestData });

    if (companions.length > 0) {
      await db.guest.createMany({ data: companions });
    }

    // ── Payload para email ────────────────────────────────────────────────────
    const emailGuest: AttendeeData = {
      name: guestData.name,
      email: guestData.email ?? "",
      phone: guestData.phone ?? "",
      dietary_notes: guestData.dietRestrictionComment ?? "",
      general_notes: guestData.comments ?? "",
      company: companions.map(c => ({
        name: c.name,
        dietary_notes: c.dietRestrictionComment ?? "",
      })),
      rsvp: guestData.rsvp ?? false,
    };

    if (guestData.rsvp) {
      sendOrganizerConfirmationEmail("vcxv.3005@gmail.com", emailGuest);
    }

    return JSON.parse(
      JSON.stringify({
        data: emailGuest,
        message: "Guest created successfully",
        status: 200,
      })
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return JSON.parse(JSON.stringify({ error, status: 500 }));
  }
}

export async function delete_guest(id: string) {
  try {
    await db.guest.delete({ where: { id } });

    return JSON.parse(
      JSON.stringify({ message: "Invitado eliminado correctamente", status: 200 })
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return JSON.parse(JSON.stringify({ error, status: 500 }));
  }
}

// ─── Emails ───────────────────────────────────────────────────────────────────

interface AttendeeData {
  name: string;
  email: string;
  dietary_notes: string;
  general_notes: string;
  rsvp: boolean;
  phone?: string;
  company?: {
    name: string;
    dietary_notes?: string;
    general_notes?: string;
  }[];
}

export async function set_guest_active(id: string) {
  try {
      await db.guest.update({
          where: { id },
          data: { rsvp: true },
      });

      return { message: "Invitado desactivado correctamente", status: 200 };
  } catch (error) {
      console.error("Unexpected error:", error);
      return { error, status: 500 };
  }
}

export async function sendOrganizerConfirmationEmail(
  organizerEmail: string,
  attendee: AttendeeData
) {
  const hasCompany = (attendee.company ?? []).length > 0;
  const totalGuests = 1 + (attendee.company ?? []).length;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>Nueva Confirmación · Organizador</title>
</head>

<body style="margin:0; padding:0; background-color:#0f0205; font-family: Georgia, serif; color:#f5e9d4;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0205;">
<tr>
<td align="center" style="padding:24px 12px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#0f0205; border:1px solid rgba(245,233,212,0.12);">

<!-- RED LINE -->
<tr><td style="height:2px; background:#d91339;"></td></tr>

<!-- EYEBROW -->
<tr>
<td style="padding:24px 20px 0 20px;">
<div style="border-bottom:1px solid rgba(245,233,212,0.12); padding-bottom:16px; font-family:monospace; font-size:11px; letter-spacing:0.18em; color:#d91339;">
PANEL ORGANIZADOR · NUEVA CONFIRMACIÓN
</div>
</td>
</tr>

<!-- TITLE -->
<tr>
<td style="padding:20px 20px 0 20px;">
<h1 style="margin:0; font-style:italic; font-weight:500; font-size:42px; line-height:1.1; color:#f5e9d4;">
Nueva confirmación<br/>
<span style="color:#d91339;">de asistencia</span>
</h1>
</td>
</tr>

<!-- TOTAL BADGE -->
<tr>
<td style="padding:16px 20px 0 20px;">
<span style="display:inline-block; padding:6px 14px; background:rgba(217,19,57,0.15); border:1px solid rgba(217,19,57,0.3); font-family:monospace; font-size:11px; letter-spacing:0.2em; color:#d91339;">
${totalGuests} ${totalGuests === 1 ? "ASISTENTE" : "ASISTENTES EN TOTAL"}
</span>
</td>
</tr>

<!-- DIVIDER -->
<tr>
<td style="padding:24px 20px;">
<table width="100%"><tr>
<td style="border-top:1px solid rgba(245,233,212,0.12);"></td>
<td style="width:10px; text-align:center; color:#d91339;">◆</td>
<td style="border-top:1px solid rgba(245,233,212,0.12);"></td>
</tr></table>
</td>
</tr>

<!-- MAIN GUEST BOX -->
<tr>
<td style="padding:0 20px 24px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(245,233,212,0.10); background:rgba(217,19,57,0.06);">

<tr>
<td style="padding:14px 16px; border-bottom:1px solid rgba(245,233,212,0.10); background:rgba(217,19,57,0.10); font-family:monospace; font-size:11px; letter-spacing:0.18em; color:#d91339;">
ASISTENTE PRINCIPAL
</td>
</tr>

<!-- NOMBRE -->
<tr>
<td style="padding:16px 16px 0 16px;">
<div style="font-family:monospace; font-size:10px; letter-spacing:0.2em; color:#d91339; margin-bottom:4px;">NOMBRE</div>
<div style="font-size:22px; font-style:italic;">${attendee.name}</div>
</td>
</tr>

<tr><td style="padding:0 16px;"><div style="border-top:1px solid rgba(245,233,212,0.08); margin:14px 0;"></div></td></tr>

<!-- EMAIL + TELEFONO -->
<tr>
<td style="padding:0 16px;">
<table width="100%">
<tr>
<td width="50%" style="vertical-align:top; padding-right:8px;">
<div style="font-family:monospace; font-size:10px; letter-spacing:0.2em; color:#d91339; margin-bottom:4px;">EMAIL</div>
<div style="font-size:15px;">
<a href="mailto:${attendee.email}" style="color:#f5e9d4; text-decoration:none;">${attendee.email || "—"}</a>
</div>
</td>
<td width="50%" style="vertical-align:top; padding-left:8px;">
<div style="font-family:monospace; font-size:10px; letter-spacing:0.2em; color:#d91339; margin-bottom:4px;">TELÉFONO</div>
<div style="font-size:15px;">${attendee.phone || "—"}</div>
</td>
</tr>
</table>
</td>
</tr>

<tr><td style="padding:0 16px;"><div style="border-top:1px solid rgba(245,233,212,0.08); margin:14px 0;"></div></td></tr>

<!-- DIETA -->
<tr>
<td style="padding:0 16px;">
<div style="font-family:monospace; font-size:10px; letter-spacing:0.2em; color:#d91339; margin-bottom:4px;">RESTRICCIÓN ALIMENTARIA</div>
<div style="font-size:16px; font-style:italic; color:${attendee.dietary_notes && attendee.dietary_notes !== 'Sin restricción' ? '#f5e9d4' : 'rgba(245,233,212,0.4)'};">
${attendee.dietary_notes || "Sin restricción"}
</div>
</td>
</tr>

${attendee.general_notes ? `
<tr><td style="padding:0 16px;"><div style="border-top:1px solid rgba(245,233,212,0.08); margin:14px 0;"></div></td></tr>
<tr>
<td style="padding:0 16px 16px 16px;">
<div style="font-family:monospace; font-size:10px; letter-spacing:0.2em; color:#d91339; margin-bottom:4px;">MENSAJE PARA VIR</div>
<div style="font-size:15px; line-height:1.6; color:rgba(245,233,212,0.8); font-style:italic;">"${attendee.general_notes}"</div>
</td>
</tr>
` : `<tr><td style="padding-bottom:16px;"></td></tr>`}

</table>
</td>
</tr>

${hasCompany ? `
<!-- COMPANIONS BOX -->
<tr>
<td style="padding:0 20px 24px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(245,233,212,0.10); background:rgba(217,19,57,0.03);">

<tr>
<td style="padding:14px 16px; border-bottom:1px solid rgba(245,233,212,0.10); background:rgba(217,19,57,0.08); font-family:monospace; font-size:11px; letter-spacing:0.18em; color:#d91339;">
ACOMPAÑANTES · ${(attendee.company ?? []).length}
</td>
</tr>

${(attendee.company ?? []).map((c, i) => `
<tr>
<td style="padding:14px 16px; ${i > 0 ? 'border-top:1px solid rgba(245,233,212,0.06);' : ''}">
<table width="100%">
<tr>
<td>
<div style="font-family:monospace; font-size:10px; letter-spacing:0.2em; color:rgba(217,19,57,0.6); margin-bottom:4px;">
0${i + 1}
</div>
<div style="font-size:19px; font-style:italic; color:#f5e9d4;">${c.name}</div>
${c.dietary_notes && c.dietary_notes !== 'Sin restricción' ? `
<div style="margin-top:6px; display:inline-block; padding:3px 10px; background:rgba(217,19,57,0.12); border:1px solid rgba(217,19,57,0.25); font-family:monospace; font-size:10px; letter-spacing:0.15em; color:#d91339;">
${c.dietary_notes}
</div>` : `
<div style="margin-top:4px; font-family:monospace; font-size:10px; letter-spacing:0.12em; color:rgba(245,233,212,0.3);">
SIN RESTRICCIÓN
</div>`}
</td>
</tr>
</table>
</td>
</tr>
`).join('')}

</table>
</td>
</tr>
` : ''}

<!-- FOOTER TEXT -->
<tr>
<td style="padding:0 20px 32px 20px; text-align:center;">
<p style="margin:0; font-size:15px; line-height:1.6; color:rgba(245,233,212,0.5);">
Este email es una notificación automática para el organizador.
</p>
</td>
</tr>

<!-- RED LINE -->
<tr><td style="height:1px; background:#d91339;"></td></tr>

<!-- FINAL FOOTER -->
<tr>
<td style="padding:20px; background:rgba(0,0,0,0.3);">
<table width="100%">
<tr>
<td style="font-size:26px; font-style:italic; color:#d91339;">Vir</td>
<td style="text-align:right; font-family:monospace; font-size:11px; letter-spacing:0.18em; color:rgba(245,233,212,0.5);">XV · 2026</td>
</tr>
<tr>
<td colspan="2" style="padding-top:10px; border-top:1px solid rgba(245,233,212,0.08);">
<p style="margin:0; font-family:monospace; font-size:11px; letter-spacing:0.12em; color:rgba(245,233,212,0.5); line-height:1.6;">
Panel de gestión de invitados · Solo para uso interno.
</p>
</td>
</tr>
</table>
</td>
</tr>

</table>
</td>
</tr>
</table>

</body>
</html>`;

  await sendEmail({
    to: organizerEmail,
    subject: `Nueva confirmación — ${attendee.name}${hasCompany ? ` +${(attendee.company ?? []).length}` : ""}`,
    html,
  });
}

export async function sendAttendeeConfirmationEmail(
  attendeeData: AttendeeData,
  event_id: string
) {
  const res = await get_event_complete(event_id);
  const eventData = res.event;

  if (!eventData) return "No se envió el mail";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />

<style>
@media only screen and (max-width: 600px) {
  table {
    width: 100% !important;
  }
  td {
    display: block !important;
    width: 100% !important;
  }
}
</style>

<title>Confirmación de Asistencia · Virginia</title>
</head>

<body style="margin:0; padding:0; background-color:#0f0205; font-family: Georgia, serif; color:#f5e9d4;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0205;">
<tr>
<td align="center" style="padding:24px 12px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#0f0205; border:1px solid rgba(245,233,212,0.12);">

<!-- RED LINE -->
<tr>
<td style="height:2px; background:#d91339;"></td>
</tr>

<!-- EYEBROW -->
<tr>
<td style="padding:24px 20px 0 20px;">
<div style="border-bottom:1px solid rgba(245,233,212,0.12); padding-bottom:16px; font-family:monospace; font-size:11px; letter-spacing:0.18em; color:#d91339;">
CONFIRMACIÓN · ASISTENCIA
</div>
</td>
</tr>

<!-- TITLE -->
<tr>
<td style="padding:20px 20px 0 20px;">
<h1 style="margin:0; font-style:italic; font-weight:500; font-size:42px; line-height:1.1; color:#f5e9d4;">
¡Nos vemos<br/>
<span style="color:#d91339;">pronto!</span>
</h1>
</td>
</tr>

<!-- GREETING -->
<tr>
<td style="padding:20px;">
<p style="margin:0; font-size:18px; line-height:1.6; color:rgba(245,233,212,0.8);">
Hola <strong style="color:#ffffff;">${attendeeData.name}</strong>,<br/>
tu asistencia ha sido confirmada exitosamente.
</p>
</td>
</tr>

<!-- DIVIDER -->
<tr>
<td style="padding:24px 20px;">
<table width="100%">
<tr>
<td style="border-top:1px solid rgba(245,233,212,0.12);"></td>
<td style="width:10px; text-align:center; color:#d91339;">◆</td>
<td style="border-top:1px solid rgba(245,233,212,0.12);"></td>
</tr>
</table>
</td>
</tr>

<!-- EVENT BOX -->
<tr>
<td style="padding:0 20px 24px 20px;">

<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(245,233,212,0.10); background:rgba(217,19,57,0.06);">

<tr>
<td style="padding:14px 16px; border-bottom:1px solid rgba(245,233,212,0.10); background:rgba(217,19,57,0.10); font-family:monospace; font-size:11px; letter-spacing:0.18em; color:#d91339;">
DETALLES DEL EVENTO
</td>
</tr>

<!-- CUANDO -->
<tr>
<td style="padding:18px 16px;">
<div style="font-family:monospace; font-size:11px; letter-spacing:0.18em; color:#d91339; margin-bottom:6px;">
CUÁNDO
</div>
<div style="font-size:20px; font-style:italic;">30 · Mayo · 2026</div>
<div style="font-size:16px; color:rgba(245,233,212,0.7);">21:00 hs</div>
</td>
</tr>

<tr><td style="border-top:1px solid rgba(245,233,212,0.08);"></td></tr>

<!-- DONDE -->
<tr>
<td style="padding:18px 16px;">
<div style="font-family:monospace; font-size:11px; letter-spacing:0.18em; color:#d91339; margin-bottom:6px;">
DÓNDE
</div>
<div style="font-size:20px; font-style:italic;">Hotel del Centro</div>
<div style="font-size:15px; color:rgba(245,233,212,0.6); line-height:1.5;">
RN158 38 X5913<br/>Pozo del Molle, Córdoba
</div>

<a href="https://maps.app.goo.gl/Sm8DGdjJb8vSH6S68"
style="display:inline-block; margin-top:10px; font-family:monospace; font-size:11px; letter-spacing:0.15em; color:#d91339; text-decoration:none;">
Ver en Google Maps →
</a>
</td>
</tr>

<tr><td style="border-top:1px solid rgba(245,233,212,0.08);"></td></tr>

<!-- DRESS -->
<tr>
<td style="padding:18px 16px;">
<div style="font-family:monospace; font-size:11px; letter-spacing:0.18em; color:#d91339; margin-bottom:6px;">
DRESS CODE
</div>
<div style="font-size:20px; font-style:italic;">Elegante</div>
<div style="font-size:14px; color:rgba(245,233,212,0.5);">
Sin azul, plateado ni rojo
</div>
</td>
</tr>

${(attendeeData.company ?? []).length > 0 ? `
  <tr>
  <td style="border-top:1px solid rgba(245,233,212,0.08); padding:18px 16px;">
  <div style="font-family:monospace; font-size:11px; letter-spacing:0.18em; color:#d91339; margin-bottom:12px;">
  ASISTÍS CON
  </div>
  <table width="100%" cellpadding="0" cellspacing="0">
  ${(attendeeData.company ?? []).map((c, i) => `
  <tr>
    <td style="padding:10px 0; ${i > 0 ? 'border-top:1px solid rgba(245,233,212,0.06);' : ''}">
      <div style="font-size:17px; font-style:italic; color:#f5e9d4;">${c.name}</div>
      ${c.dietary_notes && c.dietary_notes !== 'Sin restricción' ? `
      <div style="font-family:monospace; font-size:10px; letter-spacing:0.15em; color:rgba(217,19,57,0.7); margin-top:3px;">
        ${c.dietary_notes}
      </div>` : ''}
    </td>
  </tr>
  `).join('')}
  </table>
  </td>
  </tr>
  ` : ``}

</table>

</td>
</tr>

<!-- FOOTER TEXT -->
<tr>
<td style="padding:0 20px 32px 20px; text-align:center;">
<p style="margin:0; font-size:16px; line-height:1.6; color:rgba(245,233,212,0.7);">
Si tenés alguna consulta, no dudes en contactar al organizador.<br/>
<span style="color:#d91339;">¡Te esperamos!</span>
</p>
</td>
</tr>

<!-- RED LINE -->
<tr>
<td style="height:1px; background:#d91339;"></td>
</tr>

<!-- FINAL FOOTER -->
<tr>
<td style="padding:20px; background:rgba(0,0,0,0.3);">

<table width="100%">
<tr>
<td style="font-size:26px; font-style:italic; color:#d91339;">
Vir
</td>
<td style="text-align:right; font-family:monospace; font-size:11px; letter-spacing:0.18em; color:rgba(245,233,212,0.5);">
XV · 2026
</td>
</tr>

<tr>
<td colspan="2" style="padding-top:10px; border-top:1px solid rgba(245,233,212,0.08);">
<p style="margin:0; font-family:monospace; font-size:11px; letter-spacing:0.12em; color:rgba(245,233,212,0.5); line-height:1.6;">
Este email confirma tu asistencia al evento. Guardalo para referencia.
</p>
</td>
</tr>
</table>

</td>
</tr>

</table>
</td>
</tr>
</table>

</body>
</html>`;

  await sendEmail({
    to: attendeeData.email,
    subject: `Confirmación de asistencia - ${eventData.name}`,
    html,
  });

  return "Éxito, email enviado";
}


export async function getGuestById(id: string) {
  try {
    const guest = await db.androLedGuest.findUnique({ where: { id } });
    console.log("🚀 ~ getGuestById ~ guest:", guest)
    
    return guest;
  } catch (error) {
    console.error("Unexpected error:", error);
    return null;
  }
}

export async function getAllGuests() {
  try {
    // Ocultar filas basura (bots que entran a /[id] sin cargar nada):
    // solo mostramos a quien tenga nombre O foto (selfie).
    const guests = await db.androLedGuest.findMany({
      where: {
        OR: [
          { name: { not: "" } },
          { selfie: { not: null } },
        ],
      },
    });
    return guests;
  } catch (error) {
    console.error("Unexpected error:", error);
    return null;
  }
}

export async function updateGuestNroPulsera(id: string, nroPulsera: number) {
  try {
    await db.guest.update({
      where: { id },
      data: { nroPulsera },
    });

    return { message: "Pulsera actualizada correctamente", status: 200 };
  } catch (error) {
    console.error("Unexpected error:", error);
    return { error, status: 500 };
  }
}

export async function pulseraEntregada(id: string, value: boolean) {
  try {
    await db.androLedGuest.update({
      where: { id },
      data: { pulseraEntregada: value },
    });

    return { message: "Pulsera entregada actualizada correctamente", status: 200 };
  } catch (error) {
    console.error("Unexpected error:", error);
    return { error, status: 500 };
  }
}


export async function createGuest(guest: AndroLedGuest) {
  try {
    await db.androLedGuest.create({ data: guest });
    return { message: "Invitado creado correctamente", status: 200 };
  } catch (error) {
    console.error("Unexpected error:", error);
    return { error, status: 500 };
  }
}