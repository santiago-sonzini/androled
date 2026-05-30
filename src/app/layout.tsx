import { type Metadata } from "next";
import "./[id]/styles.css";
export const metadata: Metadata = {
  applicationName: "Androled",
  title: "Androled — Pulseras LED para eventos",
  description: "Sincronizamos cientos de pulseras LED en tiempo real. Transformá tu evento en un espectáculo de luz vivo, colectivo e irrepetible.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
