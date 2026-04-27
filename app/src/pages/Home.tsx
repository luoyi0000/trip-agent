import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { motion } from 'framer-motion'
import {
  Plane, Calendar, Bus, Hotel, Utensils, ShoppingBag,
  AlertTriangle, Sparkles, Wallet, Landmark, Mountain,
  Coffee, Sparkle, ChevronRight, Loader2, MapPin, Heart, Star,
  AlertCircle
} from 'lucide-react'
import { tripAPI } from '../services/api'

/* ──────── types ──────── */
interface FormData {
  city: string
  startDate: string
  endDate: string
  transport: string
  hotel: string
  preferences: string[]
  extra: string
}

/* ──────── constants ──────── */
const PREF_OPTIONS = [
  { key: 'history', label: '历史文化', icon: Landmark, color: '#ff8a80' },
  { key: 'nature', label: '自然风光', icon: Mountain, color: '#6bcb9e' },
  { key: 'food', label: '美食', icon: Utensils, color: '#ffd93d' },
  { key: 'shopping', label: '购物', icon: ShoppingBag, color: '#a78bfa' },
  { key: 'art', label: '艺术', icon: Sparkle, color: '#ff69b4' },
  { key: 'relax', label: '休闲', icon: Coffee, color: '#64b5f6' },
]

const BUDGET_DATA = [
  { name: '交通', value: 35, color: '#a78bfa' },
  { name: '住宿', value: 40, color: '#6bcb9e' },
  { name: '餐饮', value: 15, color: '#ffd93d' },
  { name: '门票', value: 10, color: '#ff8a80' },
]

/* ──────── stagger children animation ──────── */
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
}

/* ──────── date diff helper ──────── */
function dayDiff(a: string, b: string) {
  if (!a || !b) return 1
  const d1 = new Date(a), d2 = new Date(b)
  const ms = d2.getTime() - d1.getTime()
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
  return days > 0 ? days : 1
}

/* ═══════════════════════════════════════════════════════════════
   NEO-BRUTALISM COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/** Section Card with neo-brutalism style */
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`neo-card p-2 ${className}`}>{children}</div>
  )
}

/** Section title with colored dot */
function SectionTitle({ dotColor, title }: { dotColor: string; title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <div className="section-dot" style={{ backgroundColor: dotColor }} />
      <h2 className="text-[11px] font-extrabold text-[#1a1a2e]">{title}</h2>
    </div>
  )
}

/** Neo-brutalism input */
function NeoInput({ icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ElementType }) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#889] pointer-events-none" />}
      <input
        {...props}
        className={`neo-input w-full ${Icon ? 'pl-14' : ''} ${props.className || ''}`}
      />
    </div>
  )
}

/** Neo-brutalism select */
function NeoSelect({ icon: Icon, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { icon?: React.ElementType }) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#889] pointer-events-none z-10" />}
      <select
        {...props}
        className={`neo-select w-full ${Icon ? 'pl-10' : ''} ${props.className || ''}`}
      >
        {children}
      </select>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   3D FLIP ITINERARY CARD
   ═══════════════════════════════════════════════════════════════ */
function ItineraryCard({ visible }: { visible: boolean }) {
  const [flipped, setFlipped] = useState(false)
  const itinerary = [
    { day: 'DAY 1', title: '历史文化探索', items: ['参观天安门广场、故宫博物院', '游览景山公园，俯瞰紫禁城全景', '王府井步行街品尝北京小吃'], img: '/dest-greatwall.jpg' },
    { day: 'DAY 2', title: '皇家园林之旅', items: ['颐和园漫步昆明湖畔', '圆明园遗址公园感受历史', '晚上观看京剧表演'], img: '/dest-garden.jpg' },
    { day: 'DAY 3', title: '现代北京体验', items: ['登长城（八达岭或慕田峪）', '798艺术区感受创意氛围', '三里屯太古里购物休闲'], img: '/dest-balloon.jpg' },
  ]

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate={visible ? 'show' : 'hidden'}
      className="col-span-2 perspective-1000 cursor-pointer"
      onClick={() => setFlipped(!flipped)}
    >
      <div className={`relative preserve-3d transition-transform duration-700 ease-in-out ${flipped ? 'rotate-y-180' : ''}`}>
        {/* FRONT */}
        <div className="neo-card p-5 backface-hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#ffe4f0] border-[2.5px] border-[#1a1a2e] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#ff69b4]" />
            </div>
            <h3 className="text-base font-extrabold text-[#1a1a2e]">AI 生成行程概览</h3>
            <span className="ml-auto text-[10px] font-bold text-[#889] bg-[#f0f0f5] px-2 py-1 rounded-full border border-[#ddd]">点击翻转</span>
          </div>
          <div className="space-y-3">
            {itinerary.map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#fafbfc] border-[2.5px] border-[#1a1a2e]"
                style={{ boxShadow: '3px 3px 0px 0px #1a1a2e' }}>
                <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-[2.5px] border-[#1a1a2e]">
                  <img src={d.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-extrabold text-white bg-[#a78bfa] px-1.5 py-0.5 rounded-md">{d.day}</span>
                    <h4 className="text-sm font-bold text-[#1a1a2e] truncate">{d.title}</h4>
                  </div>
                  <p className="text-xs text-[#778] truncate">{d.items[0]}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#aab] flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* BACK */}
        <div className="absolute inset-0 neo-card p-5 backface-hidden rotate-y-180 overflow-y-auto scrollbar-hide">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#e0f8f0] border-[2.5px] border-[#1a1a2e] flex items-center justify-center">
              <Calendar className="w-4 h-4 text-[#6bcb9e]" />
            </div>
            <h3 className="text-base font-extrabold text-[#1a1a2e]">每日行程时间线</h3>
            <span className="ml-auto text-[10px] font-bold text-[#889] bg-[#f0f0f5] px-2 py-1 rounded-full border border-[#ddd]">点击返回</span>
          </div>
          <div className="space-y-4">
            {itinerary.map((d, i) => (
              <div key={i}>
                <h4 className="text-xs font-extrabold text-[#a78bfa] mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#a78bfa] text-white flex items-center justify-center text-[10px]">{i + 1}</span>
                  {d.day}: {d.title}
                </h4>
                <div className="space-y-1.5 pl-8 border-l-[2.5px] border-[#e8e8f0]">
                  {d.items.map((item, j) => (
                    <p key={j} className="text-xs text-[#556] leading-relaxed flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#a78bfa] mt-1.5 flex-shrink-0" />
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   BUDGET RING CARD
   ═══════════════════════════════════════════════════════════════ */
function BudgetRing({ visible }: { visible: boolean }) {
  const [animatedValue, setAnimatedValue] = useState(0)
  const targetValue = 5200
  const circumference = 2 * Math.PI * 70
  const progress = 0.72
  const strokeDashoffset = circumference * (1 - progress)

  useEffect(() => {
    if (!visible) return
    const duration = 1200
    const startTime = performance.now()
    const animate = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setAnimatedValue(Math.round(targetValue * eased))
      if (t < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [visible])

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate={visible ? 'show' : 'hidden'}
      className="neo-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-[#e0f8f0] border-[2.5px] border-[#1a1a2e] flex items-center justify-center">
          <Wallet className="w-4 h-4 text-[#6bcb9e]" />
        </div>
        <h3 className="text-base font-extrabold text-[#1a1a2e]">预算总览</h3>
      </div>
      <div className="flex flex-col items-center">
        <div className="relative w-44 h-44">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="#e8e8f0" strokeWidth="12" />
            <motion.circle
              cx="80" cy="80" r="70"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={visible ? { strokeDashoffset } : { strokeDashoffset: circumference }}
              transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold text-[#1a1a2e]">¥{animatedValue.toLocaleString()}</span>
            <span className="text-[11px] text-[#889] mt-0.5 font-semibold">预计总花费</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5 mt-4">
          {BUDGET_DATA.map((item) => (
            <div key={item.name} className="neo-tag" style={{ backgroundColor: `${item.color}25` }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color, border: '1.5px solid #1a1a2e' }} />
              <span style={{ color: item.color }}>{item.name}</span>
              <span className="text-[#1a1a2e]">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   INSIGHT CARD
   ═══════════════════════════════════════════════════════════════ */
function InsightCard({ visible, icon: Icon, title, color, items }: {
  visible: boolean; icon: React.ElementType; title: string; color: string; items: string[]
}) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate={visible ? 'show' : 'hidden'}
      className="neo-card p-4 group cursor-default"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center border-[2.5px] border-[#1a1a2e]"
          style={{ backgroundColor: `${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <h3 className="text-sm font-extrabold text-[#1a1a2e]">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-[#667] leading-relaxed">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 border border-[#1a1a2e]" style={{ backgroundColor: color }} />
            {item}
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState<FormData>({
    city: '', startDate: '', endDate: '',
    transport: '公共交通', hotel: '经济型酒店',
    preferences: [], extra: ''
  })
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const togglePref = (key: string) => {
    setForm(prev => ({
      ...prev,
      preferences: prev.preferences.includes(key)
        ? prev.preferences.filter(p => p !== key)
        : [...prev.preferences, key]
    }))
  }

  const handleSubmit = async () => {
    if (!form.city.trim()) {
      setError('请输入目的地城市')
      return
    }
    if (!form.startDate || !form.endDate) {
      setError('请选择开始和结束日期')
      return
    }
    setError('')
    setLoading(true)

    try {
      // 将偏好 key 转换为中文 label
      const prefLabels = form.preferences.map(key =>
        PREF_OPTIONS.find(o => o.key === key)?.label || key
      )

      const request = {
        city: form.city.trim(),
        start_date: form.startDate,
        end_date: form.endDate,
        travel_days: travelDays,
        transportation: form.transport,
        accommodation: form.hotel,
        preferences: prefLabels,
        free_text_input: form.extra,
      }

      const resp = await tripAPI.planTrip(request)
      if (resp.success && resp.task_id) {
        setShowResults(true)
        // 跳转到结果页，带上 task_id
        navigate('/result?taskId=' + resp.task_id)
      } else {
        setError(resp.message || '提交失败，请重试')
      }
    } catch (e: any) {
      setError(e.message || '网络错误，请检查后端服务是否启动')
    } finally {
      setLoading(false)
    }
  }

  const travelDays = dayDiff(form.startDate, form.endDate)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#b8d8f4] via-[#c4def6] to-[#d0e4f8]">
      {/* Decorative floating elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-20 left-[5%] w-16 h-16 rounded-full bg-[#ffd93d30] border-[3px] border-[#1a1a2e20] animate-float" />
        <div className="absolute top-40 right-[8%] w-10 h-10 rounded-full bg-[#ff69b420] border-[3px] border-[#1a1a2e15] animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-[10%] w-12 h-12 rounded-full bg-[#6bcb9e20] border-[3px] border-[#1a1a2e15] animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[60%] right-[5%] w-8 h-8 bg-[#a78bfa15] rounded-xl border-[3px] border-[#1a1a2e10] animate-wiggle" />
        <div className="absolute bottom-[20%] right-[15%] w-6 h-6 bg-[#ff8a8015] rounded-lg border-[3px] border-[#1a1a2e10] animate-wiggle" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 py-5">
        {/* ═══ HERO + FORM + DASHBOARD ═══ */}
        <div className="flex flex-col lg:flex-row gap-5">
          {/* LEFT: Planning Console */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full lg:w-[300px] flex-shrink-0 space-y-3"
          >
            {/* Hero mini card */}
            <motion.div
              variants={itemVariants}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/chat?topic=旅行规划')}
              className="neo-card p-3 flex items-center gap-3 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[2.5px] border-[#1a1a2e] flex items-center justify-center flex-shrink-0">
                <Plane className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h1 className="text-sm font-black text-[#1a1a2e] leading-relaxed tracking-wide">
                  规划你的<span className="text-highlight-pink text-[#ff69b4]">完美旅行</span>
                </h1>
                <p className="text-[10px] text-[#778] font-semibold truncate tracking-wider">AI 个性化行程 · 预算管理 · 避坑指南</p>
              </div>
              <div className="flex-shrink-0 w-10 h-10">
                <img src="/travel-deco.png" alt="" className="w-full h-full object-contain animate-float" />
              </div>
            </motion.div>

            {/* Destination & Dates */}
            <motion.div variants={itemVariants}>
              <SectionCard>
                <SectionTitle dotColor="#ff8a80" title="目的地与日期" />
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-[#667] mb-0.5 block">目的地城市</label>
                    <NeoInput
                      icon={MapPin}
                      type="text"
                      value={form.city}
                      onChange={e => setForm({ ...form, city: e.target.value })}
                      placeholder="例如：北京"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] font-bold text-[#667] mb-0.5 block">开始日期</label>
                      <NeoInput
                        icon={Calendar}
                        type="date"
                        value={form.startDate}
                        onChange={e => setForm({ ...form, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#667] mb-0.5 block">结束日期</label>
                      <NeoInput
                        icon={Calendar}
                        type="date"
                        value={form.endDate}
                        onChange={e => setForm({ ...form, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#ffe4f0] to-[#e0f8f0] border-[2px] border-[#1a1a2e]"
                    style={{ boxShadow: '2px 2px 0px 0px #1a1a2e' }}
                  >
                    <span className="text-[10px] font-bold text-[#778]">旅行天数</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black text-[#1a1a2e]">{travelDays}</span>
                      <span className="text-[10px] font-bold text-[#889]">天</span>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </motion.div>

            {/* Preferences */}
            <motion.div variants={itemVariants}>
              <SectionCard>
                <SectionTitle dotColor="#a78bfa" title="偏好设置" />
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#667] mb-1 block">交通方式</label>
                      <NeoSelect icon={Bus} value={form.transport} onChange={e => setForm({ ...form, transport: e.target.value })}>
                        <option value="公共交通">公共交通</option>
                        <option value="出租车/网约车">出租车/网约车</option>
                        <option value="自驾">自驾</option>
                        <option value="步行">步行</option>
                      </NeoSelect>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#667] mb-1 block">住宿偏好</label>
                      <NeoSelect icon={Hotel} value={form.hotel} onChange={e => setForm({ ...form, hotel: e.target.value })}>
                        <option value="经济型酒店">经济型酒店</option>
                        <option value="精品民宿">精品民宿</option>
                        <option value="豪华酒店">豪华酒店</option>
                        <option value="青年旅舍">青年旅舍</option>
                      </NeoSelect>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#667] mb-1.5 block">旅行偏好</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PREF_OPTIONS.map(opt => {
                        const checked = form.preferences.includes(opt.key)
                        const Icon = opt.icon
                        return (
                          <button
                            key={opt.key}
                            onClick={() => togglePref(opt.key)}
                            className={`flex items-center justify-center gap-1 px-1.5 py-2 rounded-xl text-[10px] font-bold transition-all border-[2px] ${checked
                              ? 'border-[#1a1a2e]'
                              : 'border-[#e0e0ea] bg-[#fafbfc] text-[#99a] hover:border-[#ccc]'
                              }`}
                            style={checked ? { backgroundColor: `${opt.color}20`, color: opt.color, boxShadow: `2px 2px 0px 0px #1a1a2e` } : {}}
                          >
                            <Icon className="w-3 h-3" />
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </motion.div>

            {/* Extra Requirements */}
            <motion.div variants={itemVariants}>
              <SectionCard>
                <SectionTitle dotColor="#6bcb9e" title="额外要求" />
                <textarea
                  value={form.extra}
                  onChange={e => setForm({ ...form, extra: e.target.value })}
                  placeholder="请输入您的额外要求，例如：想去看升旗、需要无障碍设施、对海鲜过敏等..."
                  rows={2}
                  className="neo-input w-full resize-none"
                />
              </SectionCard>
            </motion.div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="neo-card p-3 flex items-center gap-2 bg-[#ffe4f0] border-[#ff8a80]"
              >
                <AlertCircle className="w-4 h-4 text-[#ff8a80] flex-shrink-0" />
                <span className="text-[11px] font-bold text-[#ff8a80]">{error}</span>
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.div variants={itemVariants}>
              <motion.button
                whileTap={{ scale: 0.97, boxShadow: '2px 2px 0px 0px #1a1a2e' }}
                onClick={handleSubmit}
                disabled={loading}
                className="w-full neo-btn bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf] text-white flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI 正在规划...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>开始规划我的旅行</span>
                  </>
                )}
              </motion.button>
            </motion.div>
          </motion.div>

          {/* RIGHT: Dashboard */}
          <div className="flex-1 flex flex-col items-center gap-3">
            {/* ═══ NAV ═══ */}
            <div className="hidden md:flex neo-card px-2 py-1.5 items-center gap-1 justify-center w-fit">
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
            {!showResults ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center"
              >
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/chat?topic=旅行规划')}
                  className="neo-card p-6 mb-6 cursor-pointer"
                >
                  <div className="w-28 h-28 mx-auto">
                    <img src="/travel-deco.png" alt="" className="w-full h-full object-contain animate-float" />
                  </div>
                </motion.div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/chat?topic=旅行规划')}
                  className="text-2xl font-black text-[#1a1a2e] mb-2 cursor-pointer"
                >
                  准备好出发了吗？
                  <span className="text-highlight-pink text-[#ff69b4] inline-block"> ✈</span>
                </motion.button>
                <p className="text-sm text-[#778] font-semibold max-w-sm">
                  在左侧填写你的旅行偏好，AI 会为你生成专属行程、预算规划和避坑指南
                </p>
                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/chat?topic=智能规划')}
                    className="neo-tag bg-[#ffe4f0] cursor-pointer"
                  >
                    <Star className="w-3 h-3 text-[#ff69b4]" />
                    <span>智能规划</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/chat?topic=预算管理')}
                    className="neo-tag bg-[#e0f8f0] cursor-pointer"
                  >
                    <Wallet className="w-3 h-3 text-[#6bcb9e]" />
                    <span>预算管理</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/chat?topic=避坑指南')}
                    className="neo-tag bg-[#fff8dc] cursor-pointer"
                  >
                    <AlertTriangle className="w-3 h-3 text-[#f5a623]" />
                    <span>避坑指南</span>
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
              >
                <ItineraryCard visible={showResults} />
                <BudgetRing visible={showResults} />

                <InsightCard
                  visible={showResults}
                  icon={Utensils}
                  title="美食推荐"
                  color="#ff8a80"
                  items={['北京烤鸭推荐四季民福', '炸酱面推荐海碗居', '簋街夜市小龙虾不可错过']}
                />
                <InsightCard
                  visible={showResults}
                  icon={ShoppingBag}
                  title="购物指南"
                  color="#6bcb9e"
                  items={['王府井百货传统商圈', '三里屯太古里潮牌聚集', '潘家园旧货市场淘宝']}
                />
                <InsightCard
                  visible={showResults}
                  icon={AlertTriangle}
                  title="避坑提示"
                  color="#f5a623"
                  items={['故宫门票需提前一周预约', '长城避免周一去（部分闭馆）', '旺季酒店建议提前预订']}
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-10 text-center pb-6">
          <div className="inline-flex items-center gap-2 neo-card px-4 py-2">
            <Heart className="w-3.5 h-3.5 text-[#ff8a80]" />
            <span className="text-[11px] font-bold text-[#99a]">智能旅行助手 &copy; 2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}
