// lib/store.ts
// Base de datos simple en JSON usando el sistema de archivos de Vercel
// Los datos se guardan en /tmp en producción (persiste en la sesión)
// y localmente en .data/ durante desarrollo

export interface CartераData {
  nombre: string
  asesores: number
  clientes: number
  honorarioPct: number
  masivos: number
  conversionPago: number
  ticketPromedio: number
}

export interface MesData {
  mes: string           // "2025-11", "2025-12", etc
  label: string         // "NOV 2025"
  inversionAV: number
  honorarioTotal: number
  minutosConsumidos: number
  avActivo: boolean
  carteras: {
    [nombre: string]: {
      minutosAV: number
      honorario: number
      honorarioMesAnterior: number
      promesas: number
      llamadas: number
      efectivas: number
    }
  }
}

export interface PlanSemanal {
  id: string
  fecha: string         // lunes de esa semana
  acciones: {
    id: string
    descripcion: string
    responsable: string
    impactoEsperado: string
    completada: boolean
    resultado?: string
  }[]
  notas: string
}

export interface BolsaMinutos {
  saldoActual: number
  historial: {
    fecha: string
    tipo: 'recarga' | 'consumo'
    cantidad: number
    descripcion: string
  }[]
}

// Datos históricos reales precargados
export const CARTERAS_CONFIG: CartераData[] = [
  { nombre: "BANISTMO ACTIVA",     asesores: 13, clientes: 5000,  honorarioPct: 0.03,   masivos: 1800, conversionPago: 0.43, ticketPromedio: 240.99 },
  { nombre: "BANISTMO RECOVERY",   asesores: 10, clientes: 8000,  honorarioPct: 0.135,  masivos: 500,  conversionPago: 0.30, ticketPromedio: 419.06 },
  { nombre: "SURA",                asesores: 15, clientes: 15000, honorarioPct: 0.035,  masivos: 1800, conversionPago: 0.60, ticketPromedio: 101.95 },
  { nombre: "TIGO",                asesores: 5,  clientes: 14000, honorarioPct: 0.0188, masivos: 1800, conversionPago: 0.50, ticketPromedio: 53.78  },
  { nombre: "KREDIYA",             asesores: 2,  clientes: 50000, honorarioPct: 0.1308, masivos: 1800, conversionPago: 0.39, ticketPromedio: 18.42  },
  { nombre: "BAC RECOVERY",        asesores: 5,  clientes: 6000,  honorarioPct: 0.1663, masivos: 800,  conversionPago: 0.55, ticketPromedio: 151.67 },
  { nombre: "SOLVE",               asesores: 3,  clientes: 9000,  honorarioPct: 0.2228, masivos: 1000, conversionPago: 0.35, ticketPromedio: 83.17  },
  { nombre: "BANCO LA HIPOTECARIA",asesores: 1,  clientes: 900,   honorarioPct: 0.11,   masivos: 100,  conversionPago: 0.54, ticketPromedio: 184.17 },
  { nombre: "RODELAG",             asesores: 1,  clientes: 1000,  honorarioPct: 0.09,   masivos: 75,   conversionPago: 0.30, ticketPromedio: 65.00  },
]

export const HISTORICO_INICIAL: MesData[] = [
  {
    mes: "2025-11", label: "NOV 2025", inversionAV: 0, honorarioTotal: 123933, minutosConsumidos: 0, avActivo: false,
    carteras: {
      "BANISTMO ACTIVA":     { minutosAV: 0, honorario: 30708, honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
      "BANISTMO RECOVERY":   { minutosAV: 0, honorario: 11867, honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
      "SURA":                { minutosAV: 0, honorario: 34132, honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
      "TIGO":                { minutosAV: 0, honorario: 12087, honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
      "KREDIYA":             { minutosAV: 0, honorario: 6659,  honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
      "BAC RECOVERY":        { minutosAV: 0, honorario: 5491,  honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
      "SOLVE":               { minutosAV: 0, honorario: 5822,  honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
      "BANCO LA HIPOTECARIA":{ minutosAV: 0, honorario: 0,     honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
      "RODELAG":             { minutosAV: 0, honorario: 0,     honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
    }
  },
  {
    mes: "2025-12", label: "DIC 2025", inversionAV: 0, honorarioTotal: 185387, minutosConsumidos: 0, avActivo: false,
    carteras: {
      "BANISTMO ACTIVA":     { minutosAV: 0, honorario: 31889, honorarioMesAnterior: 30708, promesas: 0, llamadas: 0, efectivas: 0 },
      "BANISTMO RECOVERY":   { minutosAV: 0, honorario: 32417, honorarioMesAnterior: 11867, promesas: 0, llamadas: 0, efectivas: 0 },
      "SURA":                { minutosAV: 0, honorario: 64379, honorarioMesAnterior: 34132, promesas: 0, llamadas: 0, efectivas: 0 },
      "TIGO":                { minutosAV: 0, honorario: 18185, honorarioMesAnterior: 12087, promesas: 0, llamadas: 0, efectivas: 0 },
      "KREDIYA":             { minutosAV: 0, honorario: 10418, honorarioMesAnterior: 6659,  promesas: 0, llamadas: 0, efectivas: 0 },
      "BAC RECOVERY":        { minutosAV: 0, honorario: 6914,  honorarioMesAnterior: 5491,  promesas: 0, llamadas: 0, efectivas: 0 },
      "SOLVE":               { minutosAV: 0, honorario: 9188,  honorarioMesAnterior: 5822,  promesas: 0, llamadas: 0, efectivas: 0 },
      "BANCO LA HIPOTECARIA":{ minutosAV: 0, honorario: 0,     honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
      "RODELAG":             { minutosAV: 0, honorario: 0,     honorarioMesAnterior: 0,     promesas: 0, llamadas: 0, efectivas: 0 },
    }
  },
  {
    mes: "2026-01", label: "ENE 2026", inversionAV: 4220, honorarioTotal: 142310, minutosConsumidos: 770, avActivo: true,
    carteras: {
      "BANISTMO ACTIVA":     { minutosAV: 0,   honorario: 26668, honorarioMesAnterior: 31889, promesas: 0,  llamadas: 0,    efectivas: 0 },
      "BANISTMO RECOVERY":   { minutosAV: 0,   honorario: 20442, honorarioMesAnterior: 32417, promesas: 0,  llamadas: 0,    efectivas: 0 },
      "SURA":                { minutosAV: 0,   honorario: 50770, honorarioMesAnterior: 64379, promesas: 0,  llamadas: 0,    efectivas: 0 },
      "TIGO":                { minutosAV: 0,   honorario: 12723, honorarioMesAnterior: 18185, promesas: 0,  llamadas: 0,    efectivas: 0 },
      "KREDIYA":             { minutosAV: 0,   honorario: 9363,  honorarioMesAnterior: 10418, promesas: 0,  llamadas: 0,    efectivas: 0 },
      "BAC RECOVERY":        { minutosAV: 0,   honorario: 4340,  honorarioMesAnterior: 6914,  promesas: 0,  llamadas: 0,    efectivas: 0 },
      "SOLVE":               { minutosAV: 770, honorario: 6543,  honorarioMesAnterior: 9188,  promesas: 84, llamadas: 3200, efectivas: 450 },
      "BANCO LA HIPOTECARIA":{ minutosAV: 0,   honorario: 0,     honorarioMesAnterior: 0,     promesas: 0,  llamadas: 0,    efectivas: 0 },
      "RODELAG":             { minutosAV: 0,   honorario: 0,     honorarioMesAnterior: 0,     promesas: 0,  llamadas: 0,    efectivas: 0 },
    }
  },
  {
    mes: "2026-02", label: "FEB 2026", inversionAV: 4361, honorarioTotal: 137474, minutosConsumidos: 1268, avActivo: true,
    carteras: {
      "BANISTMO ACTIVA":     { minutosAV: 0,    honorario: 25274, honorarioMesAnterior: 26668, promesas: 0,   llamadas: 0,    efectivas: 0 },
      "BANISTMO RECOVERY":   { minutosAV: 0,    honorario: 27417, honorarioMesAnterior: 20442, promesas: 0,   llamadas: 0,    efectivas: 0 },
      "SURA":                { minutosAV: 0,    honorario: 40734, honorarioMesAnterior: 50770, promesas: 0,   llamadas: 0,    efectivas: 0 },
      "TIGO":                { minutosAV: 0,    honorario: 11968, honorarioMesAnterior: 12723, promesas: 0,   llamadas: 0,    efectivas: 0 },
      "KREDIYA":             { minutosAV: 1268, honorario: 10228, honorarioMesAnterior: 9363,  promesas: 124, llamadas: 4710, efectivas: 723 },
      "BAC RECOVERY":        { minutosAV: 0,    honorario: 3548,  honorarioMesAnterior: 4340,  promesas: 0,   llamadas: 0,    efectivas: 0 },
      "SOLVE":               { minutosAV: 0,    honorario: 6662,  honorarioMesAnterior: 6543,  promesas: 0,   llamadas: 0,    efectivas: 0 },
      "BANCO LA HIPOTECARIA":{ minutosAV: 0,    honorario: 0,     honorarioMesAnterior: 0,     promesas: 0,   llamadas: 0,    efectivas: 0 },
      "RODELAG":             { minutosAV: 0,    honorario: 0,     honorarioMesAnterior: 0,     promesas: 0,   llamadas: 0,    efectivas: 0 },
    }
  },
  {
    mes: "2026-03", label: "MAR 2026", inversionAV: 6074, honorarioTotal: 174534, minutosConsumidos: 7245, avActivo: true,
    carteras: {
      "BANISTMO ACTIVA":     { minutosAV: 1490, honorario: 40767, honorarioMesAnterior: 25274, promesas: 561, llamadas: 2692, efectivas: 802 },
      "BANISTMO RECOVERY":   { minutosAV: 1308, honorario: 39168, honorarioMesAnterior: 27417, promesas: 45,  llamadas: 7939, efectivas: 650 },
      "SURA":                { minutosAV: 29,   honorario: 52679, honorarioMesAnterior: 40734, promesas: 8,   llamadas: 48,   efectivas: 14  },
      "TIGO":                { minutosAV: 1286, honorario: 10356, honorarioMesAnterior: 11968, promesas: 459, llamadas: 1883, efectivas: 640 },
      "KREDIYA":             { minutosAV: 1268, honorario: 12148, honorarioMesAnterior: 10228, promesas: 124, llamadas: 4710, efectivas: 723 },
      "BAC RECOVERY":        { minutosAV: 190,  honorario: 6987,  honorarioMesAnterior: 3548,  promesas: 75,  llamadas: 368,  efectivas: 96  },
      "SOLVE":               { minutosAV: 772,  honorario: 8970,  honorarioMesAnterior: 6662,  promesas: 84,  llamadas: 5104, efectivas: 485 },
      "BANCO LA HIPOTECARIA":{ minutosAV: 527,  honorario: 2420,  honorarioMesAnterior: 0,     promesas: 29,  llamadas: 2454, efectivas: 257 },
      "RODELAG":             { minutosAV: 375,  honorario: 0,     honorarioMesAnterior: 0,     promesas: 78,  llamadas: 981,  efectivas: 187 },
    }
  },
]

export const BOLSA_INICIAL: BolsaMinutos = {
  saldoActual: 14000,
  historial: [
    { fecha: "2026-05-01", tipo: "recarga",  cantidad: 14000, descripcion: "Recarga mensual Mayo 2026" },
    { fecha: "2026-04-01", tipo: "recarga",  cantidad: 14000, descripcion: "Recarga mensual Abril 2026" },
    { fecha: "2026-04-30", tipo: "consumo",  cantidad: 7245,  descripcion: "Consumo Abril 2026" },
  ]
}
