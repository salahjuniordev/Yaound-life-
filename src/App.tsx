import { useEffect } from 'react';
import { useGame } from './state/store';
import { saveLocal } from './persistence/idb';
import { GameCanvas } from './render/GameCanvas';
import { HUD } from './ui/HUD';
import { TouchControls } from './ui/TouchControls';
import { Phone } from './ui/Phone';
import { Modals } from './ui/modals/Modals';
import { Toasts } from './ui/Toasts';
import { MainMenu } from './ui/MainMenu';
import { CharacterCreator } from './ui/CharacterCreator';
import { openNearby } from './ui/interactions';
import { detectAndApply, initPowerWatcher } from './render/perf';

export default function App() {
  const screen = useGame((s) => s.screen);
  const refreshMenuSaves = useGame((s) => s.refreshMenuSaves);

  useEffect(() => {
    void refreshMenuSaves();
  }, [refreshMenuSaves]);

  useEffect(() => {
    if (screen !== 'game') return;
    const engine = useGame.getState().engine;
    if (!engine) return;
    const state = engine.state;
    if (state.storyFlags['perf_detected']) return;
    state.storyFlags['perf_detected'] = 1;
    const cleanup = initPowerWatcher(engine);
    void detectAndApply(engine).then((decision) => {
      if (decision) {
        engine.notifyApp('notes', 'Quality auto-detected', `${decision.reason}. Change it any time in Settings.`);
      }
    });
    return cleanup;
  }, [screen]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 1);
      last = t;
      const engine = useGame.getState().engine;
      if (engine) {
        engine.paused = engine.state.pendingEvents.length > 0;
        engine.tick(dt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        const engine = useGame.getState().engine;
        if (engine) void saveLocal(engine.state);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onVis);
    };
  }, []);

  return (
    <>
      {screen === 'menu' && <MainMenu />}
      {screen === 'create' && <CharacterCreator />}
      {screen === 'game' && (
        <div className="game-root">
          <GameCanvas onInteract={openNearby} />
          <HUD />
          <TouchControls />
          <Phone />
          <Modals />
        </div>
      )}
      <Toasts />
    </>
  );
}
