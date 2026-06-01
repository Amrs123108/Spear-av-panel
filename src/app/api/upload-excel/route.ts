import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { put, list } from '@vercel/blob'

export const dynamic = 'force-dynamic'
const PATHNAME = 'spear-av-datos.json'

// ── Mapeo de proyectos del PISO → nombre estándar ─────────────────────
// Basado en la Hoja3 de PISO.xlsx (columna PROYECTO → PROYECTO FINAL)
const MAPA_PROYECTO_PISO: Record<string, string> = {
  // BAC
  'BAC CASTIGADA': 'BAC RECOVERY',
  'BAC': 'BAC RECOVERY',
  // BANISTMO
  'BANISTMO S.A.': 'BANISTMO RECOVERY',
  'BANISTMO ACTIVA PREDICTIVO': 'BANISTMO ACTIVA',
  'BANISTMO ACTIVA 61 A 90': 'BANISTMO ACTIVA',
  'BANISTMO ACTIVA': 'BANISTMO ACTIVA',
  'BANISTMO RECOVERY': 'BANISTMO RECOVERY',
  // SURA — múltiples subcarteras
  'SURA CORREDORES': 'SURA',
  'SURA HCIS': 'SURA',
  'SURA BANCA INDIVIDUAL': 'SURA',
  'SURA TC Y ACH': 'SURA',
  'SURA CASTIGO': 'SURA',
  'SURA SUCURSALES': 'SURA',
  'SURA': 'SURA',
  // TIGO — múltiples ciclos
  'TIGO CICLO 15': 'TIGO',
  'TIGO CICLO 1 (1-30)': 'TIGO',
  'TIGO CICLO 6': 'TIGO',
  'TIGO CICLO 21': 'TIGO',
  'TIGO': 'TIGO',
  // RESTO
  'KREDIYA': 'KREDIYA',
  'SOLVE': 'SOLVE',
  'BANCO LA HIPOTECARIA': 'BANCO LA HIPOTECARIA',
  'RODELAG': 'RODELAG',
  'MULTIBANK': 'MULTIBANK',
  'MULTIBANK ACTIVA': 'MULTIBANK',
  'GLOBAL BANK': 'GLOBAL BANK',
  'CAJA DE AHORROS': 'CAJA DE AHORROS',
  'AFINITI FINANCIAL': 'AFINITI',
  'AFINITI FINANCIAL 31-60': 'AFINITI',
  'CREDITS PANAMA': 'CREDITS PANAMA',
  'CREDICORP BANK': 'CREDICORP BANK',
  'JAMAR': 'JAMAR',
  'SIMPOL': 'SIMPOL',
}

// ── Mapeo del AV: empresa_cliente puede tener variaciones ─────────────
const MAPA_EMPRESA_AV: Record<string, string> = {
  // Banistmo — todas las variaciones posibles del reporte AV
  'BANISTMO ACTIVA': 'BANISTMO ACTIVA',
  'BANISTMO ACTIVA PREDICTIVO': 'BANISTMO ACTIVA',
  'BANISTMO ACTIVA 61 A 90': 'BANISTMO ACTIVA',
  'BANISTMO RECOVERY': 'BANISTMO RECOVERY',
  'BANISTMO S.A.': 'BANISTMO RECOVERY',
  'BANISTMO S.A': 'BANISTMO RECOVERY',
  'BANISTMO SA': 'BANISTMO RECOVERY',
  // "Banistmo" solo sin sufijo → RECOVERY (cartera de cobro/castigo)
  'BANISTMO': 'BANISTMO RECOVERY',
  'Banistmo': 'BANISTMO RECOVERY',
  'banistmo': 'BANISTMO RECOVERY',
  // Resto
  'SURA': 'SURA',
  'TIGO': 'TIGO',
  'KREDIYA': 'KREDIYA',
  'Krediya': 'KREDIYA',
  'BAC RECOVERY': 'BAC RECOVERY',
  'BAC': 'BAC RECOVERY',
  'Bac': 'BAC RECOVERY',
  'SOLVE': 'SOLVE',
  'BANCO LA HIPOTECARIA': 'BANCO LA HIPOTECARIA',
  'RODELAG': 'RODELAG',
  'MULTIBANK': 'MULTIBANK',
  'AFINITI': 'AFINITI',
  'GLOBAL BANK': 'GLOBAL BANK',
}

// ── Clasificaciones del PISO → EFECTIVA / PROMESA / NO_EFECTIVA ───────
// Basado en la Hoja3 de PISO.xlsx columna VERF
const CLASIFICACION_PISO_TIPO: Record<string, 'promesa' | 'efectiva' | 'no_efectiva'> = {
  'PROMESA': 'promesa',
  'EFECTIVA': 'efectiva',
  'NO EFECTIVA': 'no_efectiva',
}

// Las clasificaciones del AV ya tienen TIPO DE CONTACTO en Hoja2
const CLASIFICACION_AV_EFECTIVA = new Set([
  'pago_ya_realizado', 'sin_compromiso_de_pago', 'cliente_solicita_prorroga',
  'confirma_pago_para_hoy', 'mensaje_contacto_tercero', 'mensaje_con_tercero',
  'renuente', 'posible_fraude', 'ya_pago', 'niega_el_credito', 'reclamo',
  'no_quiere_pagar', 'conocido_solicita_llamar_mas_tarde', 'titular_solicita_llamar_mas_tarde',
  'recordatorio_de_pago', 'comprobante_de_pago',
])
const CLASIFICACION_AV_PROMESA = new Set([
  'promesa_de_pago',
])
// Todo lo demás es NO_EFECTIVO (buzon_de_voz, no_atiende, numero_equivocado, etc.)

// ── Detectar tipo de archivo por nombre ───────────────────────────────
interface InfoArchivo {
  tipo: 'av_cobro' | 'av_recordatorio' | 'piso' | 'desconocido'
  carteraEspecifica: string | null  // si aplica solo a una cartera (ej: SURA)
  fecha: string | null               // "18-05" extraída del nombre
  corte: number | null               // número de corte
}

function detectarArchivo(nombre: string): InfoArchivo {
  const n = nombre.toUpperCase().replace('.XLSX', '').replace('.XLS', '')

  if (n.includes('SIGELLA')) {
    // Extraer fecha: Sigella-Gestiones-18-05-2026
    const fechaMatch = nombre.match(/(\d{2})-(\d{2})-(\d{4})/)
    return {
      tipo: 'piso',
      carteraEspecifica: null,
      fecha: fechaMatch ? `${fechaMatch[1]}-${fechaMatch[2]}` : null,
      corte: null,
    }
  }

  if (n.includes('REPORTE-COBRO') || n.includes('COBRO-GENERAL') || n.includes('COBRO_GENERAL')) {
    const fechaMatch = nombre.match(/(\d{2})-(\d{2})/)
    const corteMatch = nombre.match(/CORTE[_-]?(\d)/i)
    return {
      tipo: 'av_cobro',
      carteraEspecifica: null,
      fecha: fechaMatch ? fechaMatch[0] : null,
      corte: corteMatch ? parseInt(corteMatch[1]) : 1,
    }
  }

  if (n.includes('RECORDATORIO') || n.includes('RECORDATORIOS')) {
    // Verificar si es de una cartera específica
    const fechaMatch = nombre.match(/(\d{2})-(\d{2})/)
    const corteMatch = nombre.match(/CORTE[_-]?(\d)/i)
    // Cartera específica: Reporte-Recordatorios-SURA-15-05
    let carteraEspecifica: string | null = null
    const partes = nombre.replace('.xlsx', '').replace('.xls', '').split('-')
    const idx = partes.findIndex(p => p.toLowerCase() === 'recordatorios')
    if (idx >= 0 && idx + 1 < partes.length) {
      const posibleCartera = partes[idx + 1].toUpperCase()
      if (!/^\d/.test(posibleCartera) && posibleCartera !== 'GENERAL') {
        carteraEspecifica = MAPA_EMPRESA_AV[posibleCartera] || posibleCartera
      }
    }
    return {
      tipo: 'av_recordatorio',
      carteraEspecifica,
      fecha: fechaMatch ? fechaMatch[0] : null,
      corte: corteMatch ? parseInt(corteMatch[1]) : 1,
    }
  }

  return { tipo: 'desconocido', carteraEspecifica: null, fecha: null, corte: null }
}

// ── Extraer columna por variantes de nombre ───────────────────────────
function col(headers: string[], ...opciones: string[]): number {
  const h = headers.map(x => (x || '').toLowerCase().trim())
  for (const op of opciones) {
    const idx = h.findIndex(x => x.includes(op.toLowerCase()))
    if (idx >= 0) return idx
  }
  return -1
}

// ── Procesar archivo del AV ───────────────────────────────────────────
// Columnas exactas: usuario (Agente) | Fecha | Hora | monto_pagar | empresa_cliente | clasificacion | MINUTOS CONSUMIDOS | TIPO DE CONTACTO
function procesarAV(rows: any[][], info: InfoArchivo) {
  const headers = rows[0].map(String)

  // Mapeo exacto de columnas del AV
  const cUsuario  = col(headers, 'usuario', 'agente', 'usuario (agente)')
  const cFecha    = col(headers, 'fecha')
  const cHora     = col(headers, 'hora')
  const cMonto    = col(headers, 'monto_pagar', 'monto')
  const cEmpresa  = col(headers, 'empresa_cliente', 'empresa', 'proyecto', 'cartera')
  const cClasif   = col(headers, 'clasificacion')
  const cMinutos  = col(headers, 'minutos consumidos', 'minutos', 'duracion', 'duración')
  const cTipo     = col(headers, 'tipo de contacto', 'tipo_contacto', 'tipo')

  // Estructura extendida con datos de HORA para calcular velocidad de alcance
  const FECHA_CORTE_BOLSA = '2026-05-21' // Solo minutos DESPUÉS de esta fecha afectan la bolsa

  const resumen: Record<string, {
    minutosAV: number          // total de minutos del mes (para el panel)
    minutosParaBolsa: number   // solo minutos de gestiones DESPUÉS del 21-05 (para descontar)
    llamadas: number
    efectivas: number
    promesas: number
    montoPrometido: number
    primeraHora: Date | null
    ultimaHora: Date | null
    fechasPorDia: Record<string, { primera: Date; ultima: Date; llamadas: number }>
  }> = {}

  for (let i = 1; i < rows.length; i++) {
    const fila = rows[i]
    if (!fila || fila.every((c: any) => !c)) continue

    // Determinar cartera — búsqueda robusta: exacta, luego uppercase, luego trim
    let empresa = ''
    if (info.carteraEspecifica) {
      empresa = info.carteraEspecifica
    } else if (cEmpresa >= 0) {
      const rawOriginal = String(fila[cEmpresa] || '')
        .replace(/^\s+|\s+$/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      empresa = MAPA_EMPRESA_AV[rawOriginal]
        || MAPA_EMPRESA_AV[rawOriginal.toUpperCase()]
        || MAPA_EMPRESA_AV[rawOriginal.toLowerCase()]
        || rawOriginal.toUpperCase()
    }
    if (!empresa) continue

    if (!resumen[empresa]) {
      resumen[empresa] = {
        minutosAV: 0, minutosParaBolsa: 0, llamadas: 0, efectivas: 0, promesas: 0, montoPrometido: 0,
        primeraHora: null, ultimaHora: null, fechasPorDia: {}
      }
    }
    const r = resumen[empresa]
    r.llamadas += 1

    // Minutos consumidos
    const minutos = cMinutos >= 0
      ? (parseFloat(String(fila[cMinutos] || '0').replace(',', '.')) || 0)
      : 0
    r.minutosAV += minutos

    // ── Determinar si esta gestión es posterior al corte de bolsa ─────
    // Solo los minutos de gestiones con Fecha > 21-05-2026 se descuentan
    let fechaGestion = ''
    if (cFecha >= 0 && fila[cFecha]) {
      const fv = fila[cFecha]
      if (fv instanceof Date) {
        fechaGestion = fv.toISOString().split('T')[0]
      } else {
        const str = String(fv).trim()
        // Normalizar formato DD/MM/YYYY o YYYY-MM-DD
        if (str.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [d, m, y] = str.split('/')
          fechaGestion = `${y}-${m}-${d}`
        } else if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
          fechaGestion = str.split('T')[0]
        } else if (str.match(/^\d{2}-\d{2}-\d{4}$/)) {
          const [d, m, y] = str.split('-')
          fechaGestion = `${y}-${m}-${d}`
        }
      }
    }

    // Solo contar para la bolsa si la fecha es POSTERIOR al corte
    if (fechaGestion && fechaGestion > FECHA_CORTE_BOLSA) {
      r.minutosParaBolsa += minutos
    }

    // Monto
    const monto = cMonto >= 0
      ? (parseFloat(String(fila[cMonto] || '0').replace(/[B/.\s]/g, '').replace(',', '.')) || 0)
      : 0

    // ── Cálculo de velocidad de alcance con columna HORA ─────────────
    // Registramos la hora de cada gestión para saber:
    // En cuántas horas el AV contacta X cantidad de clientes
    const horaRaw = cHora >= 0 ? fila[cHora] : null
    const fechaRaw = cFecha >= 0 ? fila[cFecha] : null

    if (horaRaw && fechaRaw) {
      let horaDate: Date | null = null

      if (horaRaw instanceof Date) {
        horaDate = horaRaw
      } else if (typeof horaRaw === 'string') {
        const parts = horaRaw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
        if (parts) {
          horaDate = new Date()
          horaDate.setHours(parseInt(parts[1]), parseInt(parts[2]), parseInt(parts[3] || '0'), 0)
        }
      }

      if (horaDate) {
        // Fecha como string para agrupar por día
        const fechaStr = fechaRaw instanceof Date
          ? fechaRaw.toISOString().split('T')[0]
          : String(fechaRaw).split('T')[0]

        if (!r.fechasPorDia[fechaStr]) {
          r.fechasPorDia[fechaStr] = { primera: horaDate, ultima: horaDate, llamadas: 0 }
        } else {
          if (horaDate < r.fechasPorDia[fechaStr].primera) r.fechasPorDia[fechaStr].primera = horaDate
          if (horaDate > r.fechasPorDia[fechaStr].ultima) r.fechasPorDia[fechaStr].ultima = horaDate
        }
        r.fechasPorDia[fechaStr].llamadas += 1

        if (!r.primeraHora || horaDate < r.primeraHora) r.primeraHora = horaDate
        if (!r.ultimaHora || horaDate > r.ultimaHora) r.ultimaHora = horaDate
      }
    }

    // Resultado de la gestión
    const tipoContacto = cTipo >= 0 ? String(fila[cTipo] || '').trim().toUpperCase() : ''
    const clasificacion = cClasif >= 0 ? String(fila[cClasif] || '').trim().toLowerCase() : ''

    if (tipoContacto === 'EFECTIVA') {
      r.efectivas += 1
      if (CLASIFICACION_AV_PROMESA.has(clasificacion) || clasificacion.includes('promesa')) {
        r.promesas += 1
        r.montoPrometido += monto
      }
    }
  }

  // ── Calcular métricas de velocidad de alcance ─────────────────────
  // velocidadAlcance = llamadas totales / horas operativas totales
  // horasParaCien    = cuántas horas necesita el AV para contactar 100 clientes
  const resultado: Record<string, {
    minutosAV: number; minutosParaBolsa: number; llamadas: number; efectivas: number
    promesas: number; montoPrometido: number
    velocidadAlcance: {
      clientesPorHora: number
      horasParaCienClientes: number
      horasOperativasTotal: number
      diasConActividad: number
      promedioClientesPorDia: number
    }
  }> = {}

  Object.entries(resumen).forEach(([empresa, r]) => {
    let horasOperativasTotal = 0
    const dias = Object.values(r.fechasPorDia)

    dias.forEach(d => {
      const diffMs = d.ultima.getTime() - d.primera.getTime()
      const diffHoras = diffMs / (1000 * 60 * 60)
      // Solo contamos si la diferencia es mayor a 0 (al menos 2 gestiones en el día)
      if (diffHoras > 0) horasOperativasTotal += diffHoras
    })

    const diasConActividad = dias.length
    const clientesPorHora = horasOperativasTotal > 0
      ? parseFloat((r.llamadas / horasOperativasTotal).toFixed(1))
      : 0
    const horasParaCienClientes = clientesPorHora > 0
      ? parseFloat((100 / clientesPorHora).toFixed(2))
      : 0
    const promedioClientesPorDia = diasConActividad > 0
      ? Math.round(r.llamadas / diasConActividad)
      : 0

    resultado[empresa] = {
      minutosAV: Math.round(r.minutosAV * 100) / 100,
      minutosParaBolsa: Math.round(r.minutosParaBolsa * 100) / 100,
      llamadas: r.llamadas,
      efectivas: r.efectivas,
      promesas: r.promesas,
      montoPrometido: Math.round(r.montoPrometido),
      velocidadAlcance: {
        clientesPorHora,
        horasParaCienClientes,
        horasOperativasTotal: parseFloat(horasOperativasTotal.toFixed(2)),
        diasConActividad,
        promedioClientesPorDia,
      }
    }
  })

  return resultado
}

// ── Procesar archivo del PISO (Sigella) ──────────────────────────────
// Extrae totales por cartera Y productividad individual por asesor
function procesarPiso(rows: any[][]) {
  const headers = rows[0].map(String)

  const cAsesor   = col(headers, 'gestor', 'asesor')  // Sigella usa 'GESTOR'
  const cClasif   = col(headers, 'clasificacion')
  const cMonto    = col(headers, 'monto')
  const cHora     = col(headers, 'hora')
  const cFecha    = col(headers, 'fecha_clas', 'fecha')
  const cProyecto = col(headers, 'proyecto')

  // Mapa completo de 150 clasificaciones reales extraídas del archivo Sigella-Gestiones-05-05-2026
  const CLASIF_PISO_MAP: Record<string, 'promesa' | 'efectiva' | 'no_efectiva'> = {
    // ── PROMESAS ──────────────────────────────────────────────────────
    'ACEPTA > COMPROMISO DE PAGO': 'promesa',
    'ACEPTA AMPLIACIÓN DE PLAZO >': 'promesa',
    'ACEPTA CONDONACIÓN >': 'promesa',
    'ACEPTA PERIODO DE GRACIA >': 'promesa',
    'CANCELACIÓN CON CONDONACIÓN >': 'promesa',
    'CANCELACIÓN/GRILLA ESPECIAL >': 'promesa',
    'CLIENTE ACEPTA ARREGLO DE PAGO >': 'promesa',
    'CONDONACION A PLAZOS >': 'promesa',
    'CONDONACION COMPLETA >': 'promesa',
    'CONFIRMACION DE PROMESA DE PAGO >': 'promesa',
    'CREAR PROMESA DE PAGO >': 'promesa',
    'DESCUENTO DIRECTO >': 'promesa',
    'DESCUENTO DIRECTO ACTIVO >': 'promesa',
    'EN ESPERA DE REESTRUCTURA >': 'promesa',
    'GRILLA ESPECIAL > ACEPTA': 'promesa',
    'LLAMADA SALIENTE > PROMESA DE PAGO': 'promesa',
    'POSIBLE REESTRUCTURA >': 'promesa',
    'PROMESA DE PAGO >': 'promesa',
    'PROMESA DE PAGO CON CONDONACION >': 'promesa',
    'PROMESA DE PAGO CON CONDONACIÓN >': 'promesa',
    'PROMESA DE PAGO CON CONDONACIÓN GRILLA ESPECIAL >': 'promesa',
    'PROMESA DE PAGO CON REAGING >': 'promesa',
    'PROMESA DE PAGO PARCIAL >': 'promesa',
    'PROMESA DE PAGO TOTAL VCDO >': 'promesa',
    'PROMESA DE PAGO VCDO >': 'promesa',
    'PROMESA DE PAGO - VISITA >': 'promesa',
    'PROMESAS DE PAGOS >': 'promesa',
    'PRONTO PAGO >': 'promesa',
    'PROSPECTO REACTIVACIÓN >': 'promesa',
    'PTP VIGENTE >': 'promesa',
    'REACTIVACION - CLIENTE INTERESADO - PENDIENTE DOCUMENTOS >': 'promesa',
    'REACTIVACION - DESEMBOLSADO >': 'promesa',
    'REACTIVACION - EN TRAMITE - DESCUENTO PENDIENTE DE APROBACION >': 'promesa',
    'REACTIVACION - EN TRAMITE - EVALUACION POR PARTE DEL BANCO >': 'promesa',
    'REACTIVACION - EN TRAMITE - PENDIENTE DESEMBOLSO >': 'promesa',
    'REACTIVACION - FIRMA CON MENSAJERÍA >': 'promesa',
    'RECORDATORIO DE PAGO EFECTIVO >': 'promesa',
    'RESTRUCTURA AGIL 1 >': 'promesa',
    'SOLICITUD DE ARREGLO >': 'promesa',
    'TRAMITE DE CANCELACION /CARTA DE SALDO >': 'promesa',
    'CANCELACION > CANCELACION': 'promesa',
    'ACEPTA > PAGO': 'promesa',
    'COMPROMISO DE PAGO >': 'promesa',
    // ── NO EFECTIVAS ───────────────────────────────────────────────────
    'CLIENTE CUELGA LA LLAMADA >': 'no_efectiva',
    'CLIENTE CUELGA LLAMADA >': 'no_efectiva',
    'CLIENTE NO CONTESTA >': 'no_efectiva',
    'ILOCALIZABLE >': 'no_efectiva',
    'LLAMADA SALIENTE > NO CONTESTAN': 'no_efectiva',
    'NO ATENDIDA >': 'no_efectiva',
    'NO CONTACTO >': 'no_efectiva',
    'NO CONTESTA >': 'no_efectiva',
    'NO CONTESTAN EN NINGÚN TELÉFONO >': 'no_efectiva',
    'NO LOCALIZABLE > NO CONTESTAN': 'no_efectiva',
    'NO SE CONTACTA_NO REPORTA EN BASE DE DATOS >': 'no_efectiva',
    'NUM CELULAR INACTIVO > NO CONTESTAN': 'no_efectiva',
    'POSIBLE ILOCALIZABLE >': 'no_efectiva',
    'RECORDAR PTP_NO CONTACTO >': 'no_efectiva',
    'SIN COMUNICACION >': 'no_efectiva',
    'SOLO MANTIENE CORREO >': 'no_efectiva',
    'TELEFONO APAGADO >': 'no_efectiva',
    'TELEFONO EQUIVOCADO >': 'no_efectiva',
    'TELEFONO ERRONEO O TELEFONO EQUIVOCADO >': 'no_efectiva',
    'TELEFONO FUERA DE SERVICIO >': 'no_efectiva',
    'TELEFONOS OCUPADOS >': 'no_efectiva',
    'TELEONO EQUIVOCADO >': 'no_efectiva',
    'TELÉFONO APAGADO >': 'no_efectiva',
    'TELÉFONO EQUIVOCADO >': 'no_efectiva',
    'TELÉFONO FUERA DE SERVICIO >': 'no_efectiva',
    'VISITA NO EFECTIVA_NO RECIBEN EN GARITA DE PH >': 'no_efectiva',
    'VISITA NO EFECTIVA_NO RESIDE EN EL LUGAR >': 'no_efectiva',
    'VISITA NO EFECTIVA_NO SE UBICA LA DIRECCION >': 'no_efectiva',
    'VISITA NO EFECTIVA_TERCERO SE NIEGA A RECIBIR LA CARTA >': 'no_efectiva',
    'VOLVER A LLAMAR NO EFECTIVA >': 'no_efectiva',
    // ── EFECTIVAS (todo lo demás que implica contacto real) ─────────────
    'AGENDAR LLAMADA >': 'efectiva',
    'CAMBIO DE FECHA DE PAGO >': 'efectiva',
    'CLIENTE AL DIA >': 'efectiva',
    'CLIENTE CANCELO >': 'efectiva',
    'CLIENTE CANCELO POLIZA >': 'efectiva',
    'CLIENTE COMPLETA PAGO >': 'efectiva',
    'CLIENTE CONFIRMA PAGO >': 'efectiva',
    'CLIENTE YA CANCELO >': 'efectiva',
    'CLIENTE YA GESTIONADO >': 'efectiva',
    'CONTACTO SIN ACUERDO > FALLECIDO': 'efectiva',
    'CONTACTO WHATSAPP > CONFIRMACION DE PAGO': 'efectiva',
    'CONTACTO WHATSAPP > RECORDATORIO DE PAGO': 'efectiva',
    'CONTACTO WHATSAPP > SE DEJA MENSAJE': 'efectiva',
    'CORRECCION DE PRIMA >': 'efectiva',
    'CUENTA CANCELADA >': 'efectiva',
    'DICE YA PAGO >': 'efectiva',
    'DICE YA PAGÓ >': 'efectiva',
    'DICE YA PAGÓ WHATSAPP >': 'efectiva',
    'DOCUMENTACION SOLICITADA >': 'efectiva',
    'EMAIL ENVIADO > EMAIL ENVIADO': 'efectiva',
    'EMPRESA CONFIRMA LABORA >': 'efectiva',
    'EMPRESA CONFIRMA NO LABORA >': 'efectiva',
    'EMPRESA CONFIRMA NO TRABAJA >': 'efectiva',
    'EMPRESA CONFIRMA SI LABORA >': 'efectiva',
    'EN ESPERA DE CONSOLIDACION >': 'efectiva',
    'EN NEGOCIACION CON EL CLIENTE >': 'efectiva',
    'ENVIO DE CARTA >': 'efectiva',
    'ENVIO DE CORREO >': 'efectiva',
    'ENVIO DE WHATSAPP >': 'efectiva',
    'ESCALAMIENTO SUPERVISOR >': 'efectiva',
    'INVESTIGACION CON APLICACION DE PAGOS >': 'efectiva',
    'LLAMADA AGENDA >': 'efectiva',
    'LLAMADA SALIENTE > CONFIRMACION DE PAGO': 'efectiva',
    'LLAMADA SALIENTE > FALLECIDO': 'efectiva',
    'LLAMADA SALIENTE > RECORDATORIO DE PAGO': 'efectiva',
    'LLAMADA SALIENTE > SE DEJA MENSAJE': 'efectiva',
    'MANTIENE ACUERDO CON RODELAG >': 'efectiva',
    'MENSAJE CON CONOCIDO >': 'efectiva',
    'MENSAJE CON CORREDOR >': 'efectiva',
    'MENSAJE CON FAMILIAR >': 'efectiva',
    'MENSAJE CON TERCERO >': 'efectiva',
    'NEGATIVA DE PAGO >': 'efectiva',
    'NO CORRESPONDE COBRANZA >': 'efectiva',
    'NO PUEDE PAGAR >': 'efectiva',
    'NO QUIERE PAGAR >': 'efectiva',
    'NO RECONOCE SALDO >': 'efectiva',
    'NO RECONOCE LA POLIZA Y SOLICITA CANCELACION >': 'efectiva',
    'NO PROMESA/ CONTACTO CON CLIENTE >': 'efectiva',
    'SIN COMPROMISO DE PAGO >': 'efectiva',
    'PAGARÁ FUERA DE PLAZO >': 'efectiva',
    'PAGARÁ FUERA DE PLAZO WHATSAPP >': 'efectiva',
    'PAGO AL CORREDOR >': 'efectiva',
    'PENSARÁ PROPUESTA >': 'efectiva',
    'PERDIDA TOTAL >': 'efectiva',
    'POSIBLE FALLECIDO >': 'efectiva',
    'PROBLEMAS ECONOMICOS >': 'efectiva',
    'RECHAZO ENVIO DE VISITA >': 'efectiva',
    'RECLAMO >': 'efectiva',
    'RECORDAR PTP_ CAMBIA FECHA DE PAGO >': 'efectiva',
    'RECORDAR PTP_ CLIENTE CONFIRMA PAGO >': 'efectiva',
    'RECORDAR PTP_ NO SE CONTACTÓ >': 'efectiva',
    'RECORDAR PTP_CLIENTE CONFIRMA PAGO WHATSAPP >': 'efectiva',
    'RECORDATORIO DE PAGO >': 'efectiva',
    'RENUENTE >': 'efectiva',
    'REPROGRAMACION >': 'efectiva',
    'SE DEJO MENSAJE CON TERCEROS >': 'efectiva',
    'SE DEJO MENSAJE EN EL CELULAR >': 'efectiva',
    'SE ENVIA CARTA >': 'efectiva',
    'SE TRANSFIERE LLAMADA >': 'efectiva',
    'SI CONTACTO > CLIENTE AL DIA': 'efectiva',
    'SI CONTACTO > GESTION POR WHATSAPP - LOCALIZADO': 'efectiva',
    'SI CONTACTO > LOCALIZADO': 'efectiva',
    'SI CONTACTO > MENSAJE A TERCERO': 'efectiva',
    'SI CONTACTO > NO PUEDE PAGAR': 'efectiva',
    'SI CONTACTO > RENUENTE': 'efectiva',
    'SI CONTACTO > VOLVER A LLAMAR': 'efectiva',
    'SI CONTACTO LOCALIZADO > SI CONTACTO LOCALIZADO': 'efectiva',
    'SI CONTACTO LOCALIZADO WHATSAPP >': 'efectiva',
    'TITULAR SOLICITA LLAMAR MAS TARDE >': 'efectiva',
    'TITULAR SOLICITA LLAMAR MÁS TARDE >': 'efectiva',
    'TITULAR SOLICITA LLAMAR MÁS TARDE WHATSAPP >': 'efectiva',
    'VISITA DE CAMPO - NO SE LOCALIZA DIRECCION >': 'efectiva',
    'VISITA EFECTIVA_ENTREGADA A TECERO >': 'efectiva',
    'VISITA EFECTIVA_ENTREGADA A TERCERO >': 'efectiva',
    'VOLVER A LLAMAR >': 'efectiva',
    'VOLVER A LLAMAR > VOLVER A LLAMAR': 'efectiva',
    'YA GESTIONADO >': 'efectiva',
    'YA GESTIONADO> >': 'efectiva',
    'YA NO LABORA >': 'efectiva',
    'YA PAGO >': 'efectiva',
    'CONTACTO CON CLIENTE >': 'efectiva',
  }

  // Totales por cartera
  type ResumenCartera = {
    llamadas: number; efectivas: number; promesas: number
    montoPrometido: number; noEfectivas: number
    intervalosGestion: number[]; asesoresSet: Set<string>
  }
  const porCartera: Record<string, ResumenCartera> = {}

  // Totales por asesor (para tabla de productividad)
  type ResumenAsesor = {
    cartera: string; gestiones: number; efectivas: number
    promesas: number; monto: number; noEfectivas: number
    fechasActivo: Set<string>
    intervalosGestion: number[]
  }
  const porAsesor: Record<string, ResumenAsesor> = {}

  // Para calcular TMO: guardamos la hora anterior por asesor+cartera+día
  const horaAnterior: Record<string, { hora: Date; fecha: string }> = {}

  for (let i = 1; i < rows.length; i++) {
    const fila = rows[i]
    if (!fila || fila.every((c: any) => !c)) continue

    // ── Normalizar nombre de cartera ──────────────────────────────────
    // Usa regex \s que captura TODOS los tipos de espacio:
    // espacio normal, tab, non-breaking space (\u00A0), etc.
    const proyBruto = String(fila[cProyecto] || '')
      .replace(/^\s+|\s+$/g, '')   // trim de cualquier espacio al inicio/final
      .replace(/\s+/g, ' ')        // normalizar espacios internos múltiples
      .replace(/\u00A0/g, ' ')     // non-breaking space → espacio normal
      .replace(/\t/g, ' ')         // tabs → espacio
      .toUpperCase()
      .trim()                      // trim final por si acaso
    const cartera = MAPA_PROYECTO_PISO[proyBruto] || proyBruto
    if (!cartera || cartera === '') continue

    const asesor = String(fila[cAsesor] || '').trim()
    const clasificacion = String(fila[cClasif] || '').trim()
    const fechaRaw = cFecha >= 0 ? fila[cFecha] : null
    const horaRaw = cHora >= 0 ? fila[cHora] : null
    const fechaStr = fechaRaw
      ? (fechaRaw instanceof Date ? fechaRaw.toISOString().split('T')[0] : String(fechaRaw).split('T')[0])
      : ''

    const tipo: 'promesa' | 'efectiva' | 'no_efectiva' = CLASIF_PISO_MAP[clasificacion] || (
      clasificacion.toLowerCase().includes('promesa') ? 'promesa' :
      clasificacion.toLowerCase().includes('no atend') ||
      clasificacion.toLowerCase().includes('apagado') ||
      clasificacion.toLowerCase().includes('no contest') ||
      clasificacion.toLowerCase().includes('ocupado') ||
      clasificacion.toLowerCase().includes('numero equivoc') ? 'no_efectiva' : 'efectiva'
    )

    const monto = (tipo === 'promesa' && cMonto >= 0)
      ? (parseFloat(String(fila[cMonto] || '0').replace(/[B/.\s]/g, '').replace(',', '.')) || 0)
      : 0

    // ── Acumular por cartera ──────────────────────────────────────────
    if (!porCartera[cartera]) {
      porCartera[cartera] = { llamadas: 0, efectivas: 0, promesas: 0, montoPrometido: 0, noEfectivas: 0, intervalosGestion: [], asesoresSet: new Set() }
    }
    const rc = porCartera[cartera]
    rc.llamadas += 1
    if (asesor) rc.asesoresSet.add(asesor)
    if (tipo === 'promesa') { rc.promesas += 1; rc.efectivas += 1; rc.montoPrometido += monto }
    else if (tipo === 'efectiva') rc.efectivas += 1
    else rc.noEfectivas += 1

    // ── Acumular por asesor ───────────────────────────────────────────
    if (asesor) {
      const keyAsesor = `${asesor}||${cartera}`
      if (!porAsesor[keyAsesor]) {
        porAsesor[keyAsesor] = { cartera, gestiones: 0, efectivas: 0, promesas: 0, monto: 0, noEfectivas: 0, fechasActivo: new Set(), intervalosGestion: [] }
      }
      const ra = porAsesor[keyAsesor]
      ra.gestiones += 1
      if (fechaStr) ra.fechasActivo.add(fechaStr)
      if (tipo === 'promesa') { ra.promesas += 1; ra.efectivas += 1; ra.monto += monto }
      else if (tipo === 'efectiva') ra.efectivas += 1
      else ra.noEfectivas += 1
    }

    // ── Calcular TMO con columna HORA ─────────────────────────────────
    if (horaRaw && asesor && fechaStr) {
      let horaDate: Date | null = null
      if (horaRaw instanceof Date) {
        horaDate = horaRaw
      } else if (typeof horaRaw === 'string') {
        const p = horaRaw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
        if (p) { horaDate = new Date(); horaDate.setHours(+p[1], +p[2], +(p[3] || 0), 0) }
      }

      if (horaDate) {
        const key = `${asesor}__${cartera}__${fechaStr}`
        if (horaAnterior[key]) {
          const diff = (horaDate.getTime() - horaAnterior[key].hora.getTime()) / 60000
          if (diff > 0 && diff < 60) {
            porCartera[cartera].intervalosGestion.push(diff)
            if (asesor && porAsesor[`${asesor}||${cartera}`]) {
              porAsesor[`${asesor}||${cartera}`].intervalosGestion.push(diff)
            }
          }
        }
        horaAnterior[key] = { hora: horaDate, fecha: fechaStr }
      }
    }
  }

  // ── Serializar totales por cartera ────────────────────────────────
  const resultadoCarteras: Record<string, any> = {}
  Object.entries(porCartera).forEach(([cartera, r]) => {
    const tmo = r.intervalosGestion.length > 0
      ? parseFloat((r.intervalosGestion.reduce((a, b) => a + b, 0) / r.intervalosGestion.length).toFixed(1))
      : 0
    resultadoCarteras[cartera] = {
      llamadas: r.llamadas, efectivas: r.efectivas, promesas: r.promesas,
      montoPrometido: Math.round(r.montoPrometido), noEfectivas: r.noEfectivas,
      tiempoPromedioMin: tmo, totalAsesores: r.asesoresSet.size,
    }
  })

  // ── Serializar productividad por asesor ───────────────────────────
  const resultadoAsesores: any[] = []
  Object.entries(porAsesor).forEach(([key, r]) => {
    const nombre = key.split('||')[0]
    const diasActivo = r.fechasActivo.size
    const tmo = r.intervalosGestion.length > 0
      ? parseFloat((r.intervalosGestion.reduce((a, b) => a + b, 0) / r.intervalosGestion.length).toFixed(1))
      : 0
    resultadoAsesores.push({
      asesor: nombre,
      cartera: r.cartera,
      gestiones: r.gestiones,
      efectivas: r.efectivas,
      promesas: r.promesas,
      monto: Math.round(r.monto),
      noEfectivas: r.noEfectivas,
      tmoMin: tmo,
      diasActivo,
      gestionesPorDia: diasActivo > 0 ? Math.round(r.gestiones / diasActivo) : 0,
    })
  })

  return { carteras: resultadoCarteras, asesores: resultadoAsesores }
}

// ── Leer Blob (fetch con Authorization para acceso privado) ──────────
async function leerBlob(): Promise<any | null> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) return null
    const { blobs } = await list({ prefix: PATHNAME, limit: 1 })
    if (!blobs?.length) return null
    const res = await fetch(blobs[0].url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch (e) { return null }
}

async function escribirBlob(datos: any) {
  const blob = new Blob([JSON.stringify({ ...datos, ultimaActualizacion: new Date().toISOString() }, null, 2)], { type: 'application/json' })
  await put(PATHNAME, blob, { access: 'private', allowOverwrite: true })
}

// ── Endpoint principal ────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const archivos = formData.getAll('archivos') as File[]
    const mes = formData.get('mes') as string
    // modo: 'reemplazar' (default) | 'agregar'
    // reemplazar = el archivo ES la verdad completa del mes hasta esa fecha
    // agregar    = el archivo contiene SOLO los datos nuevos (no incluye días anteriores)
    const modo = (formData.get('modo') as string) || 'reemplazar'

    if (!archivos?.length) return NextResponse.json({ ok: false, error: 'No se recibieron archivos' }, { status: 400 })
    if (!mes) return NextResponse.json({ ok: false, error: 'Falta el mes (formato: 2026-05)' }, { status: 400 })

    const datosActuales = await leerBlob()
    if (!datosActuales) return NextResponse.json({ ok: false, error: 'Blob no inicializado. Abre /api/save primero.' }, { status: 400 })

    const idxMes = datosActuales.historico.findIndex((m: any) => m.mes === mes)
    if (idxMes < 0) return NextResponse.json({ ok: false, error: `Mes ${mes} no existe en el histórico` }, { status: 404 })

    const mRef = datosActuales.historico[idxMes]

    // Capturar minutos totales del mes ANTES de cualquier modificación
    // La diferencia neta (después - antes) es lo que se descuenta de la bolsa
    const minutosDelMesAntes = Object.values(mRef.carteras as Record<string, any>)
      .reduce((s: number, c: any) => s + (c.minutosAV || 0), 0)

    // En modo REEMPLAZAR, limpiamos los datos operativos del mes ANTES de procesar
    // (conservamos el honorario que se ingresa manualmente — solo borramos lo que viene del Excel)
    if (modo === 'reemplazar') {
      // Saber qué tipos de archivos vienen para saber qué limpiar
      const tiposArchivos = archivos.map(a => detectarArchivo(a.name).tipo)
      const tieneAV = tiposArchivos.some(t => t === 'av_cobro' || t === 'av_recordatorio')
      const tienePiso = tiposArchivos.some(t => t === 'piso')

      if (tieneAV) {
        // Limpiar minutos y gestiones AV de todas las carteras (preservar honorario)
        Object.keys(mRef.carteras).forEach(cartera => {
          mRef.carteras[cartera].minutosAV = 0
          mRef.carteras[cartera].llamadas = 0
          mRef.carteras[cartera].efectivas = 0
          mRef.carteras[cartera].promesas = 0
        })
        // Limpiar velocidad de alcance anterior
        mRef.velocidadAlcanceAV = {}
      }

      if (tienePiso) {
        // Limpiar todas las gestiones del piso y productividad
        mRef.gestionesPiso = {}
        mRef.productividadAsesores = []
      }
    }

    const resultados: any[] = []
    let totalMinutosAV = 0
    let totalGestionesAV = 0
    let totalGestionesPiso = 0

    for (const archivo of archivos) {
      const info = detectarArchivo(archivo.name)

      const buffer = await archivo.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })

      if (rows.length < 2) {
        resultados.push({ archivo: archivo.name, ok: false, error: 'Archivo vacío o sin datos' })
        continue
      }

      if (info.tipo === 'piso') {
        const { carteras: resumenCarteras, asesores: resumenAsesores } = procesarPiso(rows)
        if (!mRef.gestionesPiso) mRef.gestionesPiso = {}
        if (!mRef.productividadAsesores) mRef.productividadAsesores = []

        // Guardar totales por cartera
        Object.entries(resumenCarteras).forEach(([cartera, vals]: [string, any]) => {
          if (!mRef.gestionesPiso[cartera]) {
            mRef.gestionesPiso[cartera] = { llamadas: 0, efectivas: 0, promesas: 0, montoPrometido: 0, noEfectivas: 0, tiempoPromedioMin: 0, totalAsesores: 0 }
          }
          const p = mRef.gestionesPiso[cartera]
          p.llamadas += vals.llamadas
          p.efectivas += vals.efectivas
          p.promesas += vals.promesas
          p.montoPrometido += vals.montoPrometido
          p.noEfectivas += vals.noEfectivas
          if (vals.tiempoPromedioMin > 0) p.tiempoPromedioMin = vals.tiempoPromedioMin
          if (vals.totalAsesores > p.totalAsesores) p.totalAsesores = vals.totalAsesores
        })

        // Guardar productividad por asesor (merge con existentes)
        resumenAsesores.forEach((nuevoAsesor: any) => {
          const idx = mRef.productividadAsesores.findIndex(
            (a: any) => a.asesor === nuevoAsesor.asesor && a.cartera === nuevoAsesor.cartera
          )
          if (idx >= 0) {
            // Sumar al existente
            const ex = mRef.productividadAsesores[idx]
            ex.gestiones += nuevoAsesor.gestiones
            ex.efectivas += nuevoAsesor.efectivas
            ex.promesas += nuevoAsesor.promesas
            ex.monto += nuevoAsesor.monto
            ex.noEfectivas += nuevoAsesor.noEfectivas
            ex.diasActivo = Math.max(ex.diasActivo, nuevoAsesor.diasActivo)
            if (nuevoAsesor.tmoMin > 0) ex.tmoMin = nuevoAsesor.tmoMin
            ex.gestionesPorDia = ex.diasActivo > 0 ? Math.round(ex.gestiones / ex.diasActivo) : 0
          } else {
            mRef.productividadAsesores.push(nuevoAsesor)
          }
        })

        const gestPiso = Object.values(resumenCarteras).reduce((s: number, v: any) => s + v.llamadas, 0)
        totalGestionesPiso += gestPiso
        resultados.push({
          archivo: archivo.name, tipo: 'piso', ok: true, modo,
          carteras: Object.keys(resumenCarteras).length,
          gestiones: gestPiso,
          asesores: resumenAsesores.length,
        })

      } else if (info.tipo === 'av_cobro' || info.tipo === 'av_recordatorio') {
        const resumen = procesarAV(rows, info)

        if (!mRef.velocidadAlcanceAV) mRef.velocidadAlcanceAV = {}

        Object.entries(resumen).forEach(([cartera, vals]) => {
          if (!mRef.carteras[cartera]) {
            mRef.carteras[cartera] = { minutosAV: 0, minutosParaBolsa: 0, honorario: 0, honorarioMesAnterior: 0, promesas: 0, llamadas: 0, efectivas: 0 }
          }
          const c = mRef.carteras[cartera]
          c.minutosAV += Math.round(vals.minutosAV)
          // minutosParaBolsa: solo los de fecha > 21-05-2026
          c.minutosParaBolsa = (c.minutosParaBolsa || 0) + Math.round(vals.minutosParaBolsa)
          c.llamadas += vals.llamadas
          c.efectivas += vals.efectivas
          c.promesas += vals.promesas
          mRef.velocidadAlcanceAV[cartera] = vals.velocidadAlcance
        })

        const mins = Object.values(resumen).reduce((s, v) => s + v.minutosAV, 0)
        const minsParaBolsa = Object.values(resumen).reduce((s, v) => s + v.minutosParaBolsa, 0)
        const gests = Object.values(resumen).reduce((s, v) => s + v.llamadas, 0)
        totalMinutosAV += mins
        totalGestionesAV += gests

        const resumenVelocidad = Object.entries(resumen).map(([cartera, v]) => ({
          cartera,
          clientesPorHora: v.velocidadAlcance.clientesPorHora,
          horasParaCienClientes: v.velocidadAlcance.horasParaCienClientes,
          promedioClientesPorDia: v.velocidadAlcance.promedioClientesPorDia,
          diasConActividad: v.velocidadAlcance.diasConActividad,
        })).filter(v => v.clientesPorHora > 0)

        resultados.push({
          archivo: archivo.name, tipo: info.tipo, ok: true, modo,
          carteraEspecifica: info.carteraEspecifica,
          carteras: Object.keys(resumen).length,
          minutos: Math.round(mins),
          minutosParaBolsa: Math.round(minsParaBolsa),
          gestiones: gests,
          velocidadAlcance: resumenVelocidad,
        })
      } else {
        resultados.push({ archivo: archivo.name, ok: false, error: 'Tipo no reconocido. Verifica el nombre del archivo.' })
      }
    }


    // ── Recalcular totales del mes ────────────────────────────────────
    const carts = mRef.carteras
    mRef.minutosConsumidos = Object.values(carts).reduce((s: number, c: any) => s + (c.minutosAV || 0), 0)
    // minutosParaBolsaMes: solo los minutos después del 21-05 → es lo que descuenta la bolsa
    mRef.minutosParaBolsa = Object.values(carts).reduce((s: number, c: any) => s + (c.minutosParaBolsa || 0), 0)
    mRef.honorarioTotal = Object.values(carts).reduce((s: number, c: any) => s + (c.honorario || 0), 0)

    // ── Bolsa: NO se toca aquí ────────────────────────────────────────
    // La bolsa se calcula determinísticamente en la calculadora usando
    // minutosConsumidos real de cada mes. No hay riesgo de duplicación.

    await escribirBlob(datosActuales)

    return NextResponse.json({
      ok: true, mes, modo,
      resultados,
      resumen: {
        archivosProcessados: resultados.filter(r => r.ok).length,
        archivosFallidos: resultados.filter(r => !r.ok).length,
        totalMinutosAV: Math.round(totalMinutosAV),
        totalGestionesAV, totalGestionesPiso,
        nota: modo === 'reemplazar'
          ? 'Los datos anteriores del mes fueron reemplazados.'
          : 'Los datos fueron sumados a los existentes.',
      },
      bolsaMinutosDelMes: mRef.minutosConsumidos,
    })
  } catch (e) {
    console.error('Error en upload-excel:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

