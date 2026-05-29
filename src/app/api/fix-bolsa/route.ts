import { NextResponse } from 'next/server'
import { list, put } from '@vercel/blob'
import { calcularSaldoBolsa } from '@/lib/bolsa'

export const dynamic = 'force-dynamic'
const PATHNAME = 'spear-av-datos.json'

async function leerBlob() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) return null
    const { blobs } = await list({ prefix: PATHNAME, limit: 1 })
    if (!blobs?.length) return null
    const res = await fetch(blobs[0].url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch (e) { return null }
}

async function escribirBlob(datos: any) {
  const blob = new Blob([JSON.stringify({ ...datos, ultimaActualizacion: new Date().toISOString() }, null, 2)], { type: 'application/json' })
  await put(PATHNAME, blob, { access: 'private', allowOverwrite: true })
}

export async function GET() {
  const datos = await leerBlob()
  if (!datos) return NextResponse.json({ ok: false, error: 'No hay datos' })

  const bolsaCorrecta = calcularSaldoBolsa(datos.historico, datos.bolsa)

  return NextResponse.json({
    ok: true,
    saldoActualEnBlob: datos.bolsa?.saldoActual,
    saldoCorrecto: bolsaCorrecta.saldoActual,
    diferencia: (datos.bolsa?.saldoActual ?? 0) - bolsaCorrecta.saldoActual,
    detalle: bolsaCorrecta.detalle,
  })
}

export async function POST() {
  const datos = await leerBlob()
  if (!datos) return NextResponse.json({ ok: false, error: 'No hay datos' })

  const saldoAnterior = datos.bolsa?.saldoActual ?? 0
  const bolsaCorrecta = calcularSaldoBolsa(datos.historico, datos.bolsa)

  datos.bolsa = {
    saldoActual: bolsaCorrecta.saldoActual,
    diaRecarga: bolsaCorrecta.diaRecarga,
    cantidadRecarga: bolsaCorrecta.cantidadRecarga,
    historial: bolsaCorrecta.historial,
  }

  await escribirBlob(datos)

  return NextResponse.json({
    ok: true,
    saldoAnterior,
    saldoNuevo: bolsaCorrecta.saldoActual,
    detalle: bolsaCorrecta.detalle,
    mensaje: `Saldo: ${saldoAnterior.toLocaleString('es-PA')} → ${bolsaCorrecta.saldoActual.toLocaleString('es-PA')} min`,
  })
}
