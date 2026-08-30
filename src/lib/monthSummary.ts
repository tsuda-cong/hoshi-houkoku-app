import type { PioneerStatus, Publisher, ServiceReport } from '../types/domain'
import { shortStatus } from './statusShort'

// 報告一覧の上に出す「立場別の集計」。画面の小表と報告一覧PDFで同じものを使う
// (以前は同じ計算が両方に写してあり、片方だけ直すとずれる状態だった)。
// 不活発者は報告を出さないので行に並べない。
// 表記は statusShort.ts に一本化してある。ここに書き写すと、同じ画面で
// 集計表とカードの立場が食い違う(実際に「開」と「正開」が混在した)
const SUMMARY_STATUS_ORDER: PioneerStatus[] = ['伝道者', '補助開拓者', '正規開拓者', '特別開拓者', '野外の宣教者']

export interface MonthSummaryRow {
  status: PioneerStatus
  label: string
  count: number
  studies: number
  hours: number
}

export interface MonthSummary {
  rows: MonthSummaryRow[]
  total: { count: number; studies: number; hours: number }
}

export function buildMonthSummary(reports: ServiceReport[], publishers: Publisher[]): MonthSummary {
  // 集計はNC(集計対象外)を除く
  const counted = reports.filter((r) => !r.no_count)
  const allRows: MonthSummaryRow[] = SUMMARY_STATUS_ORDER.map((status) => {
    const matching = counted.filter((r) => r.pioneer_status_snapshot === status)
    return {
      status,
      label: shortStatus(status),
      // 「報告の数」は行数ではなく人数で数える。前月から回ってきた分により
      // 同じ人の行が2つ入りうるため(会衆集計と同じ数え方)
      count: new Set(matching.map((r) => r.publisher_id)).size,
      studies: matching.reduce((sum, r) => sum + r.bible_studies, 0),
      hours: matching.reduce((sum, r) => sum + r.hours, 0),
    }
  })

  // 合計は**絞り込む前の全立場**から出す。こうしておけば、行を隠しても合計は変わらない
  const total = {
    count: new Set(counted.map((r) => r.publisher_id)).size,
    studies: allRows.reduce((sum, r) => sum + r.studies, 0),
    hours: allRows.reduce((sum, r) => sum + r.hours, 0),
  }

  // その立場の人がそもそもいない行(会衆に特別開拓者・野外の宣教者がいない場合など)は出さない。
  // **「報告がまだ無い」立場は隠さない**。隠してしまうと、補助開拓者が3人いてまだ誰も出していない月に
  // 行ごと消えてしまい、報告が集まるにつれて行が生えることになる。「補 0人」と出ている方が実態が分かる。
  //
  // 該当者がいるかどうかは、名簿の現在の立場と、その月の報告に残った当時の立場の両方で見る。
  // 補助開拓者はその月だけということがあり名簿の現在の立場には残らないため、名簿だけで判断すると
  // 過去の月を開いたときに行が消える。逆に報告だけで判断すると上記の「生えてくる」問題が起きる。
  // 立場の有無は人がいるかどうかの話なので、NCを除く前の reports で見る。
  const rosterStatuses = new Set<string>(publishers.filter((p) => p.is_active).map((p) => p.pioneer_status))
  const reportedStatuses = new Set<string>(reports.map((r) => r.pioneer_status_snapshot))

  return {
    rows: allRows.filter((r) => rosterStatuses.has(r.status) || reportedStatuses.has(r.status)),
    total,
  }
}
