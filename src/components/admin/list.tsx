"use client";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Mail,
  NotebookPen,
  Phone,
  Users,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import React from "react";
import { AlertModal } from "./alert-modal";
import { Button } from "@/components/ui/button";
import { GuestCard } from "./guest-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {GuestListPrintable} from "./pdf";
import { GuestTabs } from "./tabs-guest";
import { Guest } from "@prisma/client";

function deactivateDuplicates(guests: Guest[]): Guest[] {
  const byNameEmail = new Map<string, string>(); // key = name_email
  const byNamePhone = new Map<string, string>(); // key = name_phone
  const updated: Guest[] = [];

  for (const guest of guests) {
    const name = guest.name.toLowerCase().trim();
    const email = guest.email?.toLowerCase().trim() ?? "";
    const phone = guest.phone?.trim() ?? "";

    const keyEmail = `${name}_${email}`;
    const keyPhone = `${name}_${phone}`;

    // Si ya vimos alguien con ese nombre+email o nombre+teléfono → desactivamos
    if (byNameEmail.has(keyEmail) || byNamePhone.has(keyPhone)) {
      updated.push({ ...guest, rsvp: false });
    } else {
      byNameEmail.set(keyEmail, guest.id);
      byNamePhone.set(keyPhone, guest.id);
      updated.push(guest);
    }
  }

  return updated;
}


const GuestList = ({ guestsProps , emma }: { guestsProps: Guest[], emma?: boolean }) => {
  const [guests, setGuests] = React.useState(deactivateDuplicates(guestsProps))
  
  return !guests || guests.length === 0 ? (
    <div className="text-center py-8 text-gray-500">
      <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
      <p>No hay invitados registrados para este evento</p>
    </div>
  ) : (
    <>
     <GuestTabs emma={emma} guests={guests} setGuests={setGuests} />
    </>
  );
};

export default GuestList;
