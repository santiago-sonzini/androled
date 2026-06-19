import './styles.css';
import Page from './gamePage';
import { loadAlbum } from '../actions/album';

// Resolvemos el perfil + álbum en el server: si el invitado YA tiene perfil,
// el cliente arranca directo en el álbum (sin intro ni carga async).
export default async function IdPage({ params }: { params: { id: string } }) {
  const initial = await loadAlbum(params.id);
  return <Page guestId={params.id} initial={initial} />;
}
