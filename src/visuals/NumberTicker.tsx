import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";

/**
 * Count-up KPI treatment adapted from Magic UI's NumberTicker.
 * Upstream: https://github.com/magicuidesign/magicui/tree/b0b2e4974b1b68cd5278277c6837a27736e20c3a/apps/www/registry/magicui/number-ticker.tsx
 * The required MIT attribution is recorded in THIRD_PARTY_NOTICES.md.
 */
export interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  delay?: number;
  decimalPlaces?: number;
  locale?: string;
}

export default function NumberTicker({
  value,
  startValue = 0,
  delay = 0,
  decimalPlaces = 0,
  locale = "en-IN",
  className,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const precision = Math.max(0, Math.min(6, Math.trunc(decimalPlaces)));
  const format = (number: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(Number(number.toFixed(precision)));

  const motionValue = useMotionValue(startValue);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: "0px" });
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isInView) return;

    if (prefersReducedMotion) {
      springValue.jump(value);
      return;
    }

    const timer = window.setTimeout(
      () => motionValue.set(value),
      Math.max(0, delay) * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [delay, isInView, motionValue, prefersReducedMotion, springValue, value]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) ref.current.textContent = format(latest);
      }),
    [springValue, locale, precision],
  );

  return (
    <span
      ref={ref}
      className={className}
      aria-label={format(value)}
      {...props}
    >
      {format(startValue)}
    </span>
  );
}
