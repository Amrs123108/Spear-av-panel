'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, RefreshCw, Upload, Target, DollarSign, Zap, Activity } from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────
const fmt = (n: number) => `B/.${n.toLocaleString('es-PA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtDec = (n: number) => `B/.${n.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function SemaforoIcon({ s }: { s: 'verde' | 'amarillo' | 'rojo' }) {
  if (s === 'verde') return <CheckCircle className="w-5 h-5 text-emerald-400" />
  if (s === 'rojo') return <XCircle className="w-5 h-5 text-red-400" />
  return <AlertTriangle className="w-5 h-5 text-yellow-400" />
}

function Delta({ v, prefix = 'B/.' }: { v: number; prefix?: string }) {
  const pos = v >= 0
  return (
    <span className={`flex items-center gap-1 font-bold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
      {pos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      {pos ? '+' : ''}{prefix}{Math.abs(v).toLocaleString('es-PA', { maximumFractionDigits: 0 })}
    </span>
  )
}

// ── Componentes ───────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-xl p-5 border ${color} flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
        <div className="opacity-60">{icon}</div>
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
      {sub && <div className="text-xs opacity-60">{sub}</div>}
    </div>
  )
}

function BolsaMinutos({ bolsa, consumidos }: { bolsa: DashData['bolsa']; consumidos: number }) {
  const total = bolsa.saldoActual + consumidos
  const pct = total > 0 ? (bolsa.saldoActual / total) * 100 : 0
  const color = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-gray-300 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" />BOLSA DE MINUTOS</span>
        <span className="text-xs text-gray-500">14,000 min/mes</span>
      </div>
      <div className="flex items-end gap-3 mb-3">
        <span className="text-4xl font-black text-white">{bolsa.saldoActual.toLocaleString()}</span>
        <span className="text-gray-400 mb-1">min disponibles</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
        <div className={`h-3 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{consumidos.toLocaleString()} consumidos este mes</span>
        <span>{pct.toFixed(0)}% disponible</span>
      </div>
    </div>
  )
}

function TablaCarteras({ carteras }: { carteras: CarteraMetrica[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      {carteras.map(c => (
        <div key={c.nombre} className={`rounded-xl border transition-all ${c.semaforo === 'verde' ? 'border-emerald-800 bg-emerald-950/30' : c.semaforo === 'rojo' ? 'border-red-900 bg-red-950/20' : 'border-yellow-900 bg-yellow-950/20'}`}>
          {/* Fila principal */}
          <button className="w-full px-4 py-3 flex items-center gap-3 text-left" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
            <SemaforoIcon s={c.semaforo} />
            <span className="font-bold text-sm flex-1">{c.nombre}</span>
            {/* Métricas compactas */}
            <div className="hidden md:flex items-center gap-6 text-xs">
              <div className="text-center">
                <div className="text-gray-400">Inversión AV</div>
                <div className="font-bold text-white">{c.costoAV > 0 ? fmt(c.costoAV) : '—'}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400">Honorario</div>
                <div className="font-bold text-white">{fmt(c.honorario)}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400">vs mes ant.</div>
                <Delta v={c.honorario - c.honorarioMesAnterior} />
              </div>
              <div className="text-center">
                <div className="text-gray-400">B/.×B/.1</div>
                <div className={`font-bold ${c.retornoXBalboa >= 3 ? 'text-emerald-400' : c.retornoXBalboa >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {c.retornoXBalboa > 0 ? `${c.retornoXBalboa.toFixed(1)}x` : '—'}
                </div>
              </div>
            </div>
            {expanded === c.nombre ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {/* Detalle expandible */}
          {expanded === c.nombre && (
            <div className="px-4 pb-4 border-t border-gray-700/50 pt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-2 font-semibold uppercase">Operación</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Clientes:</span><span>{c.clientes.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Asesores:</span><span>{c.asesores}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Minutos AV:</span><span>{c.minutosAV.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Llamadas:</span><span>{c.llamadas.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Promesas:</span><span className="text-emerald-400 font-bold">{c.promesas}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Cobertura:</span><span>{c.pctCobertura}%</span></div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-2 font-semibold uppercase">Costos</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">AV:</span><span>{c.costoAV > 0 ? fmt(c.costoAV) : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Piso:</span><span>{fmt(c.costoPiso)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Masivos:</span><span>{fmt(c.masivos)}</span></div>
                  <div className="flex justify-between border-t border-gray-700 pt-1 mt-1"><span className="text-gray-300 font-bold">Total:</span><span className="font-bold">{fmt(c.costoTotal)}</span></div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-2 font-semibold uppercase">Honorario</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Base sin AV:</span><span>{c.base > 0 ? fmt(c.base) : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Mes anterior:</span><span>{fmt(c.honorarioMesAnterior)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Mes actual:</span><span className="font-bold text-white">{fmt(c.honorario)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Δ vs anterior:</span><Delta v={c.honorario - c.honorarioMesAnterior} /></div>
                  <div className="flex justify-between"><span className="text-gray-400">Δ vs base:</span>{c.delta !== 0 ? <Delta v={c.delta} /> : <span className="text-gray-500">—</span>}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-2 font-semibold uppercase">Diagnóstico</div>
                <div className="space-y-2 text-sm">
                  <div className={`px-2 py-1 rounded text-xs ${c.semaforo === 'verde' ? 'bg-emerald-900/50 text-emerald-300' : c.semaforo === 'rojo' ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                    {c.motivo}
                  </div>
                  <div className="text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded">
                    <span className="font-bold">Acción: </span>{c.accion}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function GraficoHistorico({ historico }: { historico: DashData['historico'] }) {
  const data = historico.map(m => ({
    name: m.label.replace(' 20', "'").replace('2025', "'25").replace('2026', "'26"),
    honorario: m.honorarioTotal,
    inversion: m.inversionAV,
    avActivo: m.avActivo,
  }))
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-200 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" />INVERSIÓN VS HONORARIO — HISTÓRICO</h3>
        <div className="flex gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Honorario</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />Inversión AV</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#F9FAFB' }} formatter={(v: number) => [`B/.${v.toLocaleString()}`, '']} />
          <Bar dataKey="honorario" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="inversion" fill="#F97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function PanelPlan({ planes }: { planes: Plan[] }) {
  const [expanded, setExpanded] = useState(true)
  const plan = planes[0]
  if (!plan) return null
  const completadas = plan.acciones.filter(a => a.completada).length
  const total = plan.acciones.length
  const pct = total > 0 ? (completadas / total) * 100 : 0

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700">
      <button className="w-full px-5 py-4 flex items-center justify-between" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-purple-400" />
          <div className="text-left">
            <div className="font-bold text-white">PLAN DE LA SEMANA</div>
            <div className="text-xs text-gray-400">{plan.semana}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-bold text-purple-400">{completadas}/{total} acciones</div>
            <div className="w-24 bg-gray-700 rounded-full h-2 mt-1">
              <div className="h-2 rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-700/50 pt-4">
          {plan.acciones.map(a => (
            <div key={a.id} className={`flex gap-3 p-3 rounded-lg ${a.completada ? 'bg-emerald-950/40 border border-emerald-800/50' : 'bg-gray-750 border border-gray-700'}`}>
              <div className="mt-0.5">
                {a.completada
                  ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                  : <Clock className="w-5 h-5 text-gray-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${a.completada ? 'line-through text-gray-500' : 'text-white'}`}>{a.descripcion}</div>
                <div className="flex flex-wrap gap-3 mt-1">
                  <span className="text-xs text-gray-400">👤 {a.responsable}</span>
                  <span className="text-xs text-emerald-400">📈 {a.impactoEsperado}</span>
                </div>
                {a.resultado && <div className="text-xs text-blue-300 mt-1 bg-blue-900/20 px-2 py-1 rounded">{a.resultado}</div>}
              </div>
            </div>
          ))}
          {plan.notas && (
            <div className="bg-gray-750 border border-gray-600 rounded-lg p-3 text-sm text-gray-300 mt-2">
              <span className="font-bold text-gray-400">Notas: </span>{plan.notas}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────
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
      setLastUpdate(new Date().toLocaleTimeString('es-PA'))
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-gray-400">Cargando panel...</div>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-red-400">Error al cargar datos</div>
    </div>
  )

  const { mesActual, carteras, historico, bolsa } = data
  const verdes = carteras.filter(c => c.semaforo === 'verde').length
  const rojas = carteras.filter(c => c.semaforo === 'rojo').length

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-sm">S</div>
            <div>
              <div className="font-black text-white text-sm">SPEAR — ASESOR VIRTUAL</div>
              <div className="text-xs text-gray-400">Panel de Control · {mesActual.label}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Act. {lastUpdate}</span>
            <button onClick={fetchData} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 px-4">
        <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
          {(['resumen', 'carteras', 'historico', 'plan'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${tab === t ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
              {t === 'resumen' ? '📊 Resumen' : t === 'carteras' ? '📋 Por Cartera' : t === 'historico' ? '📈 Histórico' : '🎯 Plan'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── TAB RESUMEN ── */}
        {tab === 'resumen' && (
          <>
            {/* Respuesta directa */}
            <div className={`rounded-2xl p-6 border-2 ${mesActual.sePaga ? 'bg-emerald-950/50 border-emerald-600' : 'bg-red-950/50 border-red-600'}`}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-5xl">{mesActual.sePaga ? '✅' : '❌'}</div>
                <div>
                  <div className="text-2xl font-black text-white">
                    {mesActual.sePaga ? 'EL AV SE ESTÁ PAGANDO' : 'EL AV NO SE PAGA SOLO AÚN'}
                  </div>
                  <div className="text-gray-300 mt-1">
                    {mesActual.sePaga
                      ? `Por cada B/.1 invertido en el AV, se generaron B/.${mesActual.roiMultiplo.toFixed(2)} de honorario incremental.`
                      : `El honorario incremental (${fmt(mesActual.incrementoVsBase)}) no cubre la inversión (${fmt(mesActual.inversionAV)}). Ver acciones en Plan.`}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-4xl font-black text-white">{mesActual.roiMultiplo.toFixed(1)}x</div>
                  <div className="text-xs text-gray-400">retorno sobre inversión AV</div>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Inversión AV" value={fmt(mesActual.inversionAV)} sub="Fijo + minutos consumidos" color="border-orange-800 bg-orange-950/30 text-orange-100" icon={<DollarSign className="w-5 h-5" />} />
              <KpiCard label="Honorario total" value={fmt(mesActual.honorarioTotal)} sub={`${mesActual.deltaVsMesAnterior >= 0 ? '▲' : '▼'} ${fmt(Math.abs(mesActual.deltaVsMesAnterior))} vs mes ant.`} color="border-blue-800 bg-blue-950/30 text-blue-100" icon={<TrendingUp className="w-5 h-5" />} />
              <KpiCard label="Carteras en verde" value={`${verdes} / ${carteras.length}`} sub={`${rojas} en rojo, ${carteras.length - verdes - rojas} en revisión`} color="border-emerald-800 bg-emerald-950/30 text-emerald-100" icon={<CheckCircle className="w-5 h-5" />} />
              <KpiCard label="Minutos consumidos" value={mesActual.minutosConsumidos.toLocaleString()} sub="de 14,000 disponibles/mes" color="border-yellow-800 bg-yellow-950/30 text-yellow-100" icon={<Zap className="w-5 h-5" />} />
            </div>

            {/* Alerta vs mes anterior */}
            <div className={`rounded-xl p-4 border flex items-center gap-3 ${mesActual.deltaVsMesAnterior >= 0 ? 'bg-emerald-950/30 border-emerald-800' : 'bg-red-950/30 border-red-800'}`}>
              {mesActual.deltaVsMesAnterior >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <TrendingDown className="w-5 h-5 text-red-400 flex-shrink-0" />}
              <div>
                <span className="font-bold text-white">vs {historico[historico.length - 2]?.label || 'mes anterior'}: </span>
                <span className={mesActual.deltaVsMesAnterior >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {mesActual.deltaVsMesAnterior >= 0 ? '+' : ''}{fmt(mesActual.deltaVsMesAnterior)} en honorario
                </span>
                <span className="text-gray-400 text-sm ml-2">
                  {mesActual.deltaVsMesAnterior >= 0 ? '— Vamos mejor que el mes pasado ✓' : '— Revisión necesaria. Ver plan de acción →'}
                </span>
              </div>
            </div>

            {/* Bolsa + Semáforo rápido */}
            <div className="grid md:grid-cols-2 gap-4">
              <BolsaMinutos bolsa={bolsa} consumidos={mesActual.minutosConsumidos} />
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />SEMÁFORO POR CARTERA
                </h3>
                <div className="space-y-2">
                  {carteras.filter(c => c.minutosAV > 0 || c.honorario > 0).map(c => (
                    <div key={c.nombre} className="flex items-center gap-3">
                      <SemaforoIcon s={c.semaforo} />
                      <span className="text-sm flex-1">{c.nombre}</span>
                      <span className="text-sm font-bold text-white">{fmt(c.honorario)}</span>
                      <Delta v={c.honorario - c.honorarioMesAnterior} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── TAB CARTERAS ── */}
        {tab === 'carteras' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Análisis por Cartera</h2>
              <div className="text-sm text-gray-400">Haz click en una cartera para ver el detalle completo</div>
            </div>
            {/* Resumen rápido arriba */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Invertido en AV', value: fmt(carteras.reduce((s, c) => s + c.costoAV, 0)), color: 'text-orange-400' },
                { label: 'Honorario total', value: fmt(carteras.reduce((s, c) => s + c.honorario, 0)), color: 'text-blue-400' },
                { label: 'Margen neto', value: fmt(carteras.reduce((s, c) => s + c.honorario - c.costoTotal, 0)), color: 'text-emerald-400' },
              ].map(k => (
                <div key={k.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                  <div className="text-xs text-gray-400 mb-1">{k.label}</div>
                  <div className={`text-xl font-black ${k.color}`}>{k.value}</div>
                </div>
              ))}
            </div>
            <TablaCarteras carteras={carteras} />
          </div>
        )}

        {/* ── TAB HISTÓRICO ── */}
        {tab === 'historico' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Inversión vs Recuperación — Histórico</h2>
            <GraficoHistorico historico={historico} />
            {/* Tabla histórica */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-700">
                    {['MES', 'INVERSIÓN AV', 'HONORARIO TOTAL', 'Δ vs MES ANT.', '¿AV SE PAGÓ?', 'B/. × B/.1', 'TENDENCIA'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historico.map((m, i) => {
                    const ant = historico[i - 1]
                    const delta = ant ? m.honorarioTotal - ant.honorarioTotal : 0
                    const roiX = m.inversionAV > 0 ? m.honorarioTotal / m.inversionAV : 0
                    const tendencia = i === 0 ? '—' : delta > 0 ? '▲ SUBE' : delta < 0 ? '▼ BAJA' : '→ IGUAL'
                    return (
                      <tr key={m.mes} className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'} ${m.avActivo ? 'ring-1 ring-inset ring-blue-800/30' : ''}`}>
                        <td className="px-4 py-3 font-bold text-white">
                          {m.label}
                          {m.avActivo && <span className="ml-2 text-xs text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">AV</span>}
                        </td>
                        <td className="px-4 py-3">{m.inversionAV > 0 ? fmt(m.inversionAV) : <span className="text-gray-600">Sin AV</span>}</td>
                        <td className="px-4 py-3 font-bold text-white">{fmt(m.honorarioTotal)}</td>
                        <td className="px-4 py-3">{i > 0 ? <Delta v={delta} /> : '—'}</td>
                        <td className="px-4 py-3">
                          {m.inversionAV > 0
                            ? <span className={`px-2 py-1 rounded text-xs font-bold ${m.honorarioTotal >= m.inversionAV ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                                {m.honorarioTotal >= m.inversionAV ? 'SÍ ✓' : 'NO ✗'}
                              </span>
                            : <span className="text-gray-600 text-xs">Sin AV</span>}
                        </td>
                        <td className="px-4 py-3">
                          {roiX > 0 ? <span className={`font-bold ${roiX >= 5 ? 'text-emerald-400' : roiX >= 2 ? 'text-yellow-400' : 'text-red-400'}`}>{roiX.toFixed(1)}x</span> : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${tendencia.includes('▲') ? 'text-emerald-400' : tendencia.includes('▼') ? 'text-red-400' : 'text-gray-400'}`}>{tendencia}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Nota alerta leak */}
            <div className="bg-yellow-950/50 border border-yellow-700 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-200">
                <span className="font-bold">ALERTA ACTIVA — B/.3,007/mes no cobrados:</span> Las gestiones del AV en Banistmo Activa (B/.1,789) y Banistmo Recovery (B/.1,217) no se entregan al cliente en el formato requerido, por lo que no se cobra la comisión correspondiente. Resolver esto es el quick win #1.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB PLAN ── */}
        {tab === 'plan' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Plan Semanal y Seguimiento</h2>
              <div className="text-sm text-gray-400">Definido cada lunes · Seguimiento diario</div>
            </div>
            {/* Contexto para tomar decisiones */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-xs text-gray-400 font-bold uppercase mb-2">¿Vamos bien?</div>
                <div className={`text-lg font-black ${mesActual.deltaVsMesAnterior >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {mesActual.deltaVsMesAnterior >= 0 ? '✓ Mejor que mes anterior' : '✗ Por debajo del mes anterior'}
                </div>
                <div className="text-sm text-gray-400 mt-1">{fmt(Math.abs(mesActual.deltaVsMesAnterior))} de diferencia</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-xs text-gray-400 font-bold uppercase mb-2">Carteras críticas</div>
                {carteras.filter(c => c.semaforo === 'rojo' && c.minutosAV > 0).map(c => (
                  <div key={c.nombre} className="text-sm text-red-400 font-medium">{c.nombre}</div>
                ))}
                {carteras.filter(c => c.semaforo === 'rojo' && c.minutosAV > 0).length === 0 && <div className="text-sm text-emerald-400">Sin carteras en rojo</div>}
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-xs text-gray-400 font-bold uppercase mb-2">Quick win disponible</div>
                <div className="text-sm text-yellow-300 font-medium">Conversor formato Banistmo</div>
                <div className="text-xs text-gray-400 mt-1">+B/.3,007/mes en ingreso no cobrado</div>
              </div>
            </div>
            <PanelPlan planes={planes} />
          </div>
        )}
      </main>
    </div>
  )
}
