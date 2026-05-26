import dynamic from 'next/dynamic';
import { getGuestById } from '../actions/guests';
import { getGuestPhotoUrl } from '../actions/supaimages';
import { redirect } from 'next/navigation';

const IdPageClient = dynamic(() => import('./IdPageClient'), { ssr: false });

export default async function IdPage({ params }: { params: { id: string } }) {
  const guest = await getGuestById(params.id);
  if (!guest) redirect('/');
  const imageUrl = await getGuestPhotoUrl(guest?.event.name, guest.id);

  return <IdPageClient id={params.id} name={guest?.name}  photoSrc={imageUrl ?? undefined} />;
}
