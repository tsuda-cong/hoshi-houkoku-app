import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: '報告一覧', end: true },
  { to: '/submission-status', label: '提出状況' },
  { to: '/publishers', label: '名簿' },
  { to: '/pioneer-progress', label: '開拓者進捗' },
  { to: '/reports', label: '帳票印刷' },
]

const ADMIN_NAV_ITEM = { to: '/staff', label: '設定', end: false }

export function Layout({ children }: { children: ReactNode }) {
  const { signOut, isAdmin } = useAuth()
  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  // ヘッダーは画面上部に固定表示する(position: sticky)。各ページの.sticky-toolbar
  // (報告一覧のナビゲーション・集計表、提出状況のナビゲーションなど)は、このヘッダーの
  // 実測の高さをCSS変数で受け取り、その直下に重ならず固定できるようにする。
  // ナビゲーションの行数や開閉でヘッダーの高さが変わるため、固定値では対応できない
  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return
    const setHeaderHeight = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    setHeaderHeight()
    const observer = new ResizeObserver(setHeaderHeight)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 狭い画面のハンバーガーメニューを、メニュー外をタップ/クリックしたときにも閉じる
  useLayoutEffect(() => {
    if (!menuOpen) return
    function handleOutside(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  return (
    <div className="app-shell">
      <header className="app-header" ref={headerRef}>
        {/* 狭い画面だけCSSで表示するハンバーガーボタン。広い画面ではタブがそのまま並ぶ */}
        <button
          type="button"
          className="nav-toggle"
          aria-label="メニュー"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>
        <nav className={`app-nav ${menuOpen ? 'is-open' : ''}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="link-button" onClick={signOut}>
          ログアウト
        </button>
      </header>
      <main>{children}</main>
      <footer className="app-footer">
        バージョン: {__APP_BUILD_TIME__.slice(0, 10)} ({__APP_VERSION__})
      </footer>
    </div>
  )
}
