import { getGuestById } from '../actions/guests';
import { getGuestPhotoUrl } from '../actions/supaimages';
import { redirect } from 'next/navigation';
import IdPageClient from './IdPageClient';
import './styles.css'



export default async function IdPage({ params }: { params: { id: string } }) {
  const guest = await getGuestById(params.id);
  if (!guest) redirect('/');
  const imageUrl = await getGuestPhotoUrl(guest?.event.name, guest.id);

  return <IdPageClient id={params.id} name={guest?.name}  photoSrc={imageUrl ?? undefined} />;
}
