import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL, PLAN_INICIAL, COSTO_FIJO_MENSUAL_AV, COSTO_PISO_ASESOR } from '@/lib/store'

export const dynamic = 'force-dynamic'

const PATHNAME = 'spear-av-datos.json'

// Leer datos actuales del Blob
async function leerBlob() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    const storeUrl = process.env.BLOB_STORE_URL
    if (!token || !storeUrl) return null
    const res = await fetch(`${storeUrl}/${PATHNAME}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    if (res.ok) return await res.json()
  } catch (e) {}
  return null
}

// Escribir datos al Blob
async function escribirBlob(datos: any) {
  const json = JSON.stringify({ ...datos, ultimaActualizacion: new Date().toISOString() }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  await put(PATHNAME, blob, { access: 'public', allowOverwrite: true })
}

// POST — Guardar datos (mes, bolsa, plan, o todo)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { accion, datos } = body

    // Leer estado actual
    let datosActuales = await leerBlob()

    // Si no hay datos en Blob aún, inicializar con el store local
    if (!datosActuales) {
      datosActuales = {
        version: 1,
        historico: HISTORICO_INICIAL,
        bolsa: BOLSA_INICIAL,
        plan: PLAN_INICIAL,
        configuracion: {
          carteras: CARTERAS_CONFIG,
          costoFijoMensualAV: COSTO_FIJO_MENSUAL_AV,
          costoPisoAsesor: COSTO_PISO_ASESOR,
          minutosIncluidosMes: 14000,
        }
      }
    }

    switch (accion) {
      case 'guardar_mes': {
        // Actualizar un mes específico
        const idx = datosActuales.historico.findIndex((m: any) => m.mes === datos.mes)
        if (idx >= 0) {
          datosActuales.historico[idx] = { ...datosActuales.historico[idx], ...datos }
        } else {
          datosActuales.historico.push(datos)
          datosActuales.historico.sort((a: any, b: any) => a.mes.localeCompare(b.mes))
        }
        break
      }
      case 'guardar_cartera': {
        // Actualizar campos de una cartera en un mes
        const { mes, cartera, campos } = datos
        const idxMes = datosActuales.historico.findIndex((m: any) => m.mes === mes)
        if (idxMes >= 0) {
          datosActuales.historico[idxMes].carteras[cartera] = {
            ...datosActuales.historico[idxMes].carteras[cartera],
            ...campos
          }
          // Recalcular total del mes
          const carteras = datosActuales.historico[idxMes].carteras
          datosActuales.historico[idxMes].honorarioTotal = Object.values(carteras).reduce((s: number, c: any) => s + (c.honorario || 0), 0)
          datosActuales.historico[idxMes].minutosConsumidos = Object.values(carteras).reduce((s: number, c: any) => s + (c.minutosAV || 0), 0)
        }
        break
      }
      case 'guardar_plan': {
        datosActuales.plan = datos
        break
      }
      case 'guardar_bolsa': {
        datosActuales.bolsa = datos
        break
      }
      case 'migrar_historico': {
        // Migración completa — reemplaza todo el histórico
        datosActuales.historico = datos.historico
        if (datos.bolsa) datosActuales.bolsa = datos.bolsa
        if (datos.plan) datosActuales.plan = datos.plan
        break
      }
      default:
        return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
    }

    await escribirBlob(datosActuales)
    return NextResponse.json({ ok: true, accion, ultimaActualizacion: new Date().toISOString() })
  } catch (e) {
    console.error('Error guardando:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// GET — Inicializar Blob con datos del store local (migración inicial)
export async function GET() {
  try {
    const existente = await leerBlob()
    if (existente && existente.historico?.length > 0) {
      return NextResponse.json({ ok: true, mensaje: 'Blob ya tiene datos', meses: existente.historico.length })
    }

    // Primera vez — poblar con el histórico completo del store
    const datos = {
      version: 1,
      historico: HISTORICO_INICIAL,
      bolsa: BOLSA_INICIAL,
      plan: PLAN_INICIAL,
      configuracion: {
        carteras: CARTERAS_CONFIG,
        costoFijoMensualAV: COSTO_FIJO_MENSUAL_AV,
        costoPisoAsesor: COSTO_PISO_ASESOR,
        minutosIncluidosMes: 14000,
      }
    }

    await escribirBlob(datos)
    return NextResponse.json({ ok: true, mensaje: 'Blob inicializado con datos históricos', meses: HISTORICO_INICIAL.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
