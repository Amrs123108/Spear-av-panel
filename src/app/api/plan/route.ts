import { NextResponse } from 'next/server'

// Planes precargados basados en el análisis
const planesIniciales = [
  {
    id: "plan-2026-05-12",
    fecha: "2026-05-12",
    semana: "Semana del 12 de Mayo 2026",
    estado: "en_curso",
    acciones: [
      {
        id: "a1", descripcion: "Construir conversor de formato para gestiones Banistmo",
        responsable: "Encargado AV", impactoEsperado: "+B/.3,007/mes en honorario no cobrado",
        completada: false, resultado: ""
      },
      {
        id: "a2", descripcion: "Reducir minutos AV en Krediya de 1,268 a 200",
        responsable: "Encargado AV", impactoEsperado: "Liberar B/.305/mes en costo variable",
        completada: false, resultado: ""
      },
      {
        id: "a3", descripcion: "Reducir minutos AV en Tigo de 1,286 a 400",
        responsable: "Encargado AV", impactoEsperado: "Liberar B/.253/mes en costo variable",
        completada: false, resultado: ""
      },
      {
        id: "a4", descripcion: "Aumentar minutos AV en Banistmo Activa de 1,490 a 2,200",
        responsable: "Encargado AV", impactoEsperado: "+B/.5,000-8,000/mes estimado",
        completada: false, resultado: ""
      },
    ],
    notas: "Primera semana de implementación del plan de optimización. Prioridad: capturar el leak de Banistmo.",
    metaHonorario: 180000,
    honorarioRealizado: 0,
  }
]

export async function GET() {
  return NextResponse.json({ ok: true, planes: planesIniciales })
}

export async function POST(req: Request) {
  const body = await req.json()
  // En producción guardaríamos en BD
  // Por ahora devolvemos confirmación
  return NextResponse.json({ ok: true, plan: body })
}
