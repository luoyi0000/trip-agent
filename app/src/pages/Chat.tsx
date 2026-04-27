import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Send, Plane, Sparkles, Zap, Loader2, Plus, Trash2,
  User, Bot, AlertCircle, MessageSquare, History, PanelLeftClose, PanelLeft,
} from 'lucide-react'
import { chatAPI, type ChatSession, type ChatMessage } from '../services/api'

/* ──────── TYPES ──────── */
interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  time: string
  type?: 'text' | 'quick_reply'
}

/* ──────── INITIAL MESSAGES ──────── */
function getWelcomeMessages(context?: string): Message[] {
  return [
    {
      id: 'w1',
      role: 'ai',
      text: context
        ? `你好！我是你的智能旅行AI助手~ 🎒\n看到你正在关注「${context}」，需要我帮你详细了解吗？`
        : '你好！我是你的智能旅行AI助手~ 🎒\n有什么旅行问题都可以问我哦！',
      time: '刚刚',
      type: 'text',
    },
  ]
}

/* ═══════════════════════════════════════════════════════════════
   MAIN CHAT PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Chat() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const context = searchParams.get('topic') || ''

  const [messages, setMessages] = useState<Message[]>(getWelcomeMessages(context))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Session state
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)

  // Auto scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setSessionsLoading(true)
    try {
      const resp = await chatAPI.getSessions()
      if (resp.success) {
        setSessions(resp.data || [])
      }
    } catch (e) {
      console.error('加载会话列表失败:', e)
    } finally {
      setSessionsLoading(false)
    }
  }

  const loadSessionMessages = async (sId: number) => {
    setLoading(true)
    try {
      const resp = await chatAPI.getSessionMessages(sId)
      if (resp.success && resp.data.length > 0) {
        const loaded: Message[] = resp.data.map((m: ChatMessage) => ({
          id: m.id.toString(),
          role: m.role as 'user' | 'ai',
          text: m.text,
          time: new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        }))
        setMessages(loaded)
        setSessionId(sId)
      }
    } catch (e) {
      console.error('加载消息失败:', e)
    } finally {
      setLoading(false)
    }
  }

  const startNewChat = () => {
    setMessages(getWelcomeMessages(context))
    setSessionId(null)
    setError('')
  }

  const deleteSessionItem = async (sId: number) => {
    try {
      await chatAPI.deleteSession(sId)
      setSessions(prev => prev.filter(s => s.id !== sId))
      if (sessionId === sId) {
        startNewChat()
      }
    } catch (e) {
      console.error('删除会话失败:', e)
    }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim()) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError('')

    try {
      // 构建历史记录（最近6轮）
      const history = messages.slice(-12).map(m => ({
        role: m.role,
        text: m.text,
      }))

      const resp = await chatAPI.send({
        message: text,
        history,
        context: context || undefined,
        session_id: sessionId,
      })

      // 保存/更新 sessionId
      if (resp.session_id && resp.session_id !== sessionId) {
        setSessionId(resp.session_id)
        // 刷新会话列表
        loadSessions()
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: resp.reply || '抱歉，我没有理解您的问题。',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (e: any) {
      setError(e.message || '网络错误，请稍后重试')
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: `收到你的问题！「${text}」\n\n💡 我是智能旅行助手，可以帮你：\n• 详细分析具体景点\n• 推荐周边美食\n• 优化行程安排\n• 提供实时天气提醒\n\n（当前AI服务暂时不可用，请稍后重试）`,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, aiMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const quickReplies = ['景点推荐', '美食攻略', '酒店对比', '交通路线', '避坑指南', '预算优化']

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-[#b8d8f4] via-[#c4def6] to-[#d0e4f8]">
      {/* ═══ TOP BAR ═══ */}
      <div className="neo-card mx-3 mt-3 px-4 py-3 flex items-center gap-3 z-10 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-full bg-[#ffe4f0] border-[2.5px] border-[#1a1a2e] flex items-center justify-center shadow-[2px_2px_0px_0px_#1a1a2e]"
        >
          <ChevronLeft className="w-5 h-5 text-[#ff69b4]" />
        </motion.button>

        {/* Toggle sidebar */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowSidebar(!showSidebar)}
          className="w-9 h-9 rounded-full bg-white border-[2.5px] border-[#1a1a2e] flex items-center justify-center shadow-[2px_2px_0px_0px_#1a1a2e] lg:hidden"
        >
          {showSidebar ? <PanelLeftClose className="w-4 h-4 text-[#778]" /> : <PanelLeft className="w-4 h-4 text-[#778]" />}
        </motion.button>

        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[2.5px] border-[#1a1a2e] flex items-center justify-center shadow-[2px_2px_0px_0px_#1a1a2e]">
          <Plane className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-extrabold text-[#1a1a2e]">智能旅行AI助手</h1>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#6bcb9e] border border-[#1a1a2e]" />
            <span className="text-[10px] font-bold text-[#6bcb9e]">在线</span>
          </div>
        </div>

        <div className="neo-tag bg-[#e0f8f0] py-1 px-2" style={{ boxShadow: '2px 2px 0px 0px #1a1a2e' }}>
          <Sparkles className="w-3 h-3 text-[#6bcb9e]" />
          <span className="text-[10px]">AI</span>
        </div>
      </div>

      {/* ═══ NAV ═══ */}
      <div className="hidden md:flex neo-card mx-3 mt-3 px-2 py-1.5 items-center gap-1 w-fit flex-shrink-0">
        {[
          { label: '首页', path: '/' },
          { label: '行程', path: '/result' },
          { label: '攻略', path: '/chat?topic=旅行攻略' },
          { label: '收藏', path: '/favorites' },
        ].map((item) => {
          const isActive =
            (item.path === '/' && location.pathname === '/') ||
            (item.path === '/result' && location.pathname === '/result') ||
            (item.path === '/favorites' && location.pathname === '/favorites') ||
            (item.path.startsWith('/chat') && location.pathname === '/chat')
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isActive
                  ? 'bg-[#ffe4f0] text-[#ff69b4]'
                  : 'text-[#778] hover:bg-[#f5f5fa]'
                }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── SESSION SIDEBAR ── */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 overflow-hidden border-r-[2px] border-[#1a1a2e]/10"
            >
              <div className="w-[240px] h-full flex flex-col p-3">
                {/* New chat button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={startNewChat}
                  className="neo-btn bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf] text-white flex items-center gap-2 py-2.5 px-3 text-xs mb-3 justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新建对话
                </motion.button>

                {/* Session list */}
                <div className="flex-1 space-y-1 overflow-y-auto">
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <History className="w-3 h-3 text-[#a78bfa]" />
                    <span className="text-[10px] font-extrabold text-[#1a1a2e]">历史对话</span>
                  </div>

                  {sessionsLoading && sessions.length === 0 ? (
                    <div className="text-[10px] text-[#99a] font-semibold text-center py-4">加载中...</div>
                  ) : sessions.length === 0 ? (
                    <div className="text-[10px] text-[#99a] font-semibold text-center py-4">暂无对话</div>
                  ) : (
                    sessions.map(s => (
                      <div key={s.id} className="group flex items-center gap-1">
                        <button
                          onClick={() => loadSessionMessages(s.id)}
                          className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-[10px] font-bold transition-all text-left ${
                            sessionId === s.id
                              ? 'bg-[#ffe4f0] text-[#ff69b4] border-[1.5px] border-[#1a1a2e]'
                              : 'text-[#778] hover:bg-[#f5f5fa] border-[1.5px] border-transparent'
                          }`}
                        >
                          <MessageSquare className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate flex-1">{s.title}</span>
                          <span className="text-[8px] text-[#aab]">{s.msg_count}条</span>
                        </button>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => deleteSessionItem(s.id)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-[#ffe4f0] border-[1.5px] border-[#1a1a2e] flex items-center justify-center flex-shrink-0 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3 text-[#ff8a80]" />
                        </motion.button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CHAT AREA ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-hide"
          >
            {/* Date divider */}
            <div className="flex justify-center">
              <div className="neo-tag bg-[#f0f0f5] py-1 px-3" style={{ boxShadow: '2px 2px 0px 0px #1a1a2e' }}>
                <span className="text-[10px] text-[#99a]">{sessionId ? '历史对话' : '新对话'}</span>
              </div>
            </div>

            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-[2px] border-[#1a1a2e] flex-shrink-0 shadow-[2px_2px_0px_0px_#1a1a2e] ${msg.role === 'ai'
                    ? 'bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf]'
                    : 'bg-[#ffe4f0]'
                    }`}>
                    {msg.role === 'ai' ? (
                      <Bot className="w-4 h-4 text-white" />
                    ) : (
                      <User className="w-4 h-4 text-[#ff69b4]" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className="max-w-[75%]">
                    <div
                      className={`px-4 py-3 rounded-2xl border-[2.5px] border-[#1a1a2e] ${msg.role === 'ai'
                        ? 'bg-white shadow-[3px_3px_0px_0px_#1a1a2e]'
                        : 'bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf] shadow-[3px_3px_0px_0px_#1a1a2e]'
                        }`}
                    >
                      <p className={`text-xs leading-relaxed whitespace-pre-line ${msg.role === 'ai' ? 'text-[#1a1a2e]' : 'text-white'
                        }`}>
                        {msg.text}
                      </p>
                    </div>
                    <p className={`text-[9px] text-[#aab] mt-1 font-semibold ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {msg.time}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[2px] border-[#1a1a2e] flex items-center justify-center shadow-[2px_2px_0px_0px_#1a1a2e]">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-white border-[2.5px] border-[#1a1a2e] shadow-[3px_3px_0px_0px_#1a1a2e]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#a78bfa] animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-2 h-2 rounded-full bg-[#a78bfa] animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <div className="w-2 h-2 rounded-full bg-[#a78bfa] animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-center"
              >
                <div className="neo-tag bg-[#ffe4f0] py-1 px-3 flex items-center gap-1" style={{ boxShadow: '2px 2px 0px 0px #1a1a2e' }}>
                  <AlertCircle className="w-3 h-3 text-[#ff8a80]" />
                  <span className="text-[10px] text-[#ff8a80] font-bold">{error}</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* ═══ QUICK REPLIES ═══ */}
          <div className="px-3 py-2 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {quickReplies.map((reply) => (
                <motion.button
                  key={reply}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => sendMessage(reply)}
                  className="neo-tag bg-white flex-shrink-0 py-1.5 px-3"
                  style={{ boxShadow: '2px 2px 0px 0px #1a1a2e' }}
                >
                  <Zap className="w-3 h-3 text-[#ffd93d]" />
                  <span className="text-[11px]">{reply}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* ═══ INPUT BAR ═══ */}
          <form
            onSubmit={handleSubmit}
            className="neo-card mx-3 mb-3 px-3 py-2.5 flex items-center gap-2 flex-shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="问我关于旅行的问题..."
              className="flex-1 bg-[#fafbfc] rounded-xl px-3 py-2.5 text-sm text-[#1a1a2e] placeholder:text-[#aab] outline-none border-[2px] border-[#e8e8f0] focus:border-[#a78bfa] transition-colors"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="submit"
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf] border-[2.5px] border-[#1a1a2e] flex items-center justify-center shadow-[2px_2px_0px_0px_#1a1a2e] disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </motion.button>
          </form>
        </div>
      </div>
    </div>
  )
}
