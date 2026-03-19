import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  text: string;
  className?: string;
}

export function InfoTooltip({ text, className = 'w-3.5 h-3.5' }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <span ref={iconRef} onMouseEnter={show} onMouseLeave={hide}>
      <svg
        className={`${className} text-zinc-400 cursor-help`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      {visible && createPortal(
        <span
          className="fixed w-64 p-2 text-xs font-normal normal-case tracking-normal bg-zinc-800 text-white rounded shadow-lg pointer-events-none z-50"
          style={{
            left: pos.x,
            top: pos.y,
            transform: 'translate(-50%, -100%) translateY(-4px)',
          }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
