import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users } from "lucide-react";
import { GuestCard } from "./guest-card";
import { GuestListPrintable, GuestListPrintableEmma } from "./pdf";
import React, { useEffect } from "react";
import { GuestCardInactive } from "./guest-card-inactive";
import { Guest } from "@prisma/client";

export function GuestTabs({
  guests,
  setGuests,
  emma,
}: {
  guests: Guest[];
  setGuests: React.Dispatch<React.SetStateAction<Guest[]>>;
  emma?: boolean;
}) {
  // `rsvp: true` = confirmed/active, `rsvp: false` = declined/removed
  const [activeGuests, setActiveGuests] = React.useState<Guest[]>(
    guests.filter((g) => g.rsvp)
  );
  const [declinedGuests, setDeclinedGuests] = React.useState<Guest[]>(
    guests.filter((g) => !g.rsvp)
  );

  useEffect(() => {
    setActiveGuests(guests.filter((g) => g.rsvp));
    setDeclinedGuests(guests.filter((g) => !g.rsvp));
  }, [guests]);

  // Each guest counts as 1 person; plusOne adds 1 more
  const totalGuests = activeGuests.reduce((sum, guest) => {
    return sum + 1 
  }, 0);

  


  // Sort by createdAt (Date objects) ascending
  const sortedActiveGuests = [...activeGuests].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col md:flex-row items-center w-full justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Lista de Invitados ({totalGuests}) 
          </div>
          <div className="flex items-center gap-2">
            {emma ? (
              <GuestListPrintableEmma guests={activeGuests} />
            ) : (
              <GuestListPrintable guests={activeGuests} />
            )}
          </div>
        </CardTitle>
        <CardDescription>Todos los invitados para este evento</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="active">Confirmaciones</TabsTrigger>
            <TabsTrigger value="declined">No confirmados</TabsTrigger>
          </TabsList>

          {/* TAB ACTIVOS */}
          <TabsContent value="active">
            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              {sortedActiveGuests.length ? (
                sortedActiveGuests.map((guest, index) => (
                  <div key={guest.id}>
                    <GuestCard guest={guest} guests={guests} setGuests={setGuests} />
                    {index < sortedActiveGuests.length - 1 && (
                      <Separator className="my-2" />
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay invitados confirmados.
                </p>
              )}
            </div>
          </TabsContent>

          {/* TAB NO CONFIRMADOS */}
          <TabsContent value="declined">
            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              {declinedGuests.length ? (
                declinedGuests.map((guest, index) => (
                  <div key={guest.id} className="opacity-60">
                    <GuestCardInactive
                      guest={guest}
                      guests={guests}
                      setGuests={setGuests}
                    />
                    {index < declinedGuests.length - 1 && (
                      <Separator className="my-2" />
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay invitados sin confirmar.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}