// 奉仕年度は9月始まり〜翌年8月終わり。年度番号は「年度の途中で迎える翌8月の暦年」で表す
// (例えば2025年9月〜2026年8月の期間は「2026年度」)。ドロップダウンで選んだ年度番号がそのまま
// service_reports.yearに保存され、表示時も一切変換しない(保存値=表示値)。
export const SERVICE_YEAR_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8] as const

// 今日が属する奉仕年度を、9月始まりの境界どおりに正しく求める。
// 以前はここに、暦年をそのまま返す簡略版(currentServiceYear)を「初期値用」として置いていたが、
// 9〜12月の間だけ1年度古い年度を指すため、9月に入った瞬間に管理画面が1年前の同じ月を開く原因になっていた。
// 1年前の9月にもデータがあるのでエラーも空欄も出ず気づけない。**日付から年度を出すときは常にこの関数を使う**。
export function actualServiceYear(date = new Date()): number {
  const year = date.getFullYear()
  return date.getMonth() + 1 >= 9 ? year + 1 : year
}

// 年度ドロップダウンの選択肢。今の奉仕年度を挟んで、過去3年度分(保存期間の上限に合わせる)と
// 先の2年度分を並べる。9月をまたぐと選択肢もまるごと1つ先へ動く。
export function serviceYearOptions(date = new Date()): number[] {
  const base = actualServiceYear(date)
  return Array.from({ length: 6 }, (_, i) => base - 3 + i)
}

// 奉仕年度の並び(9月始まり)での「翌月」。8月の次は翌奉仕年度の9月になる。
// 確定後に遅れて提出された報告を翌月の会衆集計に加算するときに使う
export function nextServicePeriod(year: number, month: number): { year: number; month: number } {
  const index = SERVICE_YEAR_MONTHS.indexOf(month as (typeof SERVICE_YEAR_MONTHS)[number])
  if (index < 0) return { year, month }
  if (index === SERVICE_YEAR_MONTHS.length - 1) return { year: year + 1, month: SERVICE_YEAR_MONTHS[0] }
  return { year, month: SERVICE_YEAR_MONTHS[index + 1] }
}

export function serviceYearLabel(year: number): string {
  return `${year}年度（${year - 1}年9月〜${year}年8月）`
}
