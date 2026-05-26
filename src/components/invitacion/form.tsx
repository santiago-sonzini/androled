import React from "react";

export const FormSection = ({
  event_id,
  confirmDate,
  event,
}: {
  event_id: string;
  confirmDate: Date;
  event: any;
}) => {
  const now = new Date();
  const isExpired = confirmDate < now;

  const dateString = confirmDate.toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section
      id="form"
      style={{
        backgroundColor: event.color,
        color: event.text_color,
      }}
      className="w-full py-24 px-6 flex flex-col items-center justify-center text-center"
    >
      <div className="max-w-xl w-full space-y-6">
        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-serif font-semibold italic">
          Confirmación de asistencia
        </h1>

        {!isExpired ? (
          <>
            {/* Subtitle */}
            <p
              className="text-sm md:text-base font-sans opacity-90"
              style={{ color: event.text_color }}
            >
              Por favor, confirme su asistencia antes del{" "}
              <span className="font-medium">{dateString}</span>
            </p>

            {/* Form */}
            <div className="pt-2 text-left">
              {/* <RSVPForm
                companion={false}
                emailcompanion={false}
                confirmDate={confirmDate}
                textColor={event.text_color}
                color={event.color}
                event_name={event.name}
                event_id={event_id}
              /> */}
            </div>
          </>
        ) : (
          /* Expired message */
          <div className="mt-6 rounded-xl  px-6 py-8">
            
            <p className="mt-2 text-sm opacity-80">
            El período de confirmación ha finalizado

            </p>
          </div>
        )}
      </div>
    </section>
  );
};
