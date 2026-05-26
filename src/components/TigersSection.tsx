import React from 'react';

const TICKER_TEXT = 'VCXV · VIRGINIA · FIFTEEN ·';
const TICKER_TEXT_BOTTOM = '· 30.05.2026 · POZO DEL MOLLE · CÓRDOBA';

const TigersSection: React.FC = () => (
  <section className="tigers-panel" id="s-tigers" data-screen-label="03 Tigers">
    <div className="tigers-ticker" aria-hidden="true">
      <div className="ticker-track">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i}>{TICKER_TEXT}</span>
        ))}
      </div>
    </div>

    <img
      className="tigers-img reveal"
      src="assets/tigers-red.png"
      alt="Emblema VCXV con tigres"
    />

    <div className="tigers-ticker tigers-ticker-bottom" aria-hidden="true">
      <div className="ticker-track ticker-reverse">
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i}>{TICKER_TEXT_BOTTOM}</span>
        ))}
      </div>
    </div>
  </section>
);

export default TigersSection;
