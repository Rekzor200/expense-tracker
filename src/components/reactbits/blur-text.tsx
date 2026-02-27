import { useEffect, useState } from "react";

interface BlurTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export function BlurText({ text, className = "", delay = 0 }: BlurTextProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <span
      className={className}
      style={{
        filter: revealed ? "blur(0px)" : "blur(8px)",
        opacity: revealed ? 1 : 0,
        transition: "filter 600ms ease-out, opacity 600ms ease-out",
      }}
    >
      {text}
    </span>
  );
}
