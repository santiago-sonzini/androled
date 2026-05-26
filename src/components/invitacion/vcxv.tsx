"use client";
import '@/app/styles.css';
import React from 'react';
import HeroSection    from '@/components/HeroSection';
import EmblemSection  from '@/components/EmblemSection';
import TigersSection  from '@/components/TigersSection';
import MapSection     from '@/components/MapSection';
import PantherSection from '@/components/PantherSection';
import RSVPForm from '@/components/forms/confirm-asistance';
import { Toaster } from '../ui/toaster';


const Invite = ({event_id}: {event_id: string}) => {
    return (
      <>
      {/* ── Fixed grain overlay ── */}
      <div className="grain" aria-hidden="true" />
  
      {/* ── Chrome labels ── */}
      <aside className="chrome chrome-left" aria-hidden="true">
        <span className="chrome-text">VCXV · VIRGINIA · QUINCE</span>
      </aside>
      <aside className="chrome chrome-right" aria-hidden="true">
        <span className="chrome-text">30 · MAYO · 2026 · POZO DEL MOLLE</span>
      </aside>
      <Toaster />
  
      {/* ── Sections ── */}
      <HeroSection />
      <EmblemSection />
      <TigersSection />
      <MapSection />
      <PantherSection />
      <RSVPForm event_id={event_id}  />
  
      {/* ── Footer ── */}
      <footer className="foot" id="s-foot" data-screen-label="07 Footer">
        <div className="foot-meta">
          Diseño x CASTELLANO PH &nbsp;·&nbsp; Hecho con ♡ para Vir
        </div>
      </footer>
    </>
    );
};

export default Invite;
