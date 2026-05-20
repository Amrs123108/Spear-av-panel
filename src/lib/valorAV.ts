// valorAV.ts
// Marco de valorización del AV — 3 formas de agregar valor

export type RolAV = 
  | 'volumen'      // AV llama a clientes que el piso no alcanza — cobertura adicional
  | 'liberacion'   // AV hace tareas repetitivas (recordatorios) y libera al asesor para negociar
  | 'mixto'        // Combinación de ambos
  | 'ninguno'      // Sin minutos AV asignados

export interface MetricaValorAV {
  rol: RolAV
  descripcionRol: string
  // Métrica 1: Volumen adicional
  gestionesAV: number          // llamadas realizadas por el AV
  gestionesPisoEstimadas: number // llamadas que haría el piso solo (ases × días × ~12 llamadas/día)
  pctCoberturaSinAV: number    // % cartera que cubriría el piso solo
  pctCoberturaConAV: number    // % cartera que cubre con el AV
  volumenAdicional: number     // gestiones extra que el AV aportó
  // Métrica 2: Liberación del asesor
  minutosAVenRepetitivas: number // minutos que el AV hizo tareas de bajo valor
  tiempoLibeReadoHoras: number   // horas que el asesor recuperó
  valorTiempoLiberado: number    // B/. del tiempo liberado (horas × costo hora asesor)
  // Métrica 3: Conversión comparativa
  tasaConversionAV: number      // efectivas/llamadas del AV
  tasaConversionPiso: number    // promesas/llamadas estimadas del piso (histórico)
  // Veredicto de valor
  avAgregoValor: boolean
  evidencia: string[]           // puntos concretos de evidencia
  limitacion: string            // la honestidad sobre lo que NO podemos afirmar
}

// Configuración del rol de cada cartera
export const ROL_POR_CARTERA: Record<string, {
  rol: RolAV
  descripcion: string
  tareaRepetitiva: string | null
  diasHabilesAsesor: number
  llamadasDiaAsesor: number
}> = {
  "BANISTMO ACTIVA": {
    rol: 'volumen',
    descripcion: 'Cartera activa grande. El AV amplía la cobertura de contacto diaria que los 13 asesores no alcanzan físicamente.',
    tareaRepetitiva: null,
    diasHabilesAsesor: 22,
    llamadasDiaAsesor: 80,
  },
  "BANISTMO RECOVERY": {
    rol: 'volumen',
    descripcion: 'Cartera castigada. El AV hace el primer contacto masivo y filtra quién responde, evitando que el asesor pierda tiempo en llamadas sin respuesta.',
    tareaRepetitiva: null,
    diasHabilesAsesor: 22,
    llamadasDiaAsesor: 60,
  },
  "SURA": {
    rol: 'liberacion',
    descripcion: 'El AV se encarga de los recordatorios de promesas de pago. Tarea repetitiva y de alto volumen que liberó tiempo al asesor para negociar nuevas promesas.',
    tareaRepetitiva: 'Recordatorio de promesas de pago — llamadas que confirman compromisos ya existentes',
    diasHabilesAsesor: 22,
    llamadasDiaAsesor: 90,
  },
  "TIGO": {
    rol: 'volumen',
    descripcion: 'Cartera de 14,000 clientes con comisión baja. El AV cubre el volumen de contacto, pero la economía de la cartera limita el retorno.',
    tareaRepetitiva: null,
    diasHabilesAsesor: 22,
    llamadasDiaAsesor: 80,
  },
  "KREDIYA": {
    rol: 'volumen',
    descripcion: 'Cartera masiva de 50,000 clientes con ticket bajo. El AV da cobertura que el piso nunca podría, pero el honorario por contacto no cubre el costo.',
    tareaRepetitiva: null,
    diasHabilesAsesor: 22,
    llamadasDiaAsesor: 70,
  },
  "BAC RECOVERY": {
    rol: 'volumen',
    descripcion: 'Cartera castigada. El AV identifica los segmentos que responden, permitiendo al asesor focalizarse en los casos con mayor probabilidad de pago.',
    tareaRepetitiva: null,
    diasHabilesAsesor: 22,
    llamadasDiaAsesor: 60,
  },
  "SOLVE": {
    rol: 'liberacion',
    descripcion: 'El AV maneja el primer contacto masivo en cartera 100% castigada. El asesor solo interviene cuando hay respuesta, multiplicando su efectividad.',
    tareaRepetitiva: 'Primer contacto y seguimiento inicial en cartera castigada',
    diasHabilesAsesor: 22,
    llamadasDiaAsesor: 70,
  },
  "BANCO LA HIPOTECARIA": {
    rol: 'volumen',
    descripcion: 'En evaluación. Ticket promedio el más alto del portafolio (B/.897). El AV está construyendo el histórico inicial.',
    tareaRepetitiva: null,
    diasHabilesAsesor: 22,
    llamadasDiaAsesor: 50,
  },
  "RODELAG": {
    rol: 'volumen',
    descripcion: 'Cartera activa pequeña. El AV cubre el seguimiento de la base completa en volumen que 1 asesor no puede sostener.',
    tareaRepetitiva: null,
    diasHabilesAsesor: 22,
    llamadasDiaAsesor: 60,
  },
}

// Calcular las métricas de valor del AV para una cartera en un mes
export function calcularValorAV(
  cartera: string,
  clientes: number,
  asesores: number,
  minutosAV: number,
  llamadasAV: number,
  efectivasAV: number,
  promesasAV: number,
  honorario: number,
  inversionAV: number,
): MetricaValorAV {
  const config = ROL_POR_CARTERA[cartera] || {
    rol: 'volumen' as RolAV,
    descripcion: '',
    tareaRepetitiva: null,
    diasHabilesAsesor: 22,
    llamadasDiaAsesor: 70,
  }

  // Estimación de gestiones que haría el piso sin AV
  const gestionesPisoMes = asesores * config.diasHabilesAsesor * config.llamadasDiaAsesor
  const gestionesTotalesConAV = gestionesPisoMes + llamadasAV
  const pctSinAV = clientes > 0 ? Math.min((gestionesPisoMes / clientes) * 100, 100) : 0
  const pctConAV = clientes > 0 ? Math.min((gestionesTotalesConAV / clientes) * 100, 100) : 0

  // Tiempo liberado: si es rol de liberación, los minutos AV = tiempo que el asesor no usó
  const costoHoraAsesor = COSTO_PISO_ASESOR_HORA // B/.8.52/hora (1500/176h)
  const horasLiberadas = config.rol === 'liberacion' ? minutosAV / 60 : 0
  const valorTiempoLiberado = horasLiberadas * costoHoraAsesor

  // Tasa de conversión
  const tasaConvAV = llamadasAV > 0 ? efectivasAV / llamadasAV : 0
  const tasaConvPiso = 0.15 // estimado histórico

  // Evidencia concreta
  const evidencia: string[] = []
  
  if (llamadasAV > 0) {
    evidencia.push(`El AV realizó ${llamadasAV.toLocaleString('es-PA')} llamadas — el piso solo habría alcanzado ~${gestionesPisoMes.toLocaleString('es-PA')}`)
  }
  if (pctConAV > pctSinAV && clientes > 1000) {
    evidencia.push(`Cobertura de cartera: sin AV ${pctSinAV.toFixed(0)}%, con AV ${Math.min(pctConAV, 100).toFixed(0)}%`)
  }
  if (config.rol === 'liberacion' && minutosAV > 0) {
    evidencia.push(`${minutosAV.toLocaleString()} min de tareas repetitivas delegadas al AV — ≈${horasLiberadas.toFixed(1)}h liberadas al asesor`)
    evidencia.push(`Tiempo recuperado valorizado en B/.${valorTiempoLiberado.toFixed(2)} (al costo de piso)`)
  }
  if (promesasAV > 0) {
    evidencia.push(`${promesasAV} promesas de pago generadas o confirmadas por el AV`)
  }
  if (efectivasAV > 0 && llamadasAV > 0) {
    evidencia.push(`Tasa efectiva AV: ${(tasaConvAV * 100).toFixed(1)}%`)
  }

  // Veredicto honesto
  const avAgregoValor = minutosAV > 0 && (
    llamadasAV > gestionesPisoMes * 0.1 || // AV agregó +10% de gestiones
    horasLiberadas > 2 ||                    // liberó más de 2h de asesor
    promesasAV > 0                           // generó promesas concretas
  )

  const limitacion = config.rol === 'liberacion'
    ? 'No podemos aislar cuánto del honorario se debe al tiempo liberado vs otros factores del mes. Lo que sí podemos afirmar es que el AV realizó las tareas repetitivas, liberando capacidad al asesor.'
    : 'No podemos atribuir el honorario exclusivamente al AV — el piso también estaba activo. Lo que sí podemos afirmar es que el AV aumentó el volumen de contacto más allá de lo que el piso solo alcanzaría.'

  return {
    rol: config.rol,
    descripcionRol: config.descripcion,
    gestionesAV: llamadasAV,
    gestionesPisoEstimadas: gestionesPisoMes,
    pctCoberturaSinAV: parseFloat(pctSinAV.toFixed(1)),
    pctCoberturaConAV: parseFloat(Math.min(pctConAV, 100).toFixed(1)),
    volumenAdicional: llamadasAV,
    minutosAVenRepetitivas: config.rol === 'liberacion' ? minutosAV : 0,
    tiempoLibeReadoHoras: parseFloat(horasLiberadas.toFixed(1)),
    valorTiempoLiberado: parseFloat(valorTiempoLiberado.toFixed(2)),
    tasaConversionAV: parseFloat((tasaConvAV * 100).toFixed(1)),
    tasaConversionPiso: tasaConvPiso * 100,
    avAgregoValor,
    evidencia,
    limitacion,
  }
}

const COSTO_PISO_ASESOR_HORA = 1500 / 176 // B/.8.52/hora
