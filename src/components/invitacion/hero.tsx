"use client";

import Image from "next/image";
import { useScroll, useTransform, motion } from "framer-motion";
import { useRef, useEffect } from "react";
import { ChevronsDown } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Event_SaveTheDate } from "./save-the-date/default";

export const Hero = ({ event }: { event: Event_SaveTheDate }) => {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 1, 0]);

  useEffect(() => {
    const video = videoRef.current;
    const container = ref.current;
    if (!video || !container) return;

    // Configurar el video antes de intentar reproducir
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.defaultMuted = true;

    // Función para intentar reproducir el video
    const playVideo = async () => {
      try {
        await video.play();
        console.log("Video playing successfully");
      } catch (error) {
        console.log("Autoplay prevented:", error);
        
        // Intentar de nuevo después de un pequeño delay
        setTimeout(async () => {
          try {
            await video.play();
          } catch (err) {
            // Fallback: reproducir solo cuando toquen el contenedor del video
            const playOnInteraction = async (e: Event) => {
              e.stopPropagation();
              try {
                await video.play();
              } catch (e) {
                console.log("Play on interaction failed:", e);
              }
            };
            
            // Solo agregar listeners al contenedor del hero, no al documento completo
            container.addEventListener("touchstart", playOnInteraction, { once: true, passive: true });
            container.addEventListener("click", playOnInteraction, { once: true });
          }
        }, 100);
      }
    };

    // Intentar reproducir inmediatamente
    playVideo();
    
    // También cuando el video esté cargado
    video.addEventListener("loadedmetadata", playVideo);
    video.addEventListener("canplay", playVideo);

    return () => {
      video.removeEventListener("loadedmetadata", playVideo);
      video.removeEventListener("canplay", playVideo);
    };
  }, [event.hero_link]);

  return (
    <div ref={ref} className="relative text-[#b9a67c]">
      <motion.div className="relative aspect-[9/16] shrink-0 overflow-clip rounded-b-md h-screen md:aspect-video w-full">
        {/* Video background */}
        {event.hero_link.desktop && (
          <video
            ref={videoRef}
            src={isMobile && event.hero_link.mobile ? event.hero_link.mobile : event.hero_link.desktop}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            webkit-playsinline="true"
            x5-playsinline="true"
            className="h-full w-full  object-cover "
          >
            Your browser does not support the video tag.
          </video>
        )}

      {/* Logo container */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
          {event.video_logo && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1.2,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="relative w-[20vw] h-[20vh] pl-52 ml-4 md:w-[30vw] md:h-[30vh]"
            >
              <Image
                src={event.video_logo}
                alt="Logo"
                fill
                quality={100}
                priority
                className="object-contain"
              />
            </motion.div>
          )}
        </div>

        {/* Scroll arrows */}
        <div className="absolute bottom-28 left-0 right-0 z-20 flex justify-center">
          <div className="flex flex-col items-center space-y-1">
            {[0].map((i) => (
              <motion.div
                key={i}
                initial={{ y: 0, opacity: 0.6 }}
                animate={{
                  y: [0, 10, 0],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              >
                <ChevronsDown size={50} className="text-white" />
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};