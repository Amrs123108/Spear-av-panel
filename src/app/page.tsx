'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, RefreshCw, ArrowUpRight, ArrowDownRight, Sparkles, Edit3, Save, X, Calendar, Bot, Brain } from 'lucide-react'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL, PLAN_INICIAL, MesData, PlanSemanal } from '@/lib/store'
import { loadMesActual, saveMesActual, loadPlan, savePlan, loadBolsa, saveBolsa, recalcularMes } from '@/lib/persistence'

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
  mesActualIdx: number
  mesActual: {
    mes: string; label: string; esMesActual: boolean;
    inversionAV: number; inversionAsignada: number;
    honorarioTotal: number; honorarioAnterior: number; deltaVsMesAnterior: number;
    incrementoVsBase: number; roiMultiplo: number; minutosConsumidos: number;
    sePaga: boolean; pctHonorarioTotalAlAV: number; costoXMinuto: number;
  }
  carteras: CarteraMetrica[]
  historico: { mes: string; label: string; inversionAV: number; honorarioTotal: number; avActivo: boolean; minutosConsumidos: number; esMesActual: boolean }[]
  bolsa: { saldoActual: number; diaRecarga: number; cantidadRecarga: number; historial: { fecha: string; tipo: string; cantidad: number; descripcion: string }[] }
}

const fmt = (n: number) => n.toLocaleString('es-PA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtB = (n: number) => `B/.${fmt(n)}`

// ── Componentes utilitarios ──────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-eyebrow">{children}</div>
}

function Divider() {
  return <div className="divider-gold my-6" />
}

function Delta({ v }: { v: number }) {
  if (v === 0) return <span className="text-slate-400 num-table">—</span>
  const pos = v > 0
  return (
    <span className={`inline-flex items-center gap-1 num-table text-sm ${pos ? 'text-emerald-800' : 'text-red-900'}`}>
      {pos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
      {pos ? '+' : '-'}B/.{fmt(Math.abs(v))}
    </span>
  )
}

function StatusDot({ s }: { s: 'verde' | 'amarillo' | 'rojo' }) {
  const colors = { verde: 'bg-emerald-700', amarillo: 'bg-amber-600', rojo: 'bg-red-800' }
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

// ── Selector de Mes ──────────────────────────────────────────────────
function MonthSelector({ historico, currentIdx, onChange }: {
  historico: DashData['historico']; currentIdx: number; onChange: (idx: number) => void
}) {
  return (
    <div className="inline-flex items-center bg-white border border-[#B8924A]/20 rounded-md overflow-hidden elevated">
      <button onClick={() => currentIdx > 0 && onChange(currentIdx - 1)}
        disabled={currentIdx === 0}
        className="px-3 py-2.5 hover:bg-[#FAF7F1] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        <svg className="w-4 h-4" style={{ color: '#0F2444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <select
        value={currentIdx}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="month-selector px-4 py-2.5 text-sm bg-transparent border-x border-[#B8924A]/20 outline-none cursor-pointer hover:bg-[#FAF7F1] transition-colors"
        style={{ color: '#0F2444', minWidth: '180px' }}
      >
        {historico.map((m, i) => (
          <option key={m.mes} value={i}>
            {m.label}{m.esMesActual ? ' ◆ ACTUAL' : ''}
          </option>
        ))}
      </select>
      <button onClick={() => currentIdx < historico.length - 1 && onChange(currentIdx + 1)}
        disabled={currentIdx === historico.length - 1}
        className="px-3 py-2.5 hover:bg-[#FAF7F1] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        <svg className="w-4 h-4" style={{ color: '#0F2444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────
function HeroKPI({ label, value, sub, accent }: {
  label: string; value: string; sub?: string;
  accent?: 'gold' | 'navy' | 'success' | 'warning';
}) {
  const accents = {
    gold: 'border-t-[#B8924A]', navy: 'border-t-[#0F2444]',
    success: 'border-t-emerald-700', warning: 'border-t-amber-600',
  }
  return (
    <div className={`card-premium-hero p-6 ${accent ? `border-t-2 ${accents[accent]}` : ''} elevated`}>
      <Eyebrow>{label}</Eyebrow>
      <div className="num-hero text-4xl mt-3" style={{ color: '#0F2444' }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-3 font-medium tracking-wide">{sub}</div>}
    </div>
  )
}

// ── Bolsa de Minutos ─────────────────────────────────────────────────
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
          <div className="font-serif text-2xl font-semibold mt-1" style={{ color: '#0F2444' }}>Capital Disponible</div>
        </div>
        <div className="text-right">
          <div className="text-eyebrow">Próxima Recarga</div>
          <div className="num-table text-sm mt-1" style={{ color: '#0F2444' }}>Día {bolsa.diaRecarga}</div>
          <div className="text-xs text-slate-500">en {diasParaRecarga} días</div>
        </div>
      </div>

      <div className="text-center py-6 border-y border-[#B8924A]/15">
        <div className="num-hero text-7xl leading-none" style={{ color: '#0F2444' }}>{fmt(saldo)}</div>
        <div className="text-xs text-slate-500 mt-3 tracking-widest font-semibold uppercase">minutos</div>
      </div>

      <div className="grid grid-cols-3 gap-6 mt-6">
        <div className="text-center">
          <div className="text-eyebrow mb-2">Recarga Mensual</div>
          <div className="num-hero text-2xl" style={{ color: '#0F2444' }}>+{fmt(bolsa.cantidadRecarga)}</div>
          <div className="text-[11px] text-slate-400 mt-1">B/.4,000 incluidos</div>
        </div>
        <div className="text-center border-x border-slate-200/60">
          <div className="text-eyebrow mb-2">Consumo Mes Ant.</div>
          <div className="num-hero text-2xl" style={{ color: '#0F2444' }}>{fmt(consumidos)}</div>
          <div className="text-[11px] text-slate-400 mt-1">{((consumidos / bolsa.cantidadRecarga) * 100).toFixed(0)}% del paquete</div>
        </div>
        <div className="text-center">
          <div className="text-eyebrow mb-2">Cobertura</div>
          <div className="num-hero text-2xl gold-text">{mesesRestantes.toFixed(1)}</div>
          <div className="text-[11px] text-slate-400 mt-1">meses al ritmo actual</div>
        </div>
      </div>
    </div>
  )
}

// ── Tabla de Carteras (con modo edición) ─────────────────────────────
function TablaCarteras({ carteras, isEditable, mesActualData, onUpdate }: {
  carteras: CarteraMetrica[];
  isEditable: boolean;
  mesActualData?: MesData;
  onUpdate?: (cartera: string, field: 'minutosAV' | 'honorario' | 'llamadas' | 'efectivas' | 'promesas', value: number) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({})

  const handleEdit = (cartera: string, field: string, value: string) => {
    setEditValues(prev => ({ ...prev, [cartera]: { ...(prev[cartera] || {}), [field]: value } }))
  }

  const handleBlur = (cartera: string, field: 'minutosAV' | 'honorario' | 'llamadas' | 'efectivas' | 'promesas') => {
    const val = editValues[cartera]?.[field]
    if (val !== undefined && onUpdate) {
      const num = parseFloat(val.replace(/,/g, '')) || 0
      onUpdate(cartera, field, num)
      // limpiar el local edit state
      setEditValues(prev => {
        const newP = { ...prev }
        if (newP[cartera]) {
          delete newP[cartera][field]
          if (Object.keys(newP[cartera]).length === 0) delete newP[cartera]
        }
        return newP
      })
    }
  }

  return (
    <div className="card-premium-hero overflow-hidden elevated">
      <div className="px-8 py-5 border-b border-[#B8924A]/15 bg-gradient-to-r from-[#0F2444] to-[#1A3458]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#C9A663' }}>
              Portfolio Analysis {isEditable && '· Modo Edición'}
            </div>
            <h3 className="font-serif text-2xl font-semibold text-white mt-1">Detalle por Cartera</h3>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-300 font-semibold tracking-widest uppercase">Inversión Total Asignada</div>
            <div className="num-hero text-2xl text-white mt-1">{fmtB(carteras.reduce((s, c) => s + c.inversionAV, 0))}</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#FAF7F1] border-b border-[#B8924A]/15">
              <th className="px-8 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Cartera</th>
              <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">{isEditable && <Edit3 className="w-3 h-3 inline mr-1" />}Min. AV</th>
              <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Inv. AV</th>
              <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">{isEditable && <Edit3 className="w-3 h-3 inline mr-1" />}Honorario</th>
              <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">% Hon. al AV</th>
              <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">vs Mes Ant.</th>
              <th className="px-3 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">Estado</th>
              <th className="px-3 py-4 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {carteras.map((c) => (
              <Fragment key={c.nombre}>
                <tr className={`border-b border-slate-100 ${expanded === c.nombre ? 'bg-[#FAF7F1]' : 'hover:bg-[#FAF7F1]/50'} transition-colors`}>
                  <td className="px-8 py-5 cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                    <div className="font-semibold text-sm tracking-tight" style={{ color: '#0F2444' }}>{c.nombre}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {fmt(c.clientes)} clientes · {c.asesores} ases. · {c.comisionPct.toFixed(2)}% comisión
                    </div>
                  </td>
                  <td className="px-3 py-5 text-right">
                    {isEditable ? (
                      <input
                        type="text" className="editable-num num-table text-sm w-24"
                        value={editValues[c.nombre]?.minutosAV ?? c.minutosAV.toString()}
                        onChange={(e) => handleEdit(c.nombre, 'minutosAV', e.target.value)}
                        onBlur={() => handleBlur(c.nombre, 'minutosAV')}
                        onFocus={(e) => e.target.select()}
                      />
                    ) : (
                      <span className="num-table text-sm" style={{ color: '#0F2444' }}>{c.minutosAV > 0 ? fmt(c.minutosAV) : '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-5 text-right cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                    {c.inversionAV > 0 ? (
                      <span className="num-table text-sm" style={{ color: '#0F2444' }}>{fmtB(c.inversionAV)}</span>
                    ) : <span className="text-slate-400 text-sm">—</span>}
                  </td>
                  <td className="px-3 py-5 text-right">
                    {isEditable ? (
                      <input
                        type="text" className="editable-num num-table text-sm w-28"
                        value={editValues[c.nombre]?.honorario ?? c.honorario.toString()}
                        onChange={(e) => handleEdit(c.nombre, 'honorario', e.target.value)}
                        onBlur={() => handleBlur(c.nombre, 'honorario')}
                        onFocus={(e) => e.target.select()}
                      />
                    ) : (
                      <>
                        <span className="num-table text-sm" style={{ color: '#0F2444' }}>{fmtB(c.honorario)}</span>
                        {c.base > 0 && <div className="text-[11px] text-slate-500 num-small">Base: {fmtB(c.base)}</div>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-5 text-right cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                    {c.pctHonorarioAlAV > 0 ? (
                      <div className={`num-hero text-base ${
                        c.pctHonorarioAlAV < 10 ? 'text-emerald-800' :
                        c.pctHonorarioAlAV < 30 ? 'text-emerald-700' :
                        c.pctHonorarioAlAV < 60 ? 'text-amber-700' : 'text-red-900'
                      }`}>
                        {c.pctHonorarioAlAV.toFixed(1)}%
                      </div>
                    ) : <span className="text-slate-400 text-sm">—</span>}
                  </td>
                  <td className="px-3 py-5 text-right cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                    <Delta v={c.honorario - c.honorarioMesAnterior} />
                  </td>
                  <td className="px-3 py-5 text-center cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                    <StatusLabel s={c.semaforo} />
                  </td>
                  <td className="px-3 py-5 text-slate-400 cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                    {expanded === c.nombre ? <ChevronUp className="w-4 h-4 mx-auto" /> : <ChevronDown className="w-4 h-4 mx-auto" />}
                  </td>
                </tr>
                {expanded === c.nombre && (
                  <tr className="bg-gradient-to-b from-[#FAF7F1] to-white border-b border-slate-200">
                    <td colSpan={8} className="px-8 py-7">
                      <div className="grid md:grid-cols-12 gap-8">
                        <div className="md:col-span-3">
                          <Eyebrow>Operación</Eyebrow>
                          <dl className="space-y-2 text-sm mt-3">
                            <div className="flex justify-between"><dt className="text-slate-600">Llamadas AV:</dt>
                              {isEditable ? (
                                <input type="text" className="editable-num num-table text-sm w-20"
                                  value={editValues[c.nombre]?.llamadas ?? c.llamadas.toString()}
                                  onChange={(e) => handleEdit(c.nombre, 'llamadas', e.target.value)}
                                  onBlur={() => handleBlur(c.nombre, 'llamadas')}
                                  onFocus={(e) => e.target.select()} />
                              ) : <dd className="num-table" style={{ color: '#0F2444' }}>{fmt(c.llamadas)}</dd>}
                            </div>
                            <div className="flex justify-between"><dt className="text-slate-600">Efectivas:</dt>
                              {isEditable ? (
                                <input type="text" className="editable-num num-table text-sm w-20"
                                  value={editValues[c.nombre]?.efectivas ?? c.efectivas.toString()}
                                  onChange={(e) => handleEdit(c.nombre, 'efectivas', e.target.value)}
                                  onBlur={() => handleBlur(c.nombre, 'efectivas')}
                                  onFocus={(e) => e.target.select()} />
                              ) : <dd className="num-table" style={{ color: '#0F2444' }}>{fmt(c.efectivas)}</dd>}
                            </div>
                            <div className="flex justify-between"><dt className="text-slate-600">Promesas:</dt>
                              {isEditable ? (
                                <input type="text" className="editable-num num-table text-sm w-20"
                                  value={editValues[c.nombre]?.promesas ?? c.promesas.toString()}
                                  onChange={(e) => handleEdit(c.nombre, 'promesas', e.target.value)}
                                  onBlur={() => handleBlur(c.nombre, 'promesas')}
                                  onFocus={(e) => e.target.select()} />
                              ) : <dd className="num-table text-emerald-800">{c.promesas}</dd>}
                            </div>
                            <div className="flex justify-between"><dt className="text-slate-600">Cobertura:</dt><dd className="num-table" style={{ color: '#0F2444' }}>{c.pctCobertura}%</dd></div>
                          </dl>
                        </div>

                        <div className="md:col-span-3">
                          <Eyebrow>Estructura de Costos</Eyebrow>
                          <dl className="space-y-2 text-sm mt-3">
                            <div className="flex justify-between"><dt className="text-slate-600">AV (prorrateado):</dt><dd className="num-table" style={{ color: '#0F2444' }}>{fmtB(c.inversionAV)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Asesores piso:</dt><dd className="num-table" style={{ color: '#0F2444' }}>{fmtB(c.costoPiso)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Masivos:</dt><dd className="num-table" style={{ color: '#0F2444' }}>{fmtB(c.masivos)}</dd></div>
                            <div className="flex justify-between pt-2 border-t border-[#B8924A]/20">
                              <dt className="font-semibold" style={{ color: '#0F2444' }}>Total:</dt>
                              <dd className="num-hero text-base" style={{ color: '#0F2444' }}>{fmtB(c.costoTotal)}</dd>
                            </div>
                          </dl>
                        </div>

                        <div className="md:col-span-3 bg-white border border-[#B8924A]/15 rounded p-5">
                          <Eyebrow>Análisis Inversión</Eyebrow>
                          <div className="mt-3 space-y-3">
                            <div>
                              <div className="text-xs text-slate-600 mb-1">% del honorario al AV</div>
                              <div className={`num-hero text-3xl ${
                                c.pctHonorarioAlAV < 10 ? 'text-emerald-800' :
                                c.pctHonorarioAlAV < 30 ? 'text-emerald-700' :
                                c.pctHonorarioAlAV < 60 ? 'text-amber-700' : 'text-red-900'
                              }`}>
                                {c.pctHonorarioAlAV > 0 ? `${c.pctHonorarioAlAV.toFixed(2)}%` : '—'}
                              </div>
                            </div>
                            <div className="pt-3 border-t border-slate-100">
                              <div className="text-[11px] text-slate-500 leading-relaxed">
                                De los <strong style={{ color: '#0F2444' }}>{c.comisionPct.toFixed(2)}%</strong> de comisión, <strong style={{ color: '#0F2444' }}>{c.puntosComisionAlAV.toFixed(3)}%</strong> se destinó al AV.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-3">
                          <Eyebrow>Diagnóstico</Eyebrow>
                          <p className="text-sm text-slate-700 leading-relaxed mt-3">{c.motivo}</p>
                          <Eyebrow><span className="mt-4 inline-block">Acción Recomendada</span></Eyebrow>
                          <div className="mt-2 p-3 border-l-2 gold-border bg-[#FAF7F1] rounded-r text-sm leading-relaxed" style={{ color: '#0F2444' }}>
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

function GraficoHistorico({ historico }: { historico: DashData['historico'] }) {
  const data = historico.map(m => ({
    name: m.label.split(' ')[0],
    honorario: m.honorarioTotal,
    inversion: m.inversionAV,
  }))
  return (
    <div className="card-premium-hero p-8 elevated">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <Eyebrow>Historical Performance</Eyebrow>
          <h3 className="font-serif text-2xl font-semibold mt-1" style={{ color: '#0F2444' }}>Inversión vs Recuperación</h3>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#0F2444' }} /><span className="text-slate-700 font-semibold">Honorario</span></span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#B8924A' }} /><span className="text-slate-700 font-semibold">Inversión AV</span></span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
          <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
          <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #B8924A', borderRadius: '4px', boxShadow: '0 8px 16px rgba(15,36,68,0.1)', padding: '12px' }}
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

function PlanPremium({ planes, onUpdate }: { planes: PlanSemanal[]; onUpdate: (planes: PlanSemanal[]) => void }) {
  const plan = planes[0]
  if (!plan) return null
  const completadas = plan.acciones.filter(a => a.completada).length
  const total = plan.acciones.length
  const pct = total > 0 ? (completadas / total) * 100 : 0

  const toggleAccion = (id: string) => {
    const nuevoPlan = {
      ...plan,
      acciones: plan.acciones.map(a => a.id === id ? { ...a, completada: !a.completada } : a)
    }
    onUpdate([nuevoPlan, ...planes.slice(1)])
  }

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
              <div className="num-hero text-2xl text-white mt-1">{completadas}/{total}</div>
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
          <div key={a.id} className="px-8 py-5 flex gap-5 hover:bg-[#FAF7F1] transition-colors cursor-pointer" onClick={() => toggleAccion(a.id)}>
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-serif text-sm font-semibold transition-all ${a.completada ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-[#FAF7F1] border border-[#B8924A]/30'}`} style={!a.completada ? { color: '#0F2444' } : {}}>
              {a.completada ? '✓' : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${a.completada ? 'line-through text-slate-400' : ''}`} style={!a.completada ? { color: '#0F2444' } : {}}>
                {a.descripcion}
              </div>
              <div className="flex flex-wrap gap-5 mt-2 text-[11px]">
                <span className="text-slate-500">Responsable: <span className="font-semibold text-slate-700">{a.responsable}</span></span>
                <span className="font-semibold text-emerald-800">Impacto: {a.impactoEsperado}</span>
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

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null)
  const [planes, setPlanes] = useState<PlanSemanal[]>(PLAN_INICIAL)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'resumen' | 'carteras' | 'historico' | 'plan'>('resumen')
  const [lastUpdate, setLastUpdate] = useState('')
  const [mesSeleccionadoIdx, setMesSeleccionadoIdx] = useState<number>(HISTORICO_INICIAL.length - 1)
  const [mesActualLocal, setMesActualLocal] = useState<MesData | null>(null)
  const [editMode, setEditMode] = useState(false)

  // Cargar datos
  const fetchData = useCallback(async (idx: number, mesEditado?: MesData) => {
    setLoading(true)
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesIdx: idx, mesActualEditado: mesEditado })
      })
      const d = await res.json()
      if (d.ok) setData(d)
      setLastUpdate(new Date().toLocaleString('es-PA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }))
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  // Carga inicial
  useEffect(() => {
    const mesActualDefault = HISTORICO_INICIAL.find(m => m.esMesActual)!
    const mesActualGuardado = loadMesActual(mesActualDefault)
    setMesActualLocal(mesActualGuardado)

    const planGuardado = loadPlan(PLAN_INICIAL)
    setPlanes(planGuardado)

    fetchData(HISTORICO_INICIAL.length - 1, mesActualGuardado)
  }, [fetchData])

  // Actualizar al cambiar de mes
  const cambiarMes = (idx: number) => {
    setMesSeleccionadoIdx(idx)
    setEditMode(false)
    fetchData(idx, mesActualLocal || undefined)
  }

  // Actualizar campo de cartera (solo en modo edición del mes actual)
  const actualizarCartera = (cartera: string, field: 'minutosAV' | 'honorario' | 'llamadas' | 'efectivas' | 'promesas', value: number) => {
    if (!mesActualLocal) return
    const nuevoMes = {
      ...mesActualLocal,
      carteras: {
        ...mesActualLocal.carteras,
        [cartera]: { ...mesActualLocal.carteras[cartera], [field]: value }
      }
    }
    const recalculado = recalcularMes(nuevoMes)
    setMesActualLocal(recalculado)
    saveMesActual(recalculado)
    fetchData(mesSeleccionadoIdx, recalculado)
  }

  const actualizarPlanes = (nuevosPlanes: PlanSemanal[]) => {
    setPlanes(nuevosPlanes)
    savePlan(nuevosPlanes)
  }

  if (loading && !data) return (
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
  const esElMesActualEditable = mesActual.esMesActual

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="border-b border-[#B8924A]/20 sticky top-0 z-50 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-5">
              {/* Logo con ícono IA */}
              <div className="w-12 h-12 rounded-sm flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, #0F2444 0%, #1A3458 100%)', boxShadow: '0 4px 12px rgba(15,36,68,0.15)' }}>
                <Sparkles className="w-5 h-5 absolute" style={{ color: '#C9A663', top: '8px', left: '8px' }} />
                <Brain className="w-5 h-5 absolute" style={{ color: '#C9A663', bottom: '8px', right: '8px', opacity: 0.6 }} />
              </div>
              <div>
                <h1 className="font-serif text-xl font-semibold tracking-tight" style={{ color: '#0F2444' }}>SPEAR</h1>
                <p className="text-[10px] tracking-widest uppercase font-semibold mt-0.5" style={{ color: '#B8924A' }}>Asesor Virtual IA · Panel Ejecutivo</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MonthSelector historico={historico} currentIdx={mesSeleccionadoIdx} onChange={cambiarMes} />
              <button onClick={() => fetchData(mesSeleccionadoIdx, mesActualLocal || undefined)} className="p-2.5 rounded-sm hover:bg-[#FAF7F1] transition-colors border border-transparent hover:border-[#B8924A]/20" title="Actualizar">
                <RefreshCw className="w-4 h-4" style={{ color: '#0F2444' }} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-between gap-3 -mb-px">
            <div className="flex gap-0 overflow-x-auto">
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

            {/* Indicador modo edición */}
            {esElMesActualEditable && tab === 'carteras' && (
              <button onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-semibold tracking-wider uppercase transition-all ${editMode ? 'bg-[#B8924A] text-white' : 'bg-[#FAF7F1] text-[#0F2444] border border-[#B8924A]/30 hover:bg-[#F5EAD0]'}`}>
                {editMode ? <><Save className="w-3.5 h-3.5" />Guardado Auto</> : <><Edit3 className="w-3.5 h-3.5" />Editar Datos</>}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10 space-y-8 fade-in">

        {/* Banner del mes seleccionado */}
        {esElMesActualEditable && (
          <div className="card-premium border-l-2 border-l-[#B8924A] p-4 flex items-center gap-4 bg-gradient-to-r from-[#FAF7F1] to-white">
            <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: '#B8924A' }} />
            <div className="flex-1">
              <div className="text-sm font-semibold" style={{ color: '#0F2444' }}>Mes Actual · {mesActual.label}</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Los datos del mes en curso se ingresan en la sección "Análisis por Cartera". Activa "Editar Datos" para modificar minutos y honorarios.
              </div>
            </div>
            {!editMode && tab !== 'carteras' && (
              <button onClick={() => { setTab('carteras'); setEditMode(true) }}
                className="text-xs font-semibold px-3 py-1.5 rounded-sm bg-[#B8924A] text-white hover:bg-[#A68441] transition-colors">
                Ir a editar →
              </button>
            )}
          </div>
        )}

        {tab === 'resumen' && (
          <>
            {/* Veredicto */}
            <div className="card-premium-hero p-10 elevated-strong">
              <div className="flex flex-wrap items-start gap-8">
                <div className="flex-1 min-w-0">
                  <Eyebrow>{mesActual.label} · Veredicto</Eyebrow>
                  <h2 className="font-serif text-5xl font-semibold mt-3 leading-tight" style={{ color: '#0F2444' }}>
                    {mesActual.honorarioTotal === 0 ? 'Esperando datos del mes' :
                      mesActual.sePaga ? 'La inversión genera retorno' : 'La inversión requiere optimización'}
                  </h2>
                  <p className="text-slate-700 text-base leading-relaxed mt-4 max-w-2xl">
                    {mesActual.honorarioTotal === 0 ? (
                      <>El mes en curso aún no tiene honorarios registrados. Ingrese los datos en "Análisis por Cartera" para ver el análisis completo.</>
                    ) : mesActual.sePaga ? (
                      <>Por cada balboa invertido en el Asesor Virtual, el portafolio generó <strong className="num-hero text-lg" style={{ color: '#0F2444' }}>B/.{mesActual.roiMultiplo.toFixed(2)}</strong> de honorario adicional sobre la base histórica. El retorno incremental acumulado del mes asciende a <strong className="num-hero text-lg" style={{ color: '#0F2444' }}>{fmtB(mesActual.incrementoVsBase)}</strong>.</>
                    ) : (
                      <>El honorario incremental ({fmtB(mesActual.incrementoVsBase)}) no cubre completamente la inversión de {fmtB(mesActual.inversionAV)}. Ver acciones recomendadas en Plan de Acción.</>
                    )}
                  </p>
                </div>
                <div className="text-right border-l border-[#B8924A]/20 pl-8">
                  <Eyebrow>Return on Investment</Eyebrow>
                  <div className="num-hero text-7xl mt-2 leading-none" style={{ color: '#0F2444' }}>
                    {mesActual.roiMultiplo > 0 ? mesActual.roiMultiplo.toFixed(1) : '—'}<span style={{ color: '#B8924A' }}>{mesActual.roiMultiplo > 0 ? '×' : ''}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-3 tracking-wider uppercase font-semibold">vs base histórica</div>
                </div>
              </div>
            </div>

            <Divider />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <HeroKPI label="Inversión AV" value={fmtB(mesActual.inversionAV)} sub="Costo fijo mensual" accent="gold" />
              <HeroKPI label="Honorario Total" value={fmtB(mesActual.honorarioTotal)}
                sub={mesActual.deltaVsMesAnterior !== 0 ? `${mesActual.deltaVsMesAnterior >= 0 ? '▲' : '▼'} ${fmtB(Math.abs(mesActual.deltaVsMesAnterior))} vs mes ant.` : 'Sin comparativo'} accent="navy" />
              <HeroKPI label="% Hon. al AV" value={mesActual.pctHonorarioTotalAlAV > 0 ? `${mesActual.pctHonorarioTotalAlAV.toFixed(2)}%` : '—'}
                sub={mesActual.honorarioTotal > 0 ? `De B/.${fmt(mesActual.honorarioTotal)} de honorario` : 'Sin datos aún'} accent="success" />
              <HeroKPI label="Minutos Consumidos" value={fmt(mesActual.minutosConsumidos)}
                sub={mesActual.minutosConsumidos > 0 ? `B/.${mesActual.costoXMinuto.toFixed(3)} costo efectivo/min` : 'Sin consumo registrado'} accent="warning" />
            </div>

            <Divider />

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <BolsaPremium bolsa={bolsa} consumidos={mesActual.minutosConsumidos} />
              </div>
              <div className="card-premium-hero p-7 elevated">
                <Eyebrow>Portfolio Distribution</Eyebrow>
                <h3 className="font-serif text-xl font-semibold mt-1 mb-5" style={{ color: '#0F2444' }}>Composición</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3"><StatusDot s="verde" /><span className="text-sm font-semibold" style={{ color: '#0F2444' }}>Rentables</span></div>
                    <span className="num-hero text-2xl" style={{ color: '#0F2444' }}>{verdes}</span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3"><StatusDot s="amarillo" /><span className="text-sm font-semibold" style={{ color: '#0F2444' }}>En Revisión</span></div>
                    <span className="num-hero text-2xl" style={{ color: '#0F2444' }}>{amarillas}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><StatusDot s="rojo" /><span className="text-sm font-semibold" style={{ color: '#0F2444' }}>No Rentables</span></div>
                    <span className="num-hero text-2xl" style={{ color: '#0F2444' }}>{rojas}</span>
                  </div>
                </div>

                {carteras.filter(c => c.semaforo === 'verde').length > 0 && (
                  <div className="mt-6 pt-5 border-t border-[#B8924A]/15">
                    <Eyebrow>Top Performers</Eyebrow>
                    <div className="space-y-2 mt-2">
                      {[...carteras].filter(c => c.semaforo === 'verde').sort((a, b) => a.pctHonorarioAlAV - b.pctHonorarioAlAV).slice(0, 3).map(c => (
                        <div key={c.nombre} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 font-medium truncate pr-2">{c.nombre}</span>
                          <span className="num-hero text-emerald-800 text-sm">{c.pctHonorarioAlAV.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {mesActual.deltaVsMesAnterior !== 0 && (
              <div className={`card-premium p-6 ${mesActual.deltaVsMesAnterior >= 0 ? 'border-l-2 border-l-emerald-700' : 'border-l-2 border-l-amber-600'}`}>
                <div className="flex items-start gap-4">
                  {mesActual.deltaVsMesAnterior >= 0
                    ? <TrendingUp className="w-5 h-5 text-emerald-700 mt-1 flex-shrink-0" />
                    : <TrendingDown className="w-5 h-5 text-amber-700 mt-1 flex-shrink-0" />}
                  <div>
                    <Eyebrow>vs {historico[mesSeleccionadoIdx - 1]?.label || 'Mes Anterior'}</Eyebrow>
                    <h3 className="font-serif text-lg font-semibold mt-1" style={{ color: '#0F2444' }}>
                      {mesActual.deltaVsMesAnterior >= 0 ? 'Honorario al alza' : 'Honorario a la baja'}
                    </h3>
                    <p className="text-sm text-slate-700 mt-2">
                      <span className={`num-hero text-xl ${mesActual.deltaVsMesAnterior >= 0 ? 'text-emerald-800' : 'text-amber-700'}`}>
                        {mesActual.deltaVsMesAnterior >= 0 ? '+' : ''}{fmtB(mesActual.deltaVsMesAnterior)}
                      </span>
                      <span className="text-slate-500 ml-2">
                        ({mesActual.honorarioAnterior > 0 ? ((mesActual.deltaVsMesAnterior / mesActual.honorarioAnterior) * 100).toFixed(1) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'carteras' && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <Eyebrow>Portfolio Analysis</Eyebrow>
                <h2 className="font-serif text-4xl font-semibold mt-2" style={{ color: '#0F2444' }}>Análisis por Cartera</h2>
                <p className="text-sm text-slate-500 mt-2">
                  {editMode ? 'Modo edición activo. Click en los campos amarillos para modificar.' : 'El % Hon. al AV muestra cuánto del honorario se destina al Asesor Virtual. Menor es mejor.'}
                </p>
              </div>
            </div>
            <TablaCarteras carteras={carteras} isEditable={editMode && esElMesActualEditable} mesActualData={mesActualLocal || undefined} onUpdate={actualizarCartera} />
          </>
        )}

        {tab === 'historico' && (
          <>
            <div>
              <Eyebrow>Historical Performance</Eyebrow>
              <h2 className="font-serif text-4xl font-semibold mt-2" style={{ color: '#0F2444' }}>Histórico de Resultados</h2>
              <p className="text-sm text-slate-500 mt-2">Evolución mensual de la inversión y el honorario recuperado.</p>
            </div>

            <GraficoHistorico historico={historico} />

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
                      <tr key={m.mes} className={`border-b border-slate-100 hover:bg-[#FAF7F1] cursor-pointer ${i === mesSeleccionadoIdx ? 'bg-[#F5EAD0]/30' : ''}`} onClick={() => cambiarMes(i)}>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-base font-semibold" style={{ color: '#0F2444' }}>{m.label}</span>
                            {m.avActivo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider" style={{ background: '#F5EAD0', color: '#B8924A' }}>AV</span>}
                            {m.esMesActual && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider bg-emerald-100 text-emerald-800">ACTUAL</span>}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-right">
                          {m.inversionAV > 0 ? <span className="num-table" style={{ color: '#0F2444' }}>{fmtB(m.inversionAV)}</span> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-4 text-right num-table text-sm" style={{ color: '#0F2444' }}>{m.honorarioTotal > 0 ? fmtB(m.honorarioTotal) : '—'}</td>
                        <td className="px-3 py-4 text-right">{i > 0 && m.honorarioTotal > 0 ? <Delta v={delta} /> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-3 py-4 text-center">
                          {m.inversionAV > 0 && m.honorarioTotal > 0
                            ? <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[11px] font-semibold border ${m.honorarioTotal >= m.inversionAV ? 'bg-emerald-50/50 text-emerald-800 border-emerald-200/60' : 'bg-red-50/50 text-red-900 border-red-200/60'}`}>
                                {m.honorarioTotal >= m.inversionAV ? 'Sí' : 'No'}
                              </span>
                            : <span className="text-slate-400 text-xs">{m.inversionAV === 0 ? 'Sin AV' : 'Pendiente'}</span>}
                        </td>
                        <td className="px-3 py-4 text-right num-hero text-sm">
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
              <p className="text-sm text-slate-500 mt-2">Acciones definidas · Click en cualquier acción para marcarla como completada</p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div className="card-premium p-6 border-l-2 border-l-emerald-700">
                <Eyebrow>Tendencia del Mes</Eyebrow>
                <div className={`font-serif text-2xl font-semibold mt-2 ${mesActual.deltaVsMesAnterior >= 0 ? 'text-emerald-800' : 'text-red-900'}`}>
                  {mesActual.deltaVsMesAnterior === 0 ? 'Sin datos' : mesActual.deltaVsMesAnterior >= 0 ? 'Avance positivo' : 'Por debajo'}
                </div>
                <div className="text-sm text-slate-600 mt-1 num-small">{mesActual.deltaVsMesAnterior !== 0 ? `${mesActual.deltaVsMesAnterior >= 0 ? '+' : ''}${fmtB(mesActual.deltaVsMesAnterior)} vs mes anterior` : 'Esperando cierre'}</div>
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
                <Eyebrow>Meta del Mes</Eyebrow>
                <div className="font-serif text-2xl font-semibold mt-2 gold-text">{fmtB(planes[0]?.metaHonorario || 0)}</div>
                <div className="text-sm text-slate-600 mt-1">
                  {mesActual.honorarioTotal > 0 ? `${((mesActual.honorarioTotal / (planes[0]?.metaHonorario || 1)) * 100).toFixed(0)}% logrado` : 'Pendiente'}
                </div>
              </div>
            </div>

            <PlanPremium planes={planes} onUpdate={actualizarPlanes} />
          </>
        )}
      </main>

      <footer className="border-t border-[#B8924A]/15 bg-white/60 mt-16">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#B8924A' }}>SPEAR</div>
              <div className="w-px h-3 bg-slate-300" />
              <span className="text-xs text-slate-500">Panel Ejecutivo del Asesor Virtual IA</span>
            </div>
            <span className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">Última actualización · {lastUpdate}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
