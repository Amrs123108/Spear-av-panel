// lib/blob.ts
// Helper centralizado para leer y escribir en Vercel Blob (acceso privado)
import { put, list, getDownloadUrl, head } from '@vercel/blob'

export const BLOB_FILENAME = 'spear-av-datos.json'

export async function leerBlobDatos(): Promise<any | null> {
  try {
    // Método 1: buscar con list
    const { blobs } = await list({ prefix: BLOB_FILENAME, limit: 1 })
    
    if (blobs && blobs.length > 0) {
      // Blob privado — necesitamos downloadUrl para leer
      const url = await getDownloadUrl(blobs[0].url)
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data && data.historico) return data
      }
    }
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
