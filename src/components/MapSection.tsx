import React from 'react';

const MapSection: React.FC = () => (
  <section className="map-section" id="s-map" data-screen-label="04 Ubicación">
    <div className="section-head reveal">
      <div className="section-num">/ 01</div>
      <h2 className="section-title">Dónde</h2>
      <div className="section-rule" />
    </div>

    <div className="map-grid">
      {/* ── Info ── */}
      <div className="map-info reveal">
        <div className="venue-name">Hotel del Centro</div>
        <div className="venue-addr">
          RN158 38<br />
          X5913 Pozo del Molle<br />
          Córdoba, Argentina
        </div>
        <div className="venue-coords">RUTA NACIONAL 158 · KM 38</div>
        <div className="venue-actions">
          <a
            className="btn-primary"
            href="https://maps.app.goo.gl/M6uQbXW9ejmuU9sH7"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Abrir en Maps</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4h8v8M4 12L12 4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </a>
          <a
            className="btn-ghost"
            href="https://www.google.com/maps/dir/?api=1&destination=Hotel+del+Centro+RN158+38+Pozo+del+Molle+Cordoba"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cómo llegar
          </a>
        </div>
      </div>

      {/* ── Map frame ── */}
      <div className="map-frame reveal">
        <div className="map-bezel">
          <div className="map-topbar">
            <span className="map-dot" />
            <span className="map-dot" />
            <span className="map-dot" />
            <span className="map-url">maps · RN158 38 · Pozo del Molle</span>
          </div>
          <div className="map-canvas">
            <iframe
              src="https://www.google.com/maps?q=Hotel%20del%20Centro%20RN158%2038%20Pozo%20del%20Molle%20C%C3%B3rdoba&z=16&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Mapa Hotel del Centro · Pozo del Molle"
            />
            <div className="map-pin" aria-hidden="true">
              <div className="pin-pulse" />
              <div className="pin-pulse pin-pulse-2" />
              <svg className="pin-svg" width="44" height="54" viewBox="0 0 44 54">
                <path
                  d="M22 2 C10 2, 2 11, 2 22 C2 36, 22 52, 22 52 C22 52, 42 36, 42 22 C42 11, 34 2, 22 2 Z"
                  fill="#d91339"
                  stroke="#3a0410"
                  strokeWidth="1.5"
                />
                <circle cx="22" cy="21" r="7" fill="#f5e9d4" />
                <text
                  x="22"
                  y="25"
                  textAnchor="middle"
                  fontFamily="Cormorant Garamond"
                  fontSize="11"
                  fontWeight="700"
                  fill="#d91339"
                >
                  VC
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default MapSection;
