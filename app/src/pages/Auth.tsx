import { useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Sparkles, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Auth() {
  const navigate = useNavigate()
  const { login, register, isAuthenticated } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 已登录则跳回首页
  if (isAuthenticated) {
    navigate('/', { replace: true })
    return null
  }

  const handleSubmit = async () => {
    setError('')

    if (!email.trim()) { setError('请输入邮箱'); return }
    if (!password) { setError('请输入密码'); return }

    if (mode === 'register') {
      if (!username.trim()) { setError('请输入用户名'); return }
      if (password.length < 6) { setError('密码长度不能少于6位'); return }
      if (password !== confirmPassword) { setError('两次密码输入不一致'); return }
    }

    setLoading(true)
    try {
      const result = mode === 'login'
        ? await login(email, password)
        : await register(email, password, username)

      if (result.success) {
        navigate('/', { replace: true })
      } else {
        setError(result.message)
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } }
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  }

  return (
    <div className="min-h-screen bg-[#f5f5fa] relative overflow-hidden flex items-center justify-center p-4">
      {/* Background Decorations */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#a78bfa]/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#2dd4bf]/10 blur-3xl" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-sm"
      >
        {/* Back Button */}
        <motion.div variants={itemVariants} className="mb-4">
          <button
            onClick={() => navigate('/')}
            className="neo-card px-3 py-2 flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-bold">返回首页</span>
          </button>
        </motion.div>

        {/* Card */}
        <motion.div variants={itemVariants} className="neo-card p-6">
          {/* Title */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#e0f8f0] border-[2.5px] border-[#1a1a2e] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#6bcb9e]" />
            </div>
            <h1 className="text-lg font-black text-[#1a1a2e]">
              {mode === 'login' ? '登录' : '注册'}
            </h1>
          </div>

          {/* Tab Switcher */}
          <div className="flex mb-5 neo-card p-1">
            <button
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'login' ? 'bg-[#a78bfa] text-white' : 'text-[#778] hover:text-[#1a1a2e]'}`}
            >
              登录
            </button>
            <button
              onClick={() => { setMode('register'); setError('') }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'register' ? 'bg-[#a78bfa] text-white' : 'text-[#778] hover:text-[#1a1a2e]'}`}
            >
              注册
            </button>
          </div>

          {/* Form */}
          <div className="space-y-3">
            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99a]" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="用户名"
                    className="neo-input w-full pl-10 text-xs"
                  />
                </div>
              </motion.div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99a]" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="邮箱"
                className="neo-input w-full pl-10 text-xs"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99a]" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="密码"
                className="neo-input w-full pl-10 pr-10 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
              >
                {showPwd
                  ? <EyeOff className="w-4 h-4 text-[#99a]" />
                  : <Eye className="w-4 h-4 text-[#99a]" />
                }
              </button>
            </div>

            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99a]" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="确认密码"
                    className="neo-input w-full pl-10 text-xs"
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 neo-card p-2.5 bg-[#ffe4f0] border-[#ff8a80]"
            >
              <p className="text-[11px] font-bold text-[#ff8a80]">{error}</p>
            </motion.div>
          )}

          {/* Submit */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-4 neo-btn bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf] text-white flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>处理中...</span>
              </>
            ) : (
              <span>{mode === 'login' ? '登录' : '注册并登录'}</span>
            )}
          </motion.button>

          {/* Switch */}
          <p className="mt-4 text-center text-[11px] text-[#99a]">
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              className="ml-1 font-bold text-[#a78bfa] hover:underline cursor-pointer"
            >
              {mode === 'login' ? '立即注册' : '去登录'}
            </button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
