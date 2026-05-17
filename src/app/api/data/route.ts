import { NextResponse } from 'next/server'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL, COSTO_FIJO_MENSUAL_AV, COSTO_PISO_ASESOR } from '@/lib/store'

export async function GET() {
  try {
    const historico = HISTORICO_INICIAL
    const mesActual = historico[historico.length - 1]
    const mesAnterior = historico[historico.length - 2]

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

    // INVERSIÓN AV DEL MES: siempre B/.4,000 (fijo)
    const inversionAVTotal = COSTO_FIJO_MENSUAL_AV
    const honorarioTotal = mesActual.honorarioTotal
    const honorarioAnterior = mesAnterior?.honorarioTotal || 0
    const deltaVsMesAnterior = honorarioTotal - honorarioAnterior

    // Incremento vs base histórica
    const baseTotal = Object.values(basesPorCartera).reduce((a, b) => a + b, 0)
    const incrementoVsBase = honorarioTotal - baseTotal
    const roiMultiplo = inversionAVTotal > 0 ? incrementoVsBase / inversionAVTotal : 0

    // PROCESAR CARTERAS con la lógica NUEVA
    const carterasConMetricas = CARTERAS_CONFIG.map(c => {
      const actual = mesActual.carteras[c.nombre] || { minutosAV: 0, honorario: 0, honorarioMesAnterior: 0, promesas: 0, llamadas: 0, efectivas: 0 }
      const base = basesPorCartera[c.nombre] || 0
      const honorarioMesAnt = actual.honorarioMesAnterior || (mesAnterior?.carteras[c.nombre]?.honorario || 0)

      // INVERSIÓN AV EN LA CARTERA: prorrateo de los B/.4,000 según minutos consumidos
      // Si la cartera usó 1,490 min de 7,245 totales → su inversión = (1,490/7,245) × 4,000 = B/.823
      const inversionAV = mesActual.minutosConsumidos > 0
        ? (actual.minutosAV / mesActual.minutosConsumidos) * COSTO_FIJO_MENSUAL_AV
        : 0

      const costoPiso = c.asesores * COSTO_PISO_ASESOR

      // % del honorario que se destinó al AV
      // Ejemplo: honorario B/.15,000, inversión AV B/.1,500 → 10% del honorario fue al AV
      const pctHonorarioAlAV = actual.honorario > 0 ? (inversionAV / actual.honorario) * 100 : 0

      // % de la comisión del cliente que se va al AV
      // Ejemplo: cartera con 10% de honorario, si AV consume 1% → 10% del honorario destinado al AV
      // significa que de los 10 puntos de comisión, 1 punto (10% de 10%) se va al AV
      const puntosComisionAlAV = c.honorarioPct * 100 * (pctHonorarioAlAV / 100)

      const delta = base > 0 ? actual.honorario - base : 0
      const retornoXBalboa = inversionAV > 0 ? actual.honorario / inversionAV : 0

      // Semáforo basado en % del honorario destinado al AV
      // < 30% del honorario al AV → muy rentable (verde)
      // 30-60% → razonable (amarillo)
      // > 60% → no rentable (rojo)
      let semaforo: 'verde' | 'amarillo' | 'rojo' = 'amarillo'
      let motivo = ''
      let accion = ''

      if (actual.minutosAV === 0) {
        semaforo = 'amarillo'
        motivo = 'Sin minutos AV asignados este mes.'
        accion = 'Evaluar si la cartera amerita activación del AV.'
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

    // Total inversión asignada vs costo fijo
    const inversionAsignada = carterasConMetricas.reduce((s, c) => s + c.inversionAV, 0)
    const pctHonorarioTotalAlAV = honorarioTotal > 0 ? (inversionAVTotal / honorarioTotal) * 100 : 0

    return NextResponse.json({
      ok: true,
      mesActual: {
        label: mesActual.label,
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
        inversionAV: m.avActivo ? COSTO_FIJO_MENSUAL_AV : 0,
        honorarioTotal: m.honorarioTotal,
        avActivo: m.avActivo,
        minutosConsumidos: m.minutosConsumidos,
      })),
      bolsa: BOLSA_INICIAL,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
