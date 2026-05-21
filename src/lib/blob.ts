// lib/blob.ts
// Helper para leer y escribir en Vercel Blob (acceso privado)
// Usa get() para leer desde servidor — NO getDownloadUrl() que es solo para navegador
import { put, list, get } from '@vercel/blob'

export const BLOB_FILENAME = 'spear-av-datos.json'

export async function leerBlobDatos(): Promise<any | null> {
  try {
    // Buscar el archivo con list para obtener la URL
    const { blobs } = await list({ prefix: BLOB_FILENAME, limit: 1 })
    if (!blobs || blobs.length === 0) return null

    // Usar get() — correcto para acceso privado desde servidor
    const blob = await get(blobs[0].url)
    if (!blob) return null

    // blob es un objeto Blob — leer como texto y parsear
    const texto = await blob.text()
    const data = JSON.parse(texto)

    if (data && data.historico && data.historico.length > 0) return data
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
