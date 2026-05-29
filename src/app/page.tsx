import dynamic from 'next/dynamic';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Androled — Pulseras LED para eventos',
  description: 'Sincronizamos miles de pulseras LED en tiempo real. Transformá tu evento en un espectáculo de luz vivo, colectivo e irrepetible.',
  metadataBase: new URL('https://androled.vercel.app'),
  openGraph: {
    type: 'website',
    url: 'https://androled.vercel.app/',
    title: 'Androled — Pulseras LED para eventos',
    description: 'Sincronizamos miles de pulseras LED en tiempo real. Transformá tu evento en un espectáculo de luz vivo, colectivo e irrepetible.',
    images: [
      {
        url: '/link.jpeg',
        width: 1600,
        height: 878,
        alt: 'Androled — Pulseras LED para eventos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Androled — Pulseras LED para eventos',
    description: 'Sincronizamos miles de pulseras LED en tiempo real. Transformá tu evento en un espectáculo de luz vivo, colectivo e irrepetible.',
    images: ['/link.jpeg'],
  },
};

const LandingClient = dynamic(() => import('./LandingClient'), { ssr: true });

export default function HomePage() {
  return <LandingClient />;
}
