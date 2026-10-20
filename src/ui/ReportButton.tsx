import { useState } from 'react';
import { useGame } from '../state/store';
import { Icon } from './icons';
import type { ContentReport } from '../sim/types';

export function ReportButton({ kind, refId }: { kind: ContentReport['kind']; refId: string }) {
  const engine = useGame((s) => s.engine);
  const fr = engine?.state.settings.language === 'fr';
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="muted small report-done">
        <Icon name="check" size={13} /> {fr ? 'Signalement enregistré' : 'Report saved'}
      </div>
    );
  }

  return (
    <div className="report-row">
      {!open ? (
        <button className="mini report-btn" onClick={() => setOpen(true)}>
          <Icon name="warning" size={13} /> {fr ? 'Signaler un contenu inexact' : 'Report inaccurate content'}
        </button>
      ) : (
        <div className="report-form">
          <input
            value={note}
            maxLength={400}
            placeholder={fr ? 'Qu’est-ce qui est inexact ou choquant ?' : 'What is inaccurate or offensive?'}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="btn-grid">
            <button
              className="mini"
              disabled={!note.trim()}
              onClick={() => {
                useGame.getState().dispatch({ type: 'report_content', kind, refId, note });
                setSent(true);
              }}
            >
              {fr ? 'Envoyer' : 'Send'}
            </button>
            <button className="mini choice-muted" onClick={() => setOpen(false)}>
              {fr ? 'Annuler' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
