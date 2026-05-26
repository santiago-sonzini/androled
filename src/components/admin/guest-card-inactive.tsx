"use client";
import React from "react";
import {
  CheckCircle,
  Mail,
  NotebookPen,
  Phone,
  UtensilsCrossed,
  XCircle,
  Check,
} from "lucide-react";
import { set_guest_active } from "@/app/actions/guests";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Guest } from "@prisma/client";

export const GuestCardInactive = ({
  guest,
  guests,
  setGuests,
}: {
  guest: Guest;
  guests: Guest[];
  setGuests: React.Dispatch<React.SetStateAction<Guest[]>>;
}) => {
  const [loading, setLoading] = React.useState(false);

  const handleSetActive = async (id: string) => {
    setLoading(true);
    const res = await set_guest_active(id);
    if (res.status === 200) {
      setGuests(guests.map((g) => g.id === id ? { ...g, rsvp: true } : g));
      toast({ title: "¡Invitado activado correctamente!" });
    } else {
      toast({
        title: "Error al activar invitado",
        description: "Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
      {/* Header with name and activate button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 truncate">
          {guest.name || "Sin nombre"}
        </h3>
        <Button
          onClick={() => handleSetActive(guest.id)}
          disabled={loading}
          title="Activar invitado"
          variant="outline"
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>

      {/* RSVP status */}
      <div className="flex items-center mb-3">
        {guest.rsvp ? (
          <div className="flex items-center text-green-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            <span className="text-sm font-medium">Confirmado</span>
          </div>
        ) : (
          <div className="flex items-center text-yellow-600">
            <XCircle className="h-4 w-4 mr-1" />
            <span className="text-sm font-medium">Pendiente</span>
          </div>
        )}
      </div>

      {/* Guest details */}
      <div className="space-y-2">
        {guest.email && (
          <div className="flex items-center text-sm text-gray-600">
            <Mail className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
            <span className="truncate">{guest.email}</span>
          </div>
        )}

        {guest.phone && (
          <div className="flex items-center text-sm text-gray-600">
            <Phone className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
            <span className="truncate">{guest.phone}</span>
          </div>
        )}

        {guest.dietRestrictionComment && (
          <div className="flex items-start text-sm text-gray-600">
            <UtensilsCrossed className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">{guest.dietRestrictionComment}</span>
          </div>
        )}

        {guest.comments && (
          <div className="flex items-start text-sm text-gray-600">
            <NotebookPen className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">{guest.comments}</span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!guest.email && !guest.phone && !guest.dietRestrictionComment && !guest.comments && (
        <div className="text-sm text-gray-400 italic">
          No hay información adicional disponible
        </div>
      )}
    </div>
  );
};