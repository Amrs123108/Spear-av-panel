import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// Mapeo de nombres de carteras — normaliza variaciones
const NOMBRES_CARTERA: Record<string, string> = {
  'banistmo activa': 'BANISTMO ACTIVA',
  'banistmo active': 'BANISTMO ACTIVA',
  'banistmo recovery': 'BANISTMO RECOVERY',
  'sura': 'SURA',
  'tigo': 'TIGO',
  'krediya': 'KREDIYA',
  'crediya': 'KREDIYA',
  'bac recovery': 'BAC RECOVERY',
  'bac': 'BAC RECOVERY',
  'solve': 'SOLVE',
  'banco la hipotecaria': 'BANCO LA HIPOTECARIA',
  'hipotecaria': 'BANCO LA HIPOTECARIA',
  'rodelag': 'RODELAG',
}

function normalizarCartera(nombre: string): string {
  const lower = (nombre || '').toLowerCase().trim()
  return NOMBRES_CARTERA[lower] || nombre.toUpperCase().trim()
}

// Detectar formato del archivo (recordatorio vs cobro general)
function detectarFormato(headers: string[]): 'recordatorio' | 'cobro' | 'desconocido' {
  const h = headers.map(h => (h || '').toLowerCase())
  if (h.some(x => x.includes('minutos') || x.includes('duracion') || x.includes('duración'))) {
    return 'recordatorio'
  }
  if (h.some(x => x.includes('monto') || x.includes('saldo') || x.includes('deuda'))) {
    return 'cobro'
  }
  return 'desconocido'
}

// Encontrar columna por palabras clave
function encontrarColumna(headers: string[], palabras: string[]): number {
  const h = headers.map(x => (x || '').toLowerCase())
  for (const palabra of palabras) {
    const idx = h.findIndex(x => x.includes(palabra))
    if (idx >= 0) return idx
  }
  return -1
}

interface FilaProc {
  cartera: string
  minutosAV: number
  llamadas: number
  efectivas: number
  promesas: number
  recaudo: number
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const archivo = formData.get('archivo') as File
    const mes = formData.get('mes') as string // "2026-05"

    if (!archivo) return NextResponse.json({ ok: false, error: 'No se recibió archivo' }, { status: 400 })
    if (!mes) return NextResponse.json({ ok: false, error: 'Falta el mes' }, { status: 400 })

    // Leer el Excel
    const buffer = await archivo.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    if (rows.length < 2) return NextResponse.json({ ok: false, error: 'Archivo vacío' }, { status: 400 })

    const headers = rows[0].map(String)
    const formato = detectarFormato(headers)

    // Encontrar columnas clave
    const colCartera = encontrarColumna(headers, ['cartera', 'portafolio', 'cliente_cartera', 'nombre_cartera'])
    const colMinutos = encontrarColumna(headers, ['minutos', 'duracion', 'duración', 'tiempo'])
    const colLlamadas = encontrarColumna(headers, ['llamadas', 'llamada', 'intentos', 'gestiones'])
    const colEfectivas = encontrarColumna(headers, ['efectivas', 'contactos', 'contactadas', 'atendidas'])
    const colPromesas = encontrarColumna(headers, ['promesa', 'promesas', 'compromisos'])
    const colRecaudo = encontrarColumna(headers, ['monto', 'recaudo', 'pago', 'cobro', 'valor'])

    if (colCartera < 0 && colMinutos < 0) {
      return NextResponse.json({
        ok: false,
        error: 'No se pudo identificar el formato del archivo.',
        headers,
        sugerencia: 'El archivo debe tener columnas de Cartera y Minutos (o Duración)'
      }, { status: 422 })
    }

    // Procesar filas — agrupar por cartera
    const agrupado: Record<string, FilaProc> = {}

    for (let i = 1; i < rows.length; i++) {
      const fila = rows[i]
      if (!fila || fila.every(c => !c)) continue

      const carteraBruta = colCartera >= 0 ? String(fila[colCartera] || '') : 'DESCONOCIDA'
      const cartera = normalizarCartera(carteraBruta)
      if (!cartera) continue

      const minutos = colMinutos >= 0 ? (parseFloat(String(fila[colMinutos]).replace(',', '.')) || 0) : 0
      const llamadas = colLlamadas >= 0 ? (parseInt(String(fila[colLlamadas])) || 0) : 0
      const efectivas = colEfectivas >= 0 ? (parseInt(String(fila[colEfectivas])) || 0) : 0
      const promesas = colPromesas >= 0 ? (parseInt(String(fila[colPromesas])) || 0) : 0
      const recaudo = colRecaudo >= 0 ? (parseFloat(String(fila[colRecaudo]).replace(',', '.').replace('B/.', '')) || 0) : 0

      if (!agrupado[cartera]) {
        agrupado[cartera] = { cartera, minutosAV: 0, llamadas: 0, efectivas: 0, promesas: 0, recaudo: 0 }
      }
      agrupado[cartera].minutosAV += minutos
      agrupado[cartera].llamadas += llamadas
      agrupado[cartera].efectivas += efectivas
      agrupado[cartera].promesas += promesas
      agrupado[cartera].recaudo += recaudo
    }

    const resultado = Object.values(agrupado)
    const totalMinutos = resultado.reduce((s, r) => s + r.minutosAV, 0)

    // Leer datos actuales del Blob
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN
    const blobUrl = process.env.BLOB_STORE_URL
    let datosActuales: any = null

    if (blobToken && blobUrl) {
      const res = await fetch(`${blobUrl}/spear-av-datos.json`, {
        headers: { Authorization: `Bearer ${blobToken}` },
        cache: 'no-store'
      })
      if (res.ok) datosActuales = await res.json()
    }

    if (!datosActuales) {
      return NextResponse.json({
        ok: false,
        error: 'No hay datos base en el Blob. Primero inicializa el sistema.'
      }, { status: 400 })
    }

    // Actualizar el mes con los datos del Excel
    const idxMes = datosActuales.historico.findIndex((m: any) => m.mes === mes)
    if (idxMes < 0) {
      return NextResponse.json({ ok: false, error: `Mes ${mes} no encontrado en el histórico` }, { status: 404 })
    }

    resultado.forEach(r => {
      if (!datosActuales.historico[idxMes].carteras[r.cartera]) {
        datosActuales.historico[idxMes].carteras[r.cartera] = {
          minutosAV: 0, honorario: 0, honorarioMesAnterior: 0,
          promesas: 0, llamadas: 0, efectivas: 0
        }
      }
      const c = datosActuales.historico[idxMes].carteras[r.cartera]
      // SUMA (no reemplaza) — permite cargar múltiples reportes del mismo mes
      c.minutosAV += Math.round(r.minutosAV)
      c.llamadas += r.llamadas
      c.efectivas += r.efectivas
      c.promesas += r.promesas
      if (r.recaudo > 0 && c.honorario === 0) {
        // Solo actualizar honorario si viene del archivo y no hay uno manual ya
        c.honorario = Math.round(r.recaudo)
      }
    })

    // Recalcular totales del mes
    const cartesDict = datosActuales.historico[idxMes].carteras
    datosActuales.historico[idxMes].minutosConsumidos = Object.values(cartesDict).reduce((s: number, c: any) => s + (c.minutosAV || 0), 0)
    datosActuales.historico[idxMes].honorarioTotal = Object.values(cartesDict).reduce((s: number, c: any) => s + (c.honorario || 0), 0)

    // Guardar
    const json = JSON.stringify({ ...datosActuales, ultimaActualizacion: new Date().toISOString() }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    await put('spear-av-datos.json', blob, { access: 'public', allowOverwrite: true })

    return NextResponse.json({
      ok: true,
      mensaje: `Archivo procesado: ${resultado.length} carteras, ${Math.round(totalMinutos)} minutos totales`,
      formato,
      columnas: { cartera: headers[colCartera], minutos: headers[colMinutos], llamadas: colLlamadas >= 0 ? headers[colLlamadas] : null },
      carteras: resultado.map(r => ({
        cartera: r.cartera,
        minutos: Math.round(r.minutosAV),
        llamadas: r.llamadas,
        efectivas: r.efectivas,
        promesas: r.promesas,
      })),
    })
  } catch (e) {
    console.error('Error procesando Excel:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
