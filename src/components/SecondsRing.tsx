import React, { useRef, useEffect } from 'react';

interface Props {
  seconds: number;
}

const R      = 42;
const TOTAL  = 60;
const RADIUS_MAJOR = 2.4;
const RADIUS_MINOR = 1.4;

const DOT_ANGLES = Array.from({ length: TOTAL }, (_, i) => ({
  cx: (Math.cos((i / TOTAL) * Math.PI * 2 - Math.PI / 2) * R).toFixed(2),
  cy: (Math.sin((i / TOTAL) * Math.PI * 2 - Math.PI / 2) * R).toFixed(2),
  r:  i % 5 === 0 ? RADIUS_MAJOR : RADIUS_MINOR,
}));

const SecondsRing: React.FC<Props> = ({ seconds }) => {
  const circlesRef = useRef<SVGCircleElement[]>([]);
  const textRef    = useRef<SVGTextElement>(null);

  useEffect(() => {
    if (textRef.current) {
      textRef.current.textContent = String(seconds).padStart(2, '0');
    }
    circlesRef.current.forEach((el, i) => {
      if (!el) return;
      el.classList.remove('on', 'lead');
      if (i < seconds) el.classList.add('on');
      if (i === seconds) el.classList.add('lead');
    });
  }, [seconds]);

  return (
    <div className="sec-ring" id="sec-ring">
      <svg viewBox="-50 -50 100 100" width="100%" height="100%">
        <g id="sec-dots">
          {DOT_ANGLES.map((dot, i) => (
            <circle
              key={i}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              className="sec-tick"
              ref={el => {
                if (el) circlesRef.current[i] = el;
              }}
            />
          ))}
        </g>
        <text
          x="0"
          y="4"
          textAnchor="middle"
          className="sec-num"
          id="sec-num"
          ref={textRef}
        >
          {String(seconds).padStart(2, '0')}
        </text>
      </svg>
    </div>
  );
};

export default SecondsRing;
