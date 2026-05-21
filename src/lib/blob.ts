// lib/blob.ts
// Helper para leer y escribir en Vercel Blob (acceso privado)
// Para Blob privado: fetch directo con Authorization header
import { put, list } from '@vercel/blob'

export const BLOB_FILENAME = 'spear-av-datos.json'

export async function leerBlobDatos(): Promise<any | null> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) return null

    // Buscar el archivo
    const { blobs } = await list({ prefix: BLOB_FILENAME, limit: 1 })
    if (!blobs || blobs.length === 0) return null

    // Leer Blob privado: fetch con token en Authorization header
    const res = await fetch(blobs[0].url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error('[Blob] fetch error:', res.status, res.statusText)
      return null
    }

    const data = await res.json()
    if (data?.historico?.length > 0) return data
    return null
  } catch (e) {
    console.error('[Blob] Error leyendo:', e)
    return null
  }
}

export async function escribirBlobDatos(datos: any): Promise<boolean> {
  try {
    const json = JSON.stringify(
      { ...datos, ultimaActualizacion: new Date().toISOString() },
      null, 2
    )
    await put(BLOB_FILENAME, json, {
      access: 'private',
      allowOverwrite: true,
      contentType: 'application/json',
    })
    return true
  } catch (e) {
    console.error('[Blob] Error escribiendo:', e)
    return false
  }
}
