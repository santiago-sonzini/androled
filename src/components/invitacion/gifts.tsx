"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Gifts() {
  const [copied, setCopied] = useState<"cbu" | "alias" | null>(null);

  const copyToClipboard = async (
    value: string,
    type: "cbu" | "alias"
  ) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopy(value);
      }
    } catch {
      fallbackCopy(value);
    }
  
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };
  
  const fallbackCopy = (value: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = value;
  
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
  
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
  
    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("Copy failed", err);
    }
  
    document.body.removeChild(textarea);
  };
  

  const CBU = "0200900511000018029958";
  const ALIAS = "BODA.TATU.RODRI";

  return (
    <section className="w-full bg-white py-10 px-6 text-center">
      <div className="max-w-3xl mx-auto space-y-10">
       
        {/* Title */}
        <div className="space-y-3">
          <h3 className="text-2xl md:text-3xl font-serif font-semibold tracking-wide italic">
            Regalos
          </h3>

          <p className="text-sm md:text-base font-sans text-gray-600 leading-relaxed">
            Lo que más nos alegra es compartir este día con ustedes.
            <br />
            Si además desean acompañarnos con un regalo, dejamos aquí nuestra opción:
          </p>
        </div>

        {/* Card */}
        <div className="flex justify-center">
  <Card className="border-none shadow-none">
    <CardContent className="flex flex-col items-center gap-6 px-10 py-8">
      <Separator className="w-40" />

      {/* CBU + Alias */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-16">
        {/* CBU */}
        <div
          className="text-center space-y-2"
        >
          <p className="text-sm font-sans font-medium uppercase tracking-wider text-gray-500">
            CBU
          </p>

          <div className="flex flex-col items-center space-y-2">
            <p className="font-sans tracking-widest text-sm select-all">
              {CBU}
            </p>

            <button
              onClick={() => copyToClipboard(CBU, "cbu")}
              className="text-xs font-sans underline underline-offset-4 opacity-70 hover:opacity-100 transition"
            >
              {copied === "cbu" ? "Copiado ✓" : "Copiar CBU"}
            </button>
          </div>
        </div>

        {/* Alias */}
        <div
          className="text-center space-y-2"
        >
          <p className="text-sm font-sans font-medium uppercase tracking-wider text-gray-500">
            Alias
          </p>

          <div className="flex flex-col items-center space-y-2">
            <p className="font-sans tracking-widest text-sm select-all">
              {ALIAS}
            </p>

            <button
              onClick={() => copyToClipboard(ALIAS, "alias")}
              className="text-xs font-sans underline underline-offset-4 opacity-70 p-2 hover:opacity-100 transition"
            >
              {copied === "alias" ? "Copiado ✓" : "Copiar alias"}
            </button>
          </div>
        </div>
      </div>

      <Separator className="w-40" />
    </CardContent>
  </Card>
</div>

      </div>
    </section>
  );
}
