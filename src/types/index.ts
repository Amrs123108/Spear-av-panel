// types/index.ts
// Fuente única de verdad para todos los tipos del sistema.
// Principio: separar los tipos de dominio de los tipos de UI.
// Cuando migremos a PostgreSQL, solo cambia la capa de datos — estos tipos no cambian.

// ── Dominio: Carteras ─────────────────────────────────────────────────────────

export type RolAV = 'volumen' | 'liberacion' | 'mixto'

export interface CarteraConfig {
  nombre: string
  asesores: number
  clientes: number
  honorarioPct: number   // decimal: 0.03 = 3%
  masivos: number
  rolAV: RolAV
}

// ── Dominio: Gestiones ────────────────────────────────────────────────────────

export type TipoGestion = 'promesa' | 'efectiva' | 'no_efectiva'
export type FuenteGestion = 'av' | 'piso'

export interface GestionRaw {
  // Sin PII: sin nombre de cliente, sin cédula, sin teléfono
  fecha: string            // YYYY-MM-DD
  hora: string             // HH:MM:SS — para calcular TMO
  asesor: string           // nombre del asesor (solo piso)
  cartera: string          // nombre normalizado
  resultado: string        // clasificación original
  tipo: TipoGestion        // clasificación normalizada
  fuente: FuenteGestion
  monto: number            // 0 si no hay promesa
  minutosAV: number        // solo AV: minutos consumidos en la llamada
}

// ── Dominio: Métricas agregadas por cartera ───────────────────────────────────

export interface MetricasCartera {
  nombre: string
  // AV
  minutosAV: number
  llamadasAV: number
  efectivasAV: number
  promesasAV: number
  montoAV: number
  // Piso
  llamadasPiso: number
  efectivasPiso: number
  promesasPiso: number
  montoPiso: number
  tiempoPromedioMinPiso: number   // TMO calculado de columna HORA
  asesoresActivos: number
  // Financiero
  honorario: number
  honorarioMesAnterior: number
  inversionAV: number             // prorrateado de B/. 4,000
}

// ── Dominio: Productividad por asesor (sin PII de clientes) ──────────────────

export interface ProductividadAsesor {
  asesor: string          // nombre del asesor — no es PII del cliente
  cartera: string
  gestiones: number
  efectivas: number
  promesas: number
  monto: number
  tmoMin: number          // tiempo medio operativo en minutos
  diasActivo: number
  gestionesPorDia: number
}

// ── Dominio: Mes histórico ────────────────────────────────────────────────────

export interface MesHistorico {
  mes: string             // "2026-05"
  label: string           // "MAY 2026"
  avActivo: boolean
  esMesActual: boolean
  honorarioTotal: number
  minutosConsumidos: number
  nota: string
  carteras: Record<string, {
    minutosAV: number
    honorario: number
    honorarioMesAnterior: number
    promesas: number
    llamadas: number
    efectivas: number
  }>
  gestionesPiso?: Record<string, {
    llamadas: number
    efectivas: number
    promesas: number
    montoPrometido: number
    noEfectivas: number
    tiempoPromedioMin: number
    totalAsesores: number
  }>
}

// ── Dominio: Bolsa de minutos ─────────────────────────────────────────────────

export interface EntradaBolsa {
  fecha: string
  tipo: 'recarga' | 'consumo'
  cantidad: number
  descripcion: string
}

export interface BolsaMinutos {
  saldoActual: number
  diaRecarga: number
  cantidadRecarga: number
  historial: EntradaBolsa[]
}

// ── Dominio: Plan de acción ───────────────────────────────────────────────────

export interface AccionPlan {
  id: string
  descripcion: string
  responsable: string
  impactoEsperado: string
  completada: boolean
  resultado?: string
}

export interface PlanSemanal {
  id: string
  fecha: string
  semana: string
  estado: string
  acciones: AccionPlan[]
  notas: string
  metaHonorario: number
  honorarioRealizado: number
}

// ── Respuesta de la API de datos ──────────────────────────────────────────────

export type EstadoMes = 'completo' | 'minutos_sin_honorario' | 'vacio' | 'en_curso'
export type SemaforoCarta = 'verde' | 'amarillo' | 'rojo'

export interface MetricaCarteraUI extends MetricasCartera {
  comisionPct: number
  clientes: number
  asesores: number
  masivos: number
  costoTotal: number
  costoPiso: number
  base: number
  delta: number
  pctHonorarioAlAV: number
  puntosComisionAlAV: number
  retornoXBalboa: number
  pctCobertura: number
  semaforo: SemaforoCarta
  motivo: string
  accion: string
  rolAV: RolAV
  descripcionRolAV: string
  evidenciaAV: string[]
  horasLiberadas: number
  valorTiempoLiberado: number
  gestionesTotales: number    // piso + AV
  coberturaTotalPct: number
}

export interface ResumenMesUI {
  mes: string
  label: string
  esMesActual: boolean
  nota: string
  inversionAV: number
  honorarioTotal: number
  honorarioAnterior: number
  deltaVsMesAnterior: number
  incrementoVsBase: number
  roiMultiplo: number
  minutosConsumidos: number
  sePaga: boolean
  pctHonorarioTotalAlAV: number
  costoXMinuto: number
  totalGestionesAV: number
  totalGestionesPiso: number
  totalHorasLiberadas: number
  carterasConValor: number
}

export interface DashboardData {
  ok: boolean
  fuenteDatos: 'blob' | 'local'
  estadoMes: EstadoMes
  mensajeEstado: string | null
  mesActualIdx: number
  mesActual: ResumenMesUI
  carteras: MetricaCarteraUI[]
  historico: {
    mes: string; label: string; nota: string
    inversionAV: number; honorarioTotal: number
    avActivo: boolean; minutosConsumidos: number; esMesActual: boolean
  }[]
  bolsa: BolsaMinutos
  plan: PlanSemanal[]
  productividadAsesores?: ProductividadAsesor[]
}
