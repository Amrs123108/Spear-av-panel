import { NextResponse } from 'next/server'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL, COSTO_FIJO_MENSUAL_AV, COSTO_PISO_ASESOR, MesData } from '@/lib/store'

// La API ahora puede recibir un mes específico via POST con datos editados del cliente
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const mesSeleccionadoIdx = body.mesIdx as number | undefined
    const mesActualEditado = body.mesActualEditado as MesData | undefined

    // Construir histórico — si vino un mes editado, reemplazar el último
    let historico = [...HISTORICO_INICIAL]
    if (mesActualEditado) {
      const idxActual = historico.findIndex(m => m.esMesActual)
      if (idxActual >= 0) historico[idxActual] = mesActualEditado
    }

    // Mes a analizar (por defecto el último/mes actual)
    const idxAnalisis = mesSeleccionadoIdx !== undefined && mesSeleccionadoIdx >= 0 && mesSeleccionadoIdx < historico.length
      ? mesSeleccionadoIdx
      : historico.length - 1

    const mesActual = historico[idxAnalisis]
    const mesAnterior = idxAnalisis > 0 ? historico[idxAnalisis - 1] : null

    return procesarDatos(historico, mesActual, mesAnterior, idxAnalisis)
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// GET para carga inicial
export async function GET() {
  try {
    const historico = HISTORICO_INICIAL
    const idxAnalisis = historico.length - 1
    const mesActual = historico[idxAnalisis]
    const mesAnterior = idxAnalisis > 0 ? historico[idxAnalisis - 1] : null
    return procesarDatos(historico, mesActual, mesAnterior, idxAnalisis)
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

function procesarDatos(historico: MesData[], mesActual: MesData, mesAnterior: MesData | null, idxAnalisis: number) {
  // Base sin AV por cartera (promedio de meses sin AV)
  const basesPorCartera: Record<string, number> = {}
  CARTERAS_CONFIG.forEach(c => {
    const mesesSinAV = historico.filter(m =>
      m.avActivo === false || (m.carteras[c.nombre]?.minutosAV || 0) === 0
    )
    const vals = mesesSinAV
      .map(m => m.carteras[c.nombre]?.honorario || 0)
      .filter(v => v > 0)
    basesPorCartera[c.nombre] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })

  // Inversión AV es siempre B/.4,000 fijos (si AV está activo y tiene consumo)
  const tieneConsumo = mesActual.minutosConsumidos > 0
  const inversionAVTotal = mesActual.avActivo && tieneConsumo ? COSTO_FIJO_MENSUAL_AV : 0

  const honorarioTotal = mesActual.honorarioTotal
  const honorarioAnterior = mesAnterior?.honorarioTotal || 0
  const deltaVsMesAnterior = honorarioTotal - honorarioAnterior

  const baseTotal = Object.values(basesPorCartera).reduce((a, b) => a + b, 0)
  const incrementoVsBase = honorarioTotal - baseTotal
  const roiMultiplo = inversionAVTotal > 0 ? incrementoVsBase / inversionAVTotal : 0

  const carterasConMetricas = CARTERAS_CONFIG.map(c => {
    const actual = mesActual.carteras[c.nombre] || { minutosAV: 0, honorario: 0, honorarioMesAnterior: 0, promesas: 0, llamadas: 0, efectivas: 0 }
    const base = basesPorCartera[c.nombre] || 0
    const honorarioMesAnt = actual.honorarioMesAnterior || (mesAnterior?.carteras[c.nombre]?.honorario || 0)

    const inversionAV = mesActual.minutosConsumidos > 0
      ? (actual.minutosAV / mesActual.minutosConsumidos) * COSTO_FIJO_MENSUAL_AV
      : 0

    const costoPiso = c.asesores * COSTO_PISO_ASESOR
    const pctHonorarioAlAV = actual.honorario > 0 ? (inversionAV / actual.honorario) * 100 : 0
    const puntosComisionAlAV = c.honorarioPct * 100 * (pctHonorarioAlAV / 100)
    const delta = base > 0 ? actual.honorario - base : 0
    const retornoXBalboa = inversionAV > 0 ? actual.honorario / inversionAV : 0

    let semaforo: 'verde' | 'amarillo' | 'rojo' = 'amarillo'
    let motivo = ''
    let accion = ''

    if (actual.minutosAV === 0) {
      semaforo = 'amarillo'
      motivo = 'Sin minutos AV asignados este mes.'
      accion = 'Evaluar si la cartera amerita activación del AV.'
    } else if (actual.honorario === 0) {
      semaforo = 'amarillo'
      motivo = `${actual.minutosAV.toLocaleString()} minutos consumidos. Aún sin honorario registrado.`
      accion = 'Esperar cierre del mes para evaluar.'
    } else if (pctHonorarioAlAV < 10) {
      semaforo = 'verde'
      motivo = `Solo el ${pctHonorarioAlAV.toFixed(1)}% del honorario se destinó al AV. Inversión muy eficiente.`
      accion = 'Mantener o aumentar minutos. Cartera con alto retorno.'
    } else if (pctHonorarioAlAV < 30) {
      semaforo = 'verde'
      motivo = `El ${pctHonorarioAlAV.toFixed(1)}% del honorario se destinó al AV. Inversión rentable.`
      accion = 'Mantener nivel de minutos actual.'
    } else if (pctHonorarioAlAV < 60) {
      semaforo = 'amarillo'
      motivo = `El ${pctHonorarioAlAV.toFixed(1)}% del honorario se está destinando al AV. Margen ajustado.`
      accion = 'Optimizar asignación de minutos.'
    } else {
      semaforo = 'rojo'
      motivo = `El ${pctHonorarioAlAV.toFixed(1)}% del honorario se destina al AV. Inversión no rentable.`
      accion = 'Reducir minutos y reasignar a carteras de mayor retorno.'
    }

    return {
      nombre: c.nombre,
      clientes: c.clientes,
      asesores: c.asesores,
      comisionPct: c.honorarioPct * 100,
      minutosAV: actual.minutosAV,
      promesas: actual.promesas,
      llamadas: actual.llamadas,
      efectivas: actual.efectivas,
      inversionAV: Math.round(inversionAV * 100) / 100,
      costoPiso,
      masivos: c.masivos,
      costoTotal: Math.round((inversionAV + costoPiso + c.masivos) * 100) / 100,
      honorario: actual.honorario,
      honorarioMesAnterior: honorarioMesAnt,
      base: Math.round(base),
      delta: Math.round(delta),
      retornoXBalboa: parseFloat(retornoXBalboa.toFixed(2)),
      pctHonorarioAlAV: parseFloat(pctHonorarioAlAV.toFixed(2)),
      puntosComisionAlAV: parseFloat(puntosComisionAlAV.toFixed(2)),
      semaforo,
      motivo,
      accion,
      pctCobertura: actual.llamadas > 0 ? parseFloat((actual.llamadas / c.clientes * 100).toFixed(1)) : 0,
    }
  })

  const inversionAsignada = carterasConMetricas.reduce((s, c) => s + c.inversionAV, 0)
  const pctHonorarioTotalAlAV = honorarioTotal > 0 ? (inversionAVTotal / honorarioTotal) * 100 : 0

  return NextResponse.json({
    ok: true,
    mesActualIdx: idxAnalisis,
    mesActual: {
      mes: mesActual.mes,
      label: mesActual.label,
      esMesActual: mesActual.esMesActual || false,
      inversionAV: inversionAVTotal,
      inversionAsignada: Math.round(inversionAsignada),
      honorarioTotal,
      honorarioAnterior,
      deltaVsMesAnterior,
      incrementoVsBase: Math.round(incrementoVsBase),
      roiMultiplo: parseFloat(roiMultiplo.toFixed(2)),
      minutosConsumidos: mesActual.minutosConsumidos,
      sePaga: incrementoVsBase >= inversionAVTotal,
      pctHonorarioTotalAlAV: parseFloat(pctHonorarioTotalAlAV.toFixed(2)),
      costoXMinuto: mesActual.minutosConsumidos > 0
        ? parseFloat((COSTO_FIJO_MENSUAL_AV / mesActual.minutosConsumidos).toFixed(3))
        : 0,
    },
    carteras: carterasConMetricas,
    historico: historico.map(m => ({
      mes: m.mes,
      label: m.label,
      inversionAV: m.avActivo && m.minutosConsumidos > 0 ? COSTO_FIJO_MENSUAL_AV : 0,
      honorarioTotal: m.honorarioTotal,
      avActivo: m.avActivo,
      minutosConsumidos: m.minutosConsumidos,
      esMesActual: m.esMesActual || false,
    })),
    bolsa: BOLSA_INICIAL,
  })
}
