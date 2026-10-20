import { useGame } from '../../state/store';
import { EventModal, PhotoModal } from './EventModal';
import { TravelModal } from './TravelModal';
import { ActivityModal, InteriorPanel, VendorModal } from './PlaceModals';
import { DialogueModal, NjangiModal } from './DialogueModals';

export function Modals() {
  const modal = useGame((s) => s.modal);
  const engine = useGame((s) => s.engine);
  useGame((s) => s.version);

  return (
    <>
      {engine && engine.state.pendingEvents.length > 0 && <EventModal />}
      {modal.kind === 'travel' && <TravelModal />}
      {modal.kind === 'activity' && <ActivityModal placeId={modal.placeId} actions={modal.actions} />}
      {modal.kind === 'vendor' && <VendorModal placeId={modal.placeId} vendorKind={modal.vendorKind} />}
      {modal.kind === 'dialogue' && <DialogueModal npcId={modal.npcId} />}
      {modal.kind === 'interior' && <InteriorPanel interiorId={modal.interiorId} placeId={modal.placeId} />}
      {modal.kind === 'njangi' && <NjangiModal />}
      {modal.kind === 'photo' && <PhotoModal landmarkId={modal.landmarkId} />}
      {modal.kind === 'jobboard' && <JobBoardRedirect />}
    </>
  );
}

function JobBoardRedirect() {
  return null;
}
