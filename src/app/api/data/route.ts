import { NextResponse } from 'next/server'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL, PLAN_INICIAL, COSTO_FIJO_MENSUAL_AV, COSTO_PISO_ASESOR } from '@/lib/store'
import { calcularValorAV } from '@/lib/valorAV'

export const dynamic = 'force-dynamic'

// Lee datos del Blob si existe, si no usa el store local
async function obtenerDatos() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    const storeUrl = process.env.BLOB_STORE_URL

    if (token && storeUrl) {
      const res = await fetch(`${storeUrl}/spear-av-datos.json`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      if (res.ok) {
        const datos = await res.json()
        if (datos.historico && datos.historico.length > 0) {
          return { fuente: 'blob' as const, ...datos }
        }
      }
    }
  } catch (e) { /* fallback al store local */ }

  return {
    fuente: 'local' as const,
    historico: HISTORICO_INICIAL,
    bolsa: BOLSA_INICIAL,
    plan: PLAN_INICIAL,
    configuracion: { carteras: CARTERAS_CONFIG, costoFijoMensualAV: COSTO_FIJO_MENSUAL_AV, costoPisoAsesor: COSTO_PISO_ASESOR }
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const mesIdx = parseInt(url.searchParams.get('mes') || '-1')
    const datos = await obtenerDatos()
    return NextResponse.json({ ok: true, fuenteDatos: datos.fuente, ...calcular(datos, mesIdx) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const datos = await obtenerDatos()
    return NextResponse.json({ ok: true, fuenteDatos: datos.fuente, ...calcular(datos, body.mesIdx ?? -1) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

function calcular(datos: any, mesIdxParam: number) {
  const { historico, bolsa, plan } = datos
  const carteras = datos.configuracion?.carteras || CARTERAS_CONFIG
  const costoFijo = datos.configuracion?.costoFijoMensualAV || COSTO_FIJO_MENSUAL_AV
  const costoPiso = datos.configuracion?.costoPisoAsesor || COSTO_PISO_ASESOR

  const mesIdx = mesIdxParam >= 0 && mesIdxParam < historico.length ? mesIdxParam : historico.length - 1
  const mesActual = historico[mesIdx]
  const mesAnterior = mesIdx > 0 ? historico[mesIdx - 1] : null

  const bases: Record<string, number> = {}
  carteras.forEach((c: any) => {
    const vals = historico.filter((m: any) => (m.carteras[c.nombre]?.minutosAV || 0) === 0).map((m: any) => m.carteras[c.nombre]?.honorario || 0).filter((v: number) => v > 0)
    bases[c.nombre] = vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0
  })

  const tieneMinutos = mesActual.minutosConsumidos > 0
  const tieneHonorario = mesActual.honorarioTotal > 0
  const inversionAV = mesActual.avActivo && tieneMinutos ? costoFijo : 0
  const honorarioTotal = mesActual.honorarioTotal
  const honorarioAnterior = mesAnterior?.honorarioTotal || 0
  const deltaVsMes = honorarioTotal - honorarioAnterior
  const baseTotal = Object.values(bases).reduce((a: number, b: number) => a + b, 0)
  const incremento = honorarioTotal - baseTotal
  const roi = inversionAV > 0 && tieneHonorario ? incremento / inversionAV : 0

  const estadoMes = mesActual.esMesActual ? 'en_curso' : tieneHonorario && tieneMinutos ? 'completo' : tieneMinutos ? 'minutos_sin_honorario' : 'vacio'

  const carterasM = carteras.map((c: any) => {
    const a = mesActual.carteras[c.nombre] || { minutosAV: 0, honorario: 0, honorarioMesAnterior: 0, promesas: 0, llamadas: 0, efectivas: 0 }
    const honAnt = a.honorarioMesAnterior || (mesAnterior?.carteras[c.nombre]?.honorario || 0)
    const base = bases[c.nombre] || 0
    const invAV = mesActual.minutosConsumidos > 0 ? (a.minutosAV / mesActual.minutosConsumidos) * costoFijo : 0
    const costoP = c.asesores * costoPiso
    const pct = a.honorario > 0 ? (invAV / a.honorario) * 100 : 0
    const pts = (c.honorarioPct || 0) * 100 * (pct / 100)
    const valorAV = calcularValorAV(c.nombre, c.clientes, c.asesores, a.minutosAV, a.llamadas, a.efectivas, a.promesas, a.honorario, invAV)

    let semaforo = 'amarillo', motivo = '', accion = ''
    if (a.minutosAV === 0) { motivo = 'Sin minutos AV.'; accion = 'Evaluar activación.' }
    else if (a.honorario === 0) { motivo = `${a.minutosAV.toLocaleString()} min. Honorario pendiente.`; accion = 'Esperar cierre.' }
    else if (pct < 10) { semaforo = 'verde'; motivo = `${pct.toFixed(1)}% al AV. Muy eficiente.`; accion = 'Mantener o aumentar.' }
    else if (pct < 30) { semaforo = 'verde'; motivo = `${pct.toFixed(1)}% al AV. Rentable.`; accion = 'Mantener.' }
    else if (pct < 60) { motivo = `${pct.toFixed(1)}% al AV. Margen ajustado.`; accion = 'Optimizar minutos.' }
    else { semaforo = 'rojo'; motivo = `${pct.toFixed(1)}% al AV. No rentable.`; accion = 'Reducir y reasignar.' }

    return { nombre: c.nombre, clientes: c.clientes, asesores: c.asesores, comisionPct: (c.honorarioPct || 0) * 100, minutosAV: a.minutosAV, promesas: a.promesas, llamadas: a.llamadas, efectivas: a.efectivas, inversionAV: Math.round(invAV * 100) / 100, costoPiso: costoP, masivos: c.masivos || 0, costoTotal: Math.round((invAV + costoP + (c.masivos || 0)) * 100) / 100, honorario: a.honorario, honorarioMesAnterior: honAnt, base: Math.round(base), delta: Math.round(a.honorario - base), retornoXBalboa: invAV > 0 && a.honorario > 0 ? parseFloat((a.honorario / invAV).toFixed(2)) : 0, pctHonorarioAlAV: parseFloat(pct.toFixed(2)), puntosComisionAlAV: parseFloat(pts.toFixed(3)), semaforo, motivo, accion, pctCobertura: a.llamadas > 0 ? parseFloat((a.llamadas / c.clientes * 100).toFixed(1)) : 0, valorAV }
  })

  const totalGest = carterasM.reduce((s: number, c: any) => s + c.llamadas, 0)
  const totalPiso = carterasM.reduce((s: number, c: any) => s + c.valorAV.gestionesPisoEstimadas, 0)
  const totalHoras = carterasM.reduce((s: number, c: any) => s + c.valorAV.tiempoLibeReadoHoras, 0)
  const pctHonAlAV = honorarioTotal > 0 ? (inversionAV / honorarioTotal) * 100 : 0

  return {
    mesActualIdx: mesIdx, estadoMes,
    mensajeEstado: estadoMes === 'minutos_sin_honorario' ? `El AV consumió ${mesActual.minutosConsumidos.toLocaleString()} min. Honorario pendiente de cierre.` : estadoMes === 'vacio' ? 'Sin datos para este mes.' : null,
    mesActual: { mes: mesActual.mes, label: mesActual.label, esMesActual: mesActual.esMesActual || false, nota: mesActual.nota || '', inversionAV, honorarioTotal, honorarioAnterior, deltaVsMesAnterior: deltaVsMes, incrementoVsBase: Math.round(incremento), roiMultiplo: parseFloat(roi.toFixed(2)), minutosConsumidos: mesActual.minutosConsumidos, sePaga: inversionAV > 0 ? incremento >= inversionAV : honorarioTotal > 0, pctHonorarioTotalAlAV: parseFloat(pctHonAlAV.toFixed(2)), costoXMinuto: mesActual.minutosConsumidos > 0 ? parseFloat((costoFijo / mesActual.minutosConsumidos).toFixed(3)) : 0, resumenValor: { carterasConValorEvidenciado: carterasM.filter((c: any) => c.valorAV.avAgregoValor && c.minutosAV > 0).length, totalGestionesAV: totalGest, totalGestionesPisoSinAV: totalPiso, pctIncrementoGestiones: totalPiso > 0 ? parseFloat(((totalGest / totalPiso) * 100).toFixed(1)) : 0, totalHorasLiberadas: parseFloat(totalHoras.toFixed(1)), advertenciaAtribucion: 'El incremento de honorario no puede atribuirse exclusivamente al AV. Lo verificable: el AV aumentó el volumen de gestiones y liberó tiempo de asesores.' } },
    carteras: carterasM,
    historico: historico.map((m: any) => ({ mes: m.mes, label: m.label, nota: m.nota || '', inversionAV: m.avActivo && m.minutosConsumidos > 0 ? costoFijo : 0, honorarioTotal: m.honorarioTotal, avActivo: m.avActivo, minutosConsumidos: m.minutosConsumidos, esMesActual: m.esMesActual || false })),
    bolsa, plan,
  }
}
