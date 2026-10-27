import { useEffect } from 'react';

const TEXT_FIELDS = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * Space spins while the machine is visible. A focused button would otherwise also fire on
 * Space (on key up), e.g. re-gambling a win after "Rojo" was clicked; that native action is
 * cancelled so Space always means "spin". Text fields keep their normal typing.
 */
export function useSpaceToSpin(active: boolean, spin: () => void): void {
  useEffect(() => {
    if (!active) return;
    const isSpace = (e: KeyboardEvent) => e.code === 'Space';
    const inTextField = (e: KeyboardEvent) => TEXT_FIELDS.includes((e.target as HTMLElement | null)?.tagName ?? '');
    const onDown = (e: KeyboardEvent) => {
      if (!isSpace(e) || inTextField(e)) return;
      e.preventDefault();
      if (!e.repeat) spin();
    };
    const onUp = (e: KeyboardEvent) => {
      if (isSpace(e) && !inTextField(e)) e.preventDefault();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [active, spin]);
}
