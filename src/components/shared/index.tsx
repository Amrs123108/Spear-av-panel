'use client'
// components/shared/index.tsx
// Componentes UI reutilizables entre vista directivo y admin

import { useState, useEffect } from 'react'
import { Info, AlertTriangle, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { BolsaMinutos, SemaforoCarta, EstadoMes } from '@/types'

// ── Constante de alerta ───────────────────────────────────────────────────────
export const UMBRAL_BOLSA_CRITICO = 2000

// ── Tooltip de advertencia ────────────────────────────────────────────────────
// Usado en métricas estimadas: Cobertura Incremental, Honorario Cruzado, Liberación

interface TooltipProps {
  texto: string
  children: React.ReactNode
}

export function TooltipMetrica({ texto, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <span
        className="cursor-help"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        <Info className="w-3.5 h-3.5 text-slate-400 hover:text-amber-600 transition-colors" />
      </span>
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 px-3 py-2 text-xs leading-relaxed text-white bg-slate-800 rounded shadow-lg whitespace-normal">
          {texto}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  )
}

// Texto estándar para métricas estimadas (requerimiento explícito)
export const TEXTO_METRICA_ESTIMADA = 'Métrica estimada. Refleja la gestión combinada del piso y el AV.'

// ── Banner de alerta de bolsa crítica ────────────────────────────────────────

interface BannerBolsaProps {
  saldo: number
}

export function BannerBolsaCritica({ saldo }: BannerBolsaProps) {
  if (saldo >= UMBRAL_BOLSA_CRITICO) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-6 py-3 flex items-center justify-center gap-3 shadow-lg">
      <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse" />
      <span className="font-semibold text-sm tracking-wide">
        Atención: Saldo operativo crítico. — Quedan {saldo.toLocaleString('es-PA')} minutos disponibles
      </span>
    </div>
  )
}

// ── Componente Bolsa de Minutos ───────────────────────────────────────────────

interface BolsaProps {
  bolsa: BolsaMinutos
  minutosConsumidosMesActual: number
}

export function ComponenteBolsa({ bolsa, minutosConsumidosMesActual }: BolsaProps) {
  const { saldoActual, diaRecarga, cantidadRecarga, historial } = bolsa
  const critico = saldoActual < UMBRAL_BOLSA_CRITICO
  const diaActual = new Date().getDate()
  const diasParaRecarga = diaActual <= diaRecarga ? diaRecarga - diaActual : 30 - diaActual + diaRecarga
  const pctUsado = cantidadRecarga > 0 ? ((cantidadRecarga - saldoActual) / cantidadRecarga) * 100 : 0
  const consumoDiario = minutosConsumidosMesActual > 0 ? minutosConsumidosMesActual / 22 : 0
  const mesesRestantes = consumoDiario > 0 ? saldoActual / (consumoDiario * 22) : 0

  return (
    <div className={`rounded-lg border-2 overflow-hidden transition-colors ${critico ? 'border-red-400 bg-red-50' : 'border-amber-200/40 bg-white'}`}>
      {/* Header */}
      <div className={`px-6 py-4 ${critico ? 'bg-red-600' : 'bg-[#0F2444]'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-[10px] font-bold tracking-widest uppercase ${critico ? 'text-red-200' : 'text-amber-400'}`}>
              Bolsa de Minutos
            </div>
            <div className="text-white font-semibold mt-0.5">
              {critico ? '⚠ Saldo Crítico' : 'Capital Disponible'}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-[10px] font-semibold tracking-widest uppercase ${critico ? 'text-red-200' : 'text-slate-300'}`}>
              Recarga en
            </div>
            <div className="text-white text-sm font-bold">{diasParaRecarga} días</div>
          </div>
        </div>
      </div>

      {/* Saldo principal */}
      <div className="px-6 py-6 text-center border-b border-slate-100">
        <div className={`text-6xl font-bold tabular-nums leading-none ${critico ? 'text-red-700' : 'text-[#0F2444]'}`}>
          {saldoActual.toLocaleString('es-PA')}
        </div>
        <div className="text-xs text-slate-500 mt-2 tracking-widest font-semibold uppercase">minutos disponibles</div>

        {/* Barra de progreso */}
        <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${critico ? 'bg-red-500' : pctUsado > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.min(100 - pctUsado, 100)}%` }}
          />
        </div>
        <div className="text-[11px] text-slate-500 mt-1">{(100 - pctUsado).toFixed(0)}% del paquete mensual disponible</div>
      </div>

      {/* Grid de métricas */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 px-0">
        <div className="px-4 py-4 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Recarga</div>
          <div className="text-xl font-bold text-[#0F2444]">+{cantidadRecarga.toLocaleString('es-PA')}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Día {diaRecarga} c/mes</div>
        </div>
        <div className="px-4 py-4 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Consumo mes</div>
          <div className="text-xl font-bold text-[#0F2444]">{minutosConsumidosMesActual.toLocaleString('es-PA')}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{((minutosConsumidosMesActual / cantidadRecarga) * 100).toFixed(0)}% del paquete</div>
        </div>
        <div className="px-4 py-4 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Cobertura</div>
          <div className={`text-xl font-bold ${critico ? 'text-red-700' : 'text-[#0F2444]'}`}>
            {mesesRestantes > 0 ? `${mesesRestantes.toFixed(1)}` : '—'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">meses al ritmo actual</div>
        </div>
      </div>

      {/* Historial reciente */}
      <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Últimos movimientos</div>
        <div className="space-y-1.5">
          {historial.slice(0, 3).map((h, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${h.tipo === 'recarga' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className="text-slate-600 truncate max-w-[160px]">{h.descripcion}</span>
              </div>
              <span className={`font-semibold tabular-nums ${h.tipo === 'recarga' ? 'text-emerald-700' : 'text-slate-700'}`}>
                {h.tipo === 'recarga' ? '+' : '-'}{h.cantidad.toLocaleString('es-PA')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Semáforo visual ───────────────────────────────────────────────────────────

export function SemaforoLabel({ s }: { s: SemaforoCarta }) {
  const config = {
    verde: { label: 'Rentable', text: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-600' },
    amarillo: { label: 'En Revisión', text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
    rojo: { label: 'No Rentable', text: 'text-red-900', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-600' },
  }[s]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-[11px] font-semibold border tracking-wide ${config.text} ${config.bg} ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

// ── Delta vs mes anterior ─────────────────────────────────────────────────────

export function Delta({ v, large }: { v: number; large?: boolean }) {
  if (v === 0) return <span className="text-slate-400 tabular-nums">—</span>
  const pos = v > 0
  const size = large ? 'text-lg' : 'text-sm'
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums font-semibold ${size} ${pos ? 'text-emerald-800' : 'text-red-900'}`}>
      {pos ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
      {pos ? '+' : '-'}{Math.abs(v).toLocaleString('es-PA')}
    </span>
  )
}

// ── Selector de mes ───────────────────────────────────────────────────────────

interface MesSelectorProps {
  historico: { mes: string; label: string; esMesActual: boolean }[]
  currentIdx: number
  onChange: (idx: number) => void
}

export function SelectorMes({ historico, currentIdx, onChange }: MesSelectorProps) {
  return (
    <div className="inline-flex items-center bg-white border border-amber-200/50 rounded-md overflow-hidden shadow-sm">
      <button
        onClick={() => currentIdx > 0 && onChange(currentIdx - 1)}
        disabled={currentIdx === 0}
        className="px-3 py-2.5 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4 text-[#0F2444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <select
        value={currentIdx}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="px-4 py-2.5 text-sm bg-transparent border-x border-amber-200/50 outline-none cursor-pointer font-semibold text-[#0F2444]"
        style={{ minWidth: '180px' }}
      >
        {historico.map((m, i) => (
          <option key={m.mes} value={i}>
            {m.label}{m.esMesActual ? ' ◆ ACTUAL' : ''}
          </option>
        ))}
      </select>
      <button
        onClick={() => currentIdx < historico.length - 1 && onChange(currentIdx + 1)}
        disabled={currentIdx === historico.length - 1}
        className="px-3 py-2.5 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4 text-[#0F2444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

// ── Estado del mes (banner) ───────────────────────────────────────────────────

export function BannerEstadoMes({ estado, mensaje, onRegistrar }: { estado: EstadoMes; mensaje: string | null; onRegistrar?: () => void }) {
  if (estado === 'completo' || estado === 'en_curso') return null
  return (
    <div className="flex items-start gap-4 px-5 py-4 bg-amber-50 border border-amber-200 rounded-lg">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="text-sm font-semibold text-[#0F2444]">
          {estado === 'minutos_sin_honorario' ? 'Minutos cargados · Honorario pendiente' : 'Sin datos registrados'}
        </div>
        {mensaje && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{mensaje}</p>}
      </div>
      {onRegistrar && (
        <button onClick={onRegistrar} className="text-xs font-semibold px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors whitespace-nowrap">
          Registrar →
        </button>
      )}
    </div>
  )
}
