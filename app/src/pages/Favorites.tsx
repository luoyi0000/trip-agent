import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { motion } from 'framer-motion'
import {
  ChevronLeft, Heart, Trash2,
  Plane, Sparkles, Landmark, Utensils, Hotel,
  AlertTriangle, Bookmark, Loader2
} from 'lucide-react'
import { favoritesAPI, type FavoriteItem } from '../services/api'

/* ──────── TYPE -> UI MAPPING ──────── */
const TYPE_CONFIG: Record<string, {
  tag: string; tagColor: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}> = {
  spot: {
    tag: '景点', tagColor: '#a78bfa',
    icon: Landmark, iconBg: '#e8e4ff', iconColor: '#a78bfa',
  },
  food: {
    tag: '美食', tagColor: '#ff8a80',
    icon: Utensils, iconBg: '#ffe4f0', iconColor: '#ff8a80',
  },
  hotel: {
    tag: '住宿', tagColor: '#6bcb9e',
    icon: Hotel, iconBg: '#e0f8f0', iconColor: '#6bcb9e',
  },
  tip: {
    tag: '避坑', tagColor: '#f5a623',
    icon: AlertTriangle, iconBg: '#fff8dc', iconColor: '#f5a623',
  },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || {
    tag: type, tagColor: '#a78bfa',
    icon: Landmark, iconBg: '#e8e4ff', iconColor: '#a78bfa',
  }
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
}

export default function Favorites() {
  const navigate = useNavigate()
  const location = useLocation()
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<number | null>(null)

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    setLoading(true)
    try {
      const resp = await favoritesAPI.list()
      if (resp.success) {
        setFavorites(resp.data || [])
      }
    } catch (e) {
      console.error('加载收藏失败:', e)
    } finally {
      setLoading(false)
    }
  }

  const removeFavorite = async (id: number) => {
    setRemoving(id)
    try {
      await favoritesAPI.remove(id)
      setFavorites(prev => prev.filter(item => item.id !== id))
    } catch (e) {
      console.error('删除失败:', e)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#b8d8f4] via-[#c4def6] to-[#d0e4f8] flex flex-col">
      <div className="relative z-10 max-w-[800px] mx-auto px-4 py-5 flex-1 w-full">
        {/* ═══ TOP BAR ═══ */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <motion.div
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/')}
            className="neo-card px-3 py-2 flex items-center gap-2 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-[#ff69b4]" />
            <span className="text-xs font-extrabold text-[#1a1a2e]">返回</span>
          </motion.div>

          <div className="neo-card px-4 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[2.5px] border-[#1a1a2e] flex items-center justify-center">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-extrabold text-[#1a1a2e]">智能旅行助手</span>
          </div>

          <div className="neo-card px-3 py-2 flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-[#ff69b4]" />
            <span className="text-xs font-bold text-[#ff69b4]">收藏</span>
          </div>
        </motion.nav>

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

        {/* ═══ HEADER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="neo-card p-5 mb-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#ffe4f0] border-[2.5px] border-[#1a1a2e] flex items-center justify-center shadow-[3px_3px_0px_0px_#1a1a2e]">
              <Heart className="w-6 h-6 text-[#ff69b4]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1a1a2e]">我的收藏</h1>
              <p className="text-xs text-[#778] font-semibold">
                共 {favorites.length} 个收藏
              </p>
            </div>
          </div>
        </motion.div>

        {/* ═══ CONTENT ═══ */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#2dd4bf] border-[3px] border-[#1a1a2e] flex items-center justify-center"
              >
                <Sparkles className="w-6 h-6 text-white" />
              </motion.div>
              <p className="text-sm font-bold text-[#778]">加载收藏...</p>
            </div>
          </div>
        ) : favorites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="neo-card p-10 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#f0f0f5] border-[2.5px] border-[#1a1a2e] flex items-center justify-center">
              <Heart className="w-8 h-8 text-[#dde]" />
            </div>
            <h2 className="text-lg font-black text-[#1a1a2e] mb-1">还没有收藏</h2>
            <p className="text-sm text-[#778] font-semibold mb-4">
              在旅行规划中收藏你感兴趣的景点、美食和住宿吧
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="neo-btn bg-gradient-to-r from-[#a78bfa] to-[#2dd4bf] text-white inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>去规划旅行</span>
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {favorites.map((item) => {
              const cfg = getTypeConfig(item.type)
              const Icon = cfg.icon
              return (
                <motion.div
                  key={item.id}
                  variants={itemVariants}
                  className="neo-card p-4 flex items-center gap-3"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center border-[2.5px] border-[#1a1a2e] flex-shrink-0 shadow-[2px_2px_0px_0px_#1a1a2e]"
                    style={{ backgroundColor: cfg.iconBg }}
                  >
                    <Icon className="w-5 h-5" style={{ color: cfg.iconColor }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-extrabold text-[#1a1a2e] truncate">
                        {item.title}
                      </h3>
                      <div
                        className="neo-tag flex-shrink-0"
                        style={{
                          backgroundColor: `${cfg.tagColor}20`,
                          padding: '1px 8px',
                          fontSize: '9px',
                        }}
                      >
                        <span style={{ color: cfg.tagColor }}>{item.tag || cfg.tag}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#778] truncate">{item.subtitle}</p>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => removeFavorite(item.id)}
                    disabled={removing === item.id}
                    className="w-8 h-8 rounded-full bg-[#f0f0f5] border-[2px] border-[#1a1a2e] flex items-center justify-center flex-shrink-0 hover:bg-[#ffe4f0] transition-colors"
                  >
                    {removing === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#ff8a80] animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-[#ff8a80]" />
                    )}
                  </motion.button>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* ═══ FOOTER ═══ */}
        <div className="mt-auto text-center pb-6 pt-8">
          <div className="inline-flex items-center gap-2 neo-card px-4 py-2">
            <Heart className="w-3.5 h-3.5 text-[#ff8a80]" />
            <span className="text-[11px] font-bold text-[#99a]">智能旅行助手 &copy; 2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}
