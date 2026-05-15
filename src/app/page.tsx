'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, RefreshCw, Target, ArrowUpRight, ArrowDownRight, Building2, Activity, Zap, BarChart3, Briefcase } from 'lucide-react'

interface CarteraMetrica {
  nombre: string; clientes: number; asesores: number; minutosAV: number
  promesas: number; llamadas: number; efectivas: number
  costoAV: number; costoPiso: number; masivos: number; costoTotal: number
  honorario: number; honorarioMesAnterior: number; base: number
  delta: number; retornoXBalboa: number
  semaforo: 'verde' | 'amarillo' | 'rojo'
  motivo: string; accion: string; pctCobertura: number
}
interface DashData {
  mesActual: { label: string; inversionAV: number; honorarioTotal: number; honorarioAnterior: number; deltaVsMesAnterior: number; incrementoVsBase: number; roiMultiplo: number; minutosConsumidos: number; sePaga: boolean }
  carteras: CarteraMetrica[]
  historico: { mes: string; label: string; inversionAV: number; honorarioTotal: number; avActivo: boolean; minutosConsumidos: number }[]
  bolsa: { saldoActual: number; historial: { fecha: string; tipo: string; cantidad: number; descripcion: string }[] }
}
interface PlanAccion { id: string; descripcion: string; responsable: string; impactoEsperado: string; completada: boolean; resultado: string }
interface Plan { id: string; fecha: string; semana: string; estado: string; acciones: PlanAccion[]; notas: string; metaHonorario: number; honorarioRealizado: number }

const fmt = (n: number) => n.toLocaleString('es-PA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtBalboas = (n: number) => `B/.${fmt(n)}`

function MetricCard({ label, value, sub, trend, accent }: {
  label: string; value: string; sub?: string;
  trend?: { value: number; positive: boolean };
  accent?: 'blue' | 'green' | 'red' | 'orange' | 'neutral'
}) {
  const accents = {
    blue: 'border-l-blue-500', green: 'border-l-emerald-500',
    red: 'border-l-red-500', orange: 'border-l-orange-500', neutral: 'border-l-slate-500',
  }
  return (
    <div className={`bg-white border border-slate-200 rounded-lg p-5 border-l-4 ${accents[accent || 'neutral']} shadow-sm`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{label}</div>
      <div className="text-3xl font-bold text-slate-900 tracking-tight tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1.5">{sub}</div>}
      {trend && (
        <div className={`flex items-center gap-1 mt-3 text-sm font-semibold ${trend.positive ? 'text-emerald-700' : 'text-red-700'}`}>
          {trend.positive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {trend.positive ? '+' : ''}{trend.value.toLocaleString('es-PA')}
          <span className="text-slate-400 font-normal ml-1">vs mes anterior</span>
        </div>
      )}
    </div>
  )
}

function SemaforoBadge({ s }: { s: 'verde' | 'amarillo' | 'rojo' }) {
  const c = {
    verde: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'RENTABLE', dot: 'bg-emerald-500' },
    amarillo: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'REVISAR', dot: 'bg-amber-500' },
    rojo: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'NO RENTABLE', dot: 'bg-red-500' },
  }[s]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

function Delta({ v }: { v: number }) {
  if (v === 0) return <span className="text-slate-400 text-sm">—</span>
  const pos = v > 0
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold text-sm tabular-nums ${pos ? 'text-emerald-700' : 'text-red-700'}`}>
      {pos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
      {pos ? '+' : '-'}B/.{fmt(Math.abs(v))}
    </span>
  )
}

function BolsaMinutosEjecutiva({ bolsa, consumidos }: { bolsa: DashData['bolsa']; consumidos: number }) {
  const saldo = bolsa.saldoActual
  const consumoDiario = consumidos > 0 ? consumidos / 30 : 0
  const mesesRestantes = consumoDiario > 0 ? (saldo / (consumoDiario * 30)) : 0

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-slate-600" />
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Bolsa de Minutos</h3>
        </div>
        <span className="text-xs text-slate-500 font-medium">Acumulación sin tope</span>
      </div>
      <div className="p-6">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-5xl font-bold text-slate-900 tabular-nums">{fmt(saldo)}</span>
          <span className="text-slate-500 text-sm font-medium">minutos disponibles</span>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Recarga mensual</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">14,000</div>
            <div className="text-xs text-slate-400 mt-0.5">cada día 1°</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Consumo mes ant.</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">{fmt(consumidos)}</div>
            <div className="text-xs text-slate-400 mt-0.5">B/.{fmt(consumidos * 0.285)} variable</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Cobertura proyectada</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">{mesesRestantes.toFixed(1)}</div>
            <div className="text-xs text-slate-400 mt-0.5">meses al ritmo actual</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TablaCarterasEjecutiva({ carteras }: { carteras: CarteraMetrica[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Cartera</th>
            <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Inversión AV</th>
            <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Honorario</th>
            <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">vs Mes Ant.</th>
            <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Retorno</th>
            <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Estado</th>
            <th className="px-3 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {carteras.map(c => (
            <Fragment key={c.nombre}>
              <tr className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                <td className="px-5 py-4">
                  <div className="font-semibold text-slate-900 text-sm">{c.nombre}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{fmt(c.clientes)} clientes · {c.asesores} ases.</div>
                </td>
                <td className="px-3 py-4 text-right tabular-nums">
                  {c.costoAV > 0 ? (
                    <>
                      <div className="text-sm font-semibold text-slate-900">{fmtBalboas(c.costoAV)}</div>
                      <div className="text-xs text-slate-500">{fmt(c.minutosAV)} min</div>
                    </>
                  ) : <span className="text-slate-400 text-sm">—</span>}
                </td>
                <td className="px-3 py-4 text-right tabular-nums">
                  <div className="text-sm font-semibold text-slate-900">{fmtBalboas(c.honorario)}</div>
                  {c.base > 0 && <div className="text-xs text-slate-500">Base: {fmtBalboas(c.base)}</div>}
                </td>
                <td className="px-3 py-4 text-right">
                  <Delta v={c.honorario - c.honorarioMesAnterior} />
                </td>
                <td className="px-3 py-4 text-right tabular-nums">
                  {c.retornoXBalboa > 0 ? (
                    <div className={`text-base font-bold ${c.retornoXBalboa >= 3 ? 'text-emerald-700' : c.retornoXBalboa >= 1 ? 'text-amber-700' : 'text-red-700'}`}>
                      {c.retornoXBalboa.toFixed(1)}×
                    </div>
                  ) : <span className="text-slate-400 text-sm">—</span>}
                </td>
                <td className="px-3 py-4 text-center"><SemaforoBadge s={c.semaforo} /></td>
                <td className="px-3 py-4 text-slate-400">
                  {expanded === c.nombre ? <ChevronUp className="w-4 h-4 mx-auto" /> : <ChevronDown className="w-4 h-4 mx-auto" />}
                </td>
              </tr>
              {expanded === c.nombre && (
                <tr className="bg-slate-50">
                  <td colSpan={7} className="px-5 py-5">
                    <div className="grid md:grid-cols-4 gap-6">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Operación</div>
                        <dl className="space-y-1.5 text-sm">
                          <div className="flex justify-between"><dt className="text-slate-600">Llamadas AV:</dt><dd className="font-semibold text-slate-900 tabular-nums">{fmt(c.llamadas)}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-600">Efectivas:</dt><dd className="font-semibold text-slate-900 tabular-nums">{fmt(c.efectivas)}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-600">Promesas pago:</dt><dd className="font-semibold text-emerald-700 tabular-nums">{c.promesas}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-600">Cobertura:</dt><dd className="font-semibold text-slate-900 tabular-nums">{c.pctCobertura}%</dd></div>
                        </dl>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Estructura de Costos</div>
                        <dl className="space-y-1.5 text-sm">
                          <div className="flex justify-between"><dt className="text-slate-600">Asesor Virtual:</dt><dd className="font-semibold text-slate-900 tabular-nums">{fmtBalboas(c.costoAV)}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-600">Asesores piso:</dt><dd className="font-semibold text-slate-900 tabular-nums">{fmtBalboas(c.costoPiso)}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-600">Masivos:</dt><dd className="font-semibold text-slate-900 tabular-nums">{fmtBalboas(c.masivos)}</dd></div>
                          <div className="flex justify-between pt-1.5 border-t border-slate-200"><dt className="text-slate-700 font-semibold">Total:</dt><dd className="font-bold text-slate-900 tabular-nums">{fmtBalboas(c.costoTotal)}</dd></div>
                        </dl>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Diagnóstico</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{c.motivo}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Acción Recomendada</div>
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-900 leading-relaxed">
                          {c.accion}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GraficoHistorico({ historico }: { historico: DashData['historico'] }) {
  const data = historico.map(m => ({
    name: m.label.split(' ')[0],
    honorario: m.honorarioTotal,
    inversion: m.inversionAV,
  }))
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Inversión vs Recuperación</h3>
          <p className="text-xs text-slate-500 mt-0.5">Comparativo histórico mes a mes</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-700" />Honorario</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500" />Inversión AV</span>
        </div>
      </div>
      <div className="p-5">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              labelStyle={{ color: '#1E293B', fontWeight: 700, marginBottom: '4px' }}
              formatter={(v: number) => [`B/.${v.toLocaleString('es-PA')}`, '']} />
            <Bar dataKey="honorario" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={45} />
            <Bar dataKey="inversion" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={45} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function PanelPlan({ planes }: { planes: Plan[] }) {
  const plan = planes[0]
  if (!plan) return null
  const completadas = plan.acciones.filter(a => a.completada).length
  const total = plan.acciones.length
  const pct = total > 0 ? (completadas / total) * 100 : 0
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-slate-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Plan de Acción</h3>
            <p className="text-xs text-slate-500">{plan.semana}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700 tabular-nums">{completadas}/{total}</span>
          <div className="w-32 bg-slate-200 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {plan.acciones.map((a, i) => (
          <div key={a.id} className="px-5 py-4 flex gap-4">
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${a.completada ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {a.completada ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${a.completada ? 'line-through text-slate-500' : 'text-slate-900'}`}>{a.descripcion}</div>
              <div className="flex flex-wrap gap-4 mt-1.5 text-xs">
                <span className="text-slate-500">Responsable: <span className="font-medium text-slate-700">{a.responsable}</span></span>
                <span className="text-emerald-700 font-medium">Impacto: {a.impactoEsperado}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {plan.notas && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
          <span className="font-semibold">Nota: </span>{plan.notas}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'resumen' | 'carteras' | 'historico' | 'plan'>('resumen')
  const [lastUpdate, setLastUpdate] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, pRes] = await Promise.all([fetch('/api/data'), fetch('/api/plan')])
      const [d, p] = await Promise.all([dRes.json(), pRes.json()])
      if (d.ok) setData(d)
      if (p.ok) setPlanes(p.planes)
      setLastUpdate(new Date().toLocaleString('es-PA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }))
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin mx-auto mb-3" />
        <div className="text-slate-600 text-sm">Cargando información...</div>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-red-600">Error al cargar datos</div>
    </div>
  )

  const { mesActual, carteras, historico, bolsa } = data
  const verdes = carteras.filter(c => c.semaforo === 'verde').length
  const rojas = carteras.filter(c => c.semaforo === 'rojo').length
  const amarillas = carteras.filter(c => c.semaforo === 'amarillo').length

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center shadow-md">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">SPEAR · Asesor Virtual</h1>
              <p className="text-xs text-slate-500 font-medium">Panel Ejecutivo · {mesActual.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">Actualizado: {lastUpdate}</span>
            <button onClick={fetchData} className="p-2 rounded-md hover:bg-slate-100 transition-colors" title="Actualizar">
              <RefreshCw className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex gap-1 -mb-px overflow-x-auto">
          {([
            { k: 'resumen', l: 'Resumen Ejecutivo', icon: BarChart3 },
            { k: 'carteras', l: 'Análisis por Cartera', icon: Building2 },
            { k: 'historico', l: 'Histórico', icon: Activity },
            { k: 'plan', l: 'Plan de Acción', icon: Target },
          ] as const).map(({ k, l, icon: Icon }) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${tab === k ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-4 h-4" />
              {l}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {tab === 'resumen' && (
          <>
            <div className={`rounded-lg overflow-hidden shadow-sm border ${mesActual.sePaga ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white' : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'}`}>
              <div className="p-7">
                <div className="flex items-start gap-5 flex-wrap">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${mesActual.sePaga ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                    {mesActual.sePaga ? <CheckCircle2 className="w-8 h-8 text-white" /> : <AlertTriangle className="w-8 h-8 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Veredicto del Mes</div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      {mesActual.sePaga ? 'La inversión está generando retorno' : 'La inversión requiere optimización'}
                    </h2>
                    <p className="text-slate-700 leading-relaxed">
                      {mesActual.sePaga
                        ? `Por cada balboa invertido en el Asesor Virtual, se generan B/.${mesActual.roiMultiplo.toFixed(2)} de honorario adicional. El retorno acumulado del mes es de ${fmtBalboas(mesActual.incrementoVsBase)}.`
                        : `El honorario incremental (${fmtBalboas(mesActual.incrementoVsBase)}) no cubre completamente la inversión (${fmtBalboas(mesActual.inversionAV)}). Ver acciones recomendadas en Plan.`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">ROI</div>
                    <div className="text-5xl font-bold text-slate-900 tabular-nums">{mesActual.roiMultiplo.toFixed(1)}×</div>
                    <div className="text-xs text-slate-500 mt-1">retorno sobre inversión</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Inversión Mensual AV" value={fmtBalboas(mesActual.inversionAV)} sub="Costo fijo + minutos consumidos" accent="orange" />
              <MetricCard label="Honorario Recuperado" value={fmtBalboas(mesActual.honorarioTotal)}
                trend={{ value: mesActual.deltaVsMesAnterior, positive: mesActual.deltaVsMesAnterior >= 0 }} accent="blue" />
              <MetricCard label="Retorno Incremental" value={fmtBalboas(mesActual.incrementoVsBase)} sub="Honorario sobre la base histórica" accent="green" />
              <MetricCard label="Minutos Consumidos" value={fmt(mesActual.minutosConsumidos)} sub={`${((mesActual.minutosConsumidos / 14000) * 100).toFixed(0)}% del paquete mensual`} accent="neutral" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <BolsaMinutosEjecutiva bolsa={bolsa} consumidos={mesActual.minutosConsumidos} />

              <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Distribución del Portafolio</h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900">{verdes}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Rentables</div>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900">{amarillas}</div>
                      <div className="text-xs text-slate-500 mt-0.5">En revisión</div>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
                        <XCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900">{rojas}</div>
                      <div className="text-xs text-slate-500 mt-0.5">No rentables</div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <div className="text-xs font-bold uppercase text-slate-500 mb-2">Top rentables</div>
                    {carteras.filter(c => c.semaforo === 'verde').slice(0, 3).map(c => (
                      <div key={c.nombre} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{c.nombre}</span>
                        <span className="font-bold text-emerald-700 tabular-nums">{c.retornoXBalboa.toFixed(1)}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={`rounded-lg border p-5 flex items-start gap-4 ${mesActual.deltaVsMesAnterior >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              {mesActual.deltaVsMesAnterior >= 0
                ? <TrendingUp className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                : <TrendingDown className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />}
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Comparativo vs {historico[historico.length - 2]?.label}</h3>
                <p className="text-sm text-slate-700">
                  {mesActual.deltaVsMesAnterior >= 0 ? 'Honorario al alza: ' : 'Honorario a la baja: '}
                  <span className={`font-bold ${mesActual.deltaVsMesAnterior >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {mesActual.deltaVsMesAnterior >= 0 ? '+' : ''}{fmtBalboas(mesActual.deltaVsMesAnterior)}
                  </span>
                  <span className="text-slate-500 ml-2">
                    ({mesActual.honorarioAnterior > 0 ? ((mesActual.deltaVsMesAnterior / mesActual.honorarioAnterior) * 100).toFixed(1) : 0}%)
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 flex items-start gap-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 mb-1">Quick Win Disponible: B/.3,007/mes no cobrados</h3>
                <p className="text-sm text-slate-700">
                  Las gestiones del Asesor Virtual en Banistmo Activa (B/.1,789) y Banistmo Recovery (B/.1,217) no se entregan al cliente en el formato requerido, por lo que no se está cobrando la comisión correspondiente. <span className="font-semibold">Resolverlo es la acción de mayor impacto a corto plazo.</span>
                </p>
              </div>
            </div>
          </>
        )}

        {tab === 'carteras' && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Análisis por Cartera</h2>
                <p className="text-sm text-slate-500 mt-1">Click en cualquier fila para ver detalle completo</p>
              </div>
              <div className="text-xs text-slate-500">
                Total invertido AV: <span className="font-bold text-slate-900">{fmtBalboas(carteras.reduce((s, c) => s + c.costoAV, 0))}</span>
              </div>
            </div>
            <TablaCarterasEjecutiva carteras={carteras} />
          </>
        )}

        {tab === 'historico' && (
          <>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Histórico de Resultados</h2>
              <p className="text-sm text-slate-500 mt-1">Evolución mensual de inversión y recuperación</p>
            </div>

            <GraficoHistorico historico={historico} />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Detalle Mes a Mes</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Mes</th>
                    <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Inversión AV</th>
                    <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Honorario</th>
                    <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">vs Mes Ant.</th>
                    <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">¿AV se pagó?</th>
                    <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">B/. × B/.1</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historico.map((m, i) => {
                    const ant = historico[i - 1]
                    const delta = ant ? m.honorarioTotal - ant.honorarioTotal : 0
                    const roiX = m.inversionAV > 0 ? m.honorarioTotal / m.inversionAV : 0
                    return (
                      <tr key={m.mes} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm">{m.label}</span>
                            {m.avActivo && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">AV</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-right text-sm tabular-nums">
                          {m.inversionAV > 0 ? <span className="font-semibold text-slate-900">{fmtBalboas(m.inversionAV)}</span> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-3.5 text-right text-sm font-semibold text-slate-900 tabular-nums">{fmtBalboas(m.honorarioTotal)}</td>
                        <td className="px-3 py-3.5 text-right">{i > 0 ? <Delta v={delta} /> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-3 py-3.5 text-center">
                          {m.inversionAV > 0
                            ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${m.honorarioTotal >= m.inversionAV ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {m.honorarioTotal >= m.inversionAV ? 'Sí' : 'No'}
                              </span>
                            : <span className="text-slate-400 text-xs">Sin AV</span>}
                        </td>
                        <td className="px-3 py-3.5 text-right text-sm font-bold tabular-nums">
                          {roiX > 0 ? <span className={roiX >= 5 ? 'text-emerald-700' : roiX >= 2 ? 'text-amber-700' : 'text-red-700'}>{roiX.toFixed(1)}×</span> : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'plan' && (
          <>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Plan de Acción Semanal</h2>
              <p className="text-sm text-slate-500 mt-1">Acciones definidas para mejorar el retorno · Seguimiento continuo</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Tendencia del mes</div>
                <div className={`text-lg font-bold ${mesActual.deltaVsMesAnterior >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {mesActual.deltaVsMesAnterior >= 0 ? 'Avance positivo' : 'Por debajo'}
                </div>
                <div className="text-sm text-slate-600 mt-1">{mesActual.deltaVsMesAnterior >= 0 ? '+' : ''}{fmtBalboas(mesActual.deltaVsMesAnterior)} vs mes anterior</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Carteras críticas</div>
                {carteras.filter(c => c.semaforo === 'rojo' && c.minutosAV > 0).length > 0
                  ? carteras.filter(c => c.semaforo === 'rojo' && c.minutosAV > 0).map(c => (
                      <div key={c.nombre} className="text-sm font-medium text-red-700">{c.nombre}</div>
                    ))
                  : <div className="text-sm text-emerald-700 font-medium">Sin carteras en rojo</div>}
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Oportunidad inmediata</div>
                <div className="text-sm font-bold text-amber-700">Conversor Banistmo</div>
                <div className="text-xs text-slate-500 mt-1">+B/.3,007/mes potencial</div>
              </div>
            </div>

            <PanelPlan planes={planes} />
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>SPEAR · Panel Ejecutivo del Asesor Virtual</span>
          <span>Actualización: {lastUpdate || 'En tiempo real'}</span>
        </div>
      </footer>
    </div>
  )
}
