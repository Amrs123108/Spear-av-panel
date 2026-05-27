import { NextResponse } from 'next/server'
import { list, put } from '@vercel/blob'

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

// GET — diagnóstico del saldo actual vs saldo correcto
export async function GET() {
  const datos = await leerBlob()
  if (!datos) return NextResponse.json({ ok: false, error: 'No hay datos' })

  // Minutos reales por mes según el Blob
  const minutosRealesPorMes: Record<string, number> = {}
  datos.historico?.forEach((m: any) => {
    const min = Object.values(m.carteras || {})
      .reduce((s: number, c: any) => s + (c.minutosAV || 0), 0) as number
    if (min > 0) minutosRealesPorMes[m.mes] = min
  })

  const totalConsumos = Object.values(minutosRealesPorMes)
    .reduce((s: number, v: unknown) => s + (v as number), 0)

  // 5 recargas: mar, abr, may 2026 + ene, feb 2026
  const totalRecargas = 14000 * 5
  const saldoCorrecto = totalRecargas - totalConsumos

  return NextResponse.json({
    saldoActualEnBlob: datos.bolsa?.saldoActual,
    saldoCorrecto,
    minutosRealesPorMes,
    totalRecargas,
    totalConsumos,
    diferencia: datos.bolsa?.saldoActual - saldoCorrecto,
    historialReciente: (datos.bolsa?.historial || []).slice(0, 8),
  })
}

// POST — corregir el saldo con el valor correcto
export async function POST(req: Request) {
  const { saldo } = await req.json()
  if (typeof saldo !== 'number' || saldo < 0)
    return NextResponse.json({ ok: false, error: 'Saldo inválido' })

  const datos = await leerBlob()
  if (!datos) return NextResponse.json({ ok: false, error: 'No hay datos' })

  const saldoAnterior = datos.bolsa.saldoActual

  // Reconstruir historial limpio: solo recargas mensuales reales + corrección
  const recargas = (datos.bolsa?.historial || [])
    .filter((h: any) => h.tipo === 'recarga' && h.descripcion?.includes('mensual'))

  datos.bolsa.saldoActual = saldo
  datos.bolsa.historial = [
    {
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'recarga',
      cantidad: 0,
      descripcion: `Saldo corregido manualmente — anterior: ${saldoAnterior.toLocaleString('es-PA')} min`
    },
    ...recargas.slice(0, 5),
  ]

  await escribirBlob(datos)

  return NextResponse.json({
    ok: true,
    saldoAnterior,
    saldoNuevo: saldo,
    mensaje: `✓ Saldo actualizado a ${saldo.toLocaleString('es-PA')} minutos`
  })
}
