import { getAllGuests } from '../actions/guests';
import { redirect } from 'next/navigation';
import NFCPage from './checkPage';

export default async function CheckPage() {
  const guests = await getAllGuests();
  if (!guests) redirect('/');

  return <NFCPage guests={guests} />;
}