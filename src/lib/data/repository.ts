// lib/data/repository.ts
// CAPA DE ABSTRACCIÓN DE DATOS
// Principio: la UI nunca sabe de dónde vienen los datos.
// Hoy: Vercel Blob. Mañana: PostgreSQL. Solo cambia este archivo.

import { DashboardData, MesHistorico, BolsaMinutos, PlanSemanal, ProductividadAsesor } from '@/types'
import { calcularMetricas } from './calculadora'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL, PLAN_INICIAL, COSTO_FIJO_MENSUAL_AV, COSTO_PISO_ASESOR } from '@/lib/store'

const BLOB_FILENAME = 'spear-av-datos.json'

// ── Fuente de datos: Blob ─────────────────────────────────────────────────────

async function leerBlob(): Promise<any | null> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) return null

    const { list } = await import('@vercel/blob')
    const { blobs } = await list({ prefix: BLOB_FILENAME, limit: 1 })
    if (!blobs?.length) return null

    const res = await fetch(blobs[0].url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    return null
  }
}

// ── Fuente de datos: local (fallback y meses históricos cerrados) ─────────────

function obtenerDatosLocales() {
  return {
    historico: HISTORICO_INICIAL,
    bolsa: BOLSA_INICIAL,
    plan: PLAN_INICIAL,
    configuracion: {
      carteras: CARTERAS_CONFIG,
      costoFijoMensualAV: COSTO_FIJO_MENSUAL_AV,
      costoPisoAsesor: COSTO_PISO_ASESOR,
    }
  }
}

// ── Repositorio principal ─────────────────────────────────────────────────────

export async function obtenerDashboard(mesIdx: number = -1): Promise<DashboardData> {
  const blob = await leerBlob()
  const fuente = blob?.historico?.length > 0 ? 'blob' : 'local'
  const raw = fuente === 'blob' ? blob : obtenerDatosLocales()

  return calcularMetricas(raw, mesIdx, fuente as 'blob' | 'local')
}

// Para meses históricos cerrados: permite caché estático de Next.js
// Cuando migremos a SQL: SELECT * FROM meses WHERE mes = $1 AND cerrado = true
export async function obtenerMesCerrado(mes: string): Promise<DashboardData | null> {
  const blob = await leerBlob()
  const raw = blob ?? obtenerDatosLocales()

  const idx = raw.historico.findIndex((m: MesHistorico) => m.mes === mes)
  if (idx < 0) return null

  const mesData = raw.historico[idx]
  if (mesData.esMesActual) return null // no es cerrado

  return calcularMetricas(raw, idx, blob ? 'blob' : 'local')
}

// Productividad de asesores — desde gestionesPiso del mes
export async function obtenerProductividad(mes: string): Promise<ProductividadAsesor[]> {
  const blob = await leerBlob()
  const raw = blob ?? obtenerDatosLocales()

  const mesData = raw.historico?.find((m: MesHistorico) => m.mes === mes)
  if (!mesData?.gestionesPiso) return []

  const resultado: ProductividadAsesor[] = []
  // Cuando tengamos Sigella integrado, esto vendrá de gestionesPiso con detalle por asesor
  // Por ahora retorna los agregados disponibles
  Object.entries(mesData.gestionesPiso).forEach(([cartera, datos]: [string, any]) => {
    if (datos.totalAsesores > 0) {
      resultado.push({
        asesor: `Equipo ${cartera}`,
        cartera,
        gestiones: datos.llamadas,
        efectivas: datos.efectivas,
        promesas: datos.promesas,
        monto: datos.montoPrometido,
        tmoMin: datos.tiempoPromedioMin,
        diasActivo: 22, // días hábiles estimados
        gestionesPorDia: datos.totalAsesores > 0 ? Math.round(datos.llamadas / (datos.totalAsesores * 22)) : 0,
      })
    }
  })

  return resultado
}

// Escribir datos al Blob — usado por /admin
export async function guardarEnBlob(datos: any): Promise<boolean> {
  try {
    const { put } = await import('@vercel/blob')
    const json = JSON.stringify({ ...datos, ultimaActualizacion: new Date().toISOString() }, null, 2)
    await put(BLOB_FILENAME, json, { access: 'private', allowOverwrite: true, contentType: 'application/json' })
    return true
  } catch (e) {
    return false
  }
}

export async function leerBlobCompleto(): Promise<any | null> {
  return leerBlob()
}
