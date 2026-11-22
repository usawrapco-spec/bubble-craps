import type { ReactNode } from "react";
import type { Face } from "../game/types";

export function Avatar({ face, size }: { face: Face; size: number }): ReactNode {
  const longHair = face.style === "long" || face.style === "curly";
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <circle cx="32" cy="32" r="32" fill="#1d1a2a" />
      {longHair ? <ellipse cx="32" cy="35" rx="18" ry="21" fill={face.hair} /> : null}
      <path d="M6 64 C8 50 20 45 32 45 C44 45 56 50 58 64 Z" fill={face.shirt} />
      <ellipse cx="32" cy="29" rx="12.5" ry="14.5" fill={face.skin} />
      {face.style === "short" ? <path d="M19.5 27 C18 12 46 12 44.5 27 C43 20 38 17 32 17 C26 17 21 20 19.5 27 Z" fill={face.hair} /> : null}
      {face.style === "cap" ? <path d="M18.5 24 C18.5 10 45.5 10 45.5 24 Z M30 21 L53 21 Q53 26 46 26 L30 26 Z" fill={face.hair} /> : null}
      {face.style === "slick" ? <path d="M19.5 27 C19 13 45 11 44.5 27 C40 18 30 16 19.5 27 Z" fill={face.hair} /> : null}
      {face.style === "long" ? <path d="M19 30 C17 12 47 12 45 30 C42 20 36 18 32 18 C27 18 22 21 19 30 Z" fill={face.hair} /> : null}
      {face.style === "curly"
        ? [[19, 25], [23, 17], [32, 13], [41, 17], [45, 25], [27, 15], [37, 15]].map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="6" fill={face.hair} />)
        : null}
      <circle cx="27" cy="29" r="1.7" fill="#1b1b1b" />
      <circle cx="37" cy="29" r="1.7" fill="#1b1b1b" />
      {face.shades ? <path d="M21 26 L43 26 L42 31 Q38 34 34 31 L32 29 L30 31 Q26 34 22 31 Z" fill="#0c0c0c" /> : null}
      <path d="M27.5 36 Q32 39.5 36.5 36" stroke={face.lips || "#6e3a2c"} strokeWidth={face.lips ? 2.2 : 1.5} fill="none" strokeLinecap="round" />
    </svg>
  );
}
