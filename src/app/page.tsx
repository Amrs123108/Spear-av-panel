'use client'
// app/page.tsx — VISTA DIRECTIVO (solo lectura)
// Esta pantalla está pensada para el dueño y gerentes.
// NO tiene controles de carga, edición ni administración.
// Acceso: cualquiera con el link

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Sparkles, Brain, RefreshCw, ChevronDown, ChevronUp, Info } from 'lucide-react'
import {
  BannerBolsaCritica, ComponenteBolsa, SemaforoLabel,
  SelectorMes, BannerEstadoMes, Delta, TooltipMetrica, TEXTO_METRICA_ESTIMADA
} from '@/components/shared'
import { PantallapisoVsAV } from '@/components/directivo/PisoVsAV'
import { DashboardData, MetricaCarteraUI } from '@/types'
import { Fragment } from 'react'

type Tab = 'resumen' | 'carteras' | 'piso_av' | 'historico'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('es-PA', { maximumFractionDigits: 0 })

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold tracking-widest uppercase text-amber-700">{children}</div>
}

function Divider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent my-6" />
}

// ── KPI Hero ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, tooltip }: {
  label: string; value: string; sub?: string
  accent?: 'gold' | 'navy' | 'green' | 'amber'
  tooltip?: string
}) {
  const borders = { gold: 'border-t-amber-500', navy: 'border-t-[#0F2444]', green: 'border-t-emerald-600', amber: 'border-t-amber-600' }
  return (
    <div className={`bg-white border border-slate-200 border-t-2 ${borders[accent ?? 'navy']} rounded-lg p-6 shadow-sm`}>
      <Eyebrow>{label}</Eyebrow>
      <div className="text-4xl font-bold tabular-nums mt-3 text-[#0F2444] leading-tight">{value}</div>
      {sub && (
        <div className="text-xs text-slate-500 mt-3 font-medium">
          {tooltip ? (
            <TooltipMetrica texto={tooltip}>{sub}</TooltipMetrica>
          ) : sub}
        </div>
      )}
    </div>
  )
}

// ── Tabla de carteras (read-only) ─────────────────────────────────────────────

function TablaCarterasReadOnly({ carteras }: { carteras: MetricaCarteraUI[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-[#0F2444] to-[#1A3458]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-amber-400">Portfolio Analysis</div>
            <h3 className="font-serif text-2xl font-semibold text-white mt-1">Detalle por Cartera</h3>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-300 font-semibold tracking-widest uppercase">Inversión Total AV</div>
            <div className="text-2xl font-bold text-white tabular-nums mt-1">
              {fmt(carteras.reduce((s, c) => s + c.inversionAV, 0))}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Cartera', 'Min. AV', 'Inv. AV', 'Honorario', '% Hon. al AV', 'vs Mes Ant.', 'Estado', ''].map((h, i) => (
                <th key={i} className={`px-${i === 0 ? 6 : 3} py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 ${i === 0 ? 'text-left' : i < 7 ? 'text-right' : 'text-center'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carteras.map(c => (
              <Fragment key={c.nombre}>
                <tr
                  onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}
                  className={`border-b border-slate-100 cursor-pointer transition-colors ${expanded === c.nombre ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#0F2444]">{c.nombre}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{fmt(c.clientes)} clientes · {c.asesores} asesores</div>
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums font-semibold text-[#0F2444]">
                    {c.minutosAV > 0 ? fmt(c.minutosAV) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums text-[#0F2444]">
                    {c.inversionAV > 0 ? fmt(c.inversionAV) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums font-semibold text-[#0F2444]">
                    {fmt(c.honorario)}
                    {c.base > 0 && <div className="text-[11px] text-slate-500 font-normal">Base: {fmt(c.base)}</div>}
                  </td>
                  <td className="px-3 py-4 text-right">
                    {c.pctHonorarioAlAV > 0 ? (
                      <span className={`tabular-nums font-bold text-base ${c.pctHonorarioAlAV < 10 ? 'text-emerald-700' : c.pctHonorarioAlAV < 30 ? 'text-emerald-600' : c.pctHonorarioAlAV < 60 ? 'text-amber-700' : 'text-red-800'}`}>
                        {c.pctHonorarioAlAV.toFixed(1)}%
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-4 text-right"><Delta v={c.honorario - c.honorarioMesAnterior} /></td>
                  <td className="px-3 py-4 text-center"><SemaforoLabel s={c.semaforo} /></td>
                  <td className="px-3 py-4 text-slate-400 text-center">
                    {expanded === c.nombre ? <ChevronUp className="w-4 h-4 mx-auto" /> : <ChevronDown className="w-4 h-4 mx-auto" />}
                  </td>
                </tr>
                {expanded === c.nombre && (
                  <tr className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-200">
                    <td colSpan={8} className="px-6 py-6">
                      <div className="grid md:grid-cols-4 gap-6">
                        <div>
                          <Eyebrow>Operación AV</Eyebrow>
                          <dl className="space-y-2 text-sm mt-3">
                            <div className="flex justify-between"><dt className="text-slate-600">Llamadas:</dt><dd className="tabular-nums font-semibold text-[#0F2444]">{fmt(c.llamadasAV)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Efectivas:</dt><dd className="tabular-nums font-semibold text-[#0F2444]">{fmt(c.efectivasAV)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Promesas:</dt><dd className="tabular-nums font-semibold text-emerald-700">{c.promesasAV}</dd></div>
                          </dl>
                        </div>
                        <div>
                          <Eyebrow>Costos</Eyebrow>
                          <dl className="space-y-2 text-sm mt-3">
                            <div className="flex justify-between"><dt className="text-slate-600">AV:</dt><dd className="tabular-nums text-[#0F2444]">{fmt(c.inversionAV)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Piso:</dt><dd className="tabular-nums text-[#0F2444]">{fmt(c.costoPiso)}</dd></div>
                            <div className="flex justify-between pt-1.5 border-t border-amber-200/40"><dt className="font-semibold text-[#0F2444]">Total:</dt><dd className="tabular-nums font-bold text-[#0F2444]">{fmt(c.costoTotal)}</dd></div>
                          </dl>
                        </div>
                        <div>
                          <Eyebrow>Rol del AV</Eyebrow>
                          <div className="mt-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold bg-[#F5EAD0] text-amber-800 border border-amber-200">
                              {c.rolAV === 'liberacion' ? '⚡ Liberación de Capacidad' : '📡 Ampliación de Cobertura'}
                            </span>
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{c.descripcionRolAV}</p>
                            {c.horasLiberadas > 0 && (
                              <div className="mt-2 text-xs text-emerald-700 font-semibold">
                                <TooltipMetrica texto={TEXTO_METRICA_ESTIMADA}>
                                  {c.horasLiberadas.toFixed(1)}h liberadas al asesor
                                </TooltipMetrica>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <Eyebrow>Diagnóstico</Eyebrow>
                          <p className="text-sm text-slate-700 leading-relaxed mt-3">{c.motivo}</p>
                          <div className="mt-3 p-3 border-l-2 border-amber-500 bg-amber-50/50 rounded-r text-sm text-[#0F2444]">
                            {c.accion}
                          </div>
                        </div>
                      </div>

                      {/* Advertencia de atribución */}
                      <div className="mt-4 flex items-start gap-2 p-3 bg-white border border-slate-200 rounded-lg">
                        <Info className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          <span className="font-semibold text-[#0F2444]">Limitación de análisis: </span>
                          No podemos atribuir el honorario exclusivamente al AV — el piso también estaba activo. Lo verificable: el AV aumentó el volumen de contacto y liberó tiempo de asesores.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Gráfico histórico ─────────────────────────────────────────────────────────

function GraficoHistorico({ historico }: { historico: DashboardData['historico'] }) {
  const data = historico.map(m => ({
    name: m.label.split(' ')[0],
    honorario: m.honorarioTotal,
    inversion: m.inversionAV,
  }))
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <Eyebrow>Historical Performance</Eyebrow>
          <h3 className="font-serif text-2xl font-semibold mt-1 text-[#0F2444]">Inversión vs Recuperación</h3>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#0F2444]" /><span className="font-semibold text-slate-700">Honorario</span></span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-500" /><span className="font-semibold text-slate-700">Inversión AV</span></span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
          <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #B8924A', borderRadius: '4px', padding: '10px' }} formatter={(v: number) => [v.toLocaleString('es-PA'), '']} />
          <Bar dataKey="honorario" fill="#0F2444" radius={[2, 2, 0, 0]} maxBarSize={48} />
          <Bar dataKey="inversion" fill="#F59E0B" radius={[2, 2, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PÁGINA DIRECTIVO
// ════════════════════════════════════════════════════════════════════════════

export default function PageDirectivo() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('resumen')
  const [mesIdx, setMesIdx] = useState(-1)
  const [lastUpdate, setLastUpdate] = useState('')

  const fetchData = useCallback(async (idx: number) => {
    setLoading(true)
    try {
      // Determinar si es mes cerrado para aprovechar caché
      const esCerrado = idx >= 0 && idx < (data?.historico.length ?? 0) - 1
      const params = new URLSearchParams({ mes: String(idx) })
      if (esCerrado) params.set('cerrado', '1')

      const res = await fetch(`/api/data?${params}`, { cache: esCerrado ? 'force-cache' : 'no-store' })
      const d: DashboardData = await res.json()
      if (d.ok) {
        setData(d)
        if (idx === -1) setMesIdx(d.mesActualIdx)
      }
      setLastUpdate(new Date().toLocaleString('es-PA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }))
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [data?.historico.length])

  useEffect(() => { fetchData(-1) }, [])

  const cambiarMes = (idx: number) => { setMesIdx(idx); fetchData(idx) }

  if (loading && !data) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F1]">
      <div className="text-center">
        <div className="w-1 h-1 bg-amber-500 mx-auto mb-6 rounded-full animate-pulse" />
        <div className="font-serif text-2xl text-[#0F2444]">SPEAR</div>
        <div className="text-xs text-slate-500 mt-2 tracking-widest uppercase">Cargando panel ejecutivo</div>
      </div>
    </div>
  )
  if (!data) return <div className="min-h-screen flex items-center justify-center text-red-900">Error al cargar</div>

  const { mesActual, carteras, historico, bolsa, estadoMes, mensajeEstado } = data
  const verdes = carteras.filter(c => c.semaforo === 'verde').length
  const rojas = carteras.filter(c => c.semaforo === 'rojo').length

  return (
    <div className="min-h-screen bg-[#FAF7F1]">
      {/* Alerta de bolsa crítica — banner persistente */}
      <BannerBolsaCritica saldo={bolsa.saldoActual} />

      {/* HEADER */}
      <header className="border-b border-amber-200/30 sticky top-0 z-40 backdrop-blur-md bg-white/90"
        style={{ top: bolsa.saldoActual < 2000 ? '48px' : '0' }}>
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              {/* Logo IA */}
              <div className="w-11 h-11 rounded-md flex items-center justify-center relative"
                style={{ background: 'linear-gradient(135deg, #0F2444 0%, #1A3458 100%)' }}>
                <Sparkles className="w-4.5 h-4.5 absolute text-amber-400" style={{ top: '7px', left: '7px' }} />
                <Brain className="w-4 h-4 absolute text-amber-400 opacity-60" style={{ bottom: '7px', right: '7px' }} />
              </div>
              <div>
                <h1 className="font-serif text-lg font-semibold tracking-tight text-[#0F2444]">SPEAR</h1>
                <p className="text-[10px] tracking-widest uppercase font-semibold text-amber-700">Asesor Virtual IA · Panel Ejecutivo</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <SelectorMes historico={historico} currentIdx={mesIdx >= 0 ? mesIdx : data.mesActualIdx} onChange={cambiarMes} />
              <button onClick={() => fetchData(mesIdx)} className="p-2.5 rounded hover:bg-slate-100 transition-colors">
                <RefreshCw className={`w-4 h-4 text-[#0F2444] ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {([
              ['resumen', 'Resumen Ejecutivo'],
              ['carteras', 'Análisis por Cartera'],
              ['piso_av', 'Piso vs AV'],
              ['historico', 'Histórico'],
            ] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-6 py-3 text-xs font-semibold transition-all whitespace-nowrap tracking-wider uppercase border-b-2 ${tab === k ? 'border-amber-500 text-[#0F2444]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10 space-y-8">

        {/* Banner estado del mes */}
        <BannerEstadoMes estado={estadoMes} mensaje={mensajeEstado} />

        {/* ── RESUMEN ── */}
        {tab === 'resumen' && (
          <>
            {/* Veredicto */}
            <div className="bg-white border border-slate-200 border-t-2 border-t-[#0F2444] rounded-lg p-10 shadow-sm">
              <div className="flex flex-wrap items-start gap-8">
                <div className="flex-1 min-w-0">
                  <Eyebrow>{mesActual.label} · Veredicto Ejecutivo</Eyebrow>
                  <h2 className="font-serif text-5xl font-semibold mt-3 leading-tight text-[#0F2444]">
                    {mesActual.honorarioTotal === 0 ? 'Esperando datos del mes' :
                      mesActual.sePaga ? 'La inversión genera retorno' : 'La inversión requiere optimización'}
                  </h2>
                  <p className="text-slate-700 text-base leading-relaxed mt-4 max-w-2xl">
                    {mesActual.honorarioTotal === 0
                      ? 'El mes en curso aún no tiene honorarios registrados.'
                      : mesActual.sePaga
                        ? <>Por cada unidad invertida en el AV, el portafolio generó <strong className="tabular-nums text-lg text-[#0F2444]">{mesActual.roiMultiplo.toFixed(2)}</strong> de honorario adicional sobre la base histórica.</>
                        : <>El honorario incremental no cubre la inversión de {fmt(mesActual.inversionAV)}. Ver recomendaciones.</>}
                  </p>
                </div>
                <div className="text-right border-l border-amber-200/40 pl-8">
                  <Eyebrow>ROI vs Base Histórica</Eyebrow>
                  <div className="text-7xl font-bold tabular-nums mt-2 leading-none text-[#0F2444]">
                    {mesActual.roiMultiplo > 0 ? mesActual.roiMultiplo.toFixed(1) : '—'}
                    <span className="text-amber-500">{mesActual.roiMultiplo > 0 ? '×' : ''}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">referencia aproximada</div>
                </div>
              </div>
            </div>

            {/* Advertencia de atribución */}
            <div className="flex items-start gap-4 p-5 bg-amber-50/60 border border-amber-200/60 rounded-lg">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-[#0F2444] mb-1">Sobre la interpretación del retorno</div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  El incremento de honorario no puede atribuirse exclusivamente al AV. Lo verificable: el AV realizó{' '}
                  <strong className="tabular-nums">{fmt(mesActual.totalGestionesAV)}</strong> gestiones adicionales y liberó{' '}
                  <strong className="tabular-nums">{mesActual.totalHorasLiberadas}</strong> horas de asesores.{' '}
                  <TooltipMetrica texto={TEXTO_METRICA_ESTIMADA}>
                    <span className="underline decoration-dotted cursor-help text-slate-500">Métricas estimadas</span>
                  </TooltipMetrica>
                </p>
              </div>
            </div>

            <Divider />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <KpiCard label="Inversión AV" value={fmt(mesActual.inversionAV)} sub="Costo fijo mensual" accent="gold" />
              <KpiCard label="Honorario Total" value={fmt(mesActual.honorarioTotal)}
                sub={mesActual.deltaVsMesAnterior !== 0 ? `${mesActual.deltaVsMesAnterior >= 0 ? '▲' : '▼'} ${fmt(Math.abs(mesActual.deltaVsMesAnterior))} vs mes ant.` : 'Sin comparativo'} accent="navy" />
              <KpiCard label="% Hon. al AV" value={mesActual.pctHonorarioTotalAlAV > 0 ? `${mesActual.pctHonorarioTotalAlAV.toFixed(2)}%` : '—'}
                sub="Del honorario total cobrado" accent="green"
                tooltip={TEXTO_METRICA_ESTIMADA} />
              <KpiCard label="Minutos Consumidos" value={fmt(mesActual.minutosConsumidos)}
                sub={mesActual.minutosConsumidos > 0 ? `${mesActual.costoXMinuto.toFixed(3)} costo efectivo/min` : 'Sin consumo'} accent="amber" />
            </div>

            <Divider />

            {/* Bolsa + Composición */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ComponenteBolsa bolsa={bolsa} minutosConsumidosMesActual={mesActual.minutosConsumidos} />
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-7 shadow-sm">
                <Eyebrow>Portfolio Distribution</Eyebrow>
                <h3 className="font-serif text-xl font-semibold mt-1 mb-5 text-[#0F2444]">Composición</h3>
                <div className="space-y-4">
                  {[['verde', verdes, 'Rentables'], ['amarillo', carteras.filter(c => c.semaforo === 'amarillo').length, 'En Revisión'], ['rojo', rojas, 'No Rentables']].map(([s, n, l]) => (
                    <div key={s as string} className="flex items-center justify-between pb-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${{ verde: 'bg-emerald-600', amarillo: 'bg-amber-500', rojo: 'bg-red-600' }[s as string]}`} />
                        <span className="text-sm font-semibold text-[#0F2444]">{l as string}</span>
                      </div>
                      <span className="text-2xl font-bold tabular-nums text-[#0F2444]">{n as number}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-amber-200/30">
                  <Eyebrow>Con Valor Evidenciado</Eyebrow>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-amber-700 tabular-nums">{mesActual.carterasConValor}</span>
                    <span className="text-xs text-slate-500">carteras con impacto AV verificable</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── CARTERAS ── */}
        {tab === 'carteras' && (
          <>
            <div>
              <Eyebrow>Portfolio Analysis</Eyebrow>
              <h2 className="font-serif text-4xl font-semibold mt-2 text-[#0F2444]">Análisis por Cartera</h2>
              <p className="text-sm text-slate-500 mt-2">Click en una cartera para ver el análisis detallado.</p>
            </div>
            <TablaCarterasReadOnly carteras={carteras} />
          </>
        )}

        {/* ── PISO VS AV ── */}
        {tab === 'piso_av' && (
          <PantallapisoVsAV
            carteras={carteras}
            productividad={data.productividadAsesores ?? []}
          />
        )}

        {/* ── HISTÓRICO ── */}
        {tab === 'historico' && (
          <>
            <div>
              <Eyebrow>Historical Performance</Eyebrow>
              <h2 className="font-serif text-4xl font-semibold mt-2 text-[#0F2444]">Histórico de Resultados</h2>
            </div>
            <GraficoHistorico historico={historico} />
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
                <Eyebrow>Detalle Mensual</Eyebrow>
                <h3 className="font-serif text-xl font-semibold mt-1 text-[#0F2444]">Desempeño por Período</h3>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200">
                  {['Período', 'Inversión AV', 'Honorario', 'vs Mes Ant.', 'AV se pagó', 'Múltiplo'].map(h => (
                    <th key={h} className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-600 text-left">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {historico.map((m, i) => {
                    const ant = historico[i - 1]
                    const delta = ant ? m.honorarioTotal - ant.honorarioTotal : 0
                    const roiX = m.inversionAV > 0 ? m.honorarioTotal / m.inversionAV : 0
                    return (
                      <tr key={m.mes} onClick={() => cambiarMes(i)}
                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${i === (mesIdx >= 0 ? mesIdx : data.mesActualIdx) ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-base font-semibold text-[#0F2444]">{m.label}</span>
                            {m.avActivo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-800">AV</span>}
                            {m.esMesActual && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-100 text-emerald-800">ACTUAL</span>}
                            {m.minutosConsumidos > 0 && m.honorarioTotal === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-600">Pend.</span>}
                          </div>
                          {m.nota && <div className="text-[11px] text-slate-500 mt-0.5 italic">{m.nota}</div>}
                        </td>
                        <td className="px-5 py-4 tabular-nums text-sm">{m.inversionAV > 0 ? fmt(m.inversionAV) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-5 py-4 tabular-nums text-sm font-semibold text-[#0F2444]">{m.honorarioTotal > 0 ? fmt(m.honorarioTotal) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-5 py-4">{i > 0 && m.honorarioTotal > 0 ? <Delta v={delta} /> : <span className="text-slate-300">—</span>}</td>
                        <td className="px-5 py-4">
                          {m.inversionAV > 0 && m.honorarioTotal > 0
                            ? <span className={`text-xs font-semibold px-2 py-0.5 rounded ${m.honorarioTotal >= m.inversionAV ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-900'}`}>
                                {m.honorarioTotal >= m.inversionAV ? 'Sí' : 'No'}
                              </span>
                            : <span className="text-slate-300 text-xs">{m.inversionAV === 0 ? 'Sin AV' : 'Pendiente'}</span>}
                        </td>
                        <td className="px-5 py-4 tabular-nums font-bold text-sm">
                          {roiX > 0 ? <span className={roiX >= 5 ? 'text-emerald-700' : roiX >= 2 ? 'text-amber-700' : 'text-red-800'}>{roiX.toFixed(1)}×</span> : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-amber-200/20 bg-white/60 mt-16">
        <div className="max-w-7xl mx-auto px-8 py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-amber-700">SPEAR</span>
            <span className="w-px h-3 bg-slate-300" />
            <span className="text-xs text-slate-500">Panel Ejecutivo del Asesor Virtual IA</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400 tracking-wider uppercase">{lastUpdate}</span>
            <a href="/admin" className="text-[10px] font-semibold px-3 py-1.5 rounded border border-slate-300 text-slate-500 hover:bg-slate-100 transition-colors">
              Admin →
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
