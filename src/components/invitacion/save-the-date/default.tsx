import "@/app/globals.css";

import { Hero } from "../hero";
import { Countdown } from "./countdown";

import { Metadata, ResolvingMetadata } from "next";
import { Footer } from "../footer";
import { Header } from "../header";

export interface Event_SaveTheDate {
  hero_link: {
    mobile?: string;
    desktop: string;
  };
  targetDate: string;
  countdown_title: string;
  video_logo?: string;
}



interface Props {
  event:Event_SaveTheDate;
}

async function SaveTheDate({
  event,
}: Props) {
  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold">Evento no disponible</h1>
        <p className="p-2 text-center text-muted-foreground">
          El evento no está disponible
        </p>
      </div>
    );
  }

  return (
    <>
      <main>
        <Header/>
        <div className="relative z-10 bg-[#000000]">
          <Hero event={event} />
        </div>
        <Countdown
          targetDate={event.targetDate}
          title={event.countdown_title} 
                    event={event}
        />
      </main>
    </>
  );
}

export default SaveTheDate;
