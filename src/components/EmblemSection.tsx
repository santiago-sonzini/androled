import React from 'react';

const EmblemSection: React.FC = () => (
  <section className="emblem" id="s-emblem" data-screen-label="02 Emblema">
    <div className="emblem-wrap reveal">
      <div className="emblem-kicker">— CAPÍTULO UNO —</div>

      <img
        className="emblem-mark"
        src="assets/fifteen-dark.png"
        alt="FIFTEEN · VCXV"
      />

      <p className="emblem-body">
        La noche del <em>treinta de mayo</em> marcará el paso del tiempo.
        Un acto breve, contado en rubíes y números romanos.
      </p>

      <div className="emblem-meta" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ borderBottom: '0px solid var(--line)' }}>
          <span className="m-k">cuándo</span>
          <span className="m-v">30 · Mayo · 21:00 hs</span>
        </div>
        <div>
          <span className="m-k">dress code</span>
          <span className="m-v">Elegante · Sin azul, plateado ni rojo</span>
        </div>
      </div>
    </div>
  </section>
);

export default EmblemSection;
