import { getGuestById } from '../actions/guests';
import { getGuestPhotoUrl } from '../actions/supaimages';
import { redirect } from 'next/navigation';
import IdPageClient from './IdPageClient';
import './styles.css'
import Page from './gamePage';



export default async function IdPage({ params }: { params: { id: string } }) {
  
  return <Page guestId={params.id} />;
}
