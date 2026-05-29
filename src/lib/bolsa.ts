// lib/bolsa.ts
// LÓGICA DE BOLSA DE MINUTOS — SPEAR
//
// Punto de partida confirmado: 21,442 minutos al 21-05-2026
// Eso ya incluye todo el histórico previo (ene-abr + días 1-20 de mayo)
//
// A partir del 21 de mayo:
//   - Se descuenta SOLO lo consumido en gestiones con fecha > 21-05-2026
//   - Esto está guardado en cada mes como "minutosParaBolsa"
//   - El 1 de junio: +14,000 minutos
//   - Cada mes siguiente: +14,000 el día 1, -minutosParaBolsa del mes
//
// Fórmula:
//   saldo = 21,442
//         - minutosParaBolsa de mayo (solo gestiones > 21-05)
//         + 14,000 × N meses posteriores con AV
//         - minutosParaBolsa de cada mes posterior

import type { EntradaBolsa } from '@/types'

export const SALDO_BASE_21MAY = 21442
export const MINUTOS_POR_MES = 14000
export const FECHA_CORTE_BOLSA = '2026-05-21'

export interface SaldoBolsa {
  saldoActual: number
  diaRecarga: number
  cantidadRecarga: number
  historial: EntradaBolsa[]
  detalle: {
    saldoBase: number
    consumoDesde21May: number     // minutos de mayo con fecha > 21-05
    recargasPostMayo: number
    consumoPostMayo: number
    desglose: Record<string, { minutosParaBolsa: number; label: string }>
  }
}

export function calcularSaldoBolsa(
  historico: Array<{
    mes: string
    label: string
    minutosConsumidos: number
    minutosParaBolsa?: number   // solo gestiones > 21-05-2026
    avActivo: boolean
  }>,
  bolsaGuardada?: { diaRecarga: number }
): SaldoBolsa {

  // Mayo 2026: solo descuenta minutosParaBolsa (gestiones después del 21)
  const mesMayo = historico.find(m => m.mes === '2026-05')
  const consumoDesde21May = mesMayo?.minutosParaBolsa ?? 0

  // Meses posteriores a mayo con AV
  const mesesPost = historico.filter(m => m.mes > '2026-05' && m.avActivo)
  const recargasPostMayo = mesesPost.length * MINUTOS_POR_MES
  const consumoPostMayo = mesesPost.reduce((s, m) => s + (m.minutosParaBolsa ?? m.minutosConsumidos ?? 0), 0)

  const saldoActual = Math.max(0,
    SALDO_BASE_21MAY
    - consumoDesde21May
    + recargasPostMayo
    - consumoPostMayo
  )

  // Desglose para diagnóstico
  const desglose: Record<string, { minutosParaBolsa: number; label: string }> = {}
  if (mesMayo && consumoDesde21May > 0) {
    desglose['2026-05'] = { minutosParaBolsa: consumoDesde21May, label: 'MAY 2026 (desde 21-05)' }
  }
  mesesPost.forEach(m => {
    const consumo = m.minutosParaBolsa ?? m.minutosConsumidos ?? 0
    if (consumo > 0) desglose[m.mes] = { minutosParaBolsa: consumo, label: m.label }
  })

  // Historial legible
  const historial: EntradaBolsa[] = [
    {
      fecha: '2026-05-21',
      tipo: 'recarga',
      cantidad: SALDO_BASE_21MAY,
      descripcion: 'Saldo inicial confirmado — 21 Mayo 2026',
    }
  ]

  if (consumoDesde21May > 0) {
    historial.push({
      fecha: '2026-05-31',
      tipo: 'consumo',
      cantidad: consumoDesde21May,
      descripcion: `Mayo 2026 (desde 22-05) — ${consumoDesde21May.toLocaleString('es-PA')} min`,
    })
  }

  mesesPost.forEach(m => {
    const consumo = m.minutosParaBolsa ?? m.minutosConsumidos ?? 0
    historial.push({
      fecha: `${m.mes}-01`,
      tipo: 'recarga',
      cantidad: MINUTOS_POR_MES,
      descripcion: `Recarga mensual ${m.label}`,
    })
    if (consumo > 0) {
      historial.push({
        fecha: `${m.mes}-28`,
        tipo: 'consumo',
        cantidad: consumo,
        descripcion: `${m.label} — ${consumo.toLocaleString('es-PA')} min`,
      })
    }
  })

  // Proyectar recarga de junio si no ha llegado
  const hoy = new Date().toISOString().split('T')[0]
  if (hoy < '2026-06-01' && !mesesPost.find(m => m.mes === '2026-06')) {
    historial.push({
      fecha: '2026-06-01',
      tipo: 'recarga',
      cantidad: MINUTOS_POR_MES,
      descripcion: 'Recarga Junio 2026 (programada el 1 de junio)',
    })
  }

  historial.sort((a, b) => b.fecha.localeCompare(a.fecha))

  return {
    saldoActual,
    diaRecarga: bolsaGuardada?.diaRecarga ?? 1,
    cantidadRecarga: MINUTOS_POR_MES,
    historial,
    detalle: {
      saldoBase: SALDO_BASE_21MAY,
      consumoDesde21May,
      recargasPostMayo,
      consumoPostMayo,
      desglose,
    }
  }
}
