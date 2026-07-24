import { useDroppable } from '@dnd-kit/core';

/**
 * A Day tab that is also a drop target: dragging a stop onto it moves that stop
 * to that day. Highlights green while a draggable hovers over it.
 */
export function DayTab({
  index,
  active,
  onClick,
  label,
}: {
  index: number;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${index}` });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
        isOver
          ? 'bg-emerald text-white ring-2 ring-emerald/50'
          : active
            ? 'bg-accent-gradient text-white'
            : 'text-cream/60 hover:text-cream'
      }`}
    >
      {label}
    </button>
  );
}
