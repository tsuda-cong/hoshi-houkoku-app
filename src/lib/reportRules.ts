// 公開報告フォームの入力から、実際にservice_reportsへ保存する値を組み立てるルール
// (以前はGoogleスプレッドシートの数式が担っていた「整える」処理のうち、①②に相当)

import { supabase } from './supabaseClient'

export const CONSIDERATION_REASONS = ['巡回大会奉仕', '地区大会奉仕', '開拓者学校', 'PVG', '国際大会奉仕', 'その他'] as const
export type ConsiderationReason = (typeof CONSIDERATION_REASONS)[number]

// 設定画面(report_rules テーブル)から変えられるルール。
// 読み込みに失敗しても報告フォームが止まらないよう、必ずこの既定値へ退避する
export interface ReportRules {
  consideredHoursCap: number
  consideredCapExemptReason: string
  auxPioneerHours: number[]
}

export const DEFAULT_REPORT_RULES: ReportRules = {
  consideredHoursCap: 55,
  consideredCapExemptReason: '開拓者学校',
  auxPioneerHours: [15, 30],
}

export async function fetchReportRules(): Promise<ReportRules> {
  const { data, error } = await supabase
    .from('report_rules')
    .select('considered_hours_cap, considered_cap_exempt_reason, aux_pioneer_hours')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return DEFAULT_REPORT_RULES
  return {
    consideredHoursCap: data.considered_hours_cap ?? DEFAULT_REPORT_RULES.consideredHoursCap,
    consideredCapExemptReason: data.considered_cap_exempt_reason ?? DEFAULT_REPORT_RULES.consideredCapExemptReason,
    auxPioneerHours:
      Array.isArray(data.aux_pioneer_hours) && data.aux_pioneer_hours.length > 0
        ? data.aux_pioneer_hours
        : DEFAULT_REPORT_RULES.auxPioneerHours,
  }
}

// ①考慮時間の上限。免除する理由(既定では「開拓者学校」)が選ばれていれば入力値をそのまま使う
// (免除理由は他の理由と同時選択できないため、含まれていれば必ず単独)。
// それ以外の理由は、奉仕時間+考慮時間が上限を超える場合、上限に届く分だけに自動調整する
export function capConsideredHours(
  hours: number,
  consideredHoursRaw: number,
  reasons: readonly ConsiderationReason[],
  rules: ReportRules = DEFAULT_REPORT_RULES,
): number {
  if (consideredHoursRaw <= 0) return 0
  if (reasons.includes(rules.consideredCapExemptReason as ConsiderationReason)) return consideredHoursRaw
  const total = hours + consideredHoursRaw
  if (total <= rules.consideredHoursCap) return consideredHoursRaw
  return Math.max(0, rules.consideredHoursCap - hours)
}

export interface RemarksInput {
  // 伝道者のみ: 補助開拓を行った月なら、その時間数(15/30など)
  auxHours: number | null
  // 正規開拓者・特別開拓者・野外の宣教者のみ: 考慮理由(複数選択可、免除理由のみ単独)
  reasons: readonly ConsiderationReason[]
  otherReasonText: string
  consideredHoursRaw: number
  cappedConsideredHours: number
  ownRemarks: string
}

// ②備考の自動合成。補助開拓なら「AP15」「AP30」のように時間を付けたものを、
// 考慮理由があれば「{理由} {入力した考慮時間}h（加算時間 {実際に採用した考慮時間}h）」を
// 先頭に付け、本人の備考を続ける
export function composeRemarks({
  auxHours,
  reasons,
  otherReasonText,
  consideredHoursRaw,
  cappedConsideredHours,
  ownRemarks,
}: RemarksInput): string {
  const own = ownRemarks.trim()

  if (auxHours !== null) return [`AP${auxHours}`, own].filter(Boolean).join(' ')

  if (reasons.length > 0) {
    const reasonLabels = reasons.map((r) => (r === 'その他' ? otherReasonText.trim() || 'その他' : r)).join('、')
    return [considerationPrefix(reasonLabels, consideredHoursRaw, cappedConsideredHours), own].filter(Boolean).join(' ')
  }

  return own
}

function considerationPrefix(reasonLabels: string, consideredHoursRaw: number, cappedConsideredHours: number): string {
  return `${reasonLabels} ${consideredHoursRaw}h（加算時間 ${cappedConsideredHours}h）`
}

// composeRemarks が付けた考慮の見出しを読み戻すための正規表現。
// **considerationPrefix と対で必ず一緒に直すこと**(片方だけ変えると読めなくなる)。
// 理由に「その他」の自由入力が入ると空白を含みうるため、後ろの固定文字列を手掛かりに最短一致で切る
const CONSIDERATION_PREFIX_RE = /^(.+?) (\d+(?:\.\d+)?)h（加算時間 (\d+(?:\.\d+)?)h）[ 　]?/

export interface ParsedConsiderationRemarks {
  /** 「巡回大会奉仕」「その他の自由入力」など、理由の表示名をそのまま */
  reasonLabels: string
  /** 本人が申告した考慮時間 */
  consideredHoursRaw: number
  /** 上限を適用した後の、実際に加算する時間 */
  cappedConsideredHours: number
  /** 見出しより後ろの、本人が書いた備考 */
  ownRemarks: string
}

/** 備考が composeRemarks の作った考慮の見出しで始まっていれば、その中身を取り出す */
export function parseConsiderationRemarks(remarks: string | null): ParsedConsiderationRemarks | null {
  if (!remarks) return null
  const m = CONSIDERATION_PREFIX_RE.exec(remarks)
  if (!m) return null
  return {
    reasonLabels: m[1],
    consideredHoursRaw: Number(m[2]),
    cappedConsideredHours: Number(m[3]),
    ownRemarks: remarks.slice(m[0].length),
  }
}

/**
 * ③管理画面で考慮時間を直したときに、備考の中の数字も合わせる。
 *
 * 備考の「〜 30h（加算時間 30h）」は保存時に組み立てた**ただの文章**で、考慮時間の数値とは
 * 別に保存されている。数値だけ直すと文章が古いまま取り残され、帳票にはその古い文章が出る。
 * 上限は報告フォームと同じ capConsideredHours を通す(理由は備考の見出しから読み取る)。
 *
 * 見出しが無い備考(手入力のものなど)は何も足さずにそのまま返す。考慮の理由が分からないため。
 */
export function applyConsideredHoursToRemarks(
  remarks: string | null,
  hours: number,
  consideredHoursRaw: number,
  rules: ReportRules = DEFAULT_REPORT_RULES,
): { remarks: string | null; cappedConsideredHours: number } {
  const parsed = parseConsiderationRemarks(remarks)
  if (!parsed) return { remarks, cappedConsideredHours: consideredHoursRaw }

  // 見出しに免除理由(既定では「開拓者学校」)が含まれていれば上限をかけない
  const reasons = parsed.reasonLabels.includes(rules.consideredCapExemptReason)
    ? ([rules.consideredCapExemptReason] as ConsiderationReason[])
    : ([] as ConsiderationReason[])
  const capped = capConsideredHours(hours, consideredHoursRaw, reasons, rules)
  const prefix = considerationPrefix(parsed.reasonLabels, consideredHoursRaw, capped)
  return {
    remarks: [prefix, parsed.ownRemarks].filter(Boolean).join(' '),
    cappedConsideredHours: capped,
  }
}
