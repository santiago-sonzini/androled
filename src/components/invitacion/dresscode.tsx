import React from "react";
import Image from "next/image";

export default function DresscodeSection() {
  return (
    <section className="relative h-[60vh]  w-full overflow-hidden flex items-center justify-center px-4 md:px-8">
      {/* Background Image con Next.js Image */}
      <div className="absolute inset-0">
        <Image
          src="https://vwcvvwhlyaarcfmsqhvo.supabase.co/storage/v1/object/public/eventos/taniayrodrigo/FOTO%20%20005.jpg"
          alt="Dresscode background"
          fill
          className="object-cover"
          priority
          sizes="100vw"
          quality={100}
        />
        {/* Overlay con gradiente elegante */}
      </div>

      {/* Tarjeta de papel lujoso */}
      <div className="relative z-10 m-auto">
        <div className=" bg-[#f8f6f4] rounded-sm shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 border border-[#e8e0d8] relative">
          {/* Textura de papel */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" /%3E%3C/filter%3E%3Crect width="100" height="100" filter="url(%23noise)" opacity="0.4"/%3E%3C/svg%3E")',
            }}
          ></div>

          {/* Título elegante */}
          <h3
            className="text-2xl lg:text-3xl font-serif text-[#402b24] mb-8 tracking-wide text-center italic"
            style={{ fontFamily: "Playfair Display, Georgia, serif" }}
          >
            Dress Code
          </h3>

          {/* Paleta de colores minimalista */}
          <div className="flex gap-3 justify-center">
          <span
              className=" lg:w-12 lg:h-12 w-8 h-8 rounded-full shadow-sm"
              style={{ backgroundColor: "#f0ebe9" }}
            ></span>
          <span
              className=" lg:w-12 lg:h-12 w-8 h-8 rounded-full shadow-sm"
              style={{ backgroundColor: "#dad2ca" }}
            ></span>
            <span
              className=" lg:w-12 lg:h-12 w-8 h-8 rounded-full shadow-sm"
              style={{ backgroundColor: "#c4b8aa" }}
            ></span>

            <span
              className=" lg:w-12 lg:h-12 w-8 h-8 rounded-full shadow-sm"
              style={{ backgroundColor: "#b09d8e" }}
            ></span>
            <span
              className=" lg:w-12 lg:h-12 w-8 h-8 rounded-full shadow-sm"
              style={{ backgroundColor: "#9d836d" }}
            ></span>
            <span
              className=" lg:w-12 lg:h-12 w-8 h-8 rounded-full shadow-sm"
              style={{ backgroundColor: "#806b56" }}
            ></span>
            <span
              className=" lg:w-12 lg:h-12 w-8 h-8 rounded-full shadow-sm"
              style={{ backgroundColor: "#625042" }}
            ></span>
          </div>

          {/* Links minimalistas */}
          <div className="mt-8 space-y-4 text-center">
  <a
    href="https://ar.pinterest.com/tania_tubero/dress-code/hombres/"
    target="_blank"
    rel="noopener noreferrer"
    className="
      inline-block w-full
      px-6 py-2
      text-sm
      border border-[#705547]
      text-[#705547]
      bg-transparent
      transition-all duration-300 ease-in-out
      hover:bg-[#705547]
      hover:text-[#f8f6f4]
    "
    style={{ fontFamily: "Georgia, serif" }}
  >
    Inspiración Hombres
  </a>

  <a
    href="https://ar.pinterest.com/tania_tubero/dress-code/mujeres/"
    target="_blank"
    rel="noopener noreferrer"
    className="
      inline-block w-full
      px-6 py-2
      text-sm
      border border-[#705547]
      text-[#705547]
      bg-transparent
      transition-all duration-300 ease-in-out
      hover:bg-[#705547]
      hover:text-[#f8f6f4]
    "
    style={{ fontFamily: "Georgia, serif" }}
  >
    Inspiración Mujeres
  </a>
</div>
        </div>
      </div>
    </section>
  );
}
