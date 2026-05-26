'use client'

import { useState, useRef, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'
import {
  ChevronDown, TrendingUp, AlertCircle, Navigation,
  BarChart3, Eye, MapPin
} from 'lucide-react'

// ✅ ScrollReveal corregido
export function ScrollReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      {children}
    </div>
  )
}

// ✅ Datos
const eficienciaData = [
  { mes: 'Ene', eficiencia: 65, target: 75 },
  { mes: 'Feb', eficiencia: 72, target: 78 },
  { mes: 'Mar', eficiencia: 78, target: 82 },
  { mes: 'Abr', eficiencia: 85, target: 86 },
  { mes: 'May', eficiencia: 88, target: 89 },
  { mes: 'Jun', eficiencia: 92, target: 92 }
]

const costosData = [
  { categoria: 'Sin optimización', costo: 850000 },
  { categoria: 'Con NomosDelta', costo: 765000 }
]

const distribucionCostos = [
  { name: 'Combustible', value: 45 },
  { name: 'Mantenimiento', value: 25 },
  { name: 'Tiempos muertos', value: 18 },
  { name: 'Personal', value: 12 }
]

const utilizacionFlota = [
  { hora: '00:00', util: 20 },
  { hora: '04:00', util: 15 },
  { hora: '08:00', util: 65 },
  { hora: '12:00', util: 85 },
  { hora: '16:00', util: 78 },
  { hora: '20:00', util: 45 },
  { hora: '23:59', util: 25 }
]

const COLORS = ['#0369a1', '#0ea5e9', '#06b6d4', '#14b8a6']

// ✅ Ejemplo simple de uso en tus secciones
export default function NomosDeltaLanding() {
  return (
    <div className="min-h-screen bg-white">
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-16 text-center">
            Resultados comprobados
          </h2>

          {/* Gráfico 1: Eficiencia */}
          <ScrollReveal>
            <div className="bg-white rounded-lg shadow-md p-8 mb-12">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                Aumento de Eficiencia Operativa
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={eficienciaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="eficiencia"
                    stroke="#0369a1"
                    strokeWidth={3}
                    dot={{ fill: '#0369a1', r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#06b6d4"
                    strokeDasharray="5 5"
                    dot={{ fill: '#06b6d4', r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ScrollReveal>

          {/* Gráfico 2: Distribución */}
          <ScrollReveal delay={200}>
            <div className="bg-white rounded-lg shadow-md p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                Distribución de Costos
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={distribucionCostos}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {distribucionCostos.map((entry, idx) => (
                      <Cell key={idx} fill={COLORS[idx]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}
