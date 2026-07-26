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
  locked = false,
}: {
  index: number;
  active: boolean;
  onClick: () => void;
  label: string;
  locked?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${index}` });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      title={locked ? 'Premium' : undefined}
      className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
        isOver
          ? 'bg-sage text-ink ring-2 ring-sage/50'
          : active
            ? 'bg-iznik text-white'
            : locked
              ? 'text-ink/30 hover:text-ink/50'
              : 'text-ink/60 hover:text-ink'
      }`}
    >
      {locked ? `🔒 ${label}` : label}
    </button>
  );
}
