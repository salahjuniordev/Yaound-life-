import { useEffect, useRef } from 'react';
import { moveInput } from '../render/controls';

export function TouchControls() {
  const zoneRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);
  const centerRef = useRef({ x: 0, y: 0, r: 52 });

  useEffect(() => {
    const zone = zoneRef.current;
    const knob = knobRef.current;
    if (!zone || !knob) return;

    const reset = () => {
      activeRef.current = false;
      moveInput.x = 0;
      moveInput.y = 0;
      knob.style.transform = 'translate(-50%, -50%)';
    };

    const onDown = (e: PointerEvent) => {
      const rect = zone.getBoundingClientRect();
      centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, r: rect.width / 2 };
      activeRef.current = true;
      zone.setPointerCapture(e.pointerId);
      handleMove(e);
    };
    const handleMove = (e: PointerEvent) => {
      if (!activeRef.current) return;
      const { x, y, r } = centerRef.current;
      let dx = e.clientX - x;
      let dy = e.clientY - y;
      const d = Math.hypot(dx, dy);
      const max = r * 0.72;
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      moveInput.x = dx / max;
      moveInput.y = -dy / max;
    };
    const onUp = (e: PointerEvent) => {
      if (zone.hasPointerCapture(e.pointerId)) zone.releasePointerCapture(e.pointerId);
      reset();
    };

    zone.addEventListener('pointerdown', onDown);
    zone.addEventListener('pointermove', handleMove);
    zone.addEventListener('pointerup', onUp);
    zone.addEventListener('pointercancel', onUp);
    return () => {
      zone.removeEventListener('pointerdown', onDown);
      zone.removeEventListener('pointermove', handleMove);
      zone.removeEventListener('pointerup', onUp);
      zone.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div className="joystick-zone" ref={zoneRef}>
      <div className="joystick-base">
        <div className="joystick-knob" ref={knobRef} />
      </div>
    </div>
  );
}
