import { useEffect } from 'react'
import { fetchLatestReportedPeriod } from './latestPeriod'

// 報告一覧と提出状況は年度・月の選択(sessionStorage)を共有している。
// このタブ(セッション)でまだ何も選んでいない場合だけ、初期値を「登録済みの最新の報告の月」に合わせる。
// 過去データをまとめて入力・復元している最中は、今日の日付よりそちらの方が実用的な初期値になるため。
//
// **両方のページで同じ処理を通しておくこと**。片方だけに置くと、どちらのページを先に開いたかで
// その後ずっと表示月が変わってしまう(共有しているキーを先に書いた方が勝つため)。
export function useLatestReportedPeriodDefault(
  storageKey: string,
  setYear: (year: number) => void,
  setMonth: (month: number) => void,
) {
  useEffect(() => {
    if (sessionStorage.getItem(storageKey) !== null) return
    fetchLatestReportedPeriod()
      .then((latest) => {
        if (!latest) return
        setYear(latest.year)
        setMonth(latest.month)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
