import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export const dynamic = 'force-dynamic'

export async function GET() {
  const resultado: any = { timestamp: new Date().toISOString(), pasos: [] }

  // Paso 1: token
  const token = process.env.BLOB_READ_WRITE_TOKEN
  resultado.pasos.push({
    paso: '1_token', ok: !!token,
    detalle: token ? `Token presente (${token.substring(0, 20)}...)` : 'TOKEN NO ENCONTRADO'
  })
  if (!token) return NextResponse.json(resultado)

  // Paso 2: listar blobs
  try {
    const { blobs } = await list()
    resultado.pasos.push({
      paso: '2_list', ok: true, totalBlobs: blobs.length,
      blobs: blobs.map(b => ({ pathname: b.pathname, size: b.size }))
    })
    if (blobs.length === 0) {
      resultado.pasos.push({ paso: '3_read', ok: false, detalle: 'Blob vacío — corre /api/save primero' })
      return NextResponse.json(resultado)
    }

    // Paso 3: buscar archivo
    const archivo = blobs.find(b => b.pathname === 'spear-av-datos.json')
    resultado.pasos.push({
      paso: '3_buscar', ok: !!archivo,
      detalle: archivo
        ? `Encontrado (${archivo.size} bytes)`
        : `No encontrado. Disponibles: ${blobs.map(b => b.pathname).join(', ')}`
    })
    if (!archivo) return NextResponse.json(resultado)

    // Paso 4: leer con Authorization header
    const res = await fetch(archivo.url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    resultado.pasos.push({
      paso: '4_fetch', ok: res.ok, status: res.status
    })
    if (!res.ok) return NextResponse.json(resultado)

    // Paso 5: parsear
    const data = await res.json()
    resultado.pasos.push({
      paso: '5_parse', ok: true,
      meses: data.historico?.length,
      ultimaActualizacion: data.ultimaActualizacion,
      saldoBolsa: data.bolsa?.saldoActual
    })

  } catch (e: any) {
    resultado.pasos.push({ paso: 'error', ok: false, error: e.message })
  }

  return NextResponse.json(resultado)
}
