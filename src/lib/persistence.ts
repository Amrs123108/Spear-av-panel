// lib/persistence.ts
// Sistema simple de persistencia usando localStorage del navegador
// para los datos editables (mes actual, plan semanal)

import { MesData, PlanSemanal, BolsaMinutos, CARTERAS_CONFIG } from './store'

const STORAGE_KEYS = {
  mesActual: 'spear-av-mes-actual',
  plan: 'spear-av-plan',
  bolsa: 'spear-av-bolsa',
}

export function loadMesActual(defaultMes: MesData): MesData {
  if (typeof window === 'undefined') return defaultMes
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.mesActual)
    if (!raw) return defaultMes
    const parsed = JSON.parse(raw)
    // Validar que tenga la estructura correcta
    if (parsed.mes && parsed.carteras) return parsed
    return defaultMes
  } catch (e) {
    return defaultMes
  }
}

export function saveMesActual(mes: MesData) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.mesActual, JSON.stringify(mes))
  } catch (e) {
    console.error('Error guardando mes actual:', e)
  }
}

export function loadPlan(defaultPlan: PlanSemanal[]): PlanSemanal[] {
  if (typeof window === 'undefined') return defaultPlan
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.plan)
    if (!raw) return defaultPlan
    return JSON.parse(raw)
  } catch (e) {
    return defaultPlan
  }
}

export function savePlan(plan: PlanSemanal[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(plan))
  } catch (e) {
    console.error('Error guardando plan:', e)
  }
}

export function loadBolsa(defaultBolsa: BolsaMinutos): BolsaMinutos {
  if (typeof window === 'undefined') return defaultBolsa
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.bolsa)
    if (!raw) return defaultBolsa
    return JSON.parse(raw)
  } catch (e) {
    return defaultBolsa
  }
}

export function saveBolsa(bolsa: BolsaMinutos) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.bolsa, JSON.stringify(bolsa))
  } catch (e) {
    console.error('Error guardando bolsa:', e)
  }
}

// Calcular totales del mes a partir de carteras
export function recalcularMes(mes: MesData): MesData {
  const honorarioTotal = Object.values(mes.carteras).reduce((s, c) => s + c.honorario, 0)
  const minutosConsumidos = Object.values(mes.carteras).reduce((s, c) => s + c.minutosAV, 0)
  return { ...mes, honorarioTotal, minutosConsumidos }
}
