// lib/blobStorage.ts
// Almacenamiento en Vercel Blob — datos compartidos entre todos los dispositivos
// Un solo archivo JSON guarda todo el estado del panel

import { put, head, del } from '@vercel/blob'

const BLOB_PATHNAME = 'spear-av-datos.json'

export interface DatosPanel {
  version: number
  ultimaActualizacion: string
  historico: MesHistorico[]
  bolsa: BolsaDatos
  plan: PlanDatos[]
  configuracion: ConfigDatos
}

export interface MesHistorico {
  mes: string           // "2026-05"
  label: string         // "MAY 2026"
  avActivo: boolean
  esMesActual: boolean
  honorarioTotal: number
  minutosConsumidos: number
  nota: string          // campo libre para contexto
  carteras: {
    [nombre: string]: {
      minutosAV: number
      honorario: number
      honorarioMesAnterior: number
      promesas: number
      llamadas: number
      efectivas: number
    }
  }
}

export interface BolsaDatos {
  saldoActual: number
  diaRecarga: number
  cantidadRecarga: number
  historial: {
    fecha: string
    tipo: 'recarga' | 'consumo'
    cantidad: number
    descripcion: string
  }[]
}

export interface PlanDatos {
  id: string
  fecha: string
  semana: string
  estado: string
  acciones: {
    id: string
    descripcion: string
    responsable: string
    impactoEsperado: string
    completada: boolean
    resultado?: string
  }[]
  notas: string
  metaHonorario: number
  honorarioRealizado: number
}

export interface ConfigDatos {
  costoFijoMensualAV: number
  minutosIncluidosMes: number
  costoPisoAsesor: number
  carteras: {
    nombre: string
    asesores: number
    clientes: number
    honorarioPct: number
    masivos: number
    conversionPago: number
    ticketPromedio: number
  }[]
}

// ── Leer datos del Blob ───────────────────────────────────────────────
export async function leerDatos(): Promise<DatosPanel | null> {
  try {
    // Verificar si el archivo existe
    const blobList = await fetch(
      `https://api.vercel.com/v1/storage/blobs?prefix=${BLOB_PATHNAME}`,
      {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
      }
    )
    
    // Intentar leer directamente
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) {
      console.error('BLOB_READ_WRITE_TOKEN no configurado')
      return null
    }

    // Construir la URL del blob
    const storeUrl = process.env.BLOB_STORE_URL || ''
    if (!storeUrl) return null

    const res = await fetch(`${storeUrl}/${BLOB_PATHNAME}`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) return null
    return await res.json() as DatosPanel
  } catch (e) {
    console.error('Error leyendo blob:', e)
    return null
  }
}

// ── Guardar datos en el Blob ─────────────────────────────────────────
export async function guardarDatos(datos: DatosPanel): Promise<boolean> {
  try {
    const json = JSON.stringify({ ...datos, ultimaActualizacion: new Date().toISOString() }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    
    await put(BLOB_PATHNAME, blob, {
      access: 'public',
      allowOverwrite: true,
    })
    return true
  } catch (e) {
    console.error('Error guardando blob:', e)
    return false
  }
}

// ── Actualizar un mes específico ─────────────────────────────────────
export async function actualizarMes(mes: MesHistorico): Promise<boolean> {
  const datos = await leerDatos()
  if (!datos) return false
  
  const idx = datos.historico.findIndex(m => m.mes === mes.mes)
  if (idx >= 0) {
    datos.historico[idx] = mes
  } else {
    datos.historico.push(mes)
    datos.historico.sort((a, b) => a.mes.localeCompare(b.mes))
  }
  
  return guardarDatos(datos)
}

// ── Actualizar bolsa ─────────────────────────────────────────────────
export async function actualizarBolsa(bolsa: BolsaDatos): Promise<boolean> {
  const datos = await leerDatos()
  if (!datos) return false
  datos.bolsa = bolsa
  return guardarDatos(datos)
}

// ── Actualizar plan ──────────────────────────────────────────────────
export async function actualizarPlan(plan: PlanDatos[]): Promise<boolean> {
  const datos = await leerDatos()
  if (!datos) return false
  datos.plan = plan
  return guardarDatos(datos)
}
