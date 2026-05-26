import Link from "next/link";
import { Phone } from "lucide-react";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";
import { Container } from "./container";
import Image from "next/image";

export const Footer = ({event}: {event: any}) => {
  return (
    <>
     
     <div  className="bg-black  z-20 text-white">
  <Container className="flex p-4 items-center justify-center w-full  ">
    
    {/* Logo en desktop */}
    <div className="hidden md:flex items-center">
      {event.logo_link && (
        <div className="relative h-20 w-[50vw]">
          {
            event.logo_link && <Image
            src={event.logo_link }
            alt="Logo"
            fill
            quality={100}
            className="object-contain"
          />
          }
        </div>
      )}
    </div>

    {/* Logo en mobile */}
<div className="flex md:hidden items-center w-full justify-center">
  {event.logo_link && (
    <div className="relative h-24 w-[50vw]"> 
      <Image
        src={event.logo_link}
        alt="Logo"
        fill
        className="object-contain"
      />
    </div>
  )}
</div>

    <div className="flex items-center gap-x-2">
      <Link href={""} target="_blank">
        <FaWhatsapp className="h-6 w-6 mr-2 text-sm" />
      </Link>
    </div>
  </Container>
</div>
    </>
  );
};
