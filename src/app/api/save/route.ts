import { NextResponse } from 'next/server'
import { put, list } from '@vercel/blob'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL, PLAN_INICIAL, COSTO_FIJO_MENSUAL_AV, COSTO_PISO_ASESOR } from '@/lib/store'

export const dynamic = 'force-dynamic'
const PATHNAME = 'spear-av-datos.json'

// ── Leer datos del Blob (fetch con Authorization para acceso privado) ──
async function leerBlob(): Promise<any | null> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) return null
    const { blobs } = await list({ prefix: PATHNAME, limit: 1 })
    if (!blobs || blobs.length === 0) return null
    const res = await fetch(blobs[0].url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.error('Error leyendo blob:', e)
    return null
  }
}

// ── Escribir datos al Blob ───────────────────────────────────────────
async function escribirBlob(datos: any): Promise<void> {
  const json = JSON.stringify(
    { ...datos, ultimaActualizacion: new Date().toISOString() },
    null, 2
  )
  const blob = new Blob([json], { type: 'application/json' })
  await put(PATHNAME, blob, { access: 'private', allowOverwrite: true })
}

// ── GET — inicializar Blob con datos del store ───────────────────────
export async function GET() {
  try {
    const existente = await leerBlob()
    if (existente?.historico?.length > 0) {
      return NextResponse.json({
        ok: true,
        mensaje: 'Blob ya tiene datos',
        meses: existente.historico.length,
        ultimaActualizacion: existente.ultimaActualizacion
      })
    }

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
    return NextResponse.json({
      ok: true,
      mensaje: `Blob inicializado con ${HISTORICO_INICIAL.length} meses de histórico`,
      meses: HISTORICO_INICIAL.length
    })
  } catch (e) {
    console.error('Error inicializando blob:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// ── POST — guardar datos ─────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { accion, datos } = body

    let datosActuales = await leerBlob()

    // Si no hay datos, inicializar con el store
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
        // Actualizar un mes completo
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
        // Actualizar campos de una cartera en un mes específico
        const { mes, cartera, campos } = datos
        const idxMes = datosActuales.historico.findIndex((m: any) => m.mes === mes)
        if (idxMes >= 0) {
          if (!datosActuales.historico[idxMes].carteras[cartera]) {
            datosActuales.historico[idxMes].carteras[cartera] = {
              minutosAV: 0, honorario: 0, honorarioMesAnterior: 0,
              promesas: 0, llamadas: 0, efectivas: 0
            }
          }
          datosActuales.historico[idxMes].carteras[cartera] = {
            ...datosActuales.historico[idxMes].carteras[cartera],
            ...campos
          }
          // Recalcular totales del mes
          const carts = datosActuales.historico[idxMes].carteras
          datosActuales.historico[idxMes].honorarioTotal =
            Object.values(carts).reduce((s: number, c: any) => s + (c.honorario || 0), 0)
          datosActuales.historico[idxMes].minutosConsumidos =
            Object.values(carts).reduce((s: number, c: any) => s + (c.minutosAV || 0), 0)
        }
        break
      }

      case 'cargar_reporte': {
        // Datos procesados de un reporte Excel (AV o Piso)
        const { mes, tipo, carteras: carterasData } = datos
        const idxMes = datosActuales.historico.findIndex((m: any) => m.mes === mes)
        if (idxMes < 0) {
          return NextResponse.json({ ok: false, error: `Mes ${mes} no encontrado` }, { status: 404 })
        }

        const mRef = datosActuales.historico[idxMes]

        Object.entries(carterasData).forEach(([nombre, vals]: [string, any]) => {
          if (!mRef.carteras[nombre]) {
            mRef.carteras[nombre] = {
              minutosAV: 0, honorario: 0, honorarioMesAnterior: 0,
              promesas: 0, llamadas: 0, efectivas: 0
            }
          }
          const c = mRef.carteras[nombre]
          if (tipo === 'av') {
            // SUMA minutos y gestiones del AV
            c.minutosAV = (c.minutosAV || 0) + (vals.minutosAV || 0)
            c.llamadas = (c.llamadas || 0) + (vals.llamadas || 0)
            c.efectivas = (c.efectivas || 0) + (vals.efectivas || 0)
            c.promesas = (c.promesas || 0) + (vals.promesas || 0)
          } else if (tipo === 'piso') {
            // Guarda gestiones del piso en subobjeto separado
            if (!mRef.gestionesPiso) mRef.gestionesPiso = {}
            if (!mRef.gestionesPiso[nombre]) {
              mRef.gestionesPiso[nombre] = {
                llamadas: 0, efectivas: 0, promesas: 0,
                montoPrometido: 0, noEfectivas: 0, tiempoPromedioMin: 0
              }
            }
            const p = mRef.gestionesPiso[nombre]
            p.llamadas = (p.llamadas || 0) + (vals.llamadas || 0)
            p.efectivas = (p.efectivas || 0) + (vals.efectivas || 0)
            p.promesas = (p.promesas || 0) + (vals.promesas || 0)
            p.montoPrometido = (p.montoPrometido || 0) + (vals.montoPrometido || 0)
            p.noEfectivas = (p.noEfectivas || 0) + (vals.noEfectivas || 0)
            if (vals.tiempoPromedioMin > 0) p.tiempoPromedioMin = vals.tiempoPromedioMin
          }
        })

        // Recalcular totales
        const carts = mRef.carteras
        mRef.minutosConsumidos = Object.values(carts).reduce((s: number, c: any) => s + (c.minutosAV || 0), 0)
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

      case 'actualizar_bolsa': {
        // Actualizar solo el saldo de la bolsa
        datosActuales.bolsa.saldoActual = datos.saldo
        if (datos.entrada) {
          datosActuales.bolsa.historial.unshift(datos.entrada)
        }
        break
      }

      default:
        return NextResponse.json({ ok: false, error: `Acción desconocida: ${accion}` }, { status: 400 })
    }

    await escribirBlob(datosActuales)
    return NextResponse.json({ ok: true, accion, guardado: new Date().toISOString() })

  } catch (e) {
    console.error('Error en /api/save POST:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
