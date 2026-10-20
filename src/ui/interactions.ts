import { useGame, type NearbyInfo } from '../state/store';
import { PLACE_MAP } from '../data/places';

export function openNearby(n: NearbyInfo) {
  const store = useGame.getState();
  if (n.kind === 'npc' && n.npcId) {
    store.setModal({ kind: 'dialogue', npcId: n.npcId });
    return;
  }
  const place = n.placeId ? PLACE_MAP[n.placeId] : null;
  if (!place) return;
  switch (place.kind) {
    case 'taxi':
      store.setModal({ kind: 'travel' });
      break;
    case 'home':
    case 'interior':
      if (place.interior) {
        if (place.interior === 'njangi') store.setModal({ kind: 'njangi' });
        else store.setModal({ kind: 'interior', interiorId: place.interior, placeId: place.id });
      }
      break;
    case 'vendor':
      store.setModal({ kind: 'vendor', placeId: place.id, vendorKind: place.vendor ?? '' });
      break;
    case 'activity':
    case 'landmark':
    case 'npc_spot':
      store.setModal({ kind: 'activity', placeId: place.id, actions: place.activities ?? [] });
      break;
  }
}

export function openPhone(app: string) {
  const store = useGame.getState();
  store.setPanel('phone');
  store.setPhoneApp(app);
}
