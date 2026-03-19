import { useRef, useEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type EquationProps = {
  tex: string;
  display?: boolean;
  className?: string;
};

export function Equation({ tex, display = false, className = '' }: EquationProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, {
        displayMode: display,
        throwOnError: false,
        strict: false,
      });
    }
  }, [tex, display]);

  return (
    <span
      ref={ref}
      className={className}
      aria-label={tex}
      role="math"
    />
  );
}
