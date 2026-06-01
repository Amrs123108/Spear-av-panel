'use client'

import { useState, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ChevronUp, ChevronDown, ChevronsUpDown, Info, Zap,
  Users, Bot, Clock, Target, BarChart3, ArrowLeft,
  AlertCircle
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — Datos ficticios para desarrollo. Sin PII de clientes.
// ─────────────────────────────────────────────────────────────────────────────

const DIAS_TRANSCURRIDOS = 18

const RESUMEN_CAPACIDAD = {
  antesAV: {
    gestionesPorHora: 14.2,
    tmoMinutos: 4.1,
    promesasPorDia: 6.8,
    tasaConversion: 8.4,
  },
  conAV: {
    gestionesPorHora: 11.6,
    tmoMinutos: 6.7,
    promesasPorDia: 9.4,
    tasaConversion: 11.2,
  },
  tiempoLiberadoMinPorDia: 120,
}

const METRICAS_PISO = {
  gestiones: 36615,
  promesas: 1717,
  montoCostoTotal: 62400,
  tmoPromedio: 6.7,
  costoPorPromesa: 36.3,
}

const METRICAS_AV = {
  gestiones: 25578,
  promesas: 211,
  minutosOperados: 7899,
  costoPorGestion: 0.19,
  costoPorPromesa: 18.9,
}

const IMPACTO_NETO = {
  coberturaExtra: 25578,
  ahorro_estimado: 4841,
  horasLiberadas: 131.7,
}

const MOCK_ASESORES = [
  { id: 1, nombre: 'Ana López',         cartera: 'SURA',            gestiones: 1240, promesas: 148, monto: 312400, tmoMin: 7.2,  tendencia: 'up'   },
  { id: 2, nombre: 'Carlos Ruiz',       cartera: 'BANISTMO ACTIVA', gestiones: 1085, promesas: 134, monto: 287100, tmoMin: 6.8,  tendencia: 'up'   },
  { id: 3, nombre: 'María Fernández',   cartera: 'SOLVE',           gestiones:  942, promesas: 121, monto: 265800, tmoMin: 8.1,  tendencia: 'up'   },
  { id: 4, nombre: 'José Martínez',     cartera: 'KREDIYA',         gestiones: 2140, promesas: 119, monto:  89400, tmoMin: 4.3,  tendencia: 'down' },
  { id: 5, nombre: 'Discador Predictivo', cartera: 'TIGO',          gestiones: 3890, promesas: 112, monto:  62300, tmoMin: 2.1,  tendencia: 'flat' },
  { id: 6, nombre: 'Laura Sánchez',     cartera: 'BAC RECOVERY',    gestiones:  780, promesas: 108, monto: 198500, tmoMin: 9.4,  tendencia: 'up'   },
  { id: 7, nombre: 'Pedro Gómez',       cartera: 'SURA',            gestiones:  890, promesas:  97, monto: 176200, tmoMin: 7.8,  tendencia: 'up'   },
  { id: 8, nombre: 'Sofia Vargas',      cartera: 'RODELAG',         gestiones:  640, promesas:  84, monto: 124600, tmoMin: 8.9,  tendencia: 'up'   },
  { id: 9, nombre: 'Roberto Castro',    cartera: 'BANISTMO RECOVERY', gestiones: 1560, promesas: 78, monto:  98700, tmoMin: 5.1, tendencia: 'down' },
  { id: 10, nombre: 'Andrea Moreno',    cartera: 'BANCO LA HIPOTECARIA', gestiones: 412, promesas: 67, monto: 412800, tmoMin: 11.2, tendencia: 'up' },
  { id: 11, nombre: 'Diego Herrera',    cartera: 'SOLVE',           gestiones:  720, promesas:  59, monto: 143200, tmoMin: 7.6,  tendencia: 'flat' },
  { id: 12, nombre: 'Carmen Jiménez',   cartera: 'TIGO',            gestiones: 1870, promesas:  54, monto:  41800, tmoMin: 3.8,  tendencia: 'down' },
]

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number, dec = 0) =>
  n.toLocaleString('es-PA', { minimumFractionDigits: dec, maximumFractionDigits: dec })

// ─────────────────────────────────────────────────────────────────────────────
// TOOLTIP ESTIMADO
// ─────────────────────────────────────────────────────────────────────────────

function TooltipEstimado({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <span
        className="cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        <Info className="w-3 h-3 text-amber-500 opacity-70 hover:opacity-100 transition-opacity" />
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 px-3 py-2 text-xs leading-relaxed text-white bg-[#0A1628] rounded-lg shadow-xl whitespace-normal border border-amber-500/20">
          *Métrica estimada referencial*
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0A1628]" />
        </span>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ANÁLISIS DE CAPACIDAD Y RENDIMIENTO HUMANO
// ─────────────────────────────────────────────────────────────────────────────

function TarjetaCapacidad() {
  const { antesAV, conAV, tiempoLiberadoMinPorDia } = RESUMEN_CAPACIDAD

  const filas = [
    {
      metrica: 'Gestiones por Hora',
      antes: antesAV.gestionesPorHora,
      despues: conAV.gestionesPorHora,
      unidad: 'gest/h',
      positivo: false, // baja es buena (menos repetitivas, más calidad)
      nota: 'Baja porque el AV absorbe llamadas sin respuesta',
    },
    {
      metrica: 'TMO Promedio',
      antes: antesAV.tmoMinutos,
      despues: conAV.tmoMinutos,
      unidad: 'min',
      positivo: true,
      nota: 'Sube porque el asesor negocia más, no marca buzones',
    },
    {
      metrica: 'Promesas por Día',
      antes: antesAV.promesasPorDia,
      despues: conAV.promesasPorDia,
      unidad: '/día',
      positivo: true,
      nota: 'Sube al enfocarse en contactos con respuesta real',
    },
    {
      metrica: 'Tasa de Conversión',
      antes: antesAV.tasaConversion,
      despues: conAV.tasaConversion,
      unidad: '%',
      positivo: true,
      nota: 'Mejora porque solo gestiona clientes que responden',
    },
  ]

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-8 py-6 bg-gradient-to-r from-[#0A1628] via-[#0F2444] to-[#1A3458] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #B8924A 0%, transparent 60%)' }} />
        <div className="relative">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-amber-400 mb-2">
                Análisis de Capacidad Humana
              </div>
              <h2 className="font-serif text-2xl font-semibold text-white">
                Rendimiento del Piso con el AV
              </h2>
              <p className="text-slate-300 text-sm mt-1.5 max-w-lg">
                El AV absorbe las tareas repetitivas. El asesor invierte su tiempo en conversaciones reales.
              </p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                <TooltipEstimado>Tiempo Liberado / Día</TooltipEstimado>
              </div>
              <div className="text-4xl font-bold text-amber-300 tabular-nums">
                {tiempoLiberadoMinPorDia}
              </div>
              <div className="text-xs text-amber-400/70 mt-0.5">minutos/asesor</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla comparativa */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Métrica</th>
              <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Sin AV</th>
              <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-[#0F2444]">Con AV (Actual)</th>
              <th className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Var.</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Interpretación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((f) => {
              const delta = f.despues - f.antes
              const pct = ((delta / f.antes) * 100).toFixed(1)
              const esBueno = f.positivo ? delta > 0 : delta < 0
              return (
                <tr key={f.metrica} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-[#0F2444]">{f.metrica}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-slate-500">
                    {fmt(f.antes, f.unidad === '%' ? 1 : 1)} <span className="text-slate-400 text-xs">{f.unidad}</span>
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums font-bold text-[#0F2444]">
                    {fmt(f.despues, f.unidad === '%' ? 1 : 1)} <span className="text-slate-500 text-xs font-normal">{f.unidad}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                      esBueno
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {esBueno
                        ? <ArrowUpRight className="w-3 h-3" />
                        : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(parseFloat(pct))}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 italic">{f.nota}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Veredicto ejecutivo */}
      <div className="mx-6 mb-6 mt-2 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1">
              Veredicto Ejecutivo
            </div>
            <p className="text-sm text-emerald-900 leading-relaxed">
              El aumento del <strong>TMO de {fmt(antesAV.tmoMinutos, 1)} a {fmt(conAV.tmoMinutos, 1)} minutos</strong> es
              un indicador positivo: el asesor ya no pierde tiempo en llamadas sin respuesta — eso lo maneja el AV.
              Cada llamada del humano es ahora una negociación real, lo que explica el aumento del{' '}
              <strong>{((conAV.promesasPorDia / antesAV.promesasPorDia - 1) * 100).toFixed(0)}%
              en promesas por día</strong> con menos gestiones por hora.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. COMPARATIVO PISO VS AV
// ─────────────────────────────────────────────────────────────────────────────

function TarjetaComparativo() {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* Piso Humano */}
      <div className="bg-white border-2 border-[#0F2444]/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-[#0F2444] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Equipo Humano</div>
            <div className="text-white font-semibold text-sm">Piso Humano</div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <MetricaBloque label="Gestiones Totales" valor={fmt(METRICAS_PISO.gestiones)} />
          <MetricaBloque label="Promesas Generadas" valor={fmt(METRICAS_PISO.promesas)} accent />
          <MetricaBloque label="Monto Comprometido" valor={fmt(METRICAS_PISO.montoCostoTotal)} />
          <MetricaBloque label="TMO Promedio" valor={`${fmt(METRICAS_PISO.tmoPromedio, 1)} min`} />
          <MetricaBloque label="Costo x Promesa" valor={`${fmt(METRICAS_PISO.costoPorPromesa, 1)}`} />
        </div>
      </div>

      {/* AV */}
      <div className="bg-white border-2 border-amber-400/20 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-gradient-to-r from-amber-600 to-amber-700 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-amber-200">Asesor Virtual IA</div>
            <div className="text-white font-semibold text-sm">
              <TooltipEstimado>Estimado</TooltipEstimado>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <MetricaBloque label="Gestiones Totales" valor={fmt(METRICAS_AV.gestiones)} />
          <MetricaBloque label="Promesas Generadas" valor={fmt(METRICAS_AV.promesas)} accent />
          <MetricaBloque label="Minutos Operados" valor={fmt(METRICAS_AV.minutosOperados)} />
          <MetricaBloque label="Costo x Gestión" valor={`${METRICAS_AV.costoPorGestion.toFixed(2)}`} />
          <MetricaBloque label="Costo x Promesa" valor={`${fmt(METRICAS_AV.costoPorPromesa, 1)}`} />
        </div>
      </div>

      {/* Impacto Neto */}
      <div className="bg-gradient-to-b from-emerald-900 to-teal-900 border-2 border-emerald-500/20 rounded-2xl overflow-hidden shadow-sm text-white">
        <div className="px-5 py-4 border-b border-emerald-500/20 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-400/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Resultado</div>
            <div className="text-white font-semibold text-sm">Impacto Neto</div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
              <TooltipEstimado>Cobertura Extra</TooltipEstimado>
            </div>
            <div className="text-3xl font-bold tabular-nums text-white">
              +{fmt(IMPACTO_NETO.coberturaExtra)}
            </div>
            <div className="text-xs text-emerald-300 mt-0.5">gestiones que el piso no alcanzaría</div>
          </div>
          <div className="h-px bg-emerald-500/20" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
              <TooltipEstimado>Ahorro Estimado</TooltipEstimado>
            </div>
            <div className="text-3xl font-bold tabular-nums text-white">
              {fmt(IMPACTO_NETO.ahorro_estimado)}
            </div>
            <div className="text-xs text-emerald-300 mt-0.5">vs contratar asesores equivalentes</div>
          </div>
          <div className="h-px bg-emerald-500/20" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
              <TooltipEstimado>Horas Liberadas</TooltipEstimado>
            </div>
            <div className="text-3xl font-bold tabular-nums text-white">
              {fmt(IMPACTO_NETO.horasLiberadas, 1)}h
            </div>
            <div className="text-xs text-emerald-300 mt-0.5">de tiempo de asesores este mes</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricaBloque({ label, valor, accent }: { label: string; valor: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${accent ? 'text-amber-700' : 'text-[#0F2444]'}`}>
        {valor}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TABLA DE PRODUCTIVIDAD HUMANA
// ─────────────────────────────────────────────────────────────────────────────

type Col = 'nombre' | 'cartera' | 'gestiones' | 'promesas' | 'monto' | 'tmoMin' | 'gestionesPorDia'
type Dir = 'asc' | 'desc'

function TendenciaIcon({ t }: { t: string }) {
  if (t === 'up') return (
    <span className="inline-flex items-center gap-0.5 text-emerald-700 text-xs font-semibold">
      <TrendingUp className="w-3.5 h-3.5" />Subió
    </span>
  )
  if (t === 'down') return (
    <span className="inline-flex items-center gap-0.5 text-red-700 text-xs font-semibold">
      <TrendingDown className="w-3.5 h-3.5" />Bajó
    </span>
  )
  return <span className="text-slate-400 text-xs">— Estable</span>
}

function TablaProductividad() {
  const [col, setCol] = useState<Col>('promesas')
  const [dir, setDir] = useState<Dir>('desc')
  const [buscar, setBuscar] = useState('')

  const ordenar = (c: Col) => {
    if (col === c) setDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setCol(c); setDir('desc') }
  }

  const datos = useMemo(() => {
    const gestionesPorDia = MOCK_ASESORES.map(a => ({
      ...a,
      gestionesPorDia: Math.round(a.gestiones / DIAS_TRANSCURRIDOS)
    }))
    const filtrados = buscar
      ? gestionesPorDia.filter(a =>
          a.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
          a.cartera.toLowerCase().includes(buscar.toLowerCase())
        )
      : gestionesPorDia

    return [...filtrados].sort((a, b) => {
      const mult = dir === 'asc' ? 1 : -1
      if (col === 'nombre') return mult * a.nombre.localeCompare(b.nombre)
      if (col === 'cartera') return mult * a.cartera.localeCompare(b.cartera)
      return mult * ((a[col] as number) - (b[col] as number))
    })
  }, [col, dir, buscar])

  type ColDef = { key: Col; label: string; estimada?: boolean }
  const cols: ColDef[] = [
    { key: 'nombre',          label: 'Asesor' },
    { key: 'cartera',         label: 'Cartera' },
    { key: 'gestiones',       label: 'Gestiones' },
    { key: 'gestionesPorDia', label: 'Prom. Diario' },
    { key: 'promesas',        label: 'Promesas Netas' },
    { key: 'monto',           label: 'Monto Comprometido', estimada: true },
    { key: 'tmoMin',          label: 'TMO (min)' },
  ]

  function SortIcon({ c }: { c: Col }) {
    if (col !== c) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
    return dir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-amber-600" />
      : <ChevronUp className="w-3 h-3 text-amber-600" />
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">Human Performance</div>
          <h3 className="font-serif text-xl font-semibold text-[#0F2444]">Productividad Humana por Asesor</h3>
          <p className="text-xs text-slate-500 mt-1">
            Ordenable por columna · Sin datos personales de clientes · "Discador Predictivo" = herramienta automatizada
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar asesor o cartera…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-amber-400 w-48 bg-slate-50"
          />
          <span className="text-xs text-slate-400">{datos.length} asesores</span>
        </div>
      </div>

      {/* Nota Discador Predictivo */}
      <div className="mx-6 mt-4 flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
        <AlertCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          <strong className="text-slate-700">Discador Predictivo</strong> — registros del usuario "Marlin Zeledon" renombrados para separar la gestión automatizada de la manual. Sus métricas de TMO no son comparables con asesores humanos.
        </p>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {cols.map(c => (
                <th
                  key={c.key}
                  onClick={() => ordenar(c.key)}
                  className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors select-none text-right first:text-left"
                >
                  <span className="inline-flex items-center gap-1 justify-end first:justify-start">
                    {c.estimada
                      ? <TooltipEstimado>{c.label}</TooltipEstimado>
                      : c.label}
                    <SortIcon c={c.key} />
                  </span>
                </th>
              ))}
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 text-center">
                Tendencia
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {datos.map((a, i) => {
              const esDiscador = a.nombre === 'Discador Predictivo'
              return (
                <tr
                  key={a.id}
                  className={`transition-colors ${
                    esDiscador
                      ? 'bg-slate-50/80 opacity-75'
                      : i === 0 && col === 'promesas' && dir === 'desc'
                        ? 'bg-amber-50/40 hover:bg-amber-50'
                        : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-5 py-4 text-left">
                    <div className="flex items-center gap-2">
                      {i === 0 && col === 'promesas' && dir === 'desc' && !esDiscador && (
                        <span className="text-amber-500 text-xs">★</span>
                      )}
                      <span className={`font-semibold ${esDiscador ? 'text-slate-500 italic' : 'text-[#0F2444]'}`}>
                        {a.nombre}
                      </span>
                      {esDiscador && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 uppercase tracking-wide">
                          Auto
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-600">{a.cartera}</td>
                  <td className="px-5 py-4 text-right tabular-nums font-semibold text-[#0F2444]">
                    {fmt(a.gestiones)}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-600">
                    {fmt(Math.round(a.gestiones / DIAS_TRANSCURRIDOS))}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="tabular-nums font-bold text-amber-700">{fmt(a.promesas)}</span>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-[#0F2444]">
                    {fmt(a.monto, 2)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`tabular-nums font-semibold ${
                      esDiscador ? 'text-slate-400' :
                      a.tmoMin >= 7 ? 'text-emerald-700' :
                      a.tmoMin >= 5 ? 'text-amber-700' : 'text-slate-600'
                    }`}>
                      {a.tmoMin.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {esDiscador
                      ? <span className="text-slate-400 text-xs">N/A</span>
                      : <TendenciaIcon t={a.tendencia} />
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Leyenda TMO */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">TMO:</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-600" />≥ 7 min — negociación activa</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />5–7 min — gestión normal</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" />{'< 5 min — contacto breve'}</span>
        <span className="ml-auto text-slate-400">* Datos del período | Días transcurridos: {DIAS_TRANSCURRIDOS}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function PisoVsAVPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F1]">
      {/* Header de página */}
      <div className="bg-white border-b border-amber-200/30 sticky top-0 z-40 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="flex items-center gap-2 text-slate-500 hover:text-[#0F2444] transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Panel Ejecutivo
            </a>
            <div className="w-px h-5 bg-slate-200" />
            <div>
              <h1 className="font-serif text-lg font-semibold text-[#0F2444]">Piso vs AV</h1>
              <p className="text-[10px] tracking-widest uppercase text-amber-700 font-bold">
                Análisis de Productividad
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <BarChart3 className="w-4 h-4" />
            Mayo 2026 · {DIAS_TRANSCURRIDOS} días transcurridos
          </div>
        </div>
      </div>

      {/* Contenido */}
      <main className="max-w-7xl mx-auto px-8 py-10 space-y-8">

        {/* Aviso mock data */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Esta pantalla utiliza <strong>datos de ejemplo ficticios</strong>. Al integrar los datos reales del Blob, los números se actualizarán automáticamente.
        </div>

        {/* 1. Análisis de Capacidad */}
        <TarjetaCapacidad />

        {/* 2. Comparativo */}
        <div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-amber-700 mb-3">
            Comparativo de Esfuerzo
          </div>
          <TarjetaComparativo />
        </div>

        {/* 3. Tabla de Productividad */}
        <TablaProductividad />

      </main>

      {/* Footer */}
      <footer className="border-t border-amber-200/20 bg-white/60 mt-16">
        <div className="max-w-7xl mx-auto px-8 py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold tracking-widest uppercase text-amber-700">SPEAR</span>
            <span className="w-px h-3 bg-slate-300" />
            <span className="text-xs text-slate-500">Análisis Piso vs Asesor Virtual</span>
          </div>
          <span className="text-[10px] text-slate-400">
            *Las métricas estimadas son referenciales y no implican atribución causal directa al AV.
          </span>
        </div>
      </footer>
    </div>
  )
}
