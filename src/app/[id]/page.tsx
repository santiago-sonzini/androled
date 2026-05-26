import dynamic from 'next/dynamic';

const IdPageClient = dynamic(() => import('./IdPageClient'), { ssr: false });

export default function IdPage({ params }: { params: { id: string } }) {
  return <IdPageClient id={params.id} name='Santiago Sonzini'  photoSrc='https://placehold.co/600x400'/>;
}
