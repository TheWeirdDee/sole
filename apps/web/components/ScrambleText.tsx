"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ScrambleTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  scrambleOnHover?: boolean;
  triggerDelay?: number; // delay before initial scramble on mount (ms)
  speed?: number; // interval between frames in ms
  cyclesPerChar?: number; // how many random character flips before resolving
  scrambleChars?: string;
}

const DEFAULT_CHARS = "0123456789abcdefx#*!&%$0123456789abcdef";

export function ScrambleText({
  text,
  className = "",
  style = {},
  scrambleOnHover = true,
  triggerDelay = 350,
  speed = 32,
  cyclesPerChar = 3,
  scrambleChars = DEFAULT_CHARS,
}: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isScrambling, setIsScrambling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startScramble = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsScrambling(true);

    let frame = 0;
    const totalFrames = text.length * cyclesPerChar;

    intervalRef.current = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      const revealIndex = Math.floor(progress * text.length);

      const nextText = text
        .split("")
        .map((char, index) => {
          if (char === " ") return " ";
          if (index < revealIndex) {
            return text[index];
          }
          const randomChar = scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
          return randomChar;
        })
        .join("");

      setDisplayText(nextText);

      if (frame >= totalFrames) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
        setIsScrambling(false);
      }
    }, speed);
  }, [text, cyclesPerChar, scrambleChars, speed]);

  useEffect(() => {
    // Initial scramble on load
    timeoutRef.current = setTimeout(() => {
      startScramble();
    }, triggerDelay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startScramble, triggerDelay]);

  const handleMouseEnter = () => {
    if (scrambleOnHover && !isScrambling) {
      startScramble();
    }
  };

  return (
    <span
      onMouseEnter={handleMouseEnter}
      className={className}
      style={{
        display: "inline-block",
        cursor: scrambleOnHover ? "pointer" : "inherit",
        fontVariantNumeric: "tabular-nums",
        transition: "color 0.2s ease",
        color: isScrambling ? "var(--claret, #7c1d2a)" : "inherit",
        ...style,
      }}
      title="Decorative text effect"
    >
      {displayText}
    </span>
  );
}
