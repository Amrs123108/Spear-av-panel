// lib/data/calculadora.ts
// Lógica de negocio pura. Sin dependencias de UI ni de fuente de datos.
// Recibe datos crudos, devuelve métricas calculadas.

import { DashboardData, MetricaCarteraUI, ResumenMesUI, EstadoMes, SemaforoCarta } from '@/types'
import { ROL_POR_CARTERA } from '@/lib/valorAV'
import { COSTO_FIJO_MENSUAL_AV, COSTO_PISO_ASESOR } from '@/lib/store'
import { calcularSaldoBolsa } from '@/lib/bolsa'

const COSTO_HORA_ASESOR = COSTO_PISO_ASESOR / 176 // B/.8.52/hora

export function calcularMetricas(raw: any, mesIdxParam: number, fuente: 'blob' | 'local'): DashboardData {
  const { historico, plan } = raw
  const carteras = raw.configuracion?.carteras ?? []
  const costoFijo = raw.configuracion?.costoFijoMensualAV ?? COSTO_FIJO_MENSUAL_AV
  const costoPisoAsesor = raw.configuracion?.costoPisoAsesor ?? COSTO_PISO_ASESOR

  // ── Bolsa calculada determinísticamente desde el histórico real ─────
  // Nunca usa el saldo guardado en Blob — siempre recalcula desde cero.
  // Esto lo hace inmune a cargas duplicadas, resets o errores previos.
  const bolsa = calcularSaldoBolsa(historico, raw.bolsa)

  const mesIdx = mesIdxParam >= 0 && mesIdxParam < historico.length ? mesIdxParam : historico.length - 1
  const mesActual = historico[mesIdx]
  const mesAnterior = mesIdx > 0 ? historico[mesIdx - 1] : null

  // Base histórica sin AV por cartera (promedio de meses sin minutos)
  const bases: Record<string, number> = {}
  carteras.forEach((c: any) => {
    const vals = historico
      .filter((m: any) => (m.carteras[c.nombre]?.minutosAV ?? 0) === 0)
      .map((m: any) => m.carteras[c.nombre]?.honorario ?? 0)
      .filter((v: number) => v > 0)
    bases[c.nombre] = vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0
  })

  const tieneMinutos = mesActual.minutosConsumidos > 0
  const tieneHonorario = mesActual.honorarioTotal > 0
  const inversionAV = mesActual.avActivo && tieneMinutos ? costoFijo : 0
  const honorarioTotal = mesActual.honorarioTotal
  const honorarioAnterior = mesAnterior?.honorarioTotal ?? 0
  const deltaVsMes = honorarioTotal - honorarioAnterior
  const baseTotal = Object.values(bases).reduce((a: number, b: number) => a + b, 0)
  const incremento = honorarioTotal - baseTotal
  const roi = inversionAV > 0 && tieneHonorario ? incremento / inversionAV : 0

  const estadoMes: EstadoMes = mesActual.esMesActual ? 'en_curso'
    : tieneHonorario && tieneMinutos ? 'completo'
    : tieneMinutos ? 'minutos_sin_honorario' : 'vacio'

  // ── Métricas por cartera ────────────────────────────────────────────────────
  const carterasUI: MetricaCarteraUI[] = carteras.map((c: any) => {
    const a = mesActual.carteras[c.nombre] ?? { minutosAV: 0, honorario: 0, honorarioMesAnterior: 0, promesas: 0, llamadas: 0, efectivas: 0 }
    const piso = mesActual.gestionesPiso?.[c.nombre] ?? null
    const honAnt = a.honorarioMesAnterior || (mesAnterior?.carteras[c.nombre]?.honorario ?? 0)
    const base = bases[c.nombre] ?? 0
    const invAV = mesActual.minutosConsumidos > 0 ? (a.minutosAV / mesActual.minutosConsumidos) * costoFijo : 0
    const costoP = c.asesores * costoPisoAsesor
    const pct = a.honorario > 0 ? (invAV / a.honorario) * 100 : 0
    const comisionPct = parseFloat((c.honorarioPct * 100).toFixed(4))
    const pts = parseFloat((comisionPct * (pct / 100)).toFixed(4))

    // Rol del AV y métricas de liberación
    const rolConfig = ROL_POR_CARTERA[c.nombre] ?? { rol: 'volumen', descripcion: '', tareaRepetitiva: null, diasHabilesAsesor: 22, llamadasDiaAsesor: 70 }
    const horasLiberadas = rolConfig.rol === 'liberacion' ? a.minutosAV / 60 : 0
    const valorTiempoLiberado = horasLiberadas * COSTO_HORA_ASESOR

    // Gestiones totales
    const gestionesTotales = a.llamadas + (piso?.llamadas ?? 0)
    const coberturaTotalPct = c.clientes > 0 ? parseFloat(((gestionesTotales / c.clientes) * 100).toFixed(1)) : 0

    // Evidencia
    const evidencia: string[] = []
    if (a.llamadas > 0) evidencia.push(`AV realizó ${a.llamadas.toLocaleString('es-PA')} gestiones`)
    if (piso?.llamadas) evidencia.push(`Piso realizó ${piso.llamadas.toLocaleString('es-PA')} gestiones`)
    if (horasLiberadas > 0) evidencia.push(`${horasLiberadas.toFixed(1)} horas liberadas al asesor`)
    if (a.promesas > 0) evidencia.push(`${a.promesas} promesas generadas por el AV`)

    // Semáforo
    let semaforo: SemaforoCarta = 'amarillo'
    let motivo = '', accion = ''
    if (a.minutosAV === 0) { motivo = 'Sin minutos AV asignados.'; accion = 'Evaluar activación del AV.' }
    else if (a.honorario === 0) { motivo = `${a.minutosAV.toLocaleString()} min consumidos. Honorario pendiente.`; accion = 'Esperar cierre del mes.' }
    else if (pct < 10) { semaforo = 'verde'; motivo = `${pct.toFixed(1)}% del honorario al AV. Muy eficiente.`; accion = 'Mantener o aumentar minutos.' }
    else if (pct < 30) { semaforo = 'verde'; motivo = `${pct.toFixed(1)}% del honorario al AV. Rentable.`; accion = 'Mantener nivel de minutos.' }
    else if (pct < 60) { motivo = `${pct.toFixed(1)}% del honorario al AV. Margen ajustado.`; accion = 'Optimizar asignación de minutos.' }
    else { semaforo = 'rojo'; motivo = `${pct.toFixed(1)}% del honorario al AV. No rentable.`; accion = 'Reducir minutos y reasignar.' }

    return {
      // Identificación
      nombre: c.nombre, clientes: c.clientes, asesores: c.asesores,
      comisionPct, masivos: c.masivos ?? 0,
      // AV
      minutosAV: a.minutosAV, llamadasAV: a.llamadas,
      efectivasAV: a.efectivas, promesasAV: a.promesas, montoAV: 0,
      // Piso
      llamadasPiso: piso?.llamadas ?? 0, efectivasPiso: piso?.efectivas ?? 0,
      promesasPiso: piso?.promesas ?? 0, montoPiso: piso?.montoPrometido ?? 0,
      tiempoPromedioMinPiso: piso?.tiempoPromedioMin ?? 0,
      asesoresActivos: piso?.totalAsesores ?? c.asesores,
      // Financiero
      honorario: a.honorario, honorarioMesAnterior: honAnt,
      inversionAV: Math.round(invAV * 100) / 100,
      costoPiso: costoP, costoTotal: Math.round((invAV + costoP + (c.masivos ?? 0)) * 100) / 100,
      base: Math.round(base), delta: Math.round(a.honorario - base),
      pctHonorarioAlAV: parseFloat(pct.toFixed(2)),
      puntosComisionAlAV: pts,
      retornoXBalboa: invAV > 0 && a.honorario > 0 ? parseFloat((a.honorario / invAV).toFixed(2)) : 0,
      pctCobertura: a.llamadas > 0 ? parseFloat((a.llamadas / c.clientes * 100).toFixed(1)) : 0,
      // Métricas combinadas
      gestionesTotales, coberturaTotalPct,
      // Análisis AV
      semaforo, motivo, accion,
      rolAV: rolConfig.rol,
      descripcionRolAV: rolConfig.descripcion,
      evidenciaAV: evidencia,
      horasLiberadas: parseFloat(horasLiberadas.toFixed(1)),
      valorTiempoLiberado: parseFloat(valorTiempoLiberado.toFixed(2)),
    }
  })

  // ── Resumen del mes ─────────────────────────────────────────────────────────
  const totalGestAV = carterasUI.reduce((s, c) => s + c.llamadasAV, 0)
  const totalGestPiso = carterasUI.reduce((s, c) => s + c.llamadasPiso, 0)
  const totalHoras = carterasUI.reduce((s, c) => s + c.horasLiberadas, 0)
  const pctHonAlAV = honorarioTotal > 0 ? (inversionAV / honorarioTotal) * 100 : 0

  const mesActualUI: ResumenMesUI = {
    mes: mesActual.mes, label: mesActual.label,
    esMesActual: mesActual.esMesActual ?? false,
    nota: mesActual.nota ?? '',
    inversionAV, honorarioTotal, honorarioAnterior,
    deltaVsMesAnterior: deltaVsMes,
    incrementoVsBase: Math.round(incremento),
    roiMultiplo: parseFloat(roi.toFixed(2)),
    minutosConsumidos: mesActual.minutosConsumidos,
    sePaga: inversionAV > 0 ? incremento >= inversionAV : honorarioTotal > 0,
    pctHonorarioTotalAlAV: parseFloat(pctHonAlAV.toFixed(2)),
    costoXMinuto: mesActual.minutosConsumidos > 0 ? parseFloat((costoFijo / mesActual.minutosConsumidos).toFixed(3)) : 0,
    totalGestionesAV: totalGestAV,
    totalGestionesPiso: totalGestPiso,
    totalHorasLiberadas: parseFloat(totalHoras.toFixed(1)),
    carterasConValor: carterasUI.filter(c => c.semaforo === 'verde' && c.minutosAV > 0).length,
  }

  return {
    ok: true,
    fuenteDatos: fuente,
    estadoMes,
    mensajeEstado: estadoMes === 'minutos_sin_honorario'
      ? `El AV consumió ${mesActual.minutosConsumidos.toLocaleString('es-PA')} minutos. Honorario pendiente de cierre.`
      : estadoMes === 'vacio' ? 'Sin datos para este mes.' : null,
    mesActualIdx: mesIdx,
    mesActual: mesActualUI,
    carteras: carterasUI,
    historico: historico.map((m: any) => ({
      mes: m.mes, label: m.label, nota: m.nota ?? '',
      inversionAV: m.avActivo && m.minutosConsumidos > 0 ? costoFijo : 0,
      honorarioTotal: m.honorarioTotal, avActivo: m.avActivo,
      minutosConsumidos: m.minutosConsumidos, esMesActual: m.esMesActual ?? false,
    })),
    bolsa,
    plan,
    // Productividad por asesor — guardada por el procesador de Sigella
    productividadAsesores: mesActual.productividadAsesores || [],
  }
}
