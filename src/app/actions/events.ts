"use server";

import { z } from "zod";
import { Prisma, Event, Guest, Admin } from "@prisma/client";
import { db } from "@/server/db";

// Type aliases con relaciones
export type EventWithRelations = Event & {
  admin: Admin | null;
  guests: Guest[];
};

export interface GetEventResponse {
  event?: EventWithRelations;
  error?: any;
  status: number;
}

export interface GetEventsResponse {
  events?: EventWithRelations[];
  error?: any;
  status: number;
}

const eventWithRelations = {
  admin: true,
  guests: true,
} satisfies Prisma.EventInclude;

// ─────────────────────────────────────────────

export async function get_event(name: string) {
  try {
    if (!name) {
      return JSON.parse(JSON.stringify({ error: "Not available", status: 500 }));
    }

    const event = await db.event.findFirst({
      where: { name },
      include: eventWithRelations,
    });

    if (!event) {
      return JSON.parse(JSON.stringify({ error: "Not available", status: 500 }));
    }

    return JSON.parse(JSON.stringify({ event, status: 200 }));
  } catch (error) {
    console.error("Error fetching event:", error);
    return JSON.parse(JSON.stringify({ error, status: 500 }));
  }
}



export async function get_event_complete(id: string): Promise<GetEventResponse> {
  try {
    const eventData = await db.event.findUnique({
      where: { id },
      include: eventWithRelations,
    });

    if (!eventData) {
      return { error: `Event "${id}" not found`, status: 404 };
    }

    eventData.guests.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

    return { event: eventData as EventWithRelations, status: 200 };
  } catch (error) {
    console.error("Unexpected error in get_event_complete:", error);
    return {
      error: "An unexpected error occurred while fetching event data",
      status: 500,
    };
  }
}

export async function get_events(): Promise<GetEventsResponse> {
  try {
    const eventData = await db.event.findMany({
      include: eventWithRelations,
      orderBy: { createdAt: "desc" },
    });

    return { events: eventData as EventWithRelations[], status: 200 };
  } catch (error) {
    console.error("Unexpected error in get_events:", error);
    return {
      error: "An unexpected error occurred while fetching event data",
      status: 500,
    };
  }
}




export async function delete_event(id: string) {
  try {
    await db.event.delete({ where: { id } });

    return JSON.parse(
      JSON.stringify({ message: "Evento borrado correctamente", status: 200 })
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return JSON.parse(JSON.stringify({ error, status: 500 }));
  }
}