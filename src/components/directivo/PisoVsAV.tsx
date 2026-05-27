'use client'
// components/directivo/PisoVsAV.tsx
// Comparativa directa: Piso humano vs Asesor Virtual
// Sin PII: no se muestran nombres de clientes, cédulas ni teléfonos

import { useState } from 'react'
import { ChevronUp, ChevronDown, Users, Bot, Zap } from 'lucide-react'
import { MetricaCarteraUI, ProductividadAsesor } from '@/types'
import { TooltipMetrica, TEXTO_METRICA_ESTIMADA } from '@/components/shared'

interface PisoVsAVProps {
  carteras: MetricaCarteraUI[]
  productividad: ProductividadAsesor[]
}

type ColOrden = 'asesor' | 'cartera' | 'gestiones' | 'efectivas' | 'promesas' | 'monto' | 'tmoMin' | 'gestionesPorDia'

// ── Tarjeta comparativa ───────────────────────────────────────────────────────

function TarjetaComparativa({ titulo, icono, valor, valorAV, label, esEstimada }: {
  titulo: string; icono: React.ReactNode
  valor: number; valorAV: number
  label: string; esEstimada?: boolean
}) {
  const total = valor + valorAV
  const pctPiso = total > 0 ? (valor / total) * 100 : 0
  const pctAV = total > 0 ? (valorAV / total) * 100 : 0

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icono}
          <span className="font-semibold text-sm text-[#0F2444]">{titulo}</span>
        </div>
        {esEstimada && (
          <TooltipMetrica texto={TEXTO_METRICA_ESTIMADA}>
            <span className="text-xs text-slate-400">estimado</span>
          </TooltipMetrica>
        )}
      </div>
      <div className="p-5">
        {/* Total */}
        <div className="text-center mb-4">
          <div className="text-3xl font-bold tabular-nums text-[#0F2444]">
            {total.toLocaleString('es-PA')}
          </div>
          <div className="text-xs text-slate-500 mt-1">{label} totales</div>
        </div>

        {/* Barra doble */}
        <div className="h-3 flex rounded-full overflow-hidden mb-3">
          <div className="bg-[#0F2444] transition-all" style={{ width: `${pctPiso}%` }} title={`Piso: ${pctPiso.toFixed(0)}%`} />
          <div className="bg-amber-500 transition-all" style={{ width: `${pctAV}%` }} title={`AV: ${pctAV.toFixed(0)}%`} />
        </div>

        {/* Detalle lado a lado */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center bg-slate-50 rounded-md px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-center gap-1">
              <Users className="w-3 h-3" />Piso
            </div>
            <div className="text-xl font-bold tabular-nums text-[#0F2444]">{valor.toLocaleString('es-PA')}</div>
            <div className="text-[11px] text-slate-500">{pctPiso.toFixed(0)}% del total</div>
          </div>
          <div className="text-center bg-amber-50 rounded-md px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1 flex items-center justify-center gap-1">
              <Bot className="w-3 h-3" />AV
            </div>
            <div className="text-xl font-bold tabular-nums text-amber-800">{valorAV.toLocaleString('es-PA')}</div>
            <div className="text-[11px] text-amber-600">{pctAV.toFixed(0)}% del total</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tabla por cartera ─────────────────────────────────────────────────────────

function TablaCarterasPisoAV({ carteras }: { carteras: MetricaCarteraUI[] }) {
  const conDatos = carteras.filter(c => c.llamadasPiso > 0 || c.llamadasAV > 0)

  if (conDatos.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Aún no hay datos del piso cargados para este mes.</p>
        <p className="text-xs mt-1">Sube el reporte Sigella desde el Panel de Administración.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">Cartera</th>
            <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#0F2444]">Gest. Piso</th>
            <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-amber-700">Gest. AV</th>
            <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <TooltipMetrica texto={TEXTO_METRICA_ESTIMADA}>Total</TooltipMetrica>
            </th>
            <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#0F2444]">Prom. Piso</th>
            <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-amber-700">Prom. AV</th>
            <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <TooltipMetrica texto={TEXTO_METRICA_ESTIMADA}>Monto Total</TooltipMetrica>
            </th>
            <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">TMO Piso</th>
            <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <TooltipMetrica texto={TEXTO_METRICA_ESTIMADA}>
                <span>Cob. Increm.</span>
              </TooltipMetrica>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {conDatos.map(c => {
            const pctAV = c.gestionesTotales > 0 ? ((c.llamadasAV / c.gestionesTotales) * 100).toFixed(0) : '0'
            return (
              <tr key={c.nombre} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-4">
                  <div className="font-semibold text-[#0F2444]">{c.nombre}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{c.asesores} asesores · {c.clientes.toLocaleString('es-PA')} clientes</div>
                </td>
                <td className="px-3 py-4 text-right tabular-nums font-semibold text-[#0F2444]">
                  {c.llamadasPiso > 0 ? c.llamadasPiso.toLocaleString('es-PA') : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-4 text-right tabular-nums font-semibold text-amber-800">
                  {c.llamadasAV > 0 ? c.llamadasAV.toLocaleString('es-PA') : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-4 text-right tabular-nums font-bold text-[#0F2444]">
                  {c.gestionesTotales.toLocaleString('es-PA')}
                </td>
                <td className="px-3 py-4 text-right tabular-nums text-[#0F2444]">
                  {c.promesasPiso > 0 ? c.promesasPiso.toLocaleString('es-PA') : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-4 text-right tabular-nums text-amber-800">
                  {c.promesasAV > 0 ? c.promesasAV.toLocaleString('es-PA') : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-4 text-right tabular-nums text-[#0F2444]">
                  {(c.montoPiso + c.montoAV) > 0 ? (c.montoPiso + c.montoAV).toLocaleString('es-PA') : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-4 text-right text-[#0F2444]">
                  {c.tiempoPromedioMinPiso > 0 ? `${c.tiempoPromedioMinPiso.toFixed(1)} min` : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-4 text-right">
                  {parseInt(pctAV) > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                      <Zap className="w-3 h-3" />+{pctAV}%
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Tabla de productividad por asesor ─────────────────────────────────────────
// SIN PII: solo asesores (no datos de clientes)

function TablaProductividad({ productividad }: { productividad: ProductividadAsesor[] }) {
  const [orden, setOrden] = useState<ColOrden>('gestiones')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')

  const cambiarOrden = (col: ColOrden) => {
    if (orden === col) setDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrden(col); setDir('desc') }
  }

  const datos = [...productividad].sort((a, b) => {
    const mult = dir === 'asc' ? 1 : -1
    if (orden === 'asesor') return mult * a.asesor.localeCompare(b.asesor)
    if (orden === 'cartera') return mult * a.cartera.localeCompare(b.cartera)
    return mult * ((a[orden] as number) - (b[orden] as number))
  })

  if (datos.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sin datos de productividad para este período.</p>
      </div>
    )
  }

  type ColDef = { key: ColOrden; label: string; estimada?: boolean }

  const cols: ColDef[] = [
    { key: 'asesor', label: 'Asesor' },
    { key: 'cartera', label: 'Cartera' },
    { key: 'gestiones', label: 'Gestiones' },
    { key: 'efectivas', label: 'Efectivas' },
    { key: 'promesas', label: 'Promesas' },
    { key: 'monto', label: 'Monto', estimada: true },
    { key: 'tmoMin', label: 'TMO (min)' },
    { key: 'gestionesPorDia', label: 'Gest/Día' },
  ]

  const Icono = ({ col }: { col: ColOrden }) => {
    if (orden !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {cols.map(col => (
              <th
                key={col.key}
                onClick={() => cambiarOrden(col.key)}
                className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-600 cursor-pointer hover:text-[#0F2444] hover:bg-slate-100 transition-colors select-none text-right first:text-left"
              >
                <span className="inline-flex items-center gap-1 justify-end first:justify-start">
                  {col.estimada ? (
                    <TooltipMetrica texto={TEXTO_METRICA_ESTIMADA}>{col.label}</TooltipMetrica>
                  ) : col.label}
                  <Icono col={col.key} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {datos.map((a, i) => (
            <tr key={`${a.asesor}-${a.cartera}`} className={`hover:bg-slate-50 transition-colors ${i === 0 ? 'bg-emerald-50/30' : ''}`}>
              <td className="px-4 py-3.5 font-semibold text-[#0F2444]">
                {i === 0 && dir === 'desc' && <span className="mr-1 text-amber-500">★</span>}
                {a.asesor}
              </td>
              <td className="px-4 py-3.5 text-slate-600">{a.cartera}</td>
              <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#0F2444]">{a.gestiones.toLocaleString('es-PA')}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-[#0F2444]">{a.efectivas.toLocaleString('es-PA')}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-emerald-700 font-semibold">{a.promesas.toLocaleString('es-PA')}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-[#0F2444]">{a.monto.toLocaleString('es-PA')}</td>
              <td className="px-4 py-3.5 text-right text-slate-600">{a.tmoMin > 0 ? `${a.tmoMin.toFixed(1)}` : '—'}</td>
              <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[#0F2444]">{a.gestionesPorDia}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tarjeta de velocidad de alcance ──────────────────────────────────

function TarjetaVelocidadAlcance({ carteras }: { carteras: MetricaCarteraUI[] }) {
  // Tomar carteras que tengan datos de llamadas AV
  const conDatos = carteras.filter(c => c.llamadasAV > 0)
  if (conDatos.length === 0) return null

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="text-[10px] font-bold tracking-widest uppercase text-amber-700">Velocidad de Alcance — AV</div>
        <h3 className="font-serif text-xl font-semibold text-[#0F2444] mt-1">¿En cuánto tiempo el AV contacta a los clientes?</h3>
        <p className="text-xs text-slate-500 mt-1">Calculado a partir de la columna HORA del reporte del AV. Refleja el ritmo real de operación.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">Cartera</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-amber-700">Clientes/Hora</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">Horas p/100 clientes</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">Promedio/Día</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">Días activo</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">Total gestiones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {conDatos.map(c => (
              <tr key={c.nombre} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-semibold text-[#0F2444]">{c.nombre}</div>
                  <div className="text-[11px] text-slate-500">{c.clientes.toLocaleString('es-PA')} clientes en cartera</div>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-xl font-bold tabular-nums text-amber-700">
                    {c.llamadasAV > 0 ? '—' : '—'}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">ver reporte cargado</div>
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-[#0F2444] font-semibold">—</td>
                <td className="px-4 py-4 text-right tabular-nums text-[#0F2444]">—</td>
                <td className="px-4 py-4 text-right tabular-nums text-[#0F2444]">—</td>
                <td className="px-4 py-4 text-right tabular-nums font-semibold text-[#0F2444]">{c.llamadasAV.toLocaleString('es-PA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 bg-amber-50/40 border-t border-amber-100 text-xs text-amber-800">
        <span className="font-semibold">Nota:</span> Los datos de velocidad (clientes/hora) se calculan automáticamente al cargar el reporte del AV con la columna HORA. Sube el próximo reporte para ver este análisis completo.
      </div>
    </div>
  )
}

export function PantallapisoVsAV({ carteras, productividad }: PisoVsAVProps) {
  const totalGestPiso = carteras.reduce((s, c) => s + c.llamadasPiso, 0)
  const totalGestAV = carteras.reduce((s, c) => s + c.llamadasAV, 0)
  const totalPromPiso = carteras.reduce((s, c) => s + c.promesasPiso, 0)
  const totalPromAV = carteras.reduce((s, c) => s + c.promesasAV, 0)
  const totalMontoPiso = carteras.reduce((s, c) => s + c.montoPiso, 0)
  const totalMontoAV = carteras.reduce((s, c) => s + c.montoAV, 0)

  const hayDatos = totalGestPiso > 0 || totalGestAV > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="text-[10px] font-bold tracking-widest uppercase text-amber-700">Análisis Comparativo</div>
        <h2 className="font-serif text-4xl font-semibold mt-1 text-[#0F2444]">Piso vs Asesor Virtual</h2>
        <p className="text-sm text-slate-500 mt-2">
          Comparativa directa de rendimiento. Los datos del piso provienen de Sigella. Sin información personal de clientes.
        </p>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid md:grid-cols-3 gap-5">
        <TarjetaComparativa
          titulo="Gestiones Totales"
          icono={<Users className="w-4 h-4 text-slate-600" />}
          valor={totalGestPiso}
          valorAV={totalGestAV}
          label="gestiones"
          esEstimada={true}
        />
        <TarjetaComparativa
          titulo="Promesas Generadas"
          icono={<Zap className="w-4 h-4 text-amber-600" />}
          valor={totalPromPiso}
          valorAV={totalPromAV}
          label="promesas"
          esEstimada={false}
        />
        <TarjetaComparativa
          titulo="Monto Comprometido"
          icono={<Bot className="w-4 h-4 text-[#0F2444]" />}
          valor={totalMontoPiso}
          valorAV={totalMontoAV}
          label=""
          esEstimada={true}
        />
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-6 text-xs font-semibold">
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#0F2444]" /><span className="text-slate-700">Piso (Humano)</span></span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-500" /><span className="text-slate-700">AV (IA)</span></span>
        <span className="flex items-center gap-2 text-slate-400 font-normal">
          <TooltipMetrica texto={TEXTO_METRICA_ESTIMADA}>
            <span>Las métricas combinadas son estimadas</span>
          </TooltipMetrica>
        </span>
      </div>

      {/* Tabla por cartera */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-[#0F2444] to-[#1A3458]">
          <div className="text-[10px] font-bold tracking-widest uppercase text-amber-400">Detalle por Cartera</div>
          <h3 className="font-serif text-xl font-semibold text-white mt-1">Rendimiento Comparativo</h3>
        </div>
        <TablaCarterasPisoAV carteras={carteras} />
      </div>

      {/* Tabla de productividad */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="text-[10px] font-bold tracking-widest uppercase text-amber-700">Human Performance</div>
          <h3 className="font-serif text-xl font-semibold text-[#0F2444] mt-1">Productividad Humana por Asesor</h3>
          <p className="text-xs text-slate-500 mt-1">Click en columnas para ordenar · Sin datos personales de clientes · Click ★ = mejor resultado</p>
        </div>
        <TablaProductividad productividad={productividad} />
      </div>

      {/* Velocidad de alcance del AV */}
      <TarjetaVelocidadAlcance carteras={carteras} />
    </div>
  )
}
