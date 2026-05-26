import { Guest } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import React from "react";

type Props = {
  guests: Guest[];
};

function capitalizeName(name: string) {
  return name
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Agrupa por inicial del guest principal
const groupByInitial = (guests: Guest[]): Record<string, Guest[]> => {
  return guests
    .filter((g) => g.isMainGuest)
    .reduce((acc, guest) => {
      const initial = guest.name?.charAt(0).toUpperCase() ?? "#";
      if (!acc[initial]) acc[initial] = [];
      acc[initial].push(guest);
      return acc;
    }, {} as Record<string, Guest[]>);
};

const baseStyle = `
  body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
  .section-letter { font-size: 24px; font-weight: bold; border-bottom: 2px solid #000; margin-top: 40px; margin-bottom: 20px; }
  .table-header { display: flex; font-weight: 600; font-size: 14px; border-bottom: 1px solid #333; margin-bottom: 10px; }
  .col-name { flex: 1; }
  .col-email { flex: 1; }
  .col-phone { width: 170px; }
  .guest-row { display: flex; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #ddd; align-items: flex-start; }
  .guest-name { font-weight: 600; font-size: 14px; }
  .guest-meta { font-size: 12px; color: #555; margin-top: 2px; }
  .restrictions { color: #e91e63; font-style: italic; font-size: 12px; margin-top: 2px; }
  .companion-list { margin-top: 6px; padding-left: 14px; border-left: 2px solid #eee; }
  .companion-row { font-size: 12px; color: #444; padding: 3px 0; display: flex; gap: 8px; align-items: baseline; }
  .companion-name { font-weight: 500; }
  .companion-diet { color: #e91e63; font-style: italic; }
  @media print {
    .footer-container { page-break-before: always; break-before: page; }
    .footer {
      width: 100vw; height: 95vh;
      display: flex; justify-content: center; align-items: center; flex-direction: column;
    }
  }
`;

const footerPage = `
  <div class="footer-container">
    <div class="footer">
      <img src="/img/all/logo-inverted.png" alt="Logo" style="height:80px;margin-bottom:20px;" />
      <div style="display:flex;align-items:center;gap:10px;font-size:18px;">
        <img src="/img/all/instagram-inverted.png" alt="Instagram" style="height:24px;" />
        <a href="https://instagram.com/castellano.ph" style="color:#000;text-decoration:none;">@castellano.ph</a>
      </div>
    </div>
  </div>
`;

function openPrintWindow(html: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 500);
  };
}

function buildSectionsHtml(guests: Guest[]): string {
  const mainGuests = guests.filter((g) => g.isMainGuest);
  const companions = guests.filter((g) => !g.isMainGuest);

  // Map: nombre del principal → sus acompañantes
  const companionsByMain = companions.reduce((acc, c) => {
    if (!c.goesWith) return acc;
    if (!acc[c.goesWith]) acc[c.goesWith] = [];
    acc[c.goesWith]?.push(c);
    return acc;
  }, {} as Record<string, Guest[]>);

  const grouped = groupByInitial(mainGuests);

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, guestList]) => {
      const rowsHtml = guestList
        .map((guest) => {
          const myCompanions = companionsByMain[guest.name] ?? [];

          const dietHtml =
            guest.hasDietRestriction && guest.dietRestrictionComment
              ? `<div class="restrictions">${guest.dietRestrictionComment}</div>`
              : "";

          const commentsHtml = guest.comments
            ? `<div class="guest-meta">"${guest.comments}"</div>`
            : "";

          const companionsHtml =
            myCompanions.length > 0
              ? `<div class="companion-list">
                  ${myCompanions
                    .map(
                      (c) => `
                    <div class="companion-row">
                      <span class="companion-name">+&nbsp;${capitalizeName(c.name)}</span>
                      ${c.hasDietRestriction && c.dietRestrictionComment
                        ? `<span class="companion-diet">${c.dietRestrictionComment}</span>`
                        : ""}
                    </div>`
                    )
                    .join("")}
                </div>`
              : "";

          const totalBadge =
            myCompanions.length > 0
              ? `<span style="font-weight:400; font-size:12px; color:#888;"> · +${myCompanions.length}</span>`
              : "";

          return `
            <div class="guest-row">
              <div class="col-name">
                <div class="guest-name">${capitalizeName(guest.name)}${totalBadge}</div>
                ${dietHtml}
                ${companionsHtml}
                ${commentsHtml}
              </div>
              <div class="col-email">${guest.email ?? ""}</div>
              <div class="col-phone">${guest.phone ?? ""}</div>
            </div>
          `;
        })
        .join("");

      return `
        <div class="section-letter">${letter}</div>
        <div class="table-header">
          <div class="col-name">Nombre</div>
          <div class="col-email">Email</div>
          <div class="col-phone">Celular</div>
        </div>
        ${rowsHtml}
      `;
    })
    .join("");
}

export const GuestListPrintable: React.FC<Props> = ({ guests }) => {
  const print = () => {
    openPrintWindow(`
      <html>
        <head><title>Lista de Invitados</title><style>${baseStyle}</style></head>
        <body>${buildSectionsHtml(guests)}${footerPage}</body>
      </html>
    `);
  };

  return (
    <Button onClick={print} className="text-pretty">
      <Download className="h-4 w-4" />
    </Button>
  );
};

export const GuestListPrintableEmma: React.FC<Props> = ({ guests }) => {
  const print = () => {
    openPrintWindow(`
      <html>
        <head><title>Lista de Invitados</title><style>${baseStyle}</style></head>
        <body>${buildSectionsHtml(guests)}${footerPage}</body>
      </html>
    `);
  };

  return (
    <Button onClick={print}>
      <Download className="h-4 w-4" />
    </Button>
  );
};