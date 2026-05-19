'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Sparkles, Brain, RefreshCw, ChevronDown, ChevronUp, Edit3, Save, AlertTriangle, CheckCircle2, Info, ClipboardList, Calendar, Target, X, Upload } from 'lucide-react'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL, PLAN_INICIAL, MesData, PlanSemanal } from '@/lib/store'
import { loadMesActual, saveMesActual, loadPlan, savePlan, recalcularMes } from '@/lib/persistence'

// ── Tipos ─────────────────────────────────────────────────────────────
interface ValorAV {
  rol: string; descripcionRol: string
  gestionesAV: number; gestionesPisoEstimadas: number
  pctCoberturaSinAV: number; pctCoberturaConAV: number
  minutosAVenRepetitivas: number; tiempoLibeReadoHoras: number; valorTiempoLiberado: number
  tasaConversionAV: number; tasaConversionPiso: number
  avAgregoValor: boolean; evidencia: string[]; limitacion: string
}
interface CarteraMetrica {
  nombre: string; clientes: number; asesores: number; comisionPct: number; minutosAV: number
  promesas: number; llamadas: number; efectivas: number
  inversionAV: number; costoPiso: number; masivos: number; costoTotal: number
  honorario: number; honorarioMesAnterior: number; base: number
  delta: number; retornoXBalboa: number
  pctHonorarioAlAV: number; puntosComisionAlAV: number
  semaforo: 'verde' | 'amarillo' | 'rojo'
  motivo: string; accion: string; pctCobertura: number
  valorAV: ValorAV
}
interface DashData {
  mesActualIdx: number
  estadoMes: 'completo' | 'minutos_sin_honorario' | 'vacio' | 'en_curso'
  mensajeEstado: string | null
  mesActual: {
    mes: string; label: string; esMesActual: boolean
    inversionAV: number; honorarioTotal: number; honorarioAnterior: number
    deltaVsMesAnterior: number; incrementoVsBase: number; roiMultiplo: number
    minutosConsumidos: number; sePaga: boolean; pctHonorarioTotalAlAV: number; costoXMinuto: number
    resumenValor: { carterasConValorEvidenciado: number; totalGestionesAV: number; totalGestionesPisoSinAV: number; pctIncrementoGestiones: number; totalHorasLiberadas: number; advertenciaAtribucion: string }
  }
  carteras: CarteraMetrica[]
  historico: { mes: string; label: string; inversionAV: number; honorarioTotal: number; avActivo: boolean; minutosConsumidos: number; esMesActual: boolean }[]
  bolsa: { saldoActual: number; diaRecarga: number; cantidadRecarga: number; historial: { fecha: string; tipo: string; cantidad: number; descripcion: string }[] }
}

// ── Helpers ───────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('es-PA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtB = (n: number) => `B/.${fmt(n)}`

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-eyebrow">{children}</div>
}
function Divider() { return <div className="divider-gold my-6" /> }
function Delta({ v }: { v: number }) {
  if (v === 0) return <span className="text-slate-400 num-table">—</span>
  const pos = v > 0
  return <span className={`inline-flex items-center gap-0.5 num-table text-sm ${pos ? 'text-emerald-800' : 'text-red-900'}`}>
    {pos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
    {pos ? '+' : '-'}B/.{fmt(Math.abs(v))}
  </span>
}
function StatusDot({ s }: { s: 'verde' | 'amarillo' | 'rojo' }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${{ verde: 'bg-emerald-700', amarillo: 'bg-amber-600', rojo: 'bg-red-800' }[s]}`} />
}
function StatusLabel({ s }: { s: 'verde' | 'amarillo' | 'rojo' }) {
  const c = { verde: { text: 'text-emerald-800', bg: 'bg-emerald-50/50', border: 'border-emerald-200/60', label: 'Rentable' }, amarillo: { text: 'text-amber-800', bg: 'bg-amber-50/50', border: 'border-amber-200/60', label: 'En Revisión' }, rojo: { text: 'text-red-900', bg: 'bg-red-50/50', border: 'border-red-200/60', label: 'No Rentable' } }[s]
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-[11px] font-semibold border tracking-wide ${c.text} ${c.bg} ${c.border}`}><StatusDot s={s} />{c.label}</span>
}

// ── KPI Card ──────────────────────────────────────────────────────────
function HeroKPI({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'gold' | 'navy' | 'success' | 'warning' | 'neutral' }) {
  const a = { gold: 'border-t-[#B8924A]', navy: 'border-t-[#0F2444]', success: 'border-t-emerald-700', warning: 'border-t-amber-600', neutral: 'border-t-slate-400' }
  return (
    <div className={`card-premium-hero p-6 border-t-2 ${a[accent || 'neutral']} elevated`}>
      <Eyebrow>{label}</Eyebrow>
      <div className="num-hero text-4xl mt-3" style={{ color: '#0F2444' }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-3 font-medium tracking-wide">{sub}</div>}
    </div>
  )
}

// ── Bolsa de Minutos ──────────────────────────────────────────────────
function BolsaPremium({ bolsa, consumidos }: { bolsa: DashData['bolsa']; consumidos: number }) {
  const saldo = bolsa.saldoActual
  const consumoDiario = consumidos > 0 ? consumidos / 30 : 0
  const mesesRestantes = consumoDiario > 0 ? saldo / (consumoDiario * 30) : 0
  const diaActual = new Date().getDate()
  const diasParaRecarga = diaActual <= bolsa.diaRecarga ? bolsa.diaRecarga - diaActual : 30 - diaActual + bolsa.diaRecarga
  return (
    <div className="card-premium-hero p-8 elevated">
      <div className="flex items-start justify-between mb-6">
        <div><Eyebrow>Bolsa de Minutos</Eyebrow><div className="font-serif text-2xl font-semibold mt-1" style={{ color: '#0F2444' }}>Capital Disponible</div></div>
        <div className="text-right"><div className="text-eyebrow">Próxima Recarga</div><div className="num-table text-sm mt-1" style={{ color: '#0F2444' }}>Día {bolsa.diaRecarga} — en {diasParaRecarga} días</div></div>
      </div>
      <div className="text-center py-6 border-y border-[#B8924A]/15">
        <div className="num-hero text-7xl leading-none" style={{ color: '#0F2444' }}>{fmt(saldo)}</div>
        <div className="text-xs text-slate-500 mt-3 tracking-widest font-semibold uppercase">minutos disponibles</div>
      </div>
      <div className="grid grid-cols-3 gap-6 mt-6">
        <div className="text-center"><div className="text-eyebrow mb-2">Recarga</div><div className="num-hero text-2xl" style={{ color: '#0F2444' }}>+{fmt(bolsa.cantidadRecarga)}</div><div className="text-[11px] text-slate-400 mt-1">B/.4,000 incluidos</div></div>
        <div className="text-center border-x border-slate-200/60"><div className="text-eyebrow mb-2">Consumo Mes Ant.</div><div className="num-hero text-2xl" style={{ color: '#0F2444' }}>{fmt(consumidos)}</div><div className="text-[11px] text-slate-400 mt-1">{((consumidos / bolsa.cantidadRecarga) * 100).toFixed(0)}% del paquete</div></div>
        <div className="text-center"><div className="text-eyebrow mb-2">Cobertura</div><div className="num-hero text-2xl gold-text">{mesesRestantes.toFixed(1)}</div><div className="text-[11px] text-slate-400 mt-1">meses al ritmo actual</div></div>
      </div>
    </div>
  )
}

// ── Panel de Valor del AV — el análisis honesto ───────────────────────
function PanelValorAV({ cartera }: { cartera: CarteraMetrica }) {
  const v = cartera.valorAV
  const rolIcon = v.rol === 'liberacion' ? '⚡' : '📡'
  const rolLabel = v.rol === 'liberacion' ? 'Liberación de Capacidad' : v.rol === 'volumen' ? 'Ampliación de Cobertura' : 'Mixto'

  return (
    <div className="mt-4 border border-[#B8924A]/20 rounded-md overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-[#FAF7F1] to-white border-b border-[#B8924A]/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{rolIcon}</span>
            <div>
              <div className="text-eyebrow">Rol del AV en esta cartera</div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: '#0F2444' }}>{rolLabel}</div>
            </div>
          </div>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-bold ${v.avAgregoValor ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
            {v.avAgregoValor ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
            {v.avAgregoValor ? 'Valor evidenciado' : 'Sin evidencia suficiente'}
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{v.descripcionRol}</p>
      </div>

      <div className="p-4">
        {/* Métricas de cobertura / liberación */}
        {v.rol === 'volumen' && v.gestionesAV > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center bg-slate-50 rounded p-3">
              <div className="text-eyebrow mb-1">Gestiones AV</div>
              <div className="num-hero text-2xl" style={{ color: '#0F2444' }}>{fmt(v.gestionesAV)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">llamadas realizadas</div>
            </div>
            <div className="text-center bg-slate-50 rounded p-3">
              <div className="text-eyebrow mb-1">Piso solo haría</div>
              <div className="num-hero text-2xl" style={{ color: '#0F2444' }}>~{fmt(v.gestionesPisoEstimadas)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">sin el AV</div>
            </div>
            <div className="text-center bg-[#F5EAD0] rounded p-3">
              <div className="text-eyebrow mb-1">Cobertura adicional</div>
              <div className="num-hero text-2xl gold-text">+{fmt(v.gestionesAV)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">gestiones extra</div>
            </div>
          </div>
        )}
        {v.rol === 'liberacion' && v.minutosAVenRepetitivas > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center bg-slate-50 rounded p-3">
              <div className="text-eyebrow mb-1">Min. repetitivos AV</div>
              <div className="num-hero text-2xl" style={{ color: '#0F2444' }}>{fmt(v.minutosAVenRepetitivas)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">tareas delegadas</div>
            </div>
            <div className="text-center bg-slate-50 rounded p-3">
              <div className="text-eyebrow mb-1">Tiempo liberado</div>
              <div className="num-hero text-2xl" style={{ color: '#0F2444' }}>{v.tiempoLibeReadoHoras}h</div>
              <div className="text-[10px] text-slate-500 mt-0.5">de asesores</div>
            </div>
            <div className="text-center bg-[#F5EAD0] rounded p-3">
              <div className="text-eyebrow mb-1">Valor tiempo liberado</div>
              <div className="num-hero text-2xl gold-text">B/.{v.valorTiempoLiberado.toFixed(0)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">al costo piso</div>
            </div>
          </div>
        )}

        {/* Evidencia */}
        {v.evidencia.length > 0 && (
          <div className="space-y-1 mb-4">
            {v.evidencia.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <span className="text-emerald-700 mt-0.5 flex-shrink-0">✓</span>
                <span>{e}</span>
              </div>
            ))}
          </div>
        )}

        {/* Advertencia de atribución — la honestidad */}
        <div className="bg-[#FAF7F1] border border-[#B8924A]/20 rounded p-3 flex gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#B8924A' }} />
          <p className="text-[11px] text-slate-600 leading-relaxed"><span className="font-semibold" style={{ color: '#0F2444' }}>Limitación de análisis: </span>{v.limitacion}</p>
        </div>
      </div>
    </div>
  )
}

// ── Tabla de Carteras ─────────────────────────────────────────────────
function TablaCarteras({ carteras, isEditable, onUpdate }: {
  carteras: CarteraMetrica[]
  isEditable: boolean
  onUpdate?: (cartera: string, field: string, value: number) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({})

  const setVal = (c: string, f: string, v: string) => setVals(p => ({ ...p, [c]: { ...(p[c] || {}), [f]: v } }))
  const commit = (c: string, f: string) => {
    const raw = vals[c]?.[f]
    if (raw !== undefined && onUpdate) {
      onUpdate(c, f, parseFloat(raw.replace(/,/g, '')) || 0)
      setVals(p => { const n = { ...p }; if (n[c]) { delete n[c][f]; if (!Object.keys(n[c]).length) delete n[c] }; return n })
    }
  }

  return (
    <div className="card-premium-hero overflow-hidden elevated">
      <div className="px-8 py-5 border-b border-[#B8924A]/15 bg-gradient-to-r from-[#0F2444] to-[#1A3458]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#C9A663' }}>Portfolio Analysis {isEditable && '· Edición Activa'}</div>
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
              {['CARTERA', isEditable ? '⬦ MIN. AV' : 'MIN. AV', 'INV. AV', isEditable ? '⬦ HONORARIO' : 'HONORARIO', '% HON. AL AV', 'vs MES ANT.', 'ESTADO', ''].map((h, i) => (
                <th key={i} className={`px-${i === 0 ? 8 : 3} py-4 text-${i === 0 ? 'left' : i < 7 ? 'right' : 'center'} text-[10px] font-bold uppercase tracking-widest text-slate-600`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carteras.map(c => (
              <Fragment key={c.nombre}>
                <tr className={`border-b border-slate-100 transition-colors ${expanded === c.nombre ? 'bg-[#FAF7F1]' : 'hover:bg-[#FAF7F1]/50'}`}>
                  <td className="px-8 py-5 cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                    <div className="font-semibold text-sm tracking-tight" style={{ color: '#0F2444' }}>{c.nombre}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{fmt(c.clientes)} clientes · {c.asesores} ases. · {c.comisionPct.toFixed(2)}% comisión</div>
                  </td>
                  <td className="px-3 py-5 text-right">
                    {isEditable ? <input type="text" className="editable-num num-table text-sm w-24" value={vals[c.nombre]?.minutosAV ?? c.minutosAV.toString()} onChange={e => setVal(c.nombre, 'minutosAV', e.target.value)} onBlur={() => commit(c.nombre, 'minutosAV')} onFocus={e => e.target.select()} />
                      : <span className="num-table text-sm" style={{ color: '#0F2444' }}>{c.minutosAV > 0 ? fmt(c.minutosAV) : '—'}</span>}
                  </td>
                  <td className="px-3 py-5 text-right cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                    {c.inversionAV > 0 ? <span className="num-table text-sm" style={{ color: '#0F2444' }}>{fmtB(c.inversionAV)}</span> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-5 text-right">
                    {isEditable ? <input type="text" className="editable-num num-table text-sm w-28" value={vals[c.nombre]?.honorario ?? c.honorario.toString()} onChange={e => setVal(c.nombre, 'honorario', e.target.value)} onBlur={() => commit(c.nombre, 'honorario')} onFocus={e => e.target.select()} />
                      : <><span className="num-table text-sm" style={{ color: '#0F2444' }}>{fmtB(c.honorario)}</span>{c.base > 0 && <div className="text-[11px] text-slate-500">Base: {fmtB(c.base)}</div>}</>}
                  </td>
                  <td className="px-3 py-5 text-right cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>
                    {c.pctHonorarioAlAV > 0 ? <div className={`num-hero text-base ${c.pctHonorarioAlAV < 10 ? 'text-emerald-800' : c.pctHonorarioAlAV < 30 ? 'text-emerald-700' : c.pctHonorarioAlAV < 60 ? 'text-amber-700' : 'text-red-900'}`}>{c.pctHonorarioAlAV.toFixed(1)}%</div>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-5 text-right cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}><Delta v={c.honorario - c.honorarioMesAnterior} /></td>
                  <td className="px-3 py-5 text-center cursor-pointer" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}><StatusLabel s={c.semaforo} /></td>
                  <td className="px-3 py-5 cursor-pointer text-slate-400" onClick={() => setExpanded(expanded === c.nombre ? null : c.nombre)}>{expanded === c.nombre ? <ChevronUp className="w-4 h-4 mx-auto" /> : <ChevronDown className="w-4 h-4 mx-auto" />}</td>
                </tr>
                {expanded === c.nombre && (
                  <tr className="bg-gradient-to-b from-[#FAF7F1] to-white border-b border-slate-200">
                    <td colSpan={8} className="px-8 py-6">
                      <div className="grid md:grid-cols-4 gap-6 mb-4">
                        <div>
                          <Eyebrow>Operación</Eyebrow>
                          <dl className="space-y-2 text-sm mt-3">
                            {isEditable ? (
                              <>
                                <div className="flex justify-between items-center"><dt className="text-slate-600">Llamadas AV:</dt><input type="text" className="editable-num num-table text-sm w-20" value={vals[c.nombre]?.llamadas ?? c.llamadas.toString()} onChange={e => setVal(c.nombre, 'llamadas', e.target.value)} onBlur={() => commit(c.nombre, 'llamadas')} onFocus={e => e.target.select()} /></div>
                                <div className="flex justify-between items-center"><dt className="text-slate-600">Efectivas:</dt><input type="text" className="editable-num num-table text-sm w-20" value={vals[c.nombre]?.efectivas ?? c.efectivas.toString()} onChange={e => setVal(c.nombre, 'efectivas', e.target.value)} onBlur={() => commit(c.nombre, 'efectivas')} onFocus={e => e.target.select()} /></div>
                                <div className="flex justify-between items-center"><dt className="text-slate-600">Promesas:</dt><input type="text" className="editable-num num-table text-sm w-20" value={vals[c.nombre]?.promesas ?? c.promesas.toString()} onChange={e => setVal(c.nombre, 'promesas', e.target.value)} onBlur={() => commit(c.nombre, 'promesas')} onFocus={e => e.target.select()} /></div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between"><dt className="text-slate-600">Llamadas AV:</dt><dd className="num-table" style={{ color: '#0F2444' }}>{fmt(c.llamadas)}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-600">Efectivas:</dt><dd className="num-table" style={{ color: '#0F2444' }}>{fmt(c.efectivas)}</dd></div>
                                <div className="flex justify-between"><dt className="text-slate-600">Promesas:</dt><dd className="num-table text-emerald-800">{c.promesas}</dd></div>
                              </>
                            )}
                            <div className="flex justify-between"><dt className="text-slate-600">Cobertura:</dt><dd className="num-table" style={{ color: '#0F2444' }}>{c.pctCobertura}%</dd></div>
                          </dl>
                        </div>
                        <div>
                          <Eyebrow>Costos</Eyebrow>
                          <dl className="space-y-2 text-sm mt-3">
                            <div className="flex justify-between"><dt className="text-slate-600">AV:</dt><dd className="num-table" style={{ color: '#0F2444' }}>{fmtB(c.inversionAV)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Piso:</dt><dd className="num-table" style={{ color: '#0F2444' }}>{fmtB(c.costoPiso)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Masivos:</dt><dd className="num-table" style={{ color: '#0F2444' }}>{fmtB(c.masivos)}</dd></div>
                            <div className="flex justify-between pt-2 border-t border-[#B8924A]/20"><dt className="font-semibold" style={{ color: '#0F2444' }}>Total:</dt><dd className="num-hero text-base" style={{ color: '#0F2444' }}>{fmtB(c.costoTotal)}</dd></div>
                          </dl>
                        </div>
                        <div className="bg-white border border-[#B8924A]/15 rounded p-4">
                          <Eyebrow>Análisis Financiero</Eyebrow>
                          <div className="mt-3 space-y-3">
                            <div><div className="text-xs text-slate-600 mb-1">% del honorario al AV</div>
                              <div className={`num-hero text-3xl ${c.pctHonorarioAlAV < 10 ? 'text-emerald-800' : c.pctHonorarioAlAV < 30 ? 'text-emerald-700' : c.pctHonorarioAlAV < 60 ? 'text-amber-700' : 'text-red-900'}`}>{c.pctHonorarioAlAV > 0 ? `${c.pctHonorarioAlAV.toFixed(2)}%` : '—'}</div>
                            </div>
                            {c.pctHonorarioAlAV > 0 && <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">De los <strong style={{ color: '#0F2444' }}>{c.comisionPct.toFixed(2)}%</strong> de comisión, <strong style={{ color: '#0F2444' }}>{c.puntosComisionAlAV.toFixed(3)}%</strong> se destinó al AV.</div>}
                          </div>
                        </div>
                        <div>
                          <Eyebrow>Diagnóstico</Eyebrow>
                          <p className="text-sm text-slate-700 leading-relaxed mt-3">{c.motivo}</p>
                          <Eyebrow><span className="mt-4 inline-block">Acción</span></Eyebrow>
                          <div className="mt-2 p-3 border-l-2 gold-border bg-[#FAF7F1] rounded-r text-sm leading-relaxed" style={{ color: '#0F2444' }}>{c.accion}</div>
                        </div>
                      </div>
                      {/* Panel de valor del AV */}
                      {c.minutosAV > 0 && <PanelValorAV cartera={c} />}
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

// ── Gráfico histórico ─────────────────────────────────────────────────
function GraficoHistorico({ historico }: { historico: DashData['historico'] }) {
  const data = historico.map(m => ({ name: m.label.split(' ')[0], honorario: m.honorarioTotal, inversion: m.inversionAV }))
  return (
    <div className="card-premium-hero p-8 elevated">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div><Eyebrow>Historical Performance</Eyebrow><h3 className="font-serif text-2xl font-semibold mt-1" style={{ color: '#0F2444' }}>Inversión vs Recuperación</h3></div>
        <div className="flex items-center gap-5 text-xs">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#0F2444' }} /><span className="font-semibold text-slate-700">Honorario</span></span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: '#B8924A' }} /><span className="font-semibold text-slate-700">Inversión AV</span></span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
          <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #B8924A', borderRadius: '4px', boxShadow: '0 8px 16px rgba(15,36,68,0.1)', padding: '12px' }} labelStyle={{ color: '#0F2444', fontWeight: 700, fontSize: '12px' }} formatter={(v: number) => [`B/.${v.toLocaleString('es-PA')}`, '']} />
          <Bar dataKey="honorario" fill="#0F2444" radius={[2, 2, 0, 0]} maxBarSize={50} />
          <Bar dataKey="inversion" fill="#B8924A" radius={[2, 2, 0, 0]} maxBarSize={50} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Panel de carga de archivos ────────────────────────────────────────
function PanelCargaArchivos({ mesActual, onExito, onCerrar }: {
  mesActual: string; onExito: () => void; onCerrar: () => void
}) {
  const [archivos, setArchivos] = useState<File[]>([])
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError] = useState('')

  const meses = [
    { value: '2026-05', label: 'MAY 2026 (actual)' },
    { value: '2026-04', label: 'ABR 2026' },
    { value: '2026-03', label: 'MAR 2026' },
    { value: '2026-02', label: 'FEB 2026' },
    { value: '2026-01', label: 'ENE 2026' },
  ]
  const [mesSeleccionado, setMesSeleccionado] = useState(mesActual || '2026-05')

  const agregarArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevos = Array.from(e.target.files || [])
    setArchivos(prev => [...prev, ...nuevos])
    setResultado(null); setError('')
  }

  const quitarArchivo = (idx: number) => setArchivos(prev => prev.filter((_, i) => i !== idx))

  const getIcono = (nombre: string) => {
    const n = nombre.toUpperCase()
    if (n.includes('SIGELLA')) return '👥'
    if (n.includes('RECORDATORIO')) return '🔔'
    if (n.includes('COBRO')) return '💳'
    return '📄'
  }

  const cargar = async () => {
    if (!archivos.length) return
    setCargando(true); setError(''); setResultado(null)
    try {
      const fd = new FormData()
      archivos.forEach(f => fd.append('archivos', f))
      fd.append('mes', mesSeleccionado)
      const res = await fetch('/api/upload-excel', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.ok) { setResultado(data); setArchivos([]); onExito() }
      else setError(data.error || 'Error al procesar los archivos')
    } catch (e) { setError(String(e)) }
    setCargando(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl mb-8">
        <div className="px-8 py-6 bg-gradient-to-r from-[#0F2444] to-[#1A3458] rounded-t-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#C9A663' }}>Carga de Datos</div>
            <h2 className="font-serif text-2xl font-semibold text-white mt-1">Cargar Reportes</h2>
            <p className="text-xs text-slate-300 mt-1">AV (Cobro/Recordatorios) y Piso (Sigella)</p>
          </div>
          <button onClick={onCerrar} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Selector de mes */}
          <div>
            <label className="text-eyebrow block mb-2">Mes al que corresponden los archivos</label>
            <select value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}
              className="w-full border border-[#B8924A]/30 rounded px-3 py-2.5 text-sm outline-none focus:border-[#B8924A] bg-[#FAF7F1] font-semibold"
              style={{ color: '#0F2444' }}>
              {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Zona de carga */}
          <div>
            <label className="text-eyebrow block mb-2">Seleccionar archivos</label>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-[#B8924A]/30 rounded-lg cursor-pointer hover:bg-[#FAF7F1]/50 transition-colors">
              <Upload className="w-7 h-7 mb-2" style={{ color: '#B8924A' }} />
              <span className="text-sm font-medium" style={{ color: '#0F2444' }}>Click para seleccionar archivos</span>
              <span className="text-xs text-slate-400 mt-1">Puedes seleccionar varios a la vez</span>
              <input type="file" multiple accept=".xlsx,.xls" className="hidden" onChange={agregarArchivos} />
            </label>
          </div>

          {/* Lista de archivos seleccionados */}
          {archivos.length > 0 && (
            <div className="space-y-2">
              <label className="text-eyebrow block">Archivos listos para cargar</label>
              {archivos.map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-[#FAF7F1] border border-[#B8924A]/15 rounded px-3 py-2.5">
                  <span className="text-lg">{getIcono(f.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: '#0F2444' }}>{f.name}</div>
                    <div className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <button onClick={() => quitarArchivo(i)} className="p-1 hover:bg-red-50 rounded transition-colors">
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Guía de nombres */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Nombres esperados de archivos</div>
            <div className="space-y-1 text-xs font-mono text-slate-600">
              <div><span className="text-blue-600">Reporte-Cobro-General-18-05-Corte-1.xlsx</span> → AV Cobro</div>
              <div><span className="text-blue-600">Reporte-Recordatorios-General-18-05.xlsx</span> → AV Recordatorio</div>
              <div><span className="text-blue-600">Reporte-Recordatorios-SURA-18-05.xlsx</span> → AV SURA</div>
              <div><span className="text-green-600">Sigella-Gestiones-18-05-2026.xlsx</span> → Piso</div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Resultado exitoso */}
          {resultado && (
            <div className="bg-emerald-50 border border-emerald-200 rounded p-4">
              <div className="font-semibold text-emerald-800 mb-2 text-sm">✓ Carga completada</div>
              <div className="space-y-1">
                {resultado.resultados?.map((r: any, i: number) => (
                  <div key={i} className="text-xs text-emerald-700">
                    {r.ok ? `✓ ${r.archivo} — ${r.tipo === 'piso' ? `${r.gestiones?.toLocaleString()} gestiones piso` : `${r.minutos} min AV, ${r.gestiones} gestiones`}` : `✗ ${r.archivo}: ${r.error}`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón cargar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onCerrar} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cerrar</button>
            <button onClick={cargar} disabled={!archivos.length || cargando}
              className="flex items-center gap-2 px-6 py-2.5 rounded-sm text-sm font-semibold text-white transition-colors disabled:opacity-40"
              style={{ background: '#0F2444' }}>
              {cargando ? <><RefreshCw className="w-4 h-4 animate-spin" />Procesando...</> : <><Upload className="w-4 h-4" />Cargar archivos</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Formulario cierre de mes ──────────────────────────────────────────
function FormularioCierreMes({ onGuardar, onCerrar }: { onGuardar: (datos: Record<string, { minutosAV: number; honorario: number; llamadas: number; efectivas: number; promesas: number }>) => void; onCerrar: () => void }) {
  const [datos, setDatos] = useState<Record<string, Record<string, string>>>({})
  const [nota, setNota] = useState('')

  const set = (c: string, f: string, v: string) => setDatos(p => ({ ...p, [c]: { ...(p[c] || {}), [f]: v } }))
  const get = (c: string, f: string) => datos[c]?.[f] ?? '0'

  const guardar = () => {
    const resultado: Record<string, any> = {}
    CARTERAS_CONFIG.forEach(c => {
      resultado[c.nombre] = {
        minutosAV: parseFloat(get(c.nombre, 'min') || '0'),
        honorario: parseFloat(get(c.nombre, 'hon') || '0'),
        llamadas: parseFloat(get(c.nombre, 'llam') || '0'),
        efectivas: parseFloat(get(c.nombre, 'efec') || '0'),
        promesas: parseFloat(get(c.nombre, 'prom') || '0'),
      }
    })
    onGuardar(resultado)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl mb-8">
        <div className="px-8 py-6 bg-gradient-to-r from-[#0F2444] to-[#1A3458] rounded-t-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#C9A663' }}>Administración</div>
            <h2 className="font-serif text-2xl font-semibold text-white mt-1">Registrar Mes</h2>
            <p className="text-xs text-slate-300 mt-1">Ingresa todos los datos del mes de una sola vez</p>
          </div>
          <button onClick={onCerrar} className="p-2 rounded-full hover:bg-white/10 transition-colors"><X className="w-5 h-5 text-white" /></button>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#B8924A]/20">
                  <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Cartera</th>
                  <th className="pb-3 px-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Min. AV</th>
                  <th className="pb-3 px-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Honorario</th>
                  <th className="pb-3 px-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Llamadas</th>
                  <th className="pb-3 px-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Efectivas</th>
                  <th className="pb-3 px-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Promesas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CARTERAS_CONFIG.map((c, i) => (
                  <tr key={c.nombre} className={i % 2 === 0 ? 'bg-[#FAF7F1]/50' : ''}>
                    <td className="py-2.5">
                      <div className="font-semibold text-xs" style={{ color: '#0F2444' }}>{c.nombre}</div>
                      <div className="text-[10px] text-slate-500">{(c.honorarioPct * 100).toFixed(2)}% comisión</div>
                    </td>
                    {(['min', 'hon', 'llam', 'efec', 'prom'] as const).map(f => (
                      <td key={f} className="px-2 py-2.5 text-right">
                        <input type="text" className="editable-num num-table text-sm w-24" placeholder="0"
                          value={get(c.nombre, f)} onChange={e => set(c.nombre, f, e.target.value)} onFocus={e => e.target.select()} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5">
            <label className="text-eyebrow mb-2 block">Nota del mes (opcional)</label>
            <input type="text" className="w-full border border-[#B8924A]/30 rounded px-3 py-2 text-sm outline-none focus:border-[#B8924A] bg-[#FAF7F1]" placeholder='Ej: "Honorario pendiente de cierre" / "Mes completo"' value={nota} onChange={e => setNota(e.target.value)} style={{ color: '#0F2444' }} />
          </div>
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
            <button onClick={onCerrar} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancelar</button>
            <button onClick={guardar} className="flex items-center gap-2 px-6 py-2.5 rounded-sm text-sm font-semibold text-white transition-colors hover:opacity-90" style={{ background: '#0F2444' }}>
              <Save className="w-4 h-4" />Guardar mes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Plan semanal ──────────────────────────────────────────────────────
function PlanPremium({ planes, onUpdate }: { planes: PlanSemanal[]; onUpdate: (p: PlanSemanal[]) => void }) {
  const plan = planes[0]; if (!plan) return null
  const done = plan.acciones.filter(a => a.completada).length
  const pct = plan.acciones.length > 0 ? (done / plan.acciones.length) * 100 : 0
  return (
    <div className="card-premium-hero overflow-hidden elevated">
      <div className="px-8 py-6 bg-gradient-to-r from-[#0F2444] to-[#1A3458] border-b border-[#B8924A]/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#C9A663' }}>Strategic Initiative</div><h3 className="font-serif text-2xl font-semibold text-white mt-1">Plan de Acción</h3><p className="text-xs text-slate-300 mt-1">{plan.semana}</p></div>
          <div className="flex items-center gap-4">
            <div className="text-right"><div className="text-[10px] text-slate-300 font-semibold tracking-widest uppercase">Progreso</div><div className="num-hero text-2xl text-white mt-1">{done}/{plan.acciones.length}</div></div>
            <div className="w-32"><div className="h-1 bg-white/10 rounded-full"><div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: '#B8924A' }} /></div></div>
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {plan.acciones.map((a, i) => (
          <div key={a.id} className="px-8 py-5 flex gap-5 hover:bg-[#FAF7F1] cursor-pointer transition-colors" onClick={() => { const np = { ...plan, acciones: plan.acciones.map(x => x.id === a.id ? { ...x, completada: !x.completada } : x) }; onUpdate([np, ...planes.slice(1)]) }}>
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${a.completada ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-[#FAF7F1] border border-[#B8924A]/30'}`} style={!a.completada ? { color: '#0F2444' } : {}}>{a.completada ? '✓' : i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${a.completada ? 'line-through text-slate-400' : ''}`} style={!a.completada ? { color: '#0F2444' } : {}}>{a.descripcion}</div>
              <div className="flex flex-wrap gap-5 mt-1.5 text-[11px]">
                <span className="text-slate-500">Responsable: <span className="font-semibold text-slate-700">{a.responsable}</span></span>
                <span className="font-semibold text-emerald-800">Impacto: {a.impactoEsperado}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {plan.notas && <div className="px-8 py-4 bg-[#FAF7F1] border-t border-[#B8924A]/15 text-xs text-slate-600"><span className="font-bold text-slate-700 mr-1">Nota:</span>{plan.notas}</div>}
    </div>
  )
}

// ── Selector de mes ───────────────────────────────────────────────────
function MonthSelector({ historico, currentIdx, onChange }: { historico: DashData['historico']; currentIdx: number; onChange: (i: number) => void }) {
  return (
    <div className="inline-flex items-center bg-white border border-[#B8924A]/20 rounded-md overflow-hidden elevated">
      <button onClick={() => currentIdx > 0 && onChange(currentIdx - 1)} disabled={currentIdx === 0} className="px-3 py-2.5 hover:bg-[#FAF7F1] transition-colors disabled:opacity-30">
        <svg className="w-4 h-4" style={{ color: '#0F2444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </button>
      <select value={currentIdx} onChange={e => onChange(parseInt(e.target.value))} className="month-selector px-4 py-2.5 text-sm bg-transparent border-x border-[#B8924A]/20 outline-none cursor-pointer" style={{ color: '#0F2444', minWidth: '180px' }}>
        {historico.map((m, i) => <option key={m.mes} value={i}>{m.label}{m.esMesActual ? ' ◆ ACTUAL' : ''}</option>)}
      </select>
      <button onClick={() => currentIdx < historico.length - 1 && onChange(currentIdx + 1)} disabled={currentIdx === historico.length - 1} className="px-3 py-2.5 hover:bg-[#FAF7F1] transition-colors disabled:opacity-30">
        <svg className="w-4 h-4" style={{ color: '#0F2444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null)
  const [planes, setPlanes] = useState<PlanSemanal[]>(PLAN_INICIAL)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'resumen' | 'carteras' | 'historico' | 'plan'>('resumen')
  const [mesIdx, setMesIdx] = useState(HISTORICO_INICIAL.length - 1)
  const [mesActualLocal, setMesActualLocal] = useState<MesData | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [mostrarCarga, setMostrarCarga] = useState(false)
  const [lastUpdate, setLastUpdate] = useState('')

  const fetchData = useCallback(async (idx: number, mesEditado?: MesData) => {
    setLoading(true)
    try {
      const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mesIdx: idx, mesActualEditado: mesEditado }) })
      const d = await res.json()
      if (d.ok) setData(d)
      setLastUpdate(new Date().toLocaleString('es-PA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }))
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => {
    const mesDefault = HISTORICO_INICIAL.find(m => m.esMesActual)!
    const mesGuardado = loadMesActual(mesDefault)
    setMesActualLocal(mesGuardado)
    setPlanes(loadPlan(PLAN_INICIAL))
    fetchData(HISTORICO_INICIAL.length - 1, mesGuardado)
  }, [fetchData])

  const cambiarMes = (idx: number) => { setMesIdx(idx); setEditMode(false); fetchData(idx, mesActualLocal || undefined) }

  const actualizarCartera = (cartera: string, field: string, value: number) => {
    if (!mesActualLocal) return
    const nuevo = recalcularMes({ ...mesActualLocal, carteras: { ...mesActualLocal.carteras, [cartera]: { ...mesActualLocal.carteras[cartera], [field]: value } } })
    setMesActualLocal(nuevo); saveMesActual(nuevo); fetchData(mesIdx, nuevo)
  }

  const guardarFormulario = (datos: Record<string, any>) => {
    if (!mesActualLocal) return
    const nuevasCar = { ...mesActualLocal.carteras }
    Object.entries(datos).forEach(([nombre, v]) => {
      nuevasCar[nombre] = { minutosAV: v.minutosAV, honorario: v.honorario, llamadas: v.llamadas, efectivas: v.efectivas, promesas: v.promesas, honorarioMesAnterior: mesActualLocal.carteras[nombre]?.honorarioMesAnterior || 0 }
    })
    const nuevo = recalcularMes({ ...mesActualLocal, carteras: nuevasCar })
    setMesActualLocal(nuevo); saveMesActual(nuevo); fetchData(mesIdx, nuevo)
    setMostrarFormulario(false)
  }

  if (loading && !data) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="w-1 h-1 bg-[#B8924A] mx-auto mb-6"></div><div className="font-serif text-2xl" style={{ color: '#0F2444' }}>SPEAR</div><div className="text-xs text-slate-500 mt-2 tracking-widest uppercase">Cargando información</div></div>
    </div>
  )
  if (!data) return <div className="min-h-screen flex items-center justify-center text-red-900">Error al cargar datos</div>

  const { mesActual, carteras, historico, bolsa, estadoMes, mensajeEstado } = data
  const verdes = carteras.filter(c => c.semaforo === 'verde').length
  const rojas = carteras.filter(c => c.semaforo === 'rojo').length
  const amarillas = carteras.filter(c => c.semaforo === 'amarillo').length
  const esMesActualEditable = mesActual.esMesActual
  const rv = mesActual.resumenValor

  return (
    <div className="min-h-screen">
      {mostrarFormulario && <FormularioCierreMes onGuardar={guardarFormulario} onCerrar={() => setMostrarFormulario(false)} />}
      {mostrarCarga && <PanelCargaArchivos mesActual={data?.mesActual?.mes || '2026-05'} onExito={() => { fetchData(mesIdx, mesActualLocal || undefined); setMostrarCarga(false) }} onCerrar={() => setMostrarCarga(false)} />}

      <header className="border-b border-[#B8924A]/20 sticky top-0 z-50 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-sm flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, #0F2444 0%, #1A3458 100%)', boxShadow: '0 4px 12px rgba(15,36,68,0.15)' }}>
                <Sparkles className="w-5 h-5 absolute" style={{ color: '#C9A663', top: '8px', left: '8px' }} />
                <Brain className="w-5 h-5 absolute" style={{ color: '#C9A663', bottom: '8px', right: '8px', opacity: 0.6 }} />
              </div>
              <div><h1 className="font-serif text-xl font-semibold tracking-tight" style={{ color: '#0F2444' }}>SPEAR</h1><p className="text-[10px] tracking-widest uppercase font-semibold mt-0.5" style={{ color: '#B8924A' }}>Asesor Virtual IA · Panel Ejecutivo</p></div>
            </div>
            <div className="flex items-center gap-3">
              <MonthSelector historico={historico} currentIdx={mesIdx} onChange={cambiarMes} />
              {esMesActualEditable && (
                <button onClick={() => setMostrarFormulario(true)} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-sm border transition-colors" style={{ borderColor: '#B8924A', color: '#B8924A' }}>
                  <ClipboardList className="w-3.5 h-3.5" />Registrar mes
                </button>
              )}
              <button onClick={() => setMostrarCarga(true)} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-sm border transition-colors" style={{ borderColor: '#0F2444', color: '#0F2444' }}>
                <Upload className="w-3.5 h-3.5" />Cargar archivos
              </button>
              <button onClick={() => fetchData(mesIdx, mesActualLocal || undefined)} className="p-2.5 rounded-sm hover:bg-[#FAF7F1] transition-colors"><RefreshCw className="w-4 h-4" style={{ color: '#0F2444' }} /></button>
            </div>
          </div>
          <div className="flex items-center justify-between -mb-px">
            <div className="flex gap-0 overflow-x-auto">
              {([['resumen', 'Resumen Ejecutivo'], ['carteras', 'Análisis por Cartera'], ['historico', 'Histórico'], ['plan', 'Plan de Acción']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-6 py-3 text-xs font-semibold transition-all whitespace-nowrap tracking-wider uppercase border-b-2 ${tab === k ? 'border-[#B8924A] text-[#0F2444]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{l}</button>
              ))}
            </div>
            {esMesActualEditable && tab === 'carteras' && (
              <button onClick={() => setEditMode(!editMode)} className={`flex items-center gap-2 px-4 py-2 mb-1 rounded-sm text-xs font-semibold tracking-wider uppercase transition-all ${editMode ? 'text-white' : 'border border-[#B8924A]/30 hover:bg-[#F5EAD0]'}`} style={editMode ? { background: '#B8924A' } : { color: '#0F2444' }}>
                {editMode ? <><Save className="w-3.5 h-3.5" />Guardado Auto</> : <><Edit3 className="w-3.5 h-3.5" />Editar Datos</>}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10 space-y-8 fade-in">

        {/* Banner de estado del mes */}
        {(estadoMes === 'minutos_sin_honorario' || estadoMes === 'vacio') && (
          <div className="card-premium p-4 border-l-2 border-l-amber-500 flex items-start gap-4 bg-amber-50/30">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold" style={{ color: '#0F2444' }}>{mesActual.label} — {estadoMes === 'minutos_sin_honorario' ? 'Minutos cargados · Honorario pendiente' : 'Sin datos registrados'}</div>
              {mensajeEstado && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{mensajeEstado}</p>}
            </div>
            {esMesActualEditable && <button onClick={() => setMostrarFormulario(true)} className="text-xs font-semibold px-3 py-1.5 rounded-sm text-white whitespace-nowrap" style={{ background: '#B8924A' }}>Registrar datos →</button>}
          </div>
        )}

        {/* ── RESUMEN EJECUTIVO ── */}
        {tab === 'resumen' && (
          <>
            {/* Veredicto principal */}
            <div className={`card-premium-hero p-10 elevated-strong ${mesActual.sePaga ? 'border-emerald-200/50' : 'border-amber-200/50'}`}>
              <div className="flex flex-wrap items-start gap-8">
                <div className="flex-1 min-w-0">
                  <Eyebrow>{mesActual.label} · Veredicto</Eyebrow>
                  <h2 className="font-serif text-5xl font-semibold mt-3 leading-tight" style={{ color: '#0F2444' }}>
                    {mesActual.honorarioTotal === 0 ? 'Esperando datos del mes' : mesActual.sePaga ? 'La inversión genera retorno' : 'La inversión requiere optimización'}
                  </h2>
                  <p className="text-slate-700 text-base leading-relaxed mt-4 max-w-2xl">
                    {mesActual.honorarioTotal === 0
                      ? 'El mes en curso aún no tiene honorarios registrados. Use "Registrar mes" para cargar los datos.'
                      : mesActual.sePaga
                        ? <>Por cada B/.1 invertido en el AV, se generaron <strong className="num-hero text-lg" style={{ color: '#0F2444' }}>B/.{mesActual.roiMultiplo.toFixed(2)}</strong> de honorario adicional sobre la base histórica.</>
                        : <>El honorario incremental ({fmtB(mesActual.incrementoVsBase)}) no cubre la inversión de {fmtB(mesActual.inversionAV)}.</>}
                  </p>
                </div>
                <div className="text-right border-l border-[#B8924A]/20 pl-8">
                  <Eyebrow>ROI vs Base Histórica</Eyebrow>
                  <div className="num-hero text-7xl mt-2 leading-none" style={{ color: '#0F2444' }}>
                    {mesActual.roiMultiplo > 0 ? mesActual.roiMultiplo.toFixed(1) : '—'}<span style={{ color: '#B8924A' }}>{mesActual.roiMultiplo > 0 ? '×' : ''}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">referencia aproximada</div>
                </div>
              </div>
            </div>

            {/* NUEVO: Advertencia de atribución — la honestidad ejecutiva */}
            <div className="card-premium p-5 border-l-2 border-l-[#B8924A] bg-[#FAF7F1]/60">
              <div className="flex items-start gap-4">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#B8924A' }} />
                <div>
                  <div className="text-sm font-semibold mb-2" style={{ color: '#0F2444' }}>Sobre la interpretación del retorno</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{rv.advertenciaAtribucion}</p>
                  {rv.totalGestionesAV > 0 && (
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#B8924A]/15">
                      <div><div className="text-eyebrow mb-1">Gestiones AV</div><div className="num-hero text-xl" style={{ color: '#0F2444' }}>{fmt(rv.totalGestionesAV)}</div><div className="text-xs text-slate-500">llamadas realizadas</div></div>
                      <div><div className="text-eyebrow mb-1">Sin AV el piso haría</div><div className="num-hero text-xl" style={{ color: '#0F2444' }}>~{fmt(rv.totalGestionesPisoSinAV)}</div><div className="text-xs text-slate-500">estimado mensual</div></div>
                      <div><div className="text-eyebrow mb-1">Horas liberadas</div><div className="num-hero text-xl gold-text">{rv.totalHorasLiberadas}h</div><div className="text-xs text-slate-500">de asesores (rol recordatorio)</div></div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Divider />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <HeroKPI label="Inversión AV" value={fmtB(mesActual.inversionAV)} sub="Costo fijo mensual" accent="gold" />
              <HeroKPI label="Honorario Total" value={fmtB(mesActual.honorarioTotal)} sub={mesActual.deltaVsMesAnterior !== 0 ? `${mesActual.deltaVsMesAnterior >= 0 ? '▲' : '▼'} ${fmtB(Math.abs(mesActual.deltaVsMesAnterior))} vs mes ant.` : 'Sin comparativo'} accent="navy" />
              <HeroKPI label="% Hon. al AV" value={mesActual.pctHonorarioTotalAlAV > 0 ? `${mesActual.pctHonorarioTotalAlAV.toFixed(2)}%` : '—'} sub="Del honorario total cobrado" accent="success" />
              <HeroKPI label="Minutos Consumidos" value={fmt(mesActual.minutosConsumidos)} sub={mesActual.minutosConsumidos > 0 ? `B/.${mesActual.costoXMinuto.toFixed(3)} efectivo/min` : 'Sin consumo'} accent="warning" />
            </div>

            <Divider />

            {/* Bolsa + Composición */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2"><BolsaPremium bolsa={bolsa} consumidos={mesActual.minutosConsumidos} /></div>
              <div className="card-premium-hero p-7 elevated">
                <Eyebrow>Portfolio Distribution</Eyebrow>
                <h3 className="font-serif text-xl font-semibold mt-1 mb-5" style={{ color: '#0F2444' }}>Composición</h3>
                <div className="space-y-4">
                  {[['verde', verdes, 'Rentables'], ['amarillo', amarillas, 'En Revisión'], ['rojo', rojas, 'No Rentables']].map(([s, n, l]) => (
                    <div key={s as string} className="flex items-center justify-between pb-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-3"><StatusDot s={s as any} /><span className="text-sm font-semibold" style={{ color: '#0F2444' }}>{l}</span></div>
                      <span className="num-hero text-2xl" style={{ color: '#0F2444' }}>{n}</span>
                    </div>
                  ))}
                </div>
                {rv.carterasConValorEvidenciado > 0 && (
                  <div className="mt-5 pt-4 border-t border-[#B8924A]/15">
                    <Eyebrow>Valor Operativo Evidenciado</Eyebrow>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="num-hero text-2xl gold-text">{rv.carterasConValorEvidenciado}</span>
                      <span className="text-xs text-slate-500">carteras con evidencia de impacto del AV</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {mesActual.deltaVsMesAnterior !== 0 && (
              <div className={`card-premium p-6 border-l-2 ${mesActual.deltaVsMesAnterior >= 0 ? 'border-l-emerald-700' : 'border-l-amber-600'}`}>
                <div className="flex items-start gap-4">
                  {mesActual.deltaVsMesAnterior >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-700 mt-1 flex-shrink-0" /> : <TrendingDown className="w-5 h-5 text-amber-700 mt-1 flex-shrink-0" />}
                  <div>
                    <Eyebrow>vs {historico[mesIdx - 1]?.label || 'Mes Anterior'}</Eyebrow>
                    <h3 className="font-serif text-lg font-semibold mt-1" style={{ color: '#0F2444' }}>{mesActual.deltaVsMesAnterior >= 0 ? 'Honorario al alza' : 'Honorario a la baja'}</h3>
                    <p className="text-sm text-slate-700 mt-2">
                      <span className={`num-hero text-xl ${mesActual.deltaVsMesAnterior >= 0 ? 'text-emerald-800' : 'text-amber-700'}`}>{mesActual.deltaVsMesAnterior >= 0 ? '+' : ''}{fmtB(mesActual.deltaVsMesAnterior)}</span>
                      <span className="text-slate-500 ml-2">({mesActual.honorarioAnterior > 0 ? ((mesActual.deltaVsMesAnterior / mesActual.honorarioAnterior) * 100).toFixed(1) : 0}%)</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CARTERAS ── */}
        {tab === 'carteras' && (
          <>
            <div><Eyebrow>Portfolio Analysis</Eyebrow><h2 className="font-serif text-4xl font-semibold mt-2" style={{ color: '#0F2444' }}>Análisis por Cartera</h2>
              <p className="text-sm text-slate-500 mt-2">{editMode ? 'Modo edición activo — campos en amarillo son editables' : 'Click en una cartera para ver el análisis de valor del AV'}</p>
            </div>
            <TablaCarteras carteras={carteras} isEditable={editMode && esMesActualEditable} onUpdate={actualizarCartera} />
          </>
        )}

        {/* ── HISTÓRICO ── */}
        {tab === 'historico' && (
          <>
            <div><Eyebrow>Historical Performance</Eyebrow><h2 className="font-serif text-4xl font-semibold mt-2" style={{ color: '#0F2444' }}>Histórico de Resultados</h2></div>
            <GraficoHistorico historico={historico} />
            <div className="card-premium-hero overflow-hidden elevated">
              <div className="px-8 py-5 border-b border-[#B8924A]/15 bg-[#FAF7F1]"><Eyebrow>Detalle Mensual</Eyebrow><h3 className="font-serif text-xl font-semibold mt-1" style={{ color: '#0F2444' }}>Desempeño por Período</h3></div>
              <table className="w-full">
                <thead><tr className="border-b border-slate-200">{['Período', 'Inversión AV', 'Honorario', 'vs Mes Ant.', '¿AV se pagó?', 'Múltiplo'].map(h => <th key={h} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">{h}</th>)}</tr></thead>
                <tbody>
                  {historico.map((m, i) => {
                    const ant = historico[i - 1]; const delta = ant ? m.honorarioTotal - ant.honorarioTotal : 0; const roiX = m.inversionAV > 0 ? m.honorarioTotal / m.inversionAV : 0
                    return (
                      <tr key={m.mes} className={`border-b border-slate-100 hover:bg-[#FAF7F1] cursor-pointer ${i === mesIdx ? 'bg-[#F5EAD0]/30' : ''}`} onClick={() => cambiarMes(i)}>
                        <td className="px-5 py-4"><div className="flex items-center gap-2"><span className="font-serif text-base font-semibold" style={{ color: '#0F2444' }}>{m.label}</span>{m.avActivo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase" style={{ background: '#F5EAD0', color: '#B8924A' }}>AV</span>}{m.esMesActual && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase bg-emerald-100 text-emerald-800">ACTUAL</span>}{m.minutosConsumidos > 0 && m.honorarioTotal === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase bg-amber-100 text-amber-800">Hon. pendiente</span>}</div></td>
                        <td className="px-5 py-4 num-table text-sm">{m.inversionAV > 0 ? fmtB(m.inversionAV) : <span className="text-slate-400">—</span>}</td>
                        <td className="px-5 py-4 num-table text-sm font-semibold" style={{ color: '#0F2444' }}>{m.honorarioTotal > 0 ? fmtB(m.honorarioTotal) : <span className="text-slate-400">—</span>}</td>
                        <td className="px-5 py-4">{i > 0 && m.honorarioTotal > 0 ? <Delta v={delta} /> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-5 py-4">{m.inversionAV > 0 && m.honorarioTotal > 0 ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${m.honorarioTotal >= m.inversionAV ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-900'}`}>{m.honorarioTotal >= m.inversionAV ? 'Sí' : 'No'}</span> : <span className="text-slate-400 text-xs">{m.inversionAV === 0 ? 'Sin AV' : 'Pendiente'}</span>}</td>
                        <td className="px-5 py-4 num-hero text-sm">{roiX > 0 ? <span className={roiX >= 5 ? 'text-emerald-800' : roiX >= 2 ? 'text-amber-700' : 'text-red-900'}>{roiX.toFixed(1)}×</span> : <span className="text-slate-400">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── PLAN ── */}
        {tab === 'plan' && (
          <>
            <div><Eyebrow>Strategic Initiative</Eyebrow><h2 className="font-serif text-4xl font-semibold mt-2" style={{ color: '#0F2444' }}>Plan de Acción</h2><p className="text-sm text-slate-500 mt-2">Click en una acción para marcarla completada</p></div>
            <div className="grid md:grid-cols-3 gap-5">
              <div className="card-premium p-6 border-l-2 border-l-emerald-700"><Eyebrow>Tendencia</Eyebrow><div className={`font-serif text-2xl font-semibold mt-2 ${mesActual.deltaVsMesAnterior >= 0 ? 'text-emerald-800' : 'text-red-900'}`}>{mesActual.deltaVsMesAnterior === 0 ? 'Sin datos' : mesActual.deltaVsMesAnterior >= 0 ? 'Avance positivo' : 'Por debajo'}</div><div className="text-sm text-slate-600 mt-1 num-small">{mesActual.deltaVsMesAnterior !== 0 ? `${mesActual.deltaVsMesAnterior >= 0 ? '+' : ''}${fmtB(mesActual.deltaVsMesAnterior)} vs mes anterior` : ''}</div></div>
              <div className="card-premium p-6 border-l-2 border-l-red-800"><Eyebrow>Carteras Críticas</Eyebrow><div className="mt-2 space-y-1">{carteras.filter(c => c.semaforo === 'rojo' && c.minutosAV > 0).length > 0 ? carteras.filter(c => c.semaforo === 'rojo' && c.minutosAV > 0).map(c => <div key={c.nombre} className="font-serif text-base font-semibold text-red-900">{c.nombre}</div>) : <div className="font-serif text-base font-semibold text-emerald-800">Sin carteras críticas</div>}</div></div>
              <div className="card-premium p-6 border-l-2 border-l-[#B8924A]"><Eyebrow>Meta del Mes</Eyebrow><div className="font-serif text-2xl font-semibold mt-2 gold-text">{fmtB(planes[0]?.metaHonorario || 0)}</div><div className="text-sm text-slate-600 mt-1">{mesActual.honorarioTotal > 0 ? `${((mesActual.honorarioTotal / (planes[0]?.metaHonorario || 1)) * 100).toFixed(0)}% logrado` : 'Esperando datos'}</div></div>
            </div>
            <PlanPremium planes={planes} onUpdate={p => { setPlanes(p); savePlan(p) }} />
          </>
        )}
      </main>

      <footer className="border-t border-[#B8924A]/15 bg-white/60 mt-16">
        <div className="max-w-7xl mx-auto px-8 py-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4"><div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#B8924A' }}>SPEAR</div><div className="w-px h-3 bg-slate-300" /><span className="text-xs text-slate-500">Panel Ejecutivo del Asesor Virtual IA</span></div>
          <span className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">Actualización · {lastUpdate}</span>
        </div>
      </footer>
    </div>
  )
}
