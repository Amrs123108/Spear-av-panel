'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line, LineChart } from 'recharts'
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, RefreshCw, ArrowUpRight, ArrowDownRight, Briefcase } from 'lucide-react'

interface CarteraMetrica {
  nombre: string; clientes: number; asesores: number; comisionPct: number; minutosAV: number
  promesas: number; llamadas: number; efectivas: number
  inversionAV: number; costoPiso: number; masivos: number; costoTotal: number
  honorario: number; honorarioMesAnterior: number; base: number
  delta: number; retornoXBalboa: number
  pctHonorarioAlAV: number; puntosComisionAlAV: number
  semaforo: 'verde' | 'amarillo' | 'rojo'
  motivo: string; accion: string; pctCobertura: number
}
interface DashData {
  mesActual: {
    label: string; inversionAV: number; inversionAsignada: number;
    honorarioTotal: number; honorarioAnterior: number; deltaVsMesAnterior: number;
    incrementoVsBase: number; roiMultiplo: number; minutosConsumidos: number;
    sePaga: boolean; pctHonorarioTotalAlAV: number; costoXMinuto: number;
  }
  carteras: CarteraMetrica[]
  historico: { mes: string; label: string; inversionAV: number; honorarioTotal: number; avActivo: boolean; minutosConsumidos: number }[]
  bolsa: { saldoActual: number; diaRecarga: number; cantidadRecarga: number; historial: { fecha: string; tipo: string; cantidad: number; descripcion: string }[] }
}
interface PlanAccion { id: string; descripcion: string; responsable: string; impactoEsperado: string; completada: boolean; resultado: string }
interface Plan { id: string; fecha: string; semana: string; estado: string; acciones: PlanAccion[]; notas: string; metaHonorario: number; honorarioRealizado: number }

const fmt = (n: number) => n.toLocaleString('es-PA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtDec = (n: number) => n.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtB = (n: number) => `B/.${fmt(n)}`

// ── Componentes ────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-eyebrow">{children}</div>
}

function Divider() {
  return <div className="divider-gold my-6" />
}

function Delta({ v, inline = false }: { v: number; inline?: boolean }) {
  if (v === 0) return <span className="text-slate-400 tabular">—</span>
  const pos = v > 0
  return (
    <span className={`inline-flex items-center gap-1 font-semibold tabular ${pos ? 'text-emerald-800' : 'text-red-900'} ${inline ? 'text-xs' : 'text-sm'}`}>
      {pos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
      {pos ? '+' : '-'}B/.{fmt(Math.abs(v))}
    </span>
  )
}

function StatusDot({ s }: { s: 'verde' | 'amarillo' | 'rojo' }) {
  const colors = {
    verde: 'bg-emerald-700',
    amarillo: 'bg-amber-600',
    rojo: 'bg-red-800',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[s]}`} />
}

function StatusLabel({ s }: { s: 'verde' | 'amarillo' | 'rojo' }) {
  const config = {
    verde: { label: 'Rentable', color: 'text-emerald-800', bg: 'bg-emerald-50/50', border: 'border-emerald-200/60' },
    amarillo: { label: 'En Revisión', color: 'text-amber-800', bg: 'bg-amber-50/50', border: 'border-amber-200/60' },
    rojo: { label: 'No Rentable', color: 'text-red-900', bg: 'bg-red-50/50', border: 'border-red-200/60' },
  }[s]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-[11px] font-semibold border tracking-wide ${config.color} ${config.bg} ${config.border}`}>
      <StatusDot s={s} />
      {config.label}
    </span>
  )
}

// ── KPI Hero — ejecutivo premium ──────────────────────────────────────
function HeroKPI({ label, value, sub, accent, isHero }: {
  label: string; value: string; sub?: string;
  accent?: 'gold' | 'navy' | 'success' | 'warning';
  isHero?: boolean;
}) {
  const accents = {
    gold: 'border-t-[#B8924A]',
    navy: 'border-t-[#0F2444]',
    success: 'border-t-emerald-700',
    warning: 'border-t-amber-600',
  }
  return (
    <div className={`card-premium-hero ${isHero ? 'p-8' : 'p-6'} ${accent ? `border-t-2 ${accents[accent]}` : ''} elevated`}>
      <Eyebrow>{label}</Eyebrow>
      <div className={`font-serif font-semibold text-navy-900 tabular mt-3 ${isHero ? 'text-5xl' : 'text-4xl'}`} style={{ color: '#0F2444' }}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-3 font-medium tracking-wide">{sub}</div>}
    </div>
  )
}

// ── Bolsa de minutos premium ──────────────────────────────────────────
function BolsaPremium({ bolsa, consumidos }: { bolsa: DashData['bolsa']; consumidos: number }) {
  const saldo = bolsa.saldoActual
  const consumoDiario = consumidos > 0 ? consumidos / 30 : 0
  const mesesRestantes = consumoDiario > 0 ? (saldo / (consumoDiario * 30)) : 0
  const diaActual = new Date().getDate()
  const diasParaRecarga = diaActual <= bolsa.diaRecarga
    ? bolsa.diaRecarga - diaActual
    : 30 - diaActual + bolsa.diaRecarga

  return (
    <div className="card-premium-hero p-8 elevated">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Eyebrow>Bolsa de Minutos</Eyebrow>
          <div className="text-headline text-2xl mt-1">Capital Disponible</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">Próxima Recarga</div>
          <div className="text-sm text-navy-900 font-semibold mt-1 tabular">Día {bolsa.diaRecarga}</div>
          <div className="text-xs text-slate-500">en {diasParaRecarga} días</div>
        </div>
      </div>

      <div className="text-center py-6 border-y border-[#B8924A]/15">
        <div className="font-serif text-7xl font-semibold tabular leading-none" style={{ color: '#0F2444' }}>
          {fmt(saldo)}
        </div>
        <div className="text-sm text-slate-500 mt-3 tracking-widest font-medium uppercase">minutos</div>
      </div>

      <div className="grid grid-cols-3 gap-6 mt-6">
        <div className="text-center">
          <div className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mb-2">Recarga Mensual</div>
          <div className="text-2xl font-serif font-semibold tabular" style={{ color: '#0F2444' }}>+{fmt(bolsa.cantidadRecarga)}</div>
          <div className="text-[11px] text-slate-400 mt-1">B/.4,000 incluidos</div>
        </div>
        <div className="text-center border-x border-slate-200/60">
          <div className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mb-2">Consumo Mes Ant.</div>
          <div className="text-2xl font-serif font-semibold tabular" style={{ color: '#0F2444' }}>{fmt(consumidos)}</div>
          <div className="text-[11px] text-slate-400 mt-1">{((consumidos / bolsa.cantidadRecarga) * 100).toFixed(0)}% del paquete</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mb-2">Cobertura</div>
          <div className="text-2xl font-serif font-semibold tabular gold-text">{mesesRestantes.toFixed(1)}</div>
          <div className="text-[11px] text-slate-400 mt-1">meses al ritmo actual</div>
        </div>
      </div>
    </div>
  )
}

// ── Tabla de carteras premium ─────────────────────────────────────────
function TablaCarterasPremium({ carteras }: { carteras: CarteraMetrica[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="card-premium-hero overflow-hidden elevated">
      <div className="px-8 py-5 border-b border-[#B8924A]/15 bg-gradient-to-r from-[#0F2444] to-[#1A3458]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#C9A663' }}>Portfolio Analysis</div>
            <h3 className="font-serif text-2xl font-semibold text-white mt-1">Detalle por Cartera</h3>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-300 font-semibold tracking-widest uppercase">Inversión Total Asignada</div>
            <div className="text-2xl font-serif font-semibold text-white tabular mt-1">{fmtB(carteras.reduce((s, c) => s + c.inversionAV, 0))}</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#FAF7F1] border-b border-[#B8924A]/15">
              <th className="px-8 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Cartera</th>
              <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Inversión AV</th>
              <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Honorario</th>
              <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">% Hon. al AV</th>
              <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">vs Mes Ant.</th>
              <th className="px-3 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">Estado</th>
              <th className="px-3 py-4 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {carteras.map((c, i) => (
              <Fragment key={c.nombre}>
                <tr className={`hover:bg-[#FAF7F1] cursor-pointer transition-colors border-b border-slate-100 ${expanded === c.nombre ? 'bg-[#FAF7F1]' : ''}`}
                  onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                  <td className="px-8 py-5">
                    <div className="font-semibold text-navy-900 text-sm tracking-tight" style={{ color: '#0F2444' }}>{c.nombre}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      {fmt(c.clientes)} clientes · {c.asesores} ases. · {c.comisionPct.toFixed(2)}% comisión
                    </div>
                  </td>
                  <td className="px-3 py-5 text-right tabular">
                    {c.inversionAV > 0 ? (
                      <>
                        <div className="text-sm font-semibold" style={{ color: '#0F2444' }}>{fmtB(c.inversionAV)}</div>
                        <div className="text-[11px] text-slate-500">{fmt(c.minutosAV)} min</div>
                      </>
                    ) : <span className="text-slate-400 text-sm">—</span>}
                  </td>
                  <td className="px-3 py-5 text-right tabular">
                    <div className="text-sm font-semibold" style={{ color: '#0F2444' }}>{fmtB(c.honorario)}</div>
                    {c.base > 0 && <div className="text-[11px] text-slate-500">Base: {fmtB(c.base)}</div>}
                  </td>
                  <td className="px-3 py-5 text-right tabular">
                    {c.pctHonorarioAlAV > 0 ? (
                      <div className={`text-base font-serif font-semibold ${
                        c.pctHonorarioAlAV < 10 ? 'text-emerald-800' :
                        c.pctHonorarioAlAV < 30 ? 'text-emerald-700' :
                        c.pctHonorarioAlAV < 60 ? 'text-amber-700' : 'text-red-900'
                      }`}>
                        {c.pctHonorarioAlAV.toFixed(1)}%
                      </div>
                    ) : <span className="text-slate-400 text-sm">—</span>}
                  </td>
                  <td className="px-3 py-5 text-right">
                    <Delta v={c.honorario - c.honorarioMesAnterior} />
                  </td>
                  <td className="px-3 py-5 text-center"><StatusLabel s={c.semaforo} /></td>
                  <td className="px-3 py-5 text-slate-400">
                    {expanded === c.nombre ? <ChevronUp className="w-4 h-4 mx-auto" /> : <ChevronDown className="w-4 h-4 mx-auto" />}
                  </td>
                </tr>
                {expanded === c.nombre && (
                  <tr className="bg-gradient-to-b from-[#FAF7F1] to-white border-b border-slate-200">
                    <td colSpan={7} className="px-8 py-7">
                      <div className="grid md:grid-cols-12 gap-8">
                        {/* Operación */}
                        <div className="md:col-span-3">
                          <Eyebrow>Operación</Eyebrow>
                          <dl className="space-y-2 text-sm mt-3">
                            <div className="flex justify-between"><dt className="text-slate-600">Llamadas AV:</dt><dd className="font-semibold tabular" style={{ color: '#0F2444' }}>{fmt(c.llamadas)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Efectivas:</dt><dd className="font-semibold tabular" style={{ color: '#0F2444' }}>{fmt(c.efectivas)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Promesas:</dt><dd className="font-semibold tabular text-emerald-800">{c.promesas}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Cobertura:</dt><dd className="font-semibold tabular" style={{ color: '#0F2444' }}>{c.pctCobertura}%</dd></div>
                          </dl>
                        </div>

                        {/* Costos */}
                        <div className="md:col-span-3">
                          <Eyebrow>Estructura de Costos</Eyebrow>
                          <dl className="space-y-2 text-sm mt-3">
                            <div className="flex justify-between"><dt className="text-slate-600">AV (prorrateado):</dt><dd className="font-semibold tabular" style={{ color: '#0F2444' }}>{fmtB(c.inversionAV)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Asesores piso:</dt><dd className="font-semibold tabular" style={{ color: '#0F2444' }}>{fmtB(c.costoPiso)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Masivos:</dt><dd className="font-semibold tabular" style={{ color: '#0F2444' }}>{fmtB(c.masivos)}</dd></div>
                            <div className="flex justify-between pt-2 border-t border-[#B8924A]/20">
                              <dt className="font-semibold" style={{ color: '#0F2444' }}>Total:</dt>
                              <dd className="font-serif font-semibold text-base tabular" style={{ color: '#0F2444' }}>{fmtB(c.costoTotal)}</dd>
                            </div>
                          </dl>
                        </div>

                        {/* Análisis de rentabilidad */}
                        <div className="md:col-span-3 bg-white border border-[#B8924A]/15 rounded p-5">
                          <Eyebrow>Análisis Inversión</Eyebrow>
                          <div className="mt-3 space-y-3">
                            <div>
                              <div className="text-xs text-slate-600 mb-1">% del honorario al AV</div>
                              <div className={`font-serif text-3xl font-semibold tabular ${
                                c.pctHonorarioAlAV < 10 ? 'text-emerald-800' :
                                c.pctHonorarioAlAV < 30 ? 'text-emerald-700' :
                                c.pctHonorarioAlAV < 60 ? 'text-amber-700' : 'text-red-900'
                              }`}>
                                {c.pctHonorarioAlAV > 0 ? `${c.pctHonorarioAlAV.toFixed(2)}%` : '—'}
                              </div>
                            </div>
                            <div className="pt-3 border-t border-slate-100">
                              <div className="text-[11px] text-slate-500 leading-relaxed">
                                De los <strong style={{ color: '#0F2444' }}>{c.comisionPct.toFixed(2)}%</strong> que cobramos al cliente, <strong style={{ color: '#0F2444' }}>{c.puntosComisionAlAV.toFixed(3)}%</strong> se está destinando al AV.
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Diagnóstico y acción */}
                        <div className="md:col-span-3">
                          <Eyebrow>Diagnóstico</Eyebrow>
                          <p className="text-sm text-slate-700 leading-relaxed mt-3">{c.motivo}</p>
                          <Eyebrow><span className="mt-4 inline-block">Acción Recomendada</span></Eyebrow>
                          <div className="mt-2 p-3 border-l-2 gold-border bg-[#FAF7F1] rounded-r text-sm text-navy-900 leading-relaxed" style={{ color: '#0F2444' }}>
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
    </div>
  )
}

// ── Gráfico premium ───────────────────────────────────────────────────
function GraficoHistoricoPremium({ historico }: { historico: DashData['historico'] }) {
  const data = historico.map(m => ({
    name: m.label.split(' ')[0],
    año: m.label.split(' ')[1],
    honorario: m.honorarioTotal,
    inversion: m.inversionAV,
  }))
  return (
    <div className="card-premium-hero p-8 elevated">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Eyebrow>Historical Performance</Eyebrow>
          <h3 className="font-serif text-2xl font-semibold mt-1" style={{ color: '#0F2444' }}>Inversión vs Recuperación</h3>
          <p className="text-xs text-slate-500 mt-1">Comparativo histórico mensual</p>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: '#0F2444' }} />
            <span className="text-slate-700 font-semibold">Honorario</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: '#B8924A' }} />
            <span className="text-slate-700 font-semibold">Inversión AV</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
          <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
          <Tooltip
            contentStyle={{ background: '#FFFFFF', border: '1px solid #B8924A', borderRadius: '4px', boxShadow: '0 8px 16px rgba(15,36,68,0.1)', padding: '12px' }}
            labelStyle={{ color: '#0F2444', fontWeight: 700, fontSize: '12px', letterSpacing: '0.05em', marginBottom: '8px', fontFamily: 'Cormorant Garamond, serif' }}
            itemStyle={{ color: '#0F2444', fontSize: '13px', fontWeight: 600 }}
            formatter={(v: number) => [`B/.${v.toLocaleString('es-PA')}`, '']} />
          <Bar dataKey="honorario" fill="#0F2444" radius={[2, 2, 0, 0]} maxBarSize={50} />
          <Bar dataKey="inversion" fill="#B8924A" radius={[2, 2, 0, 0]} maxBarSize={50} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Panel Plan premium ────────────────────────────────────────────────
function PlanPremium({ planes }: { planes: Plan[] }) {
  const plan = planes[0]
  if (!plan) return null
  const completadas = plan.acciones.filter(a => a.completada).length
  const total = plan.acciones.length
  const pct = total > 0 ? (completadas / total) * 100 : 0

  return (
    <div className="card-premium-hero overflow-hidden elevated">
      <div className="px-8 py-6 bg-gradient-to-r from-[#0F2444] to-[#1A3458] border-b border-[#B8924A]/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#C9A663' }}>Strategic Initiative</div>
            <h3 className="font-serif text-2xl font-semibold text-white mt-1">Plan de Acción</h3>
            <p className="text-xs text-slate-300 mt-1">{plan.semana}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] text-slate-300 font-semibold tracking-widest uppercase">Progreso</div>
              <div className="text-2xl font-serif font-semibold text-white tabular mt-1">{completadas}/{total}</div>
            </div>
            <div className="w-32">
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: '#B8924A' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {plan.acciones.map((a, i) => (
          <div key={a.id} className="px-8 py-5 flex gap-5 hover:bg-[#FAF7F1] transition-colors">
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-serif text-sm font-semibold ${a.completada ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-[#FAF7F1] text-navy-900 border border-[#B8924A]/30'}`} style={!a.completada ? { color: '#0F2444' } : {}}>
              {a.completada ? '✓' : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${a.completada ? 'line-through text-slate-400' : ''}`} style={!a.completada ? { color: '#0F2444' } : {}}>
                {a.descripcion}
              </div>
              <div className="flex flex-wrap gap-5 mt-2 text-[11px]">
                <span className="text-slate-500">Responsable: <span className="font-semibold text-slate-700">{a.responsable}</span></span>
                <span className="font-semibold text-emerald-800">Impacto esperado: {a.impactoEsperado}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {plan.notas && (
        <div className="px-8 py-4 bg-[#FAF7F1] border-t border-[#B8924A]/15 text-xs text-slate-600">
          <span className="font-bold text-slate-700 mr-1">Nota Estratégica:</span>{plan.notas}
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
      setLastUpdate(new Date().toLocaleString('es-PA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }))
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-1 h-1 bg-[#B8924A] mx-auto mb-6"></div>
        <div className="font-serif text-2xl" style={{ color: '#0F2444' }}>SPEAR</div>
        <div className="text-xs text-slate-500 mt-2 tracking-widest uppercase">Cargando información</div>
      </div>
    </div>
  )

  if (!data) return <div className="min-h-screen flex items-center justify-center text-red-900">Error al cargar datos</div>

  const { mesActual, carteras, historico, bolsa } = data
  const verdes = carteras.filter(c => c.semaforo === 'verde').length
  const rojas = carteras.filter(c => c.semaforo === 'rojo').length
  const amarillas = carteras.filter(c => c.semaforo === 'amarillo').length

  return (
    <div className="min-h-screen">
      {/* Header premium */}
      <header className="border-b border-[#B8924A]/20 sticky top-0 z-50 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-sm flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F2444 0%, #1A3458 100%)', boxShadow: '0 4px 12px rgba(15,36,68,0.15)' }}>
                <Briefcase className="w-5 h-5" style={{ color: '#C9A663' }} />
              </div>
              <div>
                <h1 className="font-serif text-xl font-semibold tracking-tight" style={{ color: '#0F2444' }}>SPEAR</h1>
                <p className="text-[10px] tracking-widest uppercase font-semibold mt-0.5" style={{ color: '#B8924A' }}>Asesor Virtual · Panel Ejecutivo</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">Período</div>
                <div className="text-sm font-semibold" style={{ color: '#0F2444' }}>{mesActual.label}</div>
              </div>
              <button onClick={fetchData} className="p-2.5 rounded-sm hover:bg-[#FAF7F1] transition-colors border border-transparent hover:border-[#B8924A]/20" title="Actualizar">
                <RefreshCw className="w-4 h-4" style={{ color: '#0F2444' }} />
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto -mb-px">
            {([
              { k: 'resumen', l: 'Resumen Ejecutivo' },
              { k: 'carteras', l: 'Análisis por Cartera' },
              { k: 'historico', l: 'Histórico' },
              { k: 'plan', l: 'Plan de Acción' },
            ] as const).map(({ k, l }) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-6 py-3 text-xs font-semibold transition-all whitespace-nowrap tracking-wider uppercase border-b-2 ${tab === k ? 'border-[#B8924A] text-[#0F2444]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10 space-y-8 fade-in">

        {tab === 'resumen' && (
          <>
            {/* Veredicto editorial */}
            <div className="card-premium-hero p-10 elevated-strong">
              <div className="flex flex-wrap items-start gap-8">
                <div className="flex-1 min-w-0">
                  <Eyebrow>{mesActual.label} · Veredicto</Eyebrow>
                  <h2 className="font-serif text-5xl font-semibold mt-3 leading-tight" style={{ color: '#0F2444' }}>
                    {mesActual.sePaga ? 'La inversión genera retorno' : 'La inversión requiere optimización'}
                  </h2>
                  <p className="text-slate-700 text-base leading-relaxed mt-4 max-w-2xl">
                    {mesActual.sePaga ? (
                      <>
                        Por cada balboa invertido en el Asesor Virtual, el portafolio generó <strong className="font-serif text-lg" style={{ color: '#0F2444' }}>B/.{mesActual.roiMultiplo.toFixed(2)}</strong> de honorario adicional sobre la base histórica. El retorno incremental acumulado del mes asciende a <strong className="font-serif text-lg" style={{ color: '#0F2444' }}>{fmtB(mesActual.incrementoVsBase)}</strong>.
                      </>
                    ) : (
                      <>
                        El honorario incremental ({fmtB(mesActual.incrementoVsBase)}) no cubre completamente la inversión de {fmtB(mesActual.inversionAV)}. Ver acciones recomendadas en Plan de Acción.
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right border-l border-[#B8924A]/20 pl-8">
                  <Eyebrow>Return on Investment</Eyebrow>
                  <div className="font-serif text-7xl font-semibold mt-2 leading-none tabular" style={{ color: '#0F2444' }}>
                    {mesActual.roiMultiplo.toFixed(1)}<span style={{ color: '#B8924A' }}>×</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-3 tracking-wider uppercase font-semibold">vs base histórica</div>
                </div>
              </div>
            </div>

            <Divider />

            {/* KPIs principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <HeroKPI label="Inversión AV" value={fmtB(mesActual.inversionAV)} sub="Costo fijo mensual" accent="gold" />
              <HeroKPI label="Honorario Total"
                value={fmtB(mesActual.honorarioTotal)}
                sub={`${mesActual.deltaVsMesAnterior >= 0 ? '▲' : '▼'} ${fmtB(Math.abs(mesActual.deltaVsMesAnterior))} vs mes ant.`}
                accent="navy" />
              <HeroKPI label="% Hon. al AV"
                value={`${mesActual.pctHonorarioTotalAlAV.toFixed(2)}%`}
                sub={`De B/.${fmt(mesActual.honorarioTotal)} en honorario`}
                accent="success" />
              <HeroKPI label="Minutos Consumidos"
                value={fmt(mesActual.minutosConsumidos)}
                sub={`B/.${mesActual.costoXMinuto.toFixed(3)} costo efectivo/min`}
                accent="warning" />
            </div>

            <Divider />

            {/* Bolsa + Distribución */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <BolsaPremium bolsa={bolsa} consumidos={mesActual.minutosConsumidos} />
              </div>
              <div className="card-premium-hero p-7 elevated">
                <Eyebrow>Portfolio Distribution</Eyebrow>
                <h3 className="font-serif text-xl font-semibold mt-1 mb-5" style={{ color: '#0F2444' }}>Composición</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <StatusDot s="verde" />
                      <span className="text-sm font-semibold" style={{ color: '#0F2444' }}>Rentables</span>
                    </div>
                    <span className="font-serif text-2xl font-semibold tabular" style={{ color: '#0F2444' }}>{verdes}</span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <StatusDot s="amarillo" />
                      <span className="text-sm font-semibold" style={{ color: '#0F2444' }}>En Revisión</span>
                    </div>
                    <span className="font-serif text-2xl font-semibold tabular" style={{ color: '#0F2444' }}>{amarillas}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusDot s="rojo" />
                      <span className="text-sm font-semibold" style={{ color: '#0F2444' }}>No Rentables</span>
                    </div>
                    <span className="font-serif text-2xl font-semibold tabular" style={{ color: '#0F2444' }}>{rojas}</span>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-[#B8924A]/15">
                  <Eyebrow>Top Performers</Eyebrow>
                  <div className="space-y-2 mt-2">
                    {[...carteras].filter(c => c.semaforo === 'verde').sort((a, b) => a.pctHonorarioAlAV - b.pctHonorarioAlAV).slice(0, 3).map(c => (
                      <div key={c.nombre} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium truncate pr-2">{c.nombre}</span>
                        <span className="font-serif font-semibold tabular text-emerald-800">{c.pctHonorarioAlAV.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Divider />

            {/* Alertas */}
            <div className="grid lg:grid-cols-2 gap-5">
              <div className={`card-premium p-6 ${mesActual.deltaVsMesAnterior >= 0 ? 'border-l-2 border-l-emerald-700' : 'border-l-2 border-l-amber-600'}`}>
                <div className="flex items-start gap-4">
                  {mesActual.deltaVsMesAnterior >= 0
                    ? <TrendingUp className="w-5 h-5 text-emerald-700 mt-1 flex-shrink-0" />
                    : <TrendingDown className="w-5 h-5 text-amber-700 mt-1 flex-shrink-0" />}
                  <div>
                    <Eyebrow>vs {historico[historico.length - 2]?.label}</Eyebrow>
                    <h3 className="font-serif text-lg font-semibold mt-1" style={{ color: '#0F2444' }}>
                      {mesActual.deltaVsMesAnterior >= 0 ? 'Honorario al alza' : 'Honorario a la baja'}
                    </h3>
                    <p className="text-sm text-slate-700 mt-2">
                      <span className={`font-serif text-xl font-semibold ${mesActual.deltaVsMesAnterior >= 0 ? 'text-emerald-800' : 'text-amber-700'}`}>
                        {mesActual.deltaVsMesAnterior >= 0 ? '+' : ''}{fmtB(mesActual.deltaVsMesAnterior)}
                      </span>
                      <span className="text-slate-500 ml-2">
                        ({mesActual.honorarioAnterior > 0 ? ((mesActual.deltaVsMesAnterior / mesActual.honorarioAnterior) * 100).toFixed(1) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="card-premium p-6 border-l-2 border-l-[#B8924A]">
                <div className="flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: '#B8924A' }}>
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <div>
                    <Eyebrow>Quick Win Disponible</Eyebrow>
                    <h3 className="font-serif text-lg font-semibold mt-1" style={{ color: '#0F2444' }}>B/.3,007/mes no cobrados</h3>
                    <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                      Las gestiones del AV en Banistmo no se entregan en el formato requerido. Resolverlo es la acción de mayor impacto inmediato.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'carteras' && (
          <>
            <div>
              <Eyebrow>Portfolio Analysis</Eyebrow>
              <h2 className="font-serif text-4xl font-semibold mt-2" style={{ color: '#0F2444' }}>Análisis por Cartera</h2>
              <p className="text-sm text-slate-500 mt-2">El % Hon. al AV muestra cuánto del honorario se destina al Asesor Virtual. Menor es mejor.</p>
            </div>
            <TablaCarterasPremium carteras={carteras} />
          </>
        )}

        {tab === 'historico' && (
          <>
            <div>
              <Eyebrow>Historical Performance</Eyebrow>
              <h2 className="font-serif text-4xl font-semibold mt-2" style={{ color: '#0F2444' }}>Histórico de Resultados</h2>
              <p className="text-sm text-slate-500 mt-2">Evolución mensual de la inversión y el honorario recuperado.</p>
            </div>

            <GraficoHistoricoPremium historico={historico} />

            <div className="card-premium-hero overflow-hidden elevated">
              <div className="px-8 py-5 border-b border-[#B8924A]/15 bg-[#FAF7F1]">
                <Eyebrow>Detalle Mensual</Eyebrow>
                <h3 className="font-serif text-xl font-semibold mt-1" style={{ color: '#0F2444' }}>Desempeño por Período</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-8 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Período</th>
                    <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Inversión AV</th>
                    <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Honorario</th>
                    <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">vs Mes Ant.</th>
                    <th className="px-3 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">¿AV se pagó?</th>
                    <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Múltiplo</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((m, i) => {
                    const ant = historico[i - 1]
                    const delta = ant ? m.honorarioTotal - ant.honorarioTotal : 0
                    const roiX = m.inversionAV > 0 ? m.honorarioTotal / m.inversionAV : 0
                    return (
                      <tr key={m.mes} className="hover:bg-[#FAF7F1] border-b border-slate-100">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-base font-semibold" style={{ color: '#0F2444' }}>{m.label}</span>
                            {m.avActivo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider" style={{ background: '#F5EAD0', color: '#B8924A' }}>AV</span>}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-right tabular">
                          {m.inversionAV > 0 ? <span className="font-semibold" style={{ color: '#0F2444' }}>{fmtB(m.inversionAV)}</span> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-4 text-right text-sm font-semibold tabular" style={{ color: '#0F2444' }}>{fmtB(m.honorarioTotal)}</td>
                        <td className="px-3 py-4 text-right">{i > 0 ? <Delta v={delta} /> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-3 py-4 text-center">
                          {m.inversionAV > 0
                            ? <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[11px] font-semibold border ${m.honorarioTotal >= m.inversionAV ? 'bg-emerald-50/50 text-emerald-800 border-emerald-200/60' : 'bg-red-50/50 text-red-900 border-red-200/60'}`}>
                                {m.honorarioTotal >= m.inversionAV ? 'Sí' : 'No'}
                              </span>
                            : <span className="text-slate-400 text-xs">Sin AV</span>}
                        </td>
                        <td className="px-3 py-4 text-right text-sm font-serif font-semibold tabular">
                          {roiX > 0 ? <span className={roiX >= 5 ? 'text-emerald-800' : roiX >= 2 ? 'text-amber-700' : 'text-red-900'}>{roiX.toFixed(1)}×</span> : <span className="text-slate-400">—</span>}
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
              <Eyebrow>Strategic Initiative</Eyebrow>
              <h2 className="font-serif text-4xl font-semibold mt-2" style={{ color: '#0F2444' }}>Plan de Acción</h2>
              <p className="text-sm text-slate-500 mt-2">Acciones definidas en sesión de los lunes · Seguimiento continuo</p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div className="card-premium p-6 border-l-2 border-l-emerald-700">
                <Eyebrow>Tendencia del Mes</Eyebrow>
                <div className={`font-serif text-2xl font-semibold mt-2 ${mesActual.deltaVsMesAnterior >= 0 ? 'text-emerald-800' : 'text-red-900'}`}>
                  {mesActual.deltaVsMesAnterior >= 0 ? 'Avance positivo' : 'Por debajo'}
                </div>
                <div className="text-sm text-slate-600 mt-1 tabular">{mesActual.deltaVsMesAnterior >= 0 ? '+' : ''}{fmtB(mesActual.deltaVsMesAnterior)} vs mes anterior</div>
              </div>
              <div className="card-premium p-6 border-l-2 border-l-red-800">
                <Eyebrow>Carteras Críticas</Eyebrow>
                <div className="mt-2 space-y-1">
                  {carteras.filter(c => c.semaforo === 'rojo' && c.minutosAV > 0).length > 0
                    ? carteras.filter(c => c.semaforo === 'rojo' && c.minutosAV > 0).map(c => (
                        <div key={c.nombre} className="font-serif text-base font-semibold text-red-900">{c.nombre}</div>
                      ))
                    : <div className="font-serif text-base font-semibold text-emerald-800">Sin carteras críticas</div>}
                </div>
              </div>
              <div className="card-premium p-6 border-l-2 border-l-[#B8924A]">
                <Eyebrow>Oportunidad Inmediata</Eyebrow>
                <div className="font-serif text-2xl font-semibold mt-2 gold-text">Conversor Banistmo</div>
                <div className="text-sm text-slate-600 mt-1">+B/.3,007/mes potencial</div>
              </div>
            </div>

            <PlanPremium planes={planes} />
          </>
        )}
      </main>

      <footer className="border-t border-[#B8924A]/15 bg-white/60 mt-16">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#B8924A' }}>SPEAR</div>
              <div className="w-px h-3 bg-slate-300" />
              <span className="text-xs text-slate-500">Panel Ejecutivo del Asesor Virtual</span>
            </div>
            <span className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">Última actualización · {lastUpdate}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
