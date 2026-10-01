import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が設定されていません。.env.local を作成してください。',
  )
}

// テーブル結合クエリを types/domain.ts の手書き型 + .returns<T>() で扱うため、
// supabase-js の Database ジェネリックはあえて使わない(PostgREFT select文字列パーサーが
// 未定義の Relationships を推論できず never 型になってしまうため)。
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 報告フォーム(/submit)専用。**同じブラウザで管理画面にログインしていても、常に未ログイン(anon)として送る。**
// 共通の supabase を使うと、ログイン中の人は authenticated として送信され、anon 向けの書き込み許可
// (service_reports_public_insert/update)が効かない。管理者は is_admin() で通るが、監督者は
// 書き込み権限が無いため 42501 で拒否されていた(2026-10-01、監督者がPCで送れなかった件)。
// セッションを保存も読み込みもしないので、管理画面のログイン状態には一切影響しない。
// storageKey を分けるのは、同じ保存場所を2つのクライアントが奪い合わないようにするため
export const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'public-report-form',
  },
})
