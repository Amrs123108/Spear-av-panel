import { NextResponse } from 'next/server'
import { list, getDownloadUrl } from '@vercel/blob'

export const dynamic = 'force-dynamic'

export async function GET() {
  const resultado: any = {
    timestamp: new Date().toISOString(),
    pasos: []
  }

  // Paso 1: verificar token
  const token = process.env.BLOB_READ_WRITE_TOKEN
  resultado.pasos.push({
    paso: '1_token',
    ok: !!token,
    detalle: token ? `Token presente (${token.substring(0, 20)}...)` : 'TOKEN NO ENCONTRADO'
  })

  if (!token) {
    return NextResponse.json(resultado)
  }

  // Paso 2: listar blobs
  try {
    const { blobs } = await list()
    resultado.pasos.push({
      paso: '2_list',
      ok: true,
      totalBlobs: blobs.length,
      blobs: blobs.map(b => ({ url: b.url, pathname: b.pathname, size: b.size }))
    })

    if (blobs.length === 0) {
      resultado.pasos.push({ paso: '3_read', ok: false, detalle: 'No hay archivos en el Blob' })
      return NextResponse.json(resultado)
    }

    // Paso 3: buscar el archivo específico
    const archivo = blobs.find(b => b.pathname === 'spear-av-datos.json')
    resultado.pasos.push({
      paso: '3_buscar_archivo',
      ok: !!archivo,
      detalle: archivo ? `Encontrado: ${archivo.pathname}` : `No encontrado. Archivos disponibles: ${blobs.map(b => b.pathname).join(', ')}`
    })

    if (!archivo) return NextResponse.json(resultado)

    // Paso 4: obtener download URL
    const downloadUrl = await getDownloadUrl(archivo.url)
    resultado.pasos.push({ paso: '4_downloadUrl', ok: true, url: downloadUrl.substring(0, 80) + '...' })

    // Paso 5: leer el contenido
    const res = await fetch(downloadUrl, { cache: 'no-store' })
    resultado.pasos.push({ paso: '5_fetch', ok: res.ok, status: res.status })

    if (!res.ok) return NextResponse.json(resultado)

    const data = await res.json()
    resultado.pasos.push({
      paso: '6_parse',
      ok: true,
      tieneHistorico: !!data.historico,
      meses: data.historico?.length,
      ultimaActualizacion: data.ultimaActualizacion,
      saldoBolsa: data.bolsa?.saldoActual
    })

  } catch (e: any) {
    resultado.pasos.push({ paso: 'error', ok: false, error: e.message, stack: e.stack?.split('\n').slice(0, 3) })
  }

  return NextResponse.json(resultado, { status: 200 })
}
