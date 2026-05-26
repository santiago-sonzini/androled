"use client";
import { Guest } from "@prisma/client";
import React from "react";
import {
  CheckCircle,
  Mail,
  NotebookPen,
  Phone,
  UtensilsCrossed,
  XCircle,
  X,
  Plus,
} from "lucide-react";
import { AlertModal } from "./alert-modal";
import { delete_guest } from "@/app/actions/guests";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { PersonIcon } from "@radix-ui/react-icons";

export const GuestCard = ({
  guest,
  guests,
  setGuests,
}: {
  guest: Guest;
  guests: Guest[];
  setGuests: React.Dispatch<React.SetStateAction<Guest[]>>;
}) => {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleDelete = async (id: string) => {
    setLoading(true);
    const res = await delete_guest(id);
    if (res.status === 200) {
      setGuests(guests.filter((g) => g.id !== id));
      toast({ title: "¡Invitado borrado correctamente!" });
    } else {
      toast({
        title: "Error al borrar invitado",
        description: "Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          handleDelete(guest.id);
          setOpen(false);
        }}
        loading={loading}
      />

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
        {/* Header with name and delete button */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {guest.name || "Sin nombre"}
          </h3>
          <Button
            onClick={() => setOpen(true)}
            disabled={loading}
            title="Eliminar invitado"
            variant="destructive"
          >
            <X className="h-4 w-4" />
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

          {
            guest.plusOne && (
              <div className="flex items-start text-sm text-gray-600">
                <Plus className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">+1 acompañante</span>
              </div>
            )
          }

          {
            guest.goesWith && (
              <div className="flex items-start text-sm text-gray-600">
                <PersonIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{guest.goesWith}</span>
              </div>
            )
          }
        </div>

        {/* Empty state */}
        {!guest.email && !guest.phone && !guest.dietRestrictionComment && !guest.comments && (
          <div className="text-sm text-gray-400 italic">
            No hay información adicional disponible
          </div>
        )}
      </div>
    </>
  );
};