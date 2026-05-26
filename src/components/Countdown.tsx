import React, { useRef, useEffect } from 'react';
import { useCountdown } from '../hooks/useCountdown';
import SecondsRing from './SecondsRing';

type Unit = 'days' | 'hours' | 'minutes';

const UNITS: { key: Unit; label: string; pad: number }[] = [
  { key: 'days',    label: 'días',    pad: 3 },
  { key: 'hours',   label: 'horas',   pad: 2 },
  { key: 'minutes', label: 'minutos', pad: 2 },
];

const Countdown: React.FC = () => {
  const tick = useCountdown(250);
  const refs = useRef<Record<Unit, HTMLDivElement | null>>({
    days:    null,
    hours:   null,
    minutes: null,
  });
  const prevRef = useRef<Record<Unit, number>>({ days: -1, hours: -1, minutes: -1 });
  
  // Trigger tick CSS animation on change
  useEffect(() => {
    if (tick.isFirst) return;
    UNITS.forEach(({ key }) => {
      const cur  = tick[key];
      const prev = prevRef.current[key];
      if (cur !== prev && prev !== -1) {
        const el = refs.current[key];
        if (el) {
          el.classList.remove('tick');
          void el.offsetWidth; // reflow
          el.classList.add('tick');
        }
      }
      prevRef.current[key] = cur;
    });
  }, [tick]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('countdown-beat', {
        detail: { seconds: tick.seconds }
      })
    );
  }, [tick.seconds]);

  

  return (
    <div className="countdown" id="countdown">
      {UNITS.map(({ key, label, pad }, idx) => (
  <React.Fragment key={key}>
    <div className="cd-unit">
      <div
        className="cd-value"
        data-unit={key}
        ref={el => { refs.current[key] = el; }}
      >
        {String(tick[key]).padStart(pad, '0')}
      </div>
      <div className="cd-label">{label}</div>
    </div>

    {idx < UNITS.length - 1 && (
      <div className="cd-sep">·</div>
    )}
  </React.Fragment>
))}

      <div className="cd-unit cd-sec">
        <SecondsRing seconds={tick.seconds} />
        {/* <div className="cd-label">segundos</div> */}
      </div>
    </div>
  );
};

export default Countdown;
