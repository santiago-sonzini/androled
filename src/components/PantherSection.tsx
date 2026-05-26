import React from 'react';

const PantherSection: React.FC = () => (
  <section className="panther-section" id="s-panther" data-screen-label="05 Pantera">
    <div className="panther-head reveal">
      <div className="section-num">/ 02</div>
      <h2 className="section-title">Quién</h2>
      <div className="section-rule" />
    </div>

    <div className="panther-stage">
      <div className="panther-frame reveal">
        <img src="assets/vir-panther.jpeg" alt="Virginia con pantera negra" />
        <div className="panther-overlay">
          <div className="panther-tag">VC · XV</div>
        </div>
      </div>

      <aside className="panther-text reveal">
        <div className="ps-kicker">— RETRATO —</div>
        <blockquote>
          "Quince años no se cumplen. <br /> Se conquistan."
        </blockquote>
        <div className="ps-sign">— Vir</div>
        <div className="ps-meta">
          <span>Shot by Castellano PH</span>
          <span>·</span>
          <span>Villa María · 2026</span>
        </div>
      </aside>
    </div>
  </section>
);

export default PantherSection;
