import Image from "next/image";

const CoupleSection = () => {
  return (
    <section id="couple" className="py-24">
      
      <div className="max-w-6xl mx-auto px-6">
        {/* Heading */}
        <div className="text-center mb-16 space-y-3">
          <h2 className="text-4xl md:text-5xl font-serif font-semibold italic">
            Hola!
          </h2>
          <p className="text-gray-600 font-sans text-sm tracking-wide">
            Nos llena de alegría invitarte a celebrar nuestra boda y a
            acompañarnos en este momento tan importante.{" "}
          </p>
        </div>

        {/* Couple */}
        <div className="flex flex-row md:flex-col lg:flex-row items-center justify-center gap-4 md:gap-6 lg:gap-20 relative">
  {/* Groom */}
  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6">
    {/* Nombre desktop */}
    <div className="hidden md:block text-center md:text-left max-w-sm space-y-3">
      <h3 className="text-2xl md:text-3xl font-serif font-medium">
        Rodrigo
      </h3>
    </div>

    <Image
      quality={100}
      width={500}
      height={500}
      src="https://vwcvvwhlyaarcfmsqhvo.supabase.co/storage/v1/object/public/eventos/taniayrodrigo/%20FOTO%20%20009.jpg"
      alt="Groom"
      className="w-36 h-36 md:w-56 md:h-56 object-cover rounded-full lg:-mr-6"
    />

    {/* Nombre mobile */}
    <h3 className="md:hidden text-lg font-serif font-medium text-center">
      Rodrigo
    </h3>
  </div>

  {/* Heart */}
  <div className="text-[#402b24] text-2xl md:text-3xl font-serif z-10">
    ♥
  </div>

  {/* Bride */}
  <div className="flex flex-col md:flex-row-reverse items-center gap-3 md:gap-6">
    {/* Nombre desktop */}
    <div className="hidden md:block text-center md:text-left max-w-sm space-y-3">
      <h3 className="text-2xl md:text-3xl font-serif font-medium">
        Tania
      </h3>
    </div>

    <Image
      quality={100}
      width={500}
      height={500}
      src="https://vwcvvwhlyaarcfmsqhvo.supabase.co/storage/v1/object/public/eventos/taniayrodrigo/%20FOTO%20%20008.jpg"
      alt="Bride"
      className="w-36 h-36 md:w-56 md:h-56 object-cover rounded-full lg:-ml-6"
    />

    {/* Nombre mobile */}
    <h3 className="md:hidden text-lg font-serif font-medium text-center">
      Tania
    </h3>
  </div>
</div>

      </div>
    </section>
  );
};

export default CoupleSection;
