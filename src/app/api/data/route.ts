import { NextResponse } from 'next/server'
import { list, getDownloadUrl } from '@vercel/blob'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL, PLAN_INICIAL, COSTO_FIJO_MENSUAL_AV, COSTO_PISO_ASESOR } from '@/lib/store'
import { calcularValorAV } from '@/lib/valorAV'

export const dynamic = 'force-dynamic'
const PATHNAME = 'spear-av-datos.json'

async function leerBlob(): Promise<any | null> {
  try {
    const { blobs } = await list({ prefix: PATHNAME })
    if (!blobs || blobs.length === 0) return null
    const downloadUrl = await getDownloadUrl(blobs[0].url)
    const res = await fetch(downloadUrl, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    return null
  }
}

async function obtenerDatos() {
  const blob = await leerBlob()
  if (blob?.historico?.length > 0) {
    return { fuente: 'blob' as const, ...blob }
  }
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

  // Base histórica sin AV
  const bases: Record<string, number> = {}
  carteras.forEach((c: any) => {
    const vals = historico
      .filter((m: any) => (m.carteras[c.nombre]?.minutosAV || 0) === 0)
      .map((m: any) => m.carteras[c.nombre]?.honorario || 0)
      .filter((v: number) => v > 0)
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

  const estadoMes = mesActual.esMesActual ? 'en_curso'
    : tieneHonorario && tieneMinutos ? 'completo'
    : tieneMinutos ? 'minutos_sin_honorario' : 'vacio'

  const carterasM = carteras.map((c: any) => {
    const a = mesActual.carteras[c.nombre] || { minutosAV: 0, honorario: 0, honorarioMesAnterior: 0, promesas: 0, llamadas: 0, efectivas: 0 }
    const honAnt = a.honorarioMesAnterior || (mesAnterior?.carteras[c.nombre]?.honorario || 0)
    const base = bases[c.nombre] || 0
    const invAV = mesActual.minutosConsumidos > 0 ? (a.minutosAV / mesActual.minutosConsumidos) * costoFijo : 0
    const costoP = c.asesores * costoPiso
    const pct = a.honorario > 0 ? (invAV / a.honorario) * 100 : 0
    // Corrección: redondear % de comisión para evitar floating point
    const comisionPct = parseFloat((c.honorarioPct * 100).toFixed(4))
    const pts = parseFloat((comisionPct * (pct / 100)).toFixed(4))
    const valorAV = calcularValorAV(c.nombre, c.clientes, c.asesores, a.minutosAV, a.llamadas, a.efectivas, a.promesas, a.honorario, invAV)
    // Datos del piso si existen
    const piso = mesActual.gestionesPiso?.[c.nombre] || null

    let semaforo = 'amarillo', motivo = '', accion = ''
    if (a.minutosAV === 0) { motivo = 'Sin minutos AV asignados.'; accion = 'Evaluar activación del AV.' }
    else if (a.honorario === 0) { motivo = `${a.minutosAV.toLocaleString()} min consumidos. Honorario pendiente.`; accion = 'Esperar cierre del mes.' }
    else if (pct < 10) { semaforo = 'verde'; motivo = `${pct.toFixed(1)}% del honorario al AV. Muy eficiente.`; accion = 'Mantener o aumentar minutos.' }
    else if (pct < 30) { semaforo = 'verde'; motivo = `${pct.toFixed(1)}% del honorario al AV. Rentable.`; accion = 'Mantener nivel de minutos.' }
    else if (pct < 60) { motivo = `${pct.toFixed(1)}% del honorario al AV. Margen ajustado.`; accion = 'Optimizar asignación de minutos.' }
    else { semaforo = 'rojo'; motivo = `${pct.toFixed(1)}% del honorario al AV. No rentable.`; accion = 'Reducir minutos y reasignar.' }

    return {
      nombre: c.nombre, clientes: c.clientes, asesores: c.asesores,
      comisionPct, minutosAV: a.minutosAV,
      promesas: a.promesas, llamadas: a.llamadas, efectivas: a.efectivas,
      inversionAV: Math.round(invAV * 100) / 100, costoPiso: costoP, masivos: c.masivos || 0,
      costoTotal: Math.round((invAV + costoP + (c.masivos || 0)) * 100) / 100,
      honorario: a.honorario, honorarioMesAnterior: honAnt,
      base: Math.round(base), delta: Math.round(a.honorario - base),
      retornoXBalboa: invAV > 0 && a.honorario > 0 ? parseFloat((a.honorario / invAV).toFixed(2)) : 0,
      pctHonorarioAlAV: parseFloat(pct.toFixed(2)),
      puntosComisionAlAV: pts,
      semaforo, motivo, accion,
      pctCobertura: a.llamadas > 0 ? parseFloat((a.llamadas / c.clientes * 100).toFixed(1)) : 0,
      valorAV,
      piso, // datos del piso si ya se cargaron
    }
  })

  const totalGest = carterasM.reduce((s: number, c: any) => s + c.llamadas, 0)
  const totalPiso = carterasM.reduce((s: number, c: any) => s + c.valorAV.gestionesPisoEstimadas, 0)
  const totalHoras = carterasM.reduce((s: number, c: any) => s + c.valorAV.tiempoLibeReadoHoras, 0)
  const pctHonAlAV = honorarioTotal > 0 ? (inversionAV / honorarioTotal) * 100 : 0

  return {
    mesActualIdx: mesIdx, estadoMes,
    mensajeEstado: estadoMes === 'minutos_sin_honorario'
      ? `El AV consumió ${mesActual.minutosConsumidos.toLocaleString()} min este mes. Honorario pendiente de cierre.`
      : estadoMes === 'vacio' ? 'Sin datos registrados para este mes.' : null,
    mesActual: {
      mes: mesActual.mes, label: mesActual.label,
      esMesActual: mesActual.esMesActual || false,
      nota: mesActual.nota || '',
      inversionAV, honorarioTotal, honorarioAnterior,
      deltaVsMesAnterior: deltaVsMes,
      incrementoVsBase: Math.round(incremento),
      roiMultiplo: parseFloat(roi.toFixed(2)),
      minutosConsumidos: mesActual.minutosConsumidos,
      sePaga: inversionAV > 0 ? incremento >= inversionAV : honorarioTotal > 0,
      pctHonorarioTotalAlAV: parseFloat(pctHonAlAV.toFixed(2)),
      costoXMinuto: mesActual.minutosConsumidos > 0 ? parseFloat((costoFijo / mesActual.minutosConsumidos).toFixed(3)) : 0,
      resumenValor: {
        carterasConValorEvidenciado: carterasM.filter((c: any) => c.valorAV.avAgregoValor && c.minutosAV > 0).length,
        totalGestionesAV: totalGest,
        totalGestionesPisoSinAV: totalPiso,
        pctIncrementoGestiones: totalPiso > 0 ? parseFloat(((totalGest / totalPiso) * 100).toFixed(1)) : 0,
        totalHorasLiberadas: parseFloat(totalHoras.toFixed(1)),
        advertenciaAtribucion: 'El incremento de honorario no puede atribuirse exclusivamente al AV. Lo verificable: el AV aumentó el volumen de gestiones y liberó tiempo de asesores.',
      }
    },
    carteras: carterasM,
    historico: historico.map((m: any) => ({
      mes: m.mes, label: m.label, nota: m.nota || '',
      inversionAV: m.avActivo && m.minutosConsumidos > 0 ? costoFijo : 0,
      honorarioTotal: m.honorarioTotal, avActivo: m.avActivo,
      minutosConsumidos: m.minutosConsumidos, esMesActual: m.esMesActual || false,
    })),
    bolsa, plan,
  }
}
