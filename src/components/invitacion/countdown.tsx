"use client";

import Image from "next/image";
import React, { useState, useEffect } from "react";

/* ---------------------------------- */
/* Utils                               */
/* ---------------------------------- */
const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} · ${hours}:${minutes}`;
};

/* ---------------------------------- */
/* Types                               */
/* ---------------------------------- */
interface CountdownProps {
  targetDate: string;
  title?: string;
  event: any;
}

/* ---------------------------------- */
/* Countdown Component                 */
/* ---------------------------------- */
export const Countdown: React.FC<CountdownProps> = ({
  targetDate,
  title = "",
  event,
}) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date(targetDate) - +new Date();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const addLeadingZero = (num: number) =>
    num.toString().padStart(2, "0");

  const mainColor = "#000000";

  return (
    <section className="relative w-full h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      {event?.countdown_link && (
        <Image
          src={event.countdown_link}
          alt="Event background"
          fill
          priority
          className="object-cover"
        />
      )}

      {/* Overlay */}

      {/* Content */}
      <div
        style={{ color: mainColor }}
        className="relative z-10 max-w-4xl w-full px-6 flex flex-col items-center text-center space-y-10"
      >
        {/* Title */}
        <div className="space-y-4">
          <p className="uppercase tracking-widest text-xs opacity-80 font-sans">
            {title}
          </p>

          <h1 className="text-4xl md:text-6xl font-serif font-semibold italic">
          El día especial
          </h1>

          <p className="text-sm tracking-wide opacity-90 font-sans">
            {formatDateTime(targetDate)}
          </p>
        </div>

        {/* Countdown */}
        <div className="flex gap-6 md:gap-10 text-4xl md:text-5xl font-countdown tracking-widest">
          {[
            { label: "días", value: timeLeft.days },
            { label: "horas", value: addLeadingZero(timeLeft.hours) },
            { label: "min", value: addLeadingZero(timeLeft.minutes) },
            { label: "seg", value: addLeadingZero(timeLeft.seconds) },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div>{item.value}</div>
              <div className="text-xs uppercase tracking-wide opacity-70 font-sans">
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="text-sm opacity-50 tracking-wider">· · ·</div>

        {/* Action */}
        <ButtonSaveToCalendar
          color={mainColor}
          name={event.display_name ?? "Evento"}
          targetDate={targetDate}
        />
      </div>
    </section>
  );
};

/* ---------------------------------- */
/* Save to Calendar Button             */
/* ---------------------------------- */
export const ButtonSaveToCalendar = ({
  targetDate,
  name,
  color,
}: {
  targetDate: string;
  name: string;
  color: string;
}) => {
  const generateCalendarFile = () => {
    const date = new Date(targetDate);

    const startDate =
      date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const endDate =
      new Date(date.getTime() + 60 * 60 * 1000)
        .toISOString()
        .replace(/[-:]/g, "")
        .split(".")[0] + "Z";

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Event//Countdown//EN
BEGIN:VEVENT
UID:${Date.now()}@event.com
DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .split(".")[0]}Z
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${name}
DESCRIPTION:Guardar la fecha
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "evento.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={generateCalendarFile}
      style={{ color }}
      className="mt-6 font-sans text-sm underline underline-offset-4 decoration-dotted hover:decoration-solid transition"
    >
      Agregar al calendario
    </button>
  );
};
