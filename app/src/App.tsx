import { Routes, Route, useNavigate, useLocation } from 'react-router'
import { User, LogOut } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Home from './pages/Home'
import Result from './pages/Result'
import Chat from './pages/Chat'
import Favorites from './pages/Favorites'
import AuthPage from './pages/Auth'

/** 浮动登录/用户按钮 */
function AuthButton() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // 在 auth 页隐藏
  if (location.pathname === '/auth') return null

  return (
    <div className="fixed top-4 right-4 z-50">
      {isLoading ? null : isAuthenticated && user ? (
        <div className="neo-card px-3 py-1.5 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#e0f8f0] border-[2px] border-[#1a1a2e] flex items-center justify-center">
            <User className="w-3 h-3 text-[#6bcb9e]" />
          </div>
          <span className="text-[11px] font-bold text-[#1a1a2e] max-w-[80px] truncate">
            {user.username}
          </span>
          <button
            onClick={logout}
            className="ml-1 cursor-pointer"
            title="退出登录"
          >
            <LogOut className="w-3 h-3 text-[#99a] hover:text-[#ff8a80]" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => navigate('/auth')}
          className="neo-card px-3 py-1.5 flex items-center gap-1.5 cursor-pointer hover:bg-[#f0f0f8] transition-colors"
        >
          <User className="w-3.5 h-3.5 text-[#a78bfa]" />
          <span className="text-[11px] font-bold text-[#1a1a2e]">登录</span>
        </button>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuthButton />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/result" element={<Result />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </AuthProvider>
  )
}
