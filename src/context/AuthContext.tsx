import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { StaffRole } from '../types/domain'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  staffRole: StaffRole | null
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // getSession()とonAuthStateChangeの両方がloadStaffRoleを呼ぶことがあり、
    // 後から完了した方が先に完了した方の結果を上書きしてしまうため、
    // 常に「一番最後に呼び出した問い合わせ」の結果だけを反映する
    let loadSeq = 0

    async function loadStaffRole(userId: string) {
      const seq = ++loadSeq
      const { data, error } = await supabase.from('staff').select('role').eq('user_id', userId).maybeSingle()
      if (cancelled || seq !== loadSeq) return
      if (error) {
        // 通信の一時的な失敗などで権限が取得できなかった場合、無言で監督者相当に格下げしない。
        // 直前の値を保持し、原因調査のためコンソールに残す
        console.error('staffロールの取得に失敗しました', error)
        return
      }
      setStaffRole((data?.role as StaffRole | undefined) ?? null)
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) await loadStaffRole(data.session.user.id)
      if (!cancelled) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return
      setSession(newSession)
      if (newSession) {
        loadStaffRole(newSession.user.id)
      } else {
        loadSeq++ // 進行中の問い合わせがあれば無効化してから、ログアウトを反映する
        setStaffRole(null)
      }
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, staffRole, isAdmin: staffRole === 'admin', signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
