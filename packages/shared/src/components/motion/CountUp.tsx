import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { DURATION } from "../../lib/motion";

const NUMBER_PATTERN = /^(\D*)([\d,]*\.?\d+)(\D*)$/;

interface ParsedNumber {
  prefix: string;
  suffix: string;
  target: number;
  decimals: number;
}

function parse(formatted: string): ParsedNumber | null {
  const match = NUMBER_PATTERN.exec(formatted.trim());
  if (!match) return null;
  const [, prefix, numeric, suffix] = match;
  const decimals = numeric.includes(".") ? numeric.split(".")[1].length : 0;
  const target = Number(numeric.replace(/,/g, ""));
  if (Number.isNaN(target)) return null;
  return { prefix, suffix, target, decimals };
}

function format(value: number, parsed: ParsedNumber): string {
  return `${parsed.prefix}${value.toLocaleString(undefined, {
    minimumFractionDigits: parsed.decimals,
    maximumFractionDigits: parsed.decimals,
  })}${parsed.suffix}`;
}

interface CountUpProps {
  /** A pre-formatted display value, e.g. "1,250", "₱45,000", "25", "98.5%" — animates the numeric portion while preserving any prefix/suffix/decimal formatting. Falls back to a static render for anything that doesn't parse as a number. */
  value: string;
  className?: string;
}

/** Animates a KPI's displayed number from 0 (or its previous value) up to the new one — only on first appearance or when the value actually changes, never on an unrelated re-render. */
export default function CountUp({ value, className }: CountUpProps) {
  const reducedMotion = useReducedMotion();
  const parsed = parse(value);
  const [display, setDisplay] = useState(() => (parsed ? format(reducedMotion ? parsed.target : 0, parsed) : value));
  const prevTarget = useRef<number | null>(null);

  useEffect(() => {
    if (!parsed) {
      setDisplay(value);
      return;
    }
    if (reducedMotion) {
      setDisplay(format(parsed.target, parsed));
      prevTarget.current = parsed.target;
      return;
    }
    if (prevTarget.current === parsed.target) return;

    const from = prevTarget.current ?? 0;
    const controls = animate(from, parsed.target, {
      duration: DURATION.number,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(format(latest, parsed)),
    });
    prevTarget.current = parsed.target;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reducedMotion]);

  return <span className={className}>{display}</span>;
}
