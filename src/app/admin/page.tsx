'use client'
// app/admin/page.tsx — VISTA ADMINISTRADOR
// Ruta protegida con controles de carga de archivos,
// gestión de honorarios y administración del sistema.
// Acceso: solo administradores (tú)

import { useState, useEffect } from 'react'
import { Upload, ClipboardList, RefreshCw, X, Save, Database, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { CARTERAS_CONFIG } from '@/lib/store'
import { BolsaMinutos } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('es-PA', { maximumFractionDigits: 0 })

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold tracking-widest uppercase text-amber-700">{children}</div>
}

// ── Panel de Carga de Archivos ────────────────────────────────────────────────

function PanelCarga({ onExito }: { onExito: () => void }) {
  const [archivos, setArchivos] = useState<File[]>([])
  const [modo, setModo] = useState<'reemplazar' | 'agregar'>('reemplazar')
  const [mes, setMes] = useState('2026-05')
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
      fd.append('mes', mes)
      fd.append('modo', modo)
      const res = await fetch('/api/upload-excel', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.ok) { setResultado(data); setArchivos([]); onExito() }
      else setError(data.error || 'Error al procesar los archivos')
    } catch (e) { setError(String(e)) }
    setCargando(false)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-[#0F2444] to-[#1A3458]">
        <Eyebrow><span className="text-amber-400">Carga de Datos</span></Eyebrow>
        <h3 className="font-serif text-xl font-semibold text-white mt-1">Cargar Reportes</h3>
        <p className="text-xs text-slate-300 mt-1">AV (Cobro/Recordatorios) y Piso (Sigella)</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Modo */}
        <div>
          <Eyebrow>Modo de carga</Eyebrow>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {(['reemplazar', 'agregar'] as const).map(m => (
              <button key={m} onClick={() => setModo(m)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${modo === m ? 'border-[#0F2444] bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className="text-sm font-semibold text-[#0F2444]">
                  {m === 'reemplazar' ? '🔄 Reemplazar' : '➕ Agregar'}
                </div>
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {m === 'reemplazar' ? 'El archivo tiene todos los datos del mes hasta hoy. Reemplaza lo anterior.' : 'El archivo tiene solo datos nuevos del día. Se suma a lo existente.'}
                </div>
                {m === 'reemplazar' && <div className="text-[10px] font-bold text-amber-700 mt-1.5">Recomendado para consolidados</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Mes */}
        <div>
          <Eyebrow>Mes al que corresponden los archivos</Eyebrow>
          <select value={mes} onChange={e => setMes(e.target.value)}
            className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0F2444] bg-white font-semibold text-[#0F2444]">
            {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {/* Zona de carga */}
        <div>
          <Eyebrow>Seleccionar archivos</Eyebrow>
          <label className="mt-2 flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
            <Upload className="w-7 h-7 mb-2 text-amber-600" />
            <span className="text-sm font-medium text-[#0F2444]">Click para seleccionar archivos</span>
            <span className="text-xs text-slate-400 mt-1">Puedes seleccionar varios a la vez</span>
            <input type="file" multiple accept=".xlsx,.xls" className="hidden"
              onChange={e => { setArchivos(prev => [...prev, ...Array.from(e.target.files || [])]); setResultado(null); setError('') }} />
          </label>
        </div>

        {/* Lista archivos */}
        {archivos.length > 0 && (
          <div className="space-y-2">
            <Eyebrow>Archivos listos</Eyebrow>
            {archivos.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <span className="text-lg">{getIcono(f.name)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-[#0F2444]">{f.name}</div>
                  <div className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</div>
                </div>
                <button onClick={() => setArchivos(prev => prev.filter((_, j) => j !== i))}
                  className="p-1 hover:bg-red-50 rounded transition-colors">
                  <X className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Guía de nombres */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Nombres esperados</div>
          <div className="space-y-1 text-xs font-mono text-slate-600">
            <div><span className="text-blue-600">Reporte-Cobro-General-21-05-Corte-1.xlsx</span></div>
            <div><span className="text-blue-600">Reporte-Recordatorios-General-21-05.xlsx</span></div>
            <div><span className="text-blue-600">Reporte-Recordatorios-SURA-21-05.xlsx</span></div>
            <div><span className="text-green-600">Sigella-Gestiones-21-05-2026.xlsx</span></div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="font-semibold text-emerald-800 mb-2 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />Carga completada
            </div>
            <div className="space-y-1 mb-3">
              {resultado.resultados?.map((r: any, i: number) => (
                <div key={i} className="text-xs text-emerald-700">
                  {r.ok
                    ? `✓ ${r.archivo} — ${r.tipo === 'piso' ? `${r.gestiones?.toLocaleString()} gestiones piso` : `${r.minutos?.toLocaleString()} min AV`}`
                    : `✗ ${r.archivo}: ${r.error}`}
                </div>
              ))}
            </div>
            {resultado.bolsa && (
              <div className="pt-3 border-t border-emerald-200 flex items-center justify-between">
                <span className="text-xs text-emerald-700 font-semibold">Bolsa actualizada</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-800 tabular-nums">{resultado.bolsa.saldoActual?.toLocaleString('es-PA')} min disponibles</div>
                  <div className="text-[10px] text-emerald-600">−{resultado.bolsa.minutosDescontados?.toLocaleString('es-PA')} min descontados</div>
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={cargar} disabled={!archivos.length || cargando}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-colors"
          style={{ background: '#0F2444' }}>
          {cargando ? <><RefreshCw className="w-4 h-4 animate-spin" />Procesando...</> : <><Upload className="w-4 h-4" />Cargar archivos</>}
        </button>
      </div>
    </div>
  )
}

// ── Formulario de Cierre de Mes ───────────────────────────────────────────────

function FormularioCierreMes({ onGuardar }: { onGuardar: () => void }) {
  const [mesSeleccionado, setMesSeleccionado] = useState('2026-05')
  const [datos, setDatos] = useState<Record<string, Record<string, string>>>({})
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState(false)

  const set = (c: string, f: string, v: string) =>
    setDatos(p => ({ ...p, [c]: { ...(p[c] || {}), [f]: v } }))
  const get = (c: string, f: string) => datos[c]?.[f] ?? '0'

  const guardar = async () => {
    setGuardando(true)
    const carteras: Record<string, any> = {}
    CARTERAS_CONFIG.forEach(c => {
      carteras[c.nombre] = {
        minutosAV: parseFloat(get(c.nombre, 'min') || '0'),
        honorario: parseFloat(get(c.nombre, 'hon') || '0'),
        llamadas: parseFloat(get(c.nombre, 'llam') || '0'),
        efectivas: parseFloat(get(c.nombre, 'efec') || '0'),
        promesas: parseFloat(get(c.nombre, 'prom') || '0'),
      }
    })
    const honorarioTotal = Object.values(carteras).reduce((s: number, c: any) => s + (c.honorario || 0), 0)
    const minutosConsumidos = Object.values(carteras).reduce((s: number, c: any) => s + (c.minutosAV || 0), 0)

    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar_mes',
          datos: { mes: mesSeleccionado, carteras, honorarioTotal, minutosConsumidos }
        })
      })
      setOk(true); onGuardar()
      setTimeout(() => setOk(false), 3000)
    } catch (e) { console.error(e) }
    setGuardando(false)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-slate-100">
        <Eyebrow>Administración</Eyebrow>
        <h3 className="font-serif text-xl font-semibold text-[#0F2444] mt-1">Registrar Mes Manualmente</h3>
        <p className="text-xs text-slate-500 mt-1">Ingresa los datos cuando no tengas el archivo Excel</p>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <Eyebrow>Mes</Eyebrow>
          <select value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}
            className="mt-2 w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-[#0F2444] font-semibold text-[#0F2444]">
            <option value="2026-05">MAY 2026</option>
            <option value="2026-04">ABR 2026</option>
            <option value="2026-03">MAR 2026</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">Cartera</th>
                {['Min. AV', 'Honorario', 'Llamadas', 'Efectivas', 'Promesas'].map(h => (
                  <th key={h} className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {CARTERAS_CONFIG.map((c, i) => (
                <tr key={c.nombre} className={i % 2 === 0 ? 'bg-slate-50/40' : ''}>
                  <td className="py-2.5">
                    <div className="text-xs font-semibold text-[#0F2444]">{c.nombre}</div>
                  </td>
                  {(['min', 'hon', 'llam', 'efec', 'prom'] as const).map(f => (
                    <td key={f} className="px-2 py-2.5 text-right">
                      <input type="text" placeholder="0"
                        className="w-20 border border-amber-200 rounded px-2 py-1.5 text-right text-xs outline-none focus:border-amber-500 bg-amber-50 font-semibold text-[#0F2444]"
                        value={get(c.nombre, f)}
                        onChange={e => set(c.nombre, f, e.target.value)}
                        onFocus={e => e.target.select()} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={guardar} disabled={guardando}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded text-sm font-semibold text-white disabled:opacity-50 transition-colors"
          style={{ background: ok ? '#059669' : '#0F2444' }}>
          {ok ? <><CheckCircle2 className="w-4 h-4" />Guardado</> : guardando ? <><RefreshCw className="w-4 h-4 animate-spin" />Guardando...</> : <><Save className="w-4 h-4" />Guardar mes</>}
        </button>
      </div>
    </div>
  )
}

// ── Estado del sistema ────────────────────────────────────────────────────────

function EstadoSistema({ bolsa, fuenteDatos }: { bolsa: BolsaMinutos | null; fuenteDatos: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
      <Eyebrow>Estado del Sistema</Eyebrow>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Base de datos</span>
          <span className={`font-semibold px-2 py-0.5 rounded text-xs ${fuenteDatos === 'blob' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {fuenteDatos === 'blob' ? '✓ Blob conectado' : '⚠ Local (fallback)'}
          </span>
        </div>
        {bolsa && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Saldo bolsa</span>
              <span className={`font-bold tabular-nums ${bolsa.saldoActual < 2000 ? 'text-red-700' : 'text-[#0F2444]'}`}>
                {fmt(bolsa.saldoActual)} min
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Próxima recarga</span>
              <span className="font-semibold text-[#0F2444]">Día {bolsa.diaRecarga} (+{fmt(bolsa.cantidadRecarga)} min)</span>
            </div>
          </>
        )}
        <div className="pt-3 border-t border-slate-100">
          <a href="/api/save" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-[#0F2444] transition-colors">
            <Database className="w-3.5 h-3.5" />Inicializar Blob (si es necesario)
          </a>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PÁGINA ADMIN
// ════════════════════════════════════════════════════════════════════════════

export default function PageAdmin() {
  const [bolsa, setBolsa] = useState<BolsaMinutos | null>(null)
  const [fuenteDatos, setFuenteDatos] = useState('—')
  const [lastUpdate, setLastUpdate] = useState('')

  const cargarEstado = async () => {
    try {
      const res = await fetch('/api/data', { cache: 'no-store' })
      const d = await res.json()
      if (d.ok) {
        setBolsa(d.bolsa)
        setFuenteDatos(d.fuenteDatos)
        setLastUpdate(new Date().toLocaleString('es-PA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }))
      }
    } catch (e) { console.error(e) }
  }

  useEffect(() => { cargarEstado() }, [])

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header admin */}
      <header className="bg-[#0F2444] border-b border-amber-500/20 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />Volver al Panel
            </a>
            <div className="w-px h-5 bg-slate-700" />
            <div>
              <span className="text-white font-serif font-semibold">SPEAR</span>
              <span className="text-amber-400 text-xs ml-2 font-semibold tracking-widest uppercase">Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">{lastUpdate}</span>
            <button onClick={cargarEstado} className="p-2 rounded hover:bg-white/10 transition-colors">
              <RefreshCw className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold text-[#0F2444]">Panel de Administración</h1>
          <p className="text-sm text-slate-500 mt-2">Carga de reportes, gestión de datos y configuración del sistema.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-6">
            <PanelCarga onExito={cargarEstado} />
            <FormularioCierreMes onGuardar={cargarEstado} />
          </div>

          {/* Columna lateral */}
          <div className="space-y-6">
            <EstadoSistema bolsa={bolsa} fuenteDatos={fuenteDatos} />

            {/* Guía rápida */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <Eyebrow>Guía Rápida</Eyebrow>
              <div className="mt-4 space-y-4 text-xs text-slate-600 leading-relaxed">
                <div>
                  <div className="font-semibold text-[#0F2444] mb-1">📥 Cada día</div>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Recibe reportes del AV por correo</li>
                    <li>Descarga Sigella del día anterior</li>
                    <li>Renombra: Sigella-Gestiones-DD-MM-YYYY</li>
                    <li>Carga todos aquí · Modo Reemplazar</li>
                  </ol>
                </div>
                <div>
                  <div className="font-semibold text-[#0F2444] mb-1">📊 Al cierre del mes</div>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Recibe honorarios del cliente</li>
                    <li>Ingresa en "Registrar Mes Manualmente"</li>
                    <li>El análisis se actualiza automáticamente</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
