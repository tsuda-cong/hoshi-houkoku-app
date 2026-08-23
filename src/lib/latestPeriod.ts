import { supabase } from './supabaseClient'

export interface ServicePeriod {
  year: number
  month: number
}

// 奉仕年度の並びは9,10,11,12,1,2,...,8 なので、暦の月の最小/最大では端の月を求められない
// (同じ年度なら9月が一番古く、8月が一番新しい)。そこで「9〜12月」と「1〜8月」の2つの塊に分け、
// 古い側なら9〜12月を、新しい側なら1〜8月を先に探して、見つかった時点でそれが端の月になる。
//
// **必ず limit 1 で1件だけ取ること**。以前は1年度分の月をまとめて取ってJS側で比べていたが、
// 1年度分は伝道者66人×12か月=最大792行あり、会衆が84人を超えるとSupabaseの既定の
// 取得上限1000行に当たる。上限を超えても**エラーにならず黙って切り捨てられる**ため、
// 端の月が静かにずれる作りだった。
async function fetchEdgeMonthInYear(year: number, edge: 'oldest' | 'newest'): Promise<number | null> {
  const ascending = edge === 'oldest'
  const halves = edge === 'oldest' ? ([{ gte: 9 }, { lte: 8 }] as const) : ([{ lte: 8 }, { gte: 9 }] as const)

  for (const half of halves) {
    const base = supabase.from('service_reports').select('month').eq('year', year)
    const filtered = 'gte' in half ? base.gte('month', half.gte) : base.lte('month', half.lte)
    const { data, error } = await filtered
      .order('month', { ascending })
      .limit(1)
      .returns<{ month: number }[]>()
    if (error) throw error
    if (data && data.length > 0) return data[0].month
  }
  return null
}

async function fetchEdgePeriod(edge: 'oldest' | 'newest'): Promise<ServicePeriod | null> {
  const { data, error } = await supabase
    .from('service_reports')
    .select('year')
    .order('year', { ascending: edge === 'oldest' })
    .limit(1)
    .returns<{ year: number }[]>()
  if (error) throw error
  if (!data || data.length === 0) return null

  const year = data[0].year
  const month = await fetchEdgeMonthInYear(year, edge)
  if (month === null) return null
  return { year, month }
}

// 実際に報告が登録されている一番新しい月。
// アプリ起動時の年度・月の初期値と、報告一覧の「最新 》」ボタンの行き先に使う。
export function fetchLatestReportedPeriod(): Promise<ServicePeriod | null> {
  return fetchEdgePeriod('newest')
}

// 実際に報告が登録されている一番古い月。報告一覧の「《 最古」ボタンの行き先に使う
export function fetchOldestReportedPeriod(): Promise<ServicePeriod | null> {
  return fetchEdgePeriod('oldest')
}

export async function fetchLatestReportedYear(): Promise<number | null> {
  const latest = await fetchLatestReportedPeriod()
  return latest?.year ?? null
}
