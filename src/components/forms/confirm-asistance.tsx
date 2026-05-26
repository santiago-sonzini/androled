"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "../ui/use-toast";
import { LoadingSpinner } from "@/components/loading";
import { create_guests, sendAttendeeConfirmationEmail } from "@/app/actions/guests";

// ── Types ─────────────────────────────────────────────────────────────────────
type DietKey = "none" | "veg" | "vgn" | "cel" | "oth";
type AttendValue = "yes" | "no";

const DIET_LABELS: Record<DietKey, string> = {
  none: "Sin restricción",
  veg:  "Vegetariana",
  vgn:  "Vegana",
  cel:  "Celíaca",
  oth:  "Otra",
};
const DIET_OPTIONS = Object.entries(DIET_LABELS) as [DietKey, string][];

const MAX_COMPANIONS = 5;

// ── Schema ────────────────────────────────────────────────────────────────────
const CompanionSchema = z.object({
  name:                   z.string().min(1, "El nombre es requerido."),
  diet:                   z.enum(["none","veg","vgn","cel","oth"]).default("none"),
  dietRestrictionComment: z.string().optional(),
});

export const RSVPFormSchema = z
  .object({
    attend:                 z.enum(["yes", "no"]),
    name:                   z.string(),
    email:                  z.string(),
    phone:                  z.string(),
    diet:                   z.enum(["none","veg","vgn","cel","oth"]).optional(),
    dietRestrictionComment: z.string().optional(),
    companions:             z.array(CompanionSchema).optional(),
    comments:               z.string().optional(),
  })
  .superRefine((data, ctx) => {

    if (!data.name || data.name.trim().length === 0) {
      ctx.addIssue({ path: ["name"], message: "El nombre es requerido.", code: z.ZodIssueCode.custom });
    }

    if (data.attend === "no") return;

    if (!data.email) {
      ctx.addIssue({ path: ["email"], message: "El email es requerido.", code: z.ZodIssueCode.custom });
    } else {
      const result = z.string().email({ message: "Ingresa un correo válido." }).safeParse(data.email.trim());
      if (!result.success) ctx.addIssue({ path: ["email"], message: result.error.message, code: z.ZodIssueCode.custom });
    }

    if (!data.phone) {
      ctx.addIssue({ path: ["phone"], message: "El teléfono es requerido.", code: z.ZodIssueCode.custom });
    } else {
      const result = z.string().regex(/^[\+]?[0-9\s\-\(\)]{10,}$/, { message: "Ingresa un teléfono válido." }).safeParse(data.phone);
      if (!result.success) ctx.addIssue({ path: ["phone"], message: result.error.message, code: z.ZodIssueCode.custom });
    }
  });

// ── Tokens ────────────────────────────────────────────────────────────────────
const T = {
  red:      "#d91339",
  redBright:"#ff3556",
  cream:    "#f5e9d4",
  line:     "rgba(245,233,212,0.15)",
  sans:     "'JetBrains Mono', monospace",
  serif:    "'Cormorant Garamond', Georgia, serif",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, letterSpacing: "0.3em",
  color: T.red, fontFamily: T.sans, textTransform: "uppercase", marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  background: "transparent", border: "none", borderBottom: `1px solid ${T.line}`,
  padding: "12px 0", color: T.cream, fontSize: 20, fontFamily: T.serif,
  fontStyle: "italic", width: "100%", outline: "none",
  transition: "border-color 0.2s", borderRadius: 0,
};

const errorStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: "0.15em", color: T.redBright, fontFamily: T.sans, marginTop: 4,
};

const dividerStyle: React.CSSProperties = {
  border: "none", borderTop: `1px solid ${T.line}`, margin: "1.5rem 0",
};

const fieldStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.5rem",
};

// ── Radio chip ────────────────────────────────────────────────────────────────
function RadioChip({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: "pointer", display: "inline-flex", alignItems: "center",
        padding: "10px 16px", border: `1px solid ${checked ? T.red : T.line}`,
        fontFamily: T.serif, fontSize: 18, fontStyle: "italic",
        color: T.cream, background: checked ? T.red : "transparent",
        transition: "all 0.2s",
      }}
    >
      {children}
    </button>
  );
}

// ── Select estilizado ─────────────────────────────────────────────────────────
function StyledSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        ...inputStyle,
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1L6 6L11 1' stroke='%23d91339' stroke-width='1.4' fill='none'/></svg>")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 4px center",
        paddingRight: 20,
        cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}

// ── Counter +/- ───────────────────────────────────────────────────────────────
function CompanionCounter({
  count,
  onAdd,
  onRemove,
}: {
  count: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const btnBase: React.CSSProperties = {
    width: 36, height: 36,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: `1px solid ${T.line}`,
    background: "transparent", color: T.cream,
    fontFamily: T.sans, fontSize: 18, lineHeight: 1,
    cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
      <button
        type="button"
        onClick={onRemove}
        disabled={count === 0}
        style={{
          ...btnBase,
          opacity: count === 0 ? 0.3 : 1,
          cursor: count === 0 ? "not-allowed" : "pointer",
        }}
        onMouseEnter={e => { if (count > 0) (e.currentTarget as HTMLButtonElement).style.borderColor = T.red; }}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = T.line}
      >
        −
      </button>

      <div style={{
        minWidth: 48, textAlign: "center",
        fontFamily: T.serif, fontSize: 28, fontStyle: "italic", color: T.cream,
      }}>
        {count}
      </div>

      <button
        type="button"
        onClick={onAdd}
        disabled={count >= MAX_COMPANIONS}
        style={{
          ...btnBase,
          opacity: count >= MAX_COMPANIONS ? 0.3 : 1,
          cursor: count >= MAX_COMPANIONS ? "not-allowed" : "pointer",
        }}
        onMouseEnter={e => { if (count < MAX_COMPANIONS) (e.currentTarget as HTMLButtonElement).style.borderColor = T.red; }}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = T.line}
      >
        +
      </button>

      {count > 0 && (
        <span style={{ fontFamily: T.sans, fontSize: 10, letterSpacing: "0.25em", color: "rgba(245,233,212,0.5)", textTransform: "uppercase" }}>
          {count === 1 ? "1 acompañante" : `${count} acompañantes`}
        </span>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RSVPForm({ event_id }: { event_id: string }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(RSVPFormSchema),
    defaultValues: {
      attend:                 "yes" as AttendValue,
      name:                   "",
      email:                  "",
      phone:                  "",
      diet:                   "none" as DietKey,
      dietRestrictionComment: "",
      companions:             [] as { name: string; diet: DietKey; dietRestrictionComment?: string }[],
      comments:               "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "companions",
  });

  const attend = form.watch("attend");
  const diet   = form.watch("diet");

  const handleAddCompanion = () => {
    if (fields.length < MAX_COMPANIONS) {
      append({ name: "", diet: "none", dietRestrictionComment: "" });
    }
  };

  const handleRemoveCompanion = () => {
    if (fields.length > 0) {
      remove(fields.length - 1);
    }
  };

  const handleSubmit = async (data: z.infer<typeof RSVPFormSchema>) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        diet: data.diet,
        dietRestrictionComment: data.diet === "oth" ? data.dietRestrictionComment : undefined,
        companions: (data.companions ?? []).map(c => ({
          name: c.name,
          diet: c.diet,
          dietRestrictionComment: c.diet === "oth" ? c.dietRestrictionComment : undefined,
        })),
      };

      const res = await create_guests({ guests_info: payload, event_id });
      if (res.status === 200) {
        if (data.attend === "yes") {
          const msg = await sendAttendeeConfirmationEmail(res.data, "cmoc7axa50000ssna3axq0i0e");
          toast({ title: "¡Gracias por confirmar su asistencia!", description: msg });
          setMessage("¡Gracias por confirmar su asistencia!");
          setTimeout(() => setMessage(""), 15000);
          form.reset();
        } else {
          toast({ title: "Gracias por enviar tu respuesta", description: "" });
          setMessage("Lamentamos que no asistas");
          setTimeout(() => setMessage(""), 15000);
        }
      } else {
        setMessage("Error al confirmar su asistencia");
        toast({ title: "Error al confirmar su asistencia", description: "Por favor, inténtelo de nuevo.", variant: "destructive" });
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: T.serif }}>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.4em", color: T.red, fontFamily: T.sans, textTransform: "uppercase", marginBottom: "0.5rem" }}>
          / 03
        </div>
        <h2 style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: "clamp(36px,5vw,72px)", fontWeight: 500, color: T.cream, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: "0.75rem" }}>
          Confirmá tu asistencia
        </h2>
        <div style={{ width: "100%", height: 1, background: T.line, marginBottom: "1rem" }} />
        <p style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: T.serif, fontSize: 20, color: T.cream, flexWrap: "wrap" }}>
          <span style={{ display: "inline-block", fontFamily: T.sans, fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", padding: "5px 10px", background: T.red, color: T.cream }}>
            DEADLINE
          </span>
          Confirmación hasta el <strong style={{ color: T.redBright }}>20 · 05 · 2026</strong>
        </p>
      </div>

      {/* Card */}
      <div style={{ background: "rgba(10,1,3,0.88)", backdropFilter: "blur(12px)", border: `1px solid ${T.line}`, borderRadius: 4, padding: "clamp(20px,4vw,40px)" }}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>

            {/* ── ¿Asistís? ── */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={labelStyle}>¿Asistís?</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                <RadioChip checked={attend === "yes"} onClick={() => form.setValue("attend", "yes")}>
                  Sí, cuenten conmigo
                </RadioChip>
                <RadioChip checked={attend === "no"} onClick={() => form.setValue("attend", "no")}>
                  No podré ir
                </RadioChip>
              </div>
            </div>

            <>
              <hr style={dividerStyle} />

              {/* ── Nombre ── */}
              <div style={fieldStyle}>
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>Nombre y apellido <span style={{ color: T.redBright }}>*</span></FormLabel>
                    <FormControl><Input style={inputStyle} placeholder="Ej. María García" {...field} /></FormControl>
                    <FormMessage style={errorStyle} />
                  </FormItem>
                )} />
              </div>

              {/* ── Email + Teléfono ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginBottom: "1.5rem" }}>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>Email <span style={{ color: T.redBright }}>*</span></FormLabel>
                    <FormControl><Input style={inputStyle} type="email" placeholder="tucorreo@ejemplo.com" {...field} /></FormControl>
                    <FormMessage style={errorStyle} />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>Celular <span style={{ color: T.redBright }}>*</span></FormLabel>
                    <FormControl><Input style={inputStyle} type="tel" placeholder="+54 9 ..." {...field} /></FormControl>
                    <FormMessage style={errorStyle} />
                  </FormItem>
                )} />
              </div>

              {attend === "yes" && (
                <>
                  {/* ── Restricción alimentaria del titular ── */}
                  <div style={fieldStyle}>
                    <FormField control={form.control} name="diet" render={({ field }) => (
                      <FormItem>
                        <FormLabel style={labelStyle}>Restricción alimentaria</FormLabel>
                        <FormControl>
                          <StyledSelect value={field.value ?? "none"} onChange={field.onChange}>
                            {DIET_OPTIONS.map(([val, label]) => (
                              <option key={val} value={val} style={{ background: "#150509", color: T.cream }}>{label}</option>
                            ))}
                          </StyledSelect>
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {diet === "oth" && (
                    <div style={fieldStyle}>
                      <FormField control={form.control} name="dietRestrictionComment" render={({ field }) => (
                        <FormItem>
                          <FormLabel style={labelStyle}>Detalle su restricción o alergia</FormLabel>
                          <FormControl>
                            <Textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} {...field} />
                          </FormControl>
                          <FormMessage style={errorStyle} />
                        </FormItem>
                      )} />
                    </div>
                  )}

                  <hr style={dividerStyle} />

                  {/* ── Acompañantes ── */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div style={labelStyle}>Acompañantes</div>
                    <CompanionCounter
                      count={fields.length}
                      onAdd={handleAddCompanion}
                      onRemove={handleRemoveCompanion}
                    />
                  </div>

                  {/* ── Campos dinámicos por acompañante ── */}
                  {fields.map((field, index) => {
                    const companionDiet = form.watch(`companions.${index}.diet`);
                    return (
                      <div
                        key={field.id}
                        style={{
                          padding: "20px 20px 4px",
                          border: `1px solid ${T.line}`,
                          marginBottom: "1rem",
                          position: "relative",
                        }}
                      >
                        {/* Etiqueta de índice */}
                        <div style={{
                          position: "absolute", top: -11, left: 16,
                          background: "#0a0103",
                          padding: "0 8px",
                          fontFamily: T.sans, fontSize: 10, letterSpacing: "0.3em",
                          color: T.red, textTransform: "uppercase",
                        }}>
                          Acompañante {index + 1}
                        </div>

                        {/* Botón quitar este acompañante */}
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          style={{
                            position: "absolute", top: -11, right: 12,
                            background: "#0a0103",
                            padding: "0 8px",
                            fontFamily: T.sans, fontSize: 10, letterSpacing: "0.25em",
                            color: "rgba(245,233,212,0.35)", border: "none",
                            cursor: "pointer", textTransform: "uppercase",
                            transition: "color 0.2s",
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = T.redBright}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "rgba(245,233,212,0.35)"}
                        >
                          ✕ quitar
                        </button>

                        {/* Nombre */}
                        <div style={fieldStyle}>
                          <FormField
                            control={form.control}
                            name={`companions.${index}.name`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormLabel style={labelStyle}>Nombre y apellido <span style={{ color: T.redBright }}>*</span></FormLabel>
                                <FormControl><Input style={inputStyle} placeholder="Ej. Juan Pérez" {...f} /></FormControl>
                                <FormMessage style={errorStyle} />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Dieta */}
                        <div style={fieldStyle}>
                          <FormField
                            control={form.control}
                            name={`companions.${index}.diet`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormLabel style={labelStyle}>Restricción alimentaria</FormLabel>
                                <FormControl>
                                  <StyledSelect value={f.value ?? "none"} onChange={f.onChange}>
                                    {DIET_OPTIONS.map(([val, label]) => (
                                      <option key={val} value={val} style={{ background: "#150509", color: T.cream }}>{label}</option>
                                    ))}
                                  </StyledSelect>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Detalle dieta "Otra" */}
                        {companionDiet === "oth" && (
                          <div style={fieldStyle}>
                            <FormField
                              control={form.control}
                              name={`companions.${index}.dietRestrictionComment`}
                              render={({ field: f }) => (
                                <FormItem>
                                  <FormLabel style={labelStyle}>Detalle la restricción o alergia</FormLabel>
                                  <FormControl>
                                    <Textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} {...f} />
                                  </FormControl>
                                  <FormMessage style={errorStyle} />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Hint máx */}
                  {fields.length >= MAX_COMPANIONS && (
                    <p style={{ fontFamily: T.sans, fontSize: 10, letterSpacing: "0.2em", color: "rgba(245,233,212,0.4)", marginBottom: "1rem" }}>
                      Máximo {MAX_COMPANIONS} acompañantes
                    </p>
                  )}
                </>
              )}
            </>

            <hr style={dividerStyle} />

            {/* ── Comentarios ── */}
            <div style={fieldStyle}>
              <FormField control={form.control} name="comments" render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>
                    Mensaje para Vir{" "}
                    <span style={{ color: "rgba(245,233,212,0.4)", fontSize: 9, textTransform: "none", letterSpacing: "1px" }}>(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} maxLength={280} {...field} />
                  </FormControl>
                  <div style={{ fontFamily: T.sans, fontSize: 10, letterSpacing: "0.2em", color: "rgba(245,233,212,0.4)", marginTop: 4, textAlign: "right" }}>
                    {(field.value ?? "").length} / 280
                  </div>
                  <FormMessage style={errorStyle} />
                </FormItem>
              )} />
            </div>

            {/* ── Submit ── */}
            <div style={{ paddingTop: "1.5rem", borderTop: `1px solid ${T.line}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <button
                disabled={loading || message.trim() !== ""}
                type="submit"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 14,
                  padding: "20px 40px",
                  background: loading || message.trim() ? "rgba(217,19,57,0.5)" : T.red,
                  color: T.cream, border: "none",
                  cursor: loading || message.trim() !== "" ? "not-allowed" : "pointer",
                  fontFamily: T.sans, fontSize: 12, letterSpacing: "0.35em", textTransform: "uppercase",
                  transition: "all 0.25s", width: "100%", justifyContent: "center",
                }}
                onMouseEnter={e => { if (!loading && !message.trim()) (e.currentTarget as HTMLButtonElement).style.background = T.redBright; }}
                onMouseLeave={e => { if (!loading && !message.trim()) (e.currentTarget as HTMLButtonElement).style.background = T.red; }}
              >
                {loading ? <LoadingSpinner /> : message.trim() ? message : (
                  <>
                    <span>Enviar confirmación</span>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 10H17 M12 5L17 10L12 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
            </div>

          </form>
        </Form>
      </div>
    </div>
  );
}