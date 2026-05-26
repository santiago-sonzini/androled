import React, { useRef } from 'react';
import Countdown from './Countdown';
import { useThreeMorphAnimation } from '../hooks/useThreeMorphAnimation';

const HeroSection: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Mount Three.js canvas into this section's container div
  useThreeMorphAnimation(canvasContainerRef);

  return (
    <section className="hero" id="s-hero" data-screen-label="01 Hero">
      {/* Three.js renderer mounts here — canvas is inserted as a fixed child */}
      <div ref={canvasContainerRef} aria-hidden="true" />

      <div className="hero-inner">
        <div className="hero-topline">
          <span className="dot-pulse" />
          <span>SAVE · THE · DATE</span>
          <span className="dot-pulse" />
        </div>

        {/* The monogram is rendered by the Three.js canvas — this reserves layout space */}
        <div className="hero-stage" id="hero-stage" aria-label="Monograma VC" />

        <div className="countdown-wrap">
          <Countdown />
        </div>

        <div className="hero-date">
          <span>SÁBADO</span>
          <span className="hero-date-big">30 · 05 · 2026</span>
          <span>21:00 HS · ARG</span>
        </div>

        <div className="scroll-hint">
          <span>DESLIZAR</span>
          <svg width="14" height="40" viewBox="0 0 14 40" fill="none">
            <line x1="7" y1="0" x2="7" y2="32" stroke="currentColor" strokeWidth="1" />
            <path d="M2 28 L7 34 L12 28" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
