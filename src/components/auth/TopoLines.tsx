/**
 * Decorative topographic contour lines, rendered as a few smooth bezier
 * paths at low opacity. Each line traces a slightly different curve and
 * animates in via stroke-dashoffset so on load they "draw themselves".
 *
 * Pure CSS / SVG; no client component needed.
 */
export function TopoLines() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full text-primary/30"
      viewBox="0 0 1440 900"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="topo-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.25" stopColor="currentColor" stopOpacity="1" />
          <stop offset="0.75" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#topo-fade)"
        strokeWidth="1.15"
        strokeLinecap="round"
      >
        {paths.map((d, i) => (
          <path
            key={d}
            d={d}
            className="topo-line"
            style={{
              strokeDasharray: 4000,
              strokeDashoffset: 4000,
              animation: `topo-draw 2.8s ${i * 120}ms ease-out forwards`,
            }}
          />
        ))}
      </g>
      <style>{`
        @keyframes topo-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}

// Hand-drawn-feeling contours — smooth cubics across the full width.
// Values nudged to vary the amplitude and phase of each line.
const paths = [
  "M-50,180 C220,80 420,260 720,160 S 1180,200 1500,110",
  "M-50,260 C260,140 480,340 780,240 S 1200,280 1500,200",
  "M-50,360 C240,220 520,420 820,340 S 1220,380 1500,300",
  "M-50,460 C260,340 540,520 820,440 S 1240,480 1500,400",
  "M-50,560 C280,440 560,620 860,540 S 1260,580 1500,500",
  "M-50,660 C300,540 580,720 880,640 S 1280,680 1500,600",
  "M-50,760 C320,660 620,820 900,740 S 1300,780 1500,720",
];
