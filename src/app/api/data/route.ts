import { NextResponse } from 'next/server'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL, COSTO_FIJO_MENSUAL_AV, COSTO_PISO_ASESOR, MesData } from '@/lib/store'
import { calcularValorAV, ROL_POR_CARTERA } from '@/lib/valorAV'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const mesIdx = body.mesIdx as number | undefined
    const mesEditado = body.mesActualEditado as MesData | undefined

    let historico = [...HISTORICO_INICIAL]
    if (mesEditado) {
      const idx = historico.findIndex(m => m.esMesActual)
      if (idx >= 0) historico[idx] = mesEditado
    }
    const idxAnalisis = mesIdx !== undefined ? Math.min(Math.max(mesIdx, 0), historico.length - 1) : historico.length - 1
    const mesActual = historico[idxAnalisis]
    const mesAnterior = idxAnalisis > 0 ? historico[idxAnalisis - 1] : null
    return procesarDatos(historico, mesActual, mesAnterior, idxAnalisis)
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  const historico = HISTORICO_INICIAL
  const idxAnalisis = historico.length - 1
  return procesarDatos(historico, historico[idxAnalisis], historico[idxAnalisis - 1], idxAnalisis)
}

function procesarDatos(historico: MesData[], mesActual: MesData, mesAnterior: MesData | null, idxAnalisis: number) {
  // Base sin AV por cartera
  const bases: Record<string, number> = {}
  CARTERAS_CONFIG.forEach(c => {
    const sinAV = historico.filter(m => (m.carteras[c.nombre]?.minutosAV || 0) === 0)
    const vals = sinAV.map(m => m.carteras[c.nombre]?.honorario || 0).filter(v => v > 0)
    bases[c.nombre] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })

  const tieneHonorario = mesActual.honorarioTotal > 0
  const tieneMinutos = mesActual.minutosConsumidos > 0
  const inversionAV = mesActual.avActivo && tieneMinutos ? COSTO_FIJO_MENSUAL_AV : 0

  const honorarioTotal = mesActual.honorarioTotal
  const honorarioAnterior = mesAnterior?.honorarioTotal || 0
  const deltaVsMesAnterior = honorarioTotal - honorarioAnterior
  const baseTotal = Object.values(bases).reduce((a, b) => a + b, 0)
  const incrementoVsBase = honorarioTotal - baseTotal
  const roiMultiplo = inversionAV > 0 && tieneHonorario ? incrementoVsBase / inversionAV : 0

  // Estado del mes para comunicación al directivo
  const estadoMes: 'completo' | 'minutos_sin_honorario' | 'vacio' | 'en_curso' =
    mesActual.esMesActual ? 'en_curso' :
    tieneHonorario && tieneMinutos ? 'completo' :
    tieneMinutos && !tieneHonorario ? 'minutos_sin_honorario' : 'vacio'

  const mensajeEstado = {
    completo: null,
    minutos_sin_honorario: `El AV consumió ${mesActual.minutosConsumidos.toLocaleString('es-PA')} minutos (inversión asignada: B/.${COSTO_FIJO_MENSUAL_AV.toLocaleString()}). El honorario de este mes aún no ha cerrado — cuando esté disponible, ingrésalo para ver el análisis completo.`,
    vacio: 'Sin datos de minutos ni honorario registrados para este mes.',
    en_curso: 'Mes en curso. Los datos se actualizan conforme avanza el mes.',
  }[estadoMes]

  const carteras = CARTERAS_CONFIG.map(c => {
    const actual = mesActual.carteras[c.nombre] || { minutosAV: 0, honorario: 0, honorarioMesAnterior: 0, promesas: 0, llamadas: 0, efectivas: 0 }
    const honAnt = actual.honorarioMesAnterior || (mesAnterior?.carteras[c.nombre]?.honorario || 0)
    const base = bases[c.nombre] || 0
    const invAV = mesActual.minutosConsumidos > 0 ? (actual.minutosAV / mesActual.minutosConsumidos) * COSTO_FIJO_MENSUAL_AV : 0
    const costoPiso = c.asesores * COSTO_PISO_ASESOR
    const pctHonAlAV = actual.honorario > 0 ? (invAV / actual.honorario) * 100 : 0
    const puntosComision = c.honorarioPct * 100 * (pctHonAlAV / 100)

    // NUEVO: métricas de valor del AV
    const valorAV = calcularValorAV(
      c.nombre, c.clientes, c.asesores,
      actual.minutosAV, actual.llamadas, actual.efectivas, actual.promesas,
      actual.honorario, invAV
    )

    // Semáforo
    let semaforo: 'verde' | 'amarillo' | 'rojo' = 'amarillo'
    let motivo = ''; let accion = ''

    if (actual.minutosAV === 0) {
      semaforo = 'amarillo'; motivo = 'Sin minutos AV asignados este mes.'
      accion = 'Evaluar si la cartera amerita activación del AV.'
    } else if (actual.honorario === 0) {
      semaforo = 'amarillo'
      motivo = `${actual.minutosAV.toLocaleString()} min consumidos. ${valorAV.avAgregoValor ? 'El AV sí agregó valor operativo (ver detalle). ' : ''}Honorario pendiente de cierre.`
      accion = 'Esperar cierre del mes para evaluar retorno financiero.'
    } else if (pctHonAlAV < 10) {
      semaforo = 'verde'; motivo = `Solo el ${pctHonAlAV.toFixed(1)}% del honorario se destinó al AV. Inversión muy eficiente.`
      accion = 'Mantener o aumentar minutos. Cartera con alto retorno.'
    } else if (pctHonAlAV < 30) {
      semaforo = 'verde'; motivo = `El ${pctHonAlAV.toFixed(1)}% del honorario se destinó al AV. Inversión rentable.`
      accion = 'Mantener nivel de minutos actual.'
    } else if (pctHonAlAV < 60) {
      semaforo = 'amarillo'; motivo = `El ${pctHonAlAV.toFixed(1)}% del honorario al AV. Margen ajustado.`
      accion = 'Optimizar asignación de minutos.'
    } else {
      semaforo = 'rojo'; motivo = `El ${pctHonAlAV.toFixed(1)}% del honorario al AV. Inversión no rentable.`
      accion = 'Reducir minutos y reasignar a carteras de mayor retorno.'
    }

    return {
      nombre: c.nombre, clientes: c.clientes, asesores: c.asesores,
      comisionPct: c.honorarioPct * 100, minutosAV: actual.minutosAV,
      promesas: actual.promesas, llamadas: actual.llamadas, efectivas: actual.efectivas,
      inversionAV: Math.round(invAV * 100) / 100, costoPiso, masivos: c.masivos,
      costoTotal: Math.round((invAV + costoPiso + c.masivos) * 100) / 100,
      honorario: actual.honorario, honorarioMesAnterior: honAnt,
      base: Math.round(base), delta: Math.round(actual.honorario - base),
      retornoXBalboa: invAV > 0 && actual.honorario > 0 ? parseFloat((actual.honorario / invAV).toFixed(2)) : 0,
      pctHonorarioAlAV: parseFloat(pctHonAlAV.toFixed(2)),
      puntosComisionAlAV: parseFloat(puntosComision.toFixed(3)),
      semaforo, motivo, accion,
      pctCobertura: actual.llamadas > 0 ? parseFloat((actual.llamadas / c.clientes * 100).toFixed(1)) : 0,
      valorAV, // NUEVO
    }
  })

  const pctHonTotalAlAV = honorarioTotal > 0 ? (inversionAV / honorarioTotal) * 100 : 0

  // Resumen de valor agregado para el directivo
  const carterasConValor = carteras.filter(c => c.valorAV.avAgregoValor && c.minutosAV > 0).length
  const carterasSinDatos = carteras.filter(c => c.minutosAV > 0 && !c.valorAV.avAgregoValor).length
  const totalGestionesAV = carteras.reduce((s, c) => s + c.llamadas, 0)
  const totalGestionesPiso = carteras.reduce((s, c) => s + c.valorAV.gestionesPisoEstimadas, 0)
  const totalHorasLiberadas = carteras.reduce((s, c) => s + c.valorAV.tiempoLibeReadoHoras, 0)

  return NextResponse.json({
    ok: true,
    mesActualIdx: idxAnalisis,
    estadoMes,
    mensajeEstado,
    mesActual: {
      mes: mesActual.mes, label: mesActual.label, esMesActual: mesActual.esMesActual || false,
      inversionAV, honorarioTotal, honorarioAnterior, deltaVsMesAnterior,
      incrementoVsBase: Math.round(incrementoVsBase),
      roiMultiplo: parseFloat(roiMultiplo.toFixed(2)),
      minutosConsumidos: mesActual.minutosConsumidos,
      sePaga: inversionAV > 0 ? incrementoVsBase >= inversionAV : honorarioTotal > 0,
      pctHonorarioTotalAlAV: parseFloat(pctHonTotalAlAV.toFixed(2)),
      costoXMinuto: mesActual.minutosConsumidos > 0 ? parseFloat((COSTO_FIJO_MENSUAL_AV / mesActual.minutosConsumidos).toFixed(3)) : 0,
      // Resumen de valor operativo
      resumenValor: {
        carterasConValorEvidenciado: carterasConValor,
        totalGestionesAV,
        totalGestionesPisoSinAV: totalGestionesPiso,
        pctIncrementoGestiones: totalGestionesPiso > 0 ? parseFloat(((totalGestionesAV / totalGestionesPiso) * 100).toFixed(1)) : 0,
        totalHorasLiberadas: parseFloat(totalHorasLiberadas.toFixed(1)),
        advertenciaAtribucion: 'El incremento de honorario no puede atribuirse exclusivamente al AV. Lo que sí es verificable: el AV aumentó el volumen de gestiones y liberó tiempo de asesores.',
      }
    },
    carteras,
    historico: historico.map(m => ({
      mes: m.mes, label: m.label,
      inversionAV: m.avActivo && m.minutosConsumidos > 0 ? COSTO_FIJO_MENSUAL_AV : 0,
      honorarioTotal: m.honorarioTotal, avActivo: m.avActivo,
      minutosConsumidos: m.minutosConsumidos, esMesActual: m.esMesActual || false,
    })),
    bolsa: BOLSA_INICIAL,
  })
}
