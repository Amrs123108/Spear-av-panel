import { NextResponse } from 'next/server'
import { obtenerDashboard } from '@/lib/data/repository'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const mesIdx = parseInt(url.searchParams.get('mes') ?? '-1')
    const cerrado = url.searchParams.get('cerrado') === '1'
    const data = await obtenerDashboard(mesIdx)
    const headers: Record<string, string> = {}
    if (cerrado && data.estadoMes === 'completo') {
      headers['Cache-Control'] = 'public, s-maxage=3600, stale-while-revalidate=86400'
    } else {
      headers['Cache-Control'] = 'no-store'
    }
    return NextResponse.json(data, { headers })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const data = await obtenerDashboard(body.mesIdx ?? -1)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
