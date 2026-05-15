import { NextResponse } from 'next/server'
import { HISTORICO_INICIAL, CARTERAS_CONFIG, BOLSA_INICIAL } from '@/lib/store'

// En producción usaríamos una BD real
// Por ahora usamos storage de Vercel KV o los datos iniciales
export async function GET() {
  try {
    // Calcular métricas del mes actual (el más reciente)
    const historico = HISTORICO_INICIAL
    const mesActual = historico[historico.length - 1]
    const mesAnterior = historico[historico.length - 2]

    // Base sin AV (promedio de meses sin AV por cartera)
    const basesPorCartera: Record<string, number> = {}
    CARTERAS_CONFIG.forEach(c => {
      const mesesSinAV = historico.filter(m => m.avActivo === false || (m.carteras[c.nombre]?.minutosAV || 0) === 0)
      const vals = mesesSinAV.map(m => m.carteras[c.nombre]?.honorario || 0).filter(v => v > 0)
      basesPorCartera[c.nombre] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    })

    // ROI y métricas globales
    const inversionTotal = mesActual.inversionAV + CARTERAS_CONFIG.reduce((s, c) => s + c.masivos, 0)
    const honorarioTotal = mesActual.honorarioTotal
    const honorarioAnterior = mesAnterior?.honorarioTotal || 0
    const deltaVsMesAnterior = honorarioTotal - honorarioAnterior
    const incrementoVsBase = honorarioTotal - Object.values(basesPorCartera).reduce((a, b) => a + b, 0)
    const roiMultiplo = mesActual.inversionAV > 0 ? incrementoVsBase / mesActual.inversionAV : 0

    // Datos por cartera con diagnóstico
    const carterasConMetricas = CARTERAS_CONFIG.map(c => {
      const actual = mesActual.carteras[c.nombre] || { minutosAV: 0, honorario: 0, honorarioMesAnterior: 0, promesas: 0, llamadas: 0, efectivas: 0 }
      const base = basesPorCartera[c.nombre] || 0
      const costoAV = actual.minutosAV > 0
        ? (actual.minutosAV * 0.285) + (actual.minutosAV / mesActual.minutosConsumidos) * 4000
        : 0
      const costoPiso = c.asesores * 1500
      const delta = base > 0 ? actual.honorario - base : 0
      const retornoXBalboa = costoAV > 0 ? actual.honorario / costoAV : 0

      // Semáforo
      let semaforo: 'verde' | 'amarillo' | 'rojo' = 'amarillo'
      let motivo = ''
      let accion = ''

      if (actual.minutosAV === 0) {
        semaforo = 'amarillo'; motivo = 'Sin minutos AV asignados este mes'; accion = 'Evaluar si vale la pena activar el AV'
      } else if (retornoXBalboa >= 3) {
        semaforo = 'verde'; motivo = `El AV genera B/.${retornoXBalboa.toFixed(2)} por cada B/.1 invertido`; accion = 'Mantener o aumentar minutos'
      } else if (retornoXBalboa >= 1) {
        semaforo = 'amarillo'; motivo = `El AV se paga pero con margen ajustado (${retornoXBalboa.toFixed(2)}x)`; accion = 'Optimizar asignación de minutos'
      } else if (costoAV > 0) {
        semaforo = 'rojo'; motivo = `El AV cuesta más de lo que genera (${retornoXBalboa.toFixed(2)}x)`; accion = 'Reducir minutos y reasignar a carteras rentables'
      }

      return {
        nombre: c.nombre,
        clientes: c.clientes,
        asesores: c.asesores,
        minutosAV: actual.minutosAV,
        promesas: actual.promesas,
        llamadas: actual.llamadas,
        efectivas: actual.efectivas,
        costoAV: Math.round(costoAV),
        costoPiso,
        masivos: c.masivos,
        costoTotal: Math.round(costoAV + costoPiso + c.masivos),
        honorario: actual.honorario,
        honorarioMesAnterior: actual.honorarioMesAnterior || (mesAnterior?.carteras[c.nombre]?.honorario || 0),
        base: Math.round(base),
        delta: Math.round(delta),
        retornoXBalboa: parseFloat(retornoXBalboa.toFixed(2)),
        semaforo,
        motivo,
        accion,
        pctCobertura: actual.llamadas > 0 ? parseFloat((actual.llamadas / c.clientes * 100).toFixed(1)) : 0,
      }
    })

    return NextResponse.json({
      ok: true,
      mesActual: {
        label: mesActual.label,
        inversionAV: mesActual.inversionAV,
        honorarioTotal,
        honorarioAnterior,
        deltaVsMesAnterior,
        incrementoVsBase: Math.round(incrementoVsBase),
        roiMultiplo: parseFloat(roiMultiplo.toFixed(2)),
        minutosConsumidos: mesActual.minutosConsumidos,
        sePaga: incrementoVsBase >= mesActual.inversionAV,
      },
      carteras: carterasConMetricas,
      historico: historico.map(m => ({
        mes: m.mes,
        label: m.label,
        inversionAV: m.inversionAV,
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
