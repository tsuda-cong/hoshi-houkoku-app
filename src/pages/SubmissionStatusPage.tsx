import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { ROSTER_STATUS_ORDER, type Group, type Publisher, type ServiceReport } from '../types/domain'
import { serviceYearOptions } from '../lib/serviceYear'
import { computeReportPeriod } from '../lib/reportPeriod'
import { useSessionPersistedState } from '../lib/usePersistedState'
import { useLatestReportedPeriodDefault } from '../lib/useLatestPeriodDefault'

const YEAR_OPTIONS = serviceYearOptions()
const MONTH_OPTIONS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]

export function SubmissionStatusPage() {
  const [publishers, setPublishers] = useState<Publisher[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [reports, setReports] = useState<ServiceReport[]>([])
  // 報告一覧ページと同じキーを使い、年度・月の選択を共有する(報告入力→提出状況確認という運用の流れに合わせるため)。
  // 初期値は報告フォームと同じ規則で「いま提出を受け付けている月」を出す(9月をまたいでも1年ずれない)
  const initialPeriod = computeReportPeriod()
  const [year, setYear] = useSessionPersistedState('reportList.year', initialPeriod.year)
  const [month, setMonth] = useSessionPersistedState('reportList.month', initialPeriod.month)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useLatestReportedPeriodDefault('reportList.year', setYear, setMonth)

  useEffect(() => {
    // 起動直後にuseLatestReportedPeriodDefaultでyear/monthが変わると、古いyear/monthでの取得が
    // 後から解決して新しい結果を上書きすることがあるため、最新でなくなった実行の結果は反映しない
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('publishers').select('*').eq('is_active', true).order('last_name_kana').returns<Publisher[]>(),
      supabase.from('groups').select('*').order('name').returns<Group[]>(),
      supabase.from('service_reports').select('*').eq('year', year).eq('month', month).returns<ServiceReport[]>(),
    ])
      .then(([pubRes, groupRes, reportRes]) => {
        if (cancelled) return
        if (pubRes.error) throw pubRes.error
        if (groupRes.error) throw groupRes.error
        if (reportRes.error) throw reportRes.error
        setPublishers(pubRes.data ?? [])
        setGroups(groupRes.data ?? [])
        setReports(reportRes.data ?? [])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '読み込みに失敗しました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year, month])

  // 転入前の記録などnoCountが立った報告は、提出済み扱いにしない
  const submittedIds = useMemo(
    () => new Set(reports.filter((r) => !r.no_count).map((r) => r.publisher_id)),
    [reports],
  )

  const byGroup = useMemo(() => {
    // グループ内は伝道者→正規開拓者→特別開拓者→野外の宣教者(→補助開拓者→不活発者)の順、各々の中はローマ字順
    const byRosterOrder = (a: Publisher, b: Publisher) => {
      const statusDiff = ROSTER_STATUS_ORDER.indexOf(a.pioneer_status) - ROSTER_STATUS_ORDER.indexOf(b.pioneer_status)
      return statusDiff !== 0 ? statusDiff : (a.romaji ?? '').localeCompare(b.romaji ?? '')
    }
    const groupsWithNone = [...groups, { id: '__none__', name: '未設定' } as Group]
    return groupsWithNone
      .map((g) => ({
        group: g,
        publishers: publishers.filter((p) => (p.group_id ?? '__none__') === g.id).sort(byRosterOrder),
      }))
      .filter((g) => g.publishers.length > 0)
  }, [groups, publishers])

  if (loading) return <div className="center-message">読み込み中...</div>

  const submittedCount = publishers.filter((p) => submittedIds.has(p.id)).length

  return (
    <div className="page">
      <div className="page-header">
        <h1>提出状況</h1>
        {/* 管理者・監督者が自分の報告を出すための入口。ホーム画面に追加して使う場合、
            Androidのショートカットは使えてもiOSでは使えないため、画面内にも置いている */}
        <Link className="header-button" to="/submit">
          報告フォーム
        </Link>
      </div>
      {/* 年度・月・提出済み人数は、下のグループを縦スクロールしても画面上部に固定しておく */}
      <div className="sticky-toolbar">
        <div className="date-nav">
          <label>
            年度
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
          </label>
          <label>
            月
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>
          </label>
          <span>
            提出済み {submittedCount} / {publishers.length} 名
          </span>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="submission-status-groups">
        {byGroup.map(({ group, publishers: groupPublishers }) => (
          <div key={group.id} className="submission-status-group">
            <h2 style={{ fontSize: 15, marginBottom: 8 }}>
              {group.name} ({groupPublishers.filter((p) => submittedIds.has(p.id)).length}/{groupPublishers.length})
            </h2>
            <table className="crud-table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>状況</th>
                </tr>
              </thead>
              <tbody>
                {groupPublishers.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.last_name} {p.first_name}
                    </td>
                    <td>
                      <span className={`status-badge ${submittedIds.has(p.id) ? 'submitted' : 'pending'}`}>
                        {submittedIds.has(p.id) ? '済' : '未'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
