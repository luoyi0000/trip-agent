import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router'
import { motion } from 'framer-motion'
import {
  ChevronLeft, ChevronDown, Pencil, Download,
  MapPin, Calendar, Lightbulb, Ticket, Utensils, Bus, Hotel,
  Map as MapIcon, CloudSun, Sun, CloudRain, Cloud,
  Wind, Star, Footprints, Home,
  Sparkles, Landmark,
  Heart, Wallet, AlertCircle, RefreshCw,
  Clock, Trash2, Plus, History
} from 'lucide-react'
import { tripAPI, poiAPI, favoritesAPI, type TripPlan, type HistoryItem } from '../services/api'
import MapView from '../components/MapView'

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function mealTypeLabel(type: string) {
  const map: Record<string, string> = {
    breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '小吃'
  }
  return map[type] || type
}

function weatherToIcon(dayWeather: string) {
  const w = dayWeather || ''
  if (w.includes('晴')) return 'sun'
  if (w.includes('雨')) return 'rain'
  return 'cloud'
}

function formatTemp(v: number | string) {
  if (typeof v === 'number') return `${v}°C`
  const s = String(v).replace(/°C|℃|°/g, '').trim()
  return s ? `${s}°C` : '—'
}

function durationText(minutes: number) {
  if (!minutes || minutes <= 0) return '约120分钟'
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}小时${m}分钟` : `${h}小时`
  }
  return `${minutes}分钟`
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function WeatherIcon({ type }: { type: string }) {
  if (type === 'sun') return <Sun className="w-5 h-5 text-[#ffd93d]" />
  if (type === 'rain') return <CloudRain className="w-5 h-5 text-[#64b5f6]" />
  return <Cloud className="w-5 h-5 text-[#aab]" />
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-[2.5px] ${active
        ? 'bg-[#ffe4f0] border-[#1a1a2e] text-[#ff69b4] shadow-[3px_3px_0px_0px_#1a1a2e]'
        : 'bg-white/60 border-transparent text-[#778] hover:bg-white hover:border-[#ddd]'
        }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

function AttractionImage({ name, imageUrl, keyword, city }: { name: string; imageUrl?: string; keyword?: string; city?: string }) {
  const [url, setUrl] = useState<string | null>(imageUrl || null)

  useEffect(() => {
    if (imageUrl) return
    let cancelled = false
    poiAPI.getPhoto(name, keyword, city).then(res => {
      if (!cancelled && res.data?.photo_url) {
        setUrl(res.data.photo_url)
      }
    }).catch(() => { })
    return () => { cancelled = true }
  }, [name, imageUrl, keyword, city])

  if (url) {
    return <img src={url} alt={name} className="w-full h-full object-cover" />
  }

  // fallback gradient
  const gradients = [
    'from-[#ff8a80] to-[#ff69b4]',
    'from-[#a78bfa] to-[#64b5f6]',
    'from-[#6bcb9e] to-[#2dd4bf]',
    'from-[#ffd93d] to-[#ff8a80]',
    'from-[#64b5f6] to-[#a78bfa]',
  ]
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const grad = gradients[hash % gradients.length]

  return (
    <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
      <Landmark className="w-8 h-8 text-white/60" />
    </div>
  )
}

function DayAccordion({ data, isOpen, onToggle, navigate, city, toggleFavorite, favoriteIds }: {
  data: TripPlan['days'][0]; isOpen: boolean; onToggle: () => void; navigate: (path: string) => void; city?: string
  toggleFavorite?: (type: string, title: string, subtitle: string, tag: string) => void
  favoriteIds?: Set<string>
}) {
  const dayNum = data.day_index + 1
  return (
    <div className="neo-accordion">
      <div className="neo-accordion-header" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="neo-step-dot bg-[#a78bfa]">{dayNum}</div>
          <div>
            <h4 className="text-sm font-extrabold text-[#1a1a2e]">第{dayNum}天</h4>
            <p className="text-[10px] text-[#99a] font-semibold">{data.date}</p>
          </div>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-[#889]" />
        </motion.div>
      </div>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="neo-accordion-content space-y-4">
          {/* Overview */}
          <div className="p-3 rounded-xl bg-[#fafbfc] border-[2px] border-[#e8e8f0]">
            <div className="flex items-start gap-2">
              <Footprints className="w-4 h-4 text-[#a78bfa] mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs text-[#556]"><span className="font-bold text-[#1a1a2e]">行程描述：</span>{data.description || `第${dayNum}天行程`}</p>
                <p className="text-xs text-[#556]"><span className="font-bold text-[#1a1a2e]">交通方式：</span>{data.transportation}</p>
                <p className="text-xs text-[#556]"><span className="font-bold text-[#1a1a2e]">住宿：</span>{data.accommodation}</p>
              </div>
            </div>
          </div>

          {/* Spots */}
          {data.attractions && data.attractions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#e8e4ff] border-[2px] border-[#1a1a2e] flex items-center justify-center">
                  <Landmark className="w-3 h-3 text-[#a78bfa]" />
                </div>
                <h5 className="text-xs font-extrabold text-[#1a1a2e]">景点安排</h5>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.attractions.map((spot, i) => (
                  <motion.div
                    key={i}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/chat?topic=${encodeURIComponent(spot.name)}`)}
                    className="neo-card-sm p-3 cursor-pointer"
                  >
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                      {toggleFavorite && (
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={(e) => { e.stopPropagation(); toggleFavorite('spot', spot.name, spot.address || '', '景点') }}
                          className="w-6 h-6 rounded-full bg-white border-[1.5px] border-[#1a1a2e] flex items-center justify-center shadow-[1px_1px_0px_0px_#1a1a2e]"
                        >
                          <Heart className={`w-3 h-3 ${favoriteIds?.has(spot.name) ? 'text-[#ff69b4] fill-[#ff69b4]' : 'text-[#889]'}`} />
                        </motion.button>
                      )}
                      <div className="w-6 h-6 rounded-full bg-[#a78bfa] border-[1.5px] border-[#1a1a2e] flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="h-24 rounded-lg overflow-hidden border-[2px] border-[#1a1a2e] mb-2 flex items-center justify-center">
                      <AttractionImage
                        name={spot.name}
                        imageUrl={spot.image_url}
                        keyword={spot.image_search_keyword}
                        city={city}
                      />
                    </div>
                    <h6 className="text-xs font-extrabold text-[#1a1a2e] mb-1">{spot.name}</h6>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-[#889]"><span className="font-semibold text-[#667]">地址：</span>{spot.address || '—'}</p>
                      <p className="text-[10px] text-[#889]"><span className="font-semibold text-[#667]">游览时长：</span>{durationText(spot.visit_duration)}</p>
                      {spot.ticket_price > 0 && (
                        <p className="text-[10px] text-[#889]"><span className="font-semibold text-[#667]">门票：</span>¥{spot.ticket_price}</p>
                      )}
                      <p className="text-[10px] text-[#778] leading-relaxed">{spot.description || '暂无描述'}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[#a78bfa]">
                      <Sparkles className="w-3 h-3" />
                      <span className="text-[10px] font-bold">AI详细讲解</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Hotel */}
          {data.hotel && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#e0f8f0] border-[2px] border-[#1a1a2e] flex items-center justify-center">
                  <Home className="w-3 h-3 text-[#6bcb9e]" />
                </div>
                <h5 className="text-xs font-extrabold text-[#1a1a2e]">住宿推荐</h5>
              </div>
              <motion.div
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/chat?topic=${encodeURIComponent(data.hotel!.name)}`)}
                className="neo-card-sm p-3 cursor-pointer"
              >
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  {toggleFavorite && (
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite('hotel', data.hotel!.name, data.hotel!.address || '', '住宿') }}
                      className="w-6 h-6 rounded-full bg-white border-[1.5px] border-[#1a1a2e] flex items-center justify-center shadow-[1px_1px_0px_0px_#1a1a2e]"
                    >
                      <Heart className={`w-3 h-3 ${favoriteIds?.has(data.hotel!.name) ? 'text-[#ff69b4] fill-[#ff69b4]' : 'text-[#889]'}`} />
                    </motion.button>
                  )}
                  <div className="w-6 h-6 rounded-full bg-[#6bcb9e] border-[1.5px] border-[#1a1a2e] flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <h6 className="text-sm font-extrabold text-[#1a1a2e]">{data.hotel.name}</h6>
                  {data.hotel.rating && (
                    <div className="neo-tag bg-[#fff8dc]" style={{ padding: '2px 8px', fontSize: '10px' }}>
                      <Star className="w-3 h-3 text-[#ffd93d]" />
                      <span>{data.hotel.rating}</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-[#889] mb-1">{data.hotel.address || '—'}</p>
                <div className="flex flex-wrap gap-3 text-[10px] text-[#778]">
                  {data.hotel.type && <span><span className="font-semibold">类型：</span>{data.hotel.type}</span>}
                  {data.hotel.price_range && <span><span className="font-semibold">价格：</span>{data.hotel.price_range}</span>}
                  {data.hotel.estimated_cost > 0 && <span><span className="font-semibold">预估：</span>¥{data.hotel.estimated_cost}/晚</span>}
                </div>
                <div className="mt-2 flex items-center gap-1 text-[#6bcb9e]">
                  <Sparkles className="w-3 h-3" />
                  <span className="text-[10px] font-bold">AI酒店评测</span>
                </div>
              </motion.div>
            </div>
          )}

          {/* Meals */}
          {data.meals && data.meals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#ffe4f0] border-[2px] border-[#1a1a2e] flex items-center justify-center">
                  <Utensils className="w-3 h-3 text-[#ff8a80]" />
                </div>
                <h5 className="text-xs font-extrabold text-[#1a1a2e]">餐饮安排</h5>
              </div>
              <div className="space-y-2">
                {data.meals.map((meal, i) => (
                  <motion.div
                    key={i}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/chat?topic=${encodeURIComponent(meal.name || '美食推荐')}`)}
                    className="flex items-start gap-2 p-2.5 rounded-xl bg-[#fafbfc] border-[2px] border-[#e8e8f0] cursor-pointer hover:bg-[#fff8f0] transition-colors"
                  >
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-md bg-[#fff8dc] border-[1.5px] border-[#1a1a2e] text-[10px] font-extrabold text-[#1a1a2e]">{mealTypeLabel(meal.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#556] leading-relaxed">{meal.name}{meal.description ? ` - ${meal.description}` : ''}</p>
                      {meal.estimated_cost > 0 && (
                        <p className="text-[10px] text-[#889] mt-0.5">预估 ¥{meal.estimated_cost}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      {toggleFavorite && (
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={(e) => { e.stopPropagation(); toggleFavorite('food', meal.name || '美食', meal.description || '', mealTypeLabel(meal.type)) }}
                          className="w-5 h-5 rounded-full bg-white border-[1.5px] border-[#1a1a2e] flex items-center justify-center"
                        >
                          <Heart className={`w-2.5 h-2.5 ${favoriteIds?.has(meal.name) ? 'text-[#ff69b4] fill-[#ff69b4]' : 'text-[#889]'}`} />
                        </motion.button>
                      )}
                      <Sparkles className="w-3 h-3 text-[#ffd93d]" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Result() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId') || undefined

  const [activeSection, setActiveSection] = useState('overview')
  const [openDays, setOpenDays] = useState<Set<number>>(new Set([0]))
  const [plan, setPlan] = useState<TripPlan | null>(null)
  const [loading, setLoading] = useState(!!taskId)
  const [pollStatus, setPollStatus] = useState('')
  const [error, setError] = useState('')

  const progressValue = useMemo(() => {
    const status = pollStatus || ''
    if (status.includes('排队')) return 5
    if (status.includes('景点')) return 30
    if (status.includes('天气')) return 50
    if (status.includes('酒店')) return 70
    if (status.includes('整合') || status.includes('规划') || status.includes('生成')) return 85
    if (status.includes('完成') || status.includes('成功')) return 100
    return 10
  }, [pollStatus])

  // History state
  const [historyList, setHistoryList] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [selectedHistoryTaskId, setSelectedHistoryTaskId] = useState<string | null>(null)
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false)

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())

  const toggleFavorite = async (type: string, title: string, subtitle: string, tag: string) => {
    if (favoriteIds.has(title)) return // already favorited
    try {
      const resp = await favoritesAPI.add({ type, title, subtitle, tag })
      if (resp.success) {
        setFavoriteIds(prev => new Set(prev).add(title))
      }
    } catch (e) {
      console.error('收藏失败:', e)
    }
  }

  // Determine current view: showing history list or trip detail
  const isShowingHistory = !plan && !loading && !error && !taskId
  const isShowingTripDetail = !!plan || !!selectedHistoryTaskId

  // Fetch history list
  const fetchHistory = async () => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const resp = await tripAPI.getHistoryList()
      if (resp.success) {
        setHistoryList(resp.data || [])
      }
    } catch (e: any) {
      setHistoryError(e.message || '加载历史记录失败')
    } finally {
      setHistoryLoading(false)
    }
  }

  // Load history detail when clicking a history item
  const loadHistoryDetail = async (taskId: string) => {
    setHistoryDetailLoading(true)
    setSelectedHistoryTaskId(taskId)
    setError('')
    // Sync URL so refresh keeps the same trip
    navigate('/result?taskId=' + taskId, { replace: true })
    try {
      const result = await tripAPI.getHistoryDetail(taskId)
      if (result.status === 'completed' && result.data) {
        setPlan(result.data)
        setLoading(false)
      } else {
        setError('该行程尚未完成或数据不可用')
        setSelectedHistoryTaskId(null)
      }
    } catch (e: any) {
      setError(e.message || '加载历史行程失败')
      setSelectedHistoryTaskId(null)
    } finally {
      setHistoryDetailLoading(false)
    }
  }

  // Delete history item
  const deleteHistoryItem = async (taskId: string) => {
    try {
      await tripAPI.deleteHistory(taskId)
      setHistoryList(prev => prev.filter(h => h.task_id !== taskId))
      // If currently viewing this trip, go back to history list
      if (selectedHistoryTaskId === taskId) {
        setSelectedHistoryTaskId(null)
        setPlan(null)
      }
    } catch (e: any) {
      console.error('删除失败:', e.message)
    }
  }

  // Go back to history list view
  const backToHistory = () => {
    setPlan(null)
    setSelectedHistoryTaskId(null)
    setError('')
    setLoading(false)
  }

  // Fetch history on mount
  useEffect(() => {
    fetchHistory()
  }, [])

  // Poll task status when taskId is present (coming from Home)
  useEffect(() => {
    if (!taskId) return

    let cancelled = false

    const doPoll = async () => {
      try {
        const result = await tripAPI.pollPlanStatus(
          taskId,
          (status) => {
            if (!cancelled) setPollStatus(status.message)
          },
          2000,
          150
        )
        if (cancelled) return

        if (result.status === 'completed' && result.data) {
          setPlan(result.data)
          // Refresh history list to include the new trip
          fetchHistory()
        } else if (result.status === 'failed') {
          setError(result.message || '任务执行失败')
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || '查询失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    doPoll()
    return () => { cancelled = true }
  }, [taskId])

  const toggleDay = (dayIndex: number) => {
    setOpenDays(prev => {
      const next = new Set(prev)
      if (next.has(dayIndex)) next.delete(dayIndex)
      else next.add(dayIndex)
      return next
    })
  }

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 20
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const ids = ['overview', 'budget', 'map', 'days', 'weather']
      const offsets = ids.map(s => {
        const el = document.getElementById(s)
        return { id: s, top: el ? el.getBoundingClientRect().top : Infinity }
      })
      const current = offsets.find(o => o.top > 0) || offsets[offsets.length - 1]
      if (current) setActiveSection(current.id)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const sections = [
    { id: 'overview', label: '行程概览', icon: Sparkles },
    { id: 'budget', label: '预算明细', icon: Wallet },
    { id: 'map', label: '景点地图', icon: MapIcon },
    { id: 'days', label: '每日行程', icon: Calendar },
    { id: 'weather', label: '天气信息', icon: CloudSun },
  ]

  // Determine content state
  const city = plan?.city || '未知城市'
  const startDate = plan?.start_date || '—'
  const endDate = plan?.end_date || '—'
  const daysCount = plan?.days?.length || 0
  const datesText = daysCount > 0 ? `${startDate} 至 ${endDate}` : '—'
  const advice = plan?.overall_suggestions || '暂无建议'

  /* ────────── HISTORY LIST VIEW ────────── */
  if (!plan && !loading && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#b8d8f4] via-[#c4def6] to-[#d0e4f8]">
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-24 left-[3%] w-12 h-12 rounded-full bg-[#ffd93d25] border-[2px] border-[#1a1a2e15] animate-float" />
          <div className="absolute top-48 right-[5%] w-8 h-8 rounded-full bg-[#ff69b415] border-[2px] border-[#1a1a2e10] animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-40 left-[8%] w-10 h-10 rounded-full bg-[#6bcb9e20] border-[2px] border-[#1a1a2e10] animate-float" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 max-w-[1200px] mx-auto px-4 py-4">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="neo-btn bg-white text-[#1a1a2e] flex items-center gap-2 py-2.5 px-4 text-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              返回首页
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="neo-btn bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf] text-white flex items-center gap-2 py-2.5 px-4 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              新建行程
            </motion.button>
          </div>

          {/* Nav */}
          <div className="hidden md:flex neo-card px-2 py-1.5 items-center gap-1 mb-5 w-fit">
            {[
              { label: '首页', path: '/' },
              { label: '行程', path: '/result' },
              { label: '攻略', path: '/chat?topic=旅行攻略' },
              { label: '收藏', path: '/favorites' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${item.path === '/result' || (item.path.startsWith('/result') && location.pathname === '/result')
                  ? 'bg-[#ffe4f0] text-[#ff69b4]'
                  : 'text-[#778] hover:bg-[#f5f5fa]'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[2.5px] border-[#1a1a2e] flex items-center justify-center">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#1a1a2e]">我的行程</h2>
                <p className="text-xs text-[#99a] font-semibold">共 {historyList.length} 条记录</p>
              </div>
            </div>

            {historyLoading && historyList.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[3px] border-[#1a1a2e] flex items-center justify-center"
                  >
                    <Sparkles className="w-6 h-6 text-white" />
                  </motion.div>
                  <p className="text-sm font-bold text-[#778]">加载历史记录...</p>
                </div>
              </div>
            ) : historyList.length === 0 ? (
              <div className="neo-card p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#ffe4f0] border-[3px] border-[#1a1a2e] flex items-center justify-center">
                  <MapPin className="w-10 h-10 text-[#ff8a80]" />
                </div>
                <h3 className="text-lg font-black text-[#1a1a2e] mb-2">还没有行程记录</h3>
                <p className="text-sm text-[#99a] font-semibold mb-6">开始规划你的第一次旅行吧！</p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/')}
                  className="neo-btn bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf] text-white flex items-center gap-2 mx-auto text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  去规划旅行
                </motion.button>
              </div>
            ) : (
              <div className="space-y-3">
                {historyError && (
                  <div className="neo-card p-3 flex items-center gap-2 bg-[#ffe4f0] border-[#ff8a80]">
                    <AlertCircle className="w-4 h-4 text-[#ff8a80] flex-shrink-0" />
                    <span className="text-xs font-bold text-[#ff8a80] flex-1">{historyError}</span>
                    <button onClick={fetchHistory} className="text-xs font-bold text-[#ff8a80] underline">重试</button>
                  </div>
                )}
                {historyList.map((item, index) => (
                  <motion.div
                    key={item.task_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => loadHistoryDetail(item.task_id)}
                    className="neo-card p-4 cursor-pointer hover:bg-[#fff8f0] transition-colors relative group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[2px] border-[#1a1a2e] flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-[#1a1a2e]">{item.city}</h4>
                          <div className="flex items-center gap-3 text-xs text-[#99a] font-semibold mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {item.start_date} ~ {item.end_date}
                            </span>
                            <span>{item.travel_days}天</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.created_at?.slice(0, 10)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border-[1.5px] ${item.status === 'completed'
                          ? 'bg-[#e0f8f0] border-[#1a1a2e] text-[#6bcb9e]'
                          : item.status === 'failed'
                            ? 'bg-[#ffe4f0] border-[#1a1a2e] text-[#ff8a80]'
                            : 'bg-[#fff8dc] border-[#1a1a2e] text-[#f5a623]'
                          }`}>
                          {item.status === 'completed' ? '已完成' : item.status === 'failed' ? '失败' : '处理中'}
                        </span>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.task_id) }}
                          className="w-8 h-8 rounded-full bg-[#ffe4f0] border-[2px] border-[#1a1a2e] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4 text-[#ff8a80]" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
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

  const budgetItems = plan?.budget ? [
    { label: '景点门票', amount: plan.budget.total_attractions, icon: Ticket, color: '#a78bfa', bg: '#e8e4ff' },
    { label: '酒店住宿', amount: plan.budget.total_hotels, icon: Hotel, color: '#6bcb9e', bg: '#e0f8f0' },
    { label: '餐饮费用', amount: plan.budget.total_meals, icon: Utensils, color: '#ffd93d', bg: '#fff8dc' },
    { label: '交通费用', amount: plan.budget.total_transportation, icon: Bus, color: '#ff8a80', bg: '#ffe4f0' },
  ] : []
  const totalBudget = plan?.budget?.total || 0

  // 构建地图标记数据
  const mapMarkers = plan?.days
    ? plan.days.flatMap((day) =>
      (day.attractions || []).map((spot) => ({
        name: spot.name,
        longitude: spot.location?.longitude ?? 0,
        latitude: spot.location?.latitude ?? 0,
        address: spot.address,
        description: spot.description,
        dayIndex: day.day_index,
      }))
    )
    : []

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#b8d8f4] via-[#c4def6] to-[#d0e4f8] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[3px] border-[#1a1a2e] flex items-center justify-center shadow-[4px_4px_0px_0px_#1a1a2e]"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <h2 className="text-lg font-black text-[#1a1a2e] mb-2">AI 正在规划你的旅行...</h2>
          <p className="text-sm text-[#778] font-semibold max-w-xs mx-auto">{pollStatus || '正在调用多智能体系统搜索景点、天气和酒店信息...'}</p>
          <div className="mt-6 w-64 mx-auto">
            <div className="relative">
              <div className="h-3 rounded-full border-[2px] border-[#1a1a2e] bg-white overflow-hidden" style={{ boxShadow: '3px 3px 0px 0px #1a1a2e' }}>
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf]"
                  animate={{ width: `${progressValue}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <div
                className="absolute -top-1 transition-all duration-500 ease-out"
                style={{ left: `calc(${progressValue}% - 8px)` }}
              >
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-4 h-4 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[2px] border-[#1a1a2e]"
                />
              </div>
            </div>
            <p className="text-[10px] font-bold text-[#99a] mt-2">{progressValue}%</p>
          </div>
          <div className="mt-4 flex justify-center gap-2">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 }}
                className="w-3 h-3 rounded-full bg-[#a78bfa] border-[2px] border-[#1a1a2e]"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // History detail loading state
  if (historyDetailLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#b8d8f4] via-[#c4def6] to-[#d0e4f8] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[3px] border-[#1a1a2e] flex items-center justify-center shadow-[4px_4px_0px_0px_#1a1a2e]"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <h2 className="text-lg font-black text-[#1a1a2e] mb-2">加载行程详情...</h2>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#b8d8f4] via-[#c4def6] to-[#d0e4f8] flex items-center justify-center">
        <div className="neo-card p-8 text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#ffe4f0] border-[3px] border-[#1a1a2e] flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-[#ff8a80]" />
          </div>
          <h2 className="text-lg font-black text-[#1a1a2e] mb-2">出错了</h2>
          <p className="text-sm text-[#778] font-semibold mb-6">{error || '未能获取旅行计划'}</p>
          <div className="flex gap-3 justify-center">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => backToHistory()}
              className="neo-btn bg-white text-[#1a1a2e] flex items-center gap-2 text-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              返回列表
            </motion.button>
            {taskId && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => window.location.reload()}
                className="neo-btn bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf] text-white flex items-center gap-2 text-xs"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </motion.button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#b8d8f4] via-[#c4def6] to-[#d0e4f8]">
      {/* Floating decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-24 left-[3%] w-12 h-12 rounded-full bg-[#ffd93d25] border-[2px] border-[#1a1a2e15] animate-float" />
        <div className="absolute top-48 right-[5%] w-8 h-8 rounded-full bg-[#ff69b415] border-[2px] border-[#1a1a2e10] animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-40 left-[8%] w-10 h-10 rounded-full bg-[#6bcb9e20] border-[2px] border-[#1a1a2e10] animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 py-4">
        {/* ═══ TOP BAR ═══ */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="neo-btn bg-white text-[#1a1a2e] flex items-center gap-2 py-2.5 px-4 text-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              返回首页
            </motion.button>
            <div className="neo-card px-3 py-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[2px] border-[#1a1a2e] flex items-center justify-center">
                <MapPin className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-extrabold text-[#1a1a2e]">{city} · {daysCount}天</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.95 }} className="neo-btn bg-[#fff8dc] text-[#1a1a2e] flex items-center gap-2 py-2.5 px-4 text-xs">
              <Pencil className="w-3.5 h-3.5" />
              编辑行程
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} className="neo-btn bg-[#e0f8f0] text-[#1a1a2e] flex items-center gap-2 py-2.5 px-4 text-xs">
              <Download className="w-3.5 h-3.5" />
              导出行程
            </motion.button>
          </div>
        </div>

        {/* ═══ NAV ═══ */}
        <div className="hidden md:flex neo-card px-2 py-1.5 items-center gap-1 mb-5 w-fit">
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
        <div className="flex flex-col lg:flex-row gap-5">
          {/* LEFT SIDEBAR */}
          <div className="w-full lg:w-[200px] flex-shrink-0 space-y-3">
            {/* History section */}
            <div className="neo-card p-3 lg:sticky lg:top-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#a78bfa]" />
                  <span className="text-[10px] font-extrabold text-[#1a1a2e]">历史行程</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={backToHistory}
                  className="text-[9px] font-bold text-[#a78bfa] underline cursor-pointer"
                >
                  全部
                </motion.button>
              </div>
              <div className="space-y-1 max-h-[260px] overflow-y-auto">
                {historyLoading ? (
                  <div className="text-[10px] text-[#99a] font-semibold text-center py-2">加载中...</div>
                ) : historyList.length === 0 ? (
                  <div className="text-[10px] text-[#99a] font-semibold text-center py-2">暂无记录</div>
                ) : (
                  historyList.slice(0, 5).map(item => {
                    const isActive = item.task_id === taskId || item.task_id === selectedHistoryTaskId
                    return (
                      <button
                        key={item.task_id}
                        onClick={() => loadHistoryDetail(item.task_id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all text-left ${isActive
                          ? 'bg-[#ffe4f0] text-[#ff69b4] border-[1.5px] border-[#1a1a2e]'
                          : 'text-[#778] hover:bg-[#f5f5fa] border-[1.5px] border-transparent'
                          }`}
                      >
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate flex-1">{item.city} · {item.travel_days}天</span>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.status === 'completed' ? 'bg-[#6bcb9e]' : 'bg-[#f5a623]'
                          }`} />
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Section navigation */}
            {sections.length > 0 && (
              <div className="neo-card p-3 space-y-1.5 lg:sticky lg:top-[200px]">
                {sections.map(s => (
                  <NavItem
                    key={s.id}
                    icon={s.icon}
                    label={s.label}
                    active={activeSection === s.id}
                    onClick={() => scrollToSection(s.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT CONTENT */}
          <div className="flex-1 space-y-5">
            {/* ── Overview & Map ── */}
            <div id="overview" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Overview Card */}
              <div className="neo-card p-5">
                <div className="neo-section-header bg-[#a78bfa] mb-4">
                  <Sparkles className="w-4 h-4" />
                  {city}旅行计划
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#a78bfa]" />
                    <span className="text-sm font-bold text-[#1a1a2e]">日期：</span>
                    <span className="text-sm text-[#556]">{datesText}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-[#ffd93d] mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-bold text-[#1a1a2e]">建议：</span>
                      <p className="text-xs text-[#778] leading-relaxed mt-1">{advice}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real Map */}
              <div id="map" className="neo-card p-5">
                <div className="neo-section-header bg-[#6bcb9e] mb-4">
                  <MapIcon className="w-4 h-4" />
                  景点地图
                </div>
                <MapView
                  markers={mapMarkers}
                  height="280px"
                />
              </div>
            </div>

            {/* ── Budget ── */}
            {budgetItems.length > 0 && (
              <div id="budget" className="neo-card p-5">
                <div className="neo-section-header bg-[#ffd93d] text-[#1a1a2e] mb-4">
                  <Wallet className="w-4 h-4" />
                  预算明细
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {budgetItems.map((item, i) => {
                    const Icon = item.icon
                    return (
                      <motion.div
                        key={i}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate(`/chat?topic=${encodeURIComponent(item.label)}`)}
                        className="neo-card-sm p-3 text-center cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center border-[2px] border-[#1a1a2e]"
                          style={{ backgroundColor: item.bg }}>
                          <Icon className="w-5 h-5" style={{ color: item.color }} />
                        </div>
                        <p className="text-[10px] font-bold text-[#889] mb-0.5">{item.label}</p>
                        <p className="text-lg font-black" style={{ color: item.color }}>¥{item.amount}</p>
                        <div className="mt-1 flex items-center justify-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5 text-[#aab]" />
                          <span className="text-[9px] text-[#aab] font-bold">AI咨询</span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/chat?topic=预算优化')}
                  className="p-4 rounded-xl bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf] border-[2.5px] border-[#1a1a2e] text-center cursor-pointer"
                  style={{ boxShadow: '4px 4px 0px 0px #1a1a2e' }}
                >
                  <span className="text-xs font-bold text-white/80">预估总费用</span>
                  <p className="text-2xl font-black text-white mt-1">¥{totalBudget}</p>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3 text-white/60" />
                    <span className="text-[10px] text-white/60 font-bold">点击让AI优化预算</span>
                  </div>
                </motion.div>
              </div>
            )}

            {/* ── Daily Itinerary ── */}
            <div id="days">
              <div className="neo-section-header bg-[#ff8a80] mb-4">
                <Calendar className="w-4 h-4" />
                每日行程
              </div>
              <div className="space-y-3">
                {plan.days?.map(d => (
                  <DayAccordion
                    key={d.day_index}
                    data={d}
                    isOpen={openDays.has(d.day_index)}
                    onToggle={() => toggleDay(d.day_index)}
                    navigate={navigate}
                    city={city}
                    toggleFavorite={toggleFavorite}
                    favoriteIds={favoriteIds}
                  />
                ))}
              </div>
            </div>

            {/* ── Weather ── */}
            {plan.weather_info && plan.weather_info.length > 0 && (
              <div id="weather" className="neo-card p-5">
                <div className="neo-section-header bg-[#64b5f6] mb-4">
                  <CloudSun className="w-4 h-4" />
                  天气信息
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {plan.weather_info.map((w, i) => (
                    <div key={i} className="neo-weather-card">
                      <p className="text-[10px] font-extrabold text-[#1a1a2e] mb-2">{w.date}</p>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <WeatherIcon type={weatherToIcon(w.day_weather)} />
                        <span className="text-xs font-bold text-[#556]">{w.day_weather}</span>
                      </div>
                      <p className="text-sm font-black text-[#a78bfa] mb-1">{formatTemp(w.day_temp)}</p>
                      <div className="border-t border-[#eee] pt-1.5 mt-1">
                        <p className="text-[9px] text-[#99a] font-semibold">{w.night_weather} {formatTemp(w.night_temp)}</p>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <Wind className="w-3 h-3 text-[#aab]" />
                          <span className="text-[9px] text-[#99a]">{w.wind_direction} {w.wind_power}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
