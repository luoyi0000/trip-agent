/**
 * API 服务层 - 封装后端 FastAPI 接口
 * 后端运行在 http://localhost:8000
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/* ──────── USER ID (匿名用户) ──────── */

const USER_ID_KEY = 'travel_user_id'

export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

export function setUserId(id: string) {
  localStorage.setItem(USER_ID_KEY, id)
}

/* ──────── TYPES ──────── */

export interface TripRequest {
  city: string
  start_date: string
  end_date: string
  travel_days: number
  transportation: string
  accommodation: string
  preferences: string[]
  free_text_input?: string
}

export interface Location {
  longitude: number
  latitude: number
}

export interface Attraction {
  name: string
  address: string
  location: Location
  visit_duration: number
  description: string
  category?: string
  rating?: number
  photos?: string[]
  poi_id?: string
  image_url?: string
  image_search_keyword?: string
  ticket_price: number
}

export interface Meal {
  type: string
  name: string
  address?: string
  location?: Location
  description?: string
  estimated_cost: number
}

export interface Hotel {
  name: string
  address: string
  location?: Location
  price_range: string
  rating: string
  distance: string
  type: string
  estimated_cost: number
}

export interface DayPlan {
  date: string
  day_index: number
  description: string
  transportation: string
  accommodation: string
  hotel?: Hotel
  attractions: Attraction[]
  meals: Meal[]
}

export interface WeatherInfo {
  date: string
  day_weather: string
  night_weather: string
  day_temp: number | string
  night_temp: number | string
  wind_direction: string
  wind_power: string
}

export interface Budget {
  total_attractions: number
  total_hotels: number
  total_meals: number
  total_transportation: number
  total: number
}

export interface TripPlan {
  city: string
  start_date: string
  end_date: string
  days: DayPlan[]
  weather_info: WeatherInfo[]
  overall_suggestions: string
  budget?: Budget
}

export interface TripPlanTaskResponse {
  success: boolean
  message: string
  task_id: string
  status: string
}

export interface TripPlanTaskStatus {
  task_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  data?: TripPlan
  message: string
}

export interface POIInfo {
  id: string
  name: string
  type: string
  address: string
  location: Location
  tel?: string
}

export interface POISearchResponse {
  success: boolean
  message: string
  data: POIInfo[]
}

export interface RouteRequest {
  origin_address: string
  destination_address: string
  origin_city?: string
  destination_city?: string
  route_type?: string
}

export interface RouteInfo {
  distance: number
  duration: number
  route_type: string
  description: string
}

export interface RouteResponse {
  success: boolean
  message: string
  data?: RouteInfo
}

export interface WeatherResponse {
  success: boolean
  message: string
  data: WeatherInfo[]
}

export interface POIPhotoResponse {
  success: boolean
  message: string
  data: {
    name: string
    photo_url: string | null
    source: string | null
  }
}

/* ──────── HISTORY TYPES ──────── */

export interface HistoryItem {
  id: number
  task_id: string
  user_id?: string
  city: string
  start_date: string
  end_date: string
  travel_days: number
  status: string
  created_at: string
}

export interface HistoryListResponse {
  success: boolean
  message: string
  data: HistoryItem[]
  total: number
}

/* ──────── AUTH TOKEN ──────── */

const TOKEN_KEY = 'travel_auth_token'

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/* ──────── HELPERS ──────── */

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
  }
  // 如果已登录，追加 Bearer token（后端优先使用 token 中的 user_id）
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // merge custom headers from options
  if (options?.headers) {
    const custom = options.headers as Record<string, string>
    for (const k of Object.keys(custom)) {
      headers[k] = custom[k]
    }
  }
  const resp = await fetch(url, { ...options, headers })
  // token 过期时清除
  if (resp.status === 401 && token) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('travel_auth_user')
  }
  if (!resp.ok) {
    const err = await resp.text().catch(() => 'Unknown error')
    throw new Error(`HTTP ${resp.status}: ${err}`)
  }
  return resp.json() as Promise<T>
}

/* ──────── API ──────── */

export const tripAPI = {
  /** 提交旅行规划任务 */
  async planTrip(request: TripRequest): Promise<TripPlanTaskResponse> {
    return fetchJSON(`${API_BASE_URL}/api/trip/plan`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /** 查询任务状态 */
  async getPlanStatus(taskId: string): Promise<TripPlanTaskStatus> {
    return fetchJSON(`${API_BASE_URL}/api/trip/plan/status/${taskId}`)
  },

  /** 轮询直到任务完成或失败 */
  async pollPlanStatus(
    taskId: string,
    onUpdate?: (status: TripPlanTaskStatus) => void,
    intervalMs = 2000,
    maxAttempts = 150
  ): Promise<TripPlanTaskStatus> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getPlanStatus(taskId)
      onUpdate?.(status)
      if (status.status === 'completed' || status.status === 'failed') {
        return status
      }
      await new Promise(r => setTimeout(r, intervalMs))
    }
    throw new Error('轮询超时，请稍后手动刷新查看结果')
  },

  /** 查询历史行程列表 */
  async getHistoryList(limit = 50, offset = 0): Promise<HistoryListResponse> {
    return fetchJSON(`${API_BASE_URL}/api/trip/history?limit=${limit}&offset=${offset}`)
  },

  /** 查询单条历史行程详情 */
  async getHistoryDetail(taskId: string): Promise<TripPlanTaskStatus> {
    return fetchJSON(`${API_BASE_URL}/api/trip/history/${taskId}`)
  },

  /** 删除历史行程 */
  async deleteHistory(taskId: string): Promise<{ success: boolean; message: string }> {
    return fetchJSON(`${API_BASE_URL}/api/trip/history/${taskId}`, {
      method: 'DELETE',
    })
  },
}

export const mapAPI = {
  /** 搜索POI */
  async searchPOI(keywords: string, city: string, citylimit = true): Promise<POISearchResponse> {
    const params = new URLSearchParams({ keywords, city, citylimit: String(citylimit) })
    return fetchJSON(`${API_BASE_URL}/api/map/poi?${params}`)
  },

  /** 查询天气 */
  async getWeather(city: string): Promise<WeatherResponse> {
    return fetchJSON(`${API_BASE_URL}/api/map/weather?city=${encodeURIComponent(city)}`)
  },

  /** 规划路线 */
  async planRoute(request: RouteRequest): Promise<RouteResponse> {
    return fetchJSON(`${API_BASE_URL}/api/map/route`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },
}

export const poiAPI = {
  /** 获取POI详情 */
  async getDetail(poiId: string): Promise<{ success: boolean; message: string; data?: any }> {
    return fetchJSON(`${API_BASE_URL}/api/poi/detail/${poiId}`)
  },

  /** 搜索POI */
  async search(keywords: string, city: string): Promise<{ success: boolean; message: string; data?: any }> {
    return fetchJSON(`${API_BASE_URL}/api/poi/search?keywords=${encodeURIComponent(keywords)}&city=${encodeURIComponent(city)}`)
  },

  /** 获取景点图片 */
  async getPhoto(name: string, keyword?: string, city?: string): Promise<POIPhotoResponse> {
    const params = new URLSearchParams({ name })
    if (keyword) params.append('keyword', keyword)
    if (city) params.append('city', city)
    return fetchJSON(`${API_BASE_URL}/api/poi/photo?${params}`)
  },
}

/* ──────── FAVORITES TYPES & API ──────── */

export interface FavoriteItem {
  id: number
  type: string
  title: string
  subtitle: string
  tag: string
  source_id: string
  raw_data: string
  created_at: string
}

export const favoritesAPI = {
  /** 添加收藏 */
  async add(data: {
    type: string
    title: string
    subtitle?: string
    tag?: string
    source_id?: string
    raw_data?: string
  }): Promise<{ success: boolean; message: string; data: { id: number } }> {
    return fetchJSON(`${API_BASE_URL}/api/favorites/`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /** 查询收藏列表 */
  async list(): Promise<{ success: boolean; message: string; data: FavoriteItem[] }> {
    return fetchJSON(`${API_BASE_URL}/api/favorites/`)
  },

  /** 删除收藏 */
  async remove(id: number): Promise<{ success: boolean; message: string }> {
    return fetchJSON(`${API_BASE_URL}/api/favorites/${id}`, {
      method: 'DELETE',
    })
  },
}

/* ──────── CHAT TYPES & API ──────── */

export interface ChatRequest {
  message: string
  history?: { role: 'user' | 'ai'; text: string }[]
  context?: string
  session_id?: number | null
}

export interface ChatResponse {
  success: boolean
  message: string
  reply: string
  session_id?: number | null
}

export interface ChatSession {
  id: number
  title: string
  topic: string
  created_at: string
  updated_at: string
  msg_count: number
}

export interface ChatMessage {
  id: number
  role: string
  text: string
  created_at: string
}

export const chatAPI = {
  /** AI 对话（支持 session） */
  async send(request: ChatRequest): Promise<ChatResponse> {
    return fetchJSON(`${API_BASE_URL}/api/chat/`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /** 查询历史会话列表 */
  async getSessions(): Promise<{ success: boolean; data: ChatSession[] }> {
    return fetchJSON(`${API_BASE_URL}/api/chat/sessions`)
  },

  /** 查询单个会话的消息列表 */
  async getSessionMessages(sessionId: number): Promise<{ success: boolean; data: ChatMessage[] }> {
    return fetchJSON(`${API_BASE_URL}/api/chat/sessions/${sessionId}`)
  },

  /** 删除会话 */
  async deleteSession(sessionId: number): Promise<{ success: boolean; message: string }> {
    return fetchJSON(`${API_BASE_URL}/api/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    })
  },
}

/* ──────── AUTH TYPES & API ──────── */

export interface AuthResponse {
  success: boolean
  message: string
  data?: {
    token: string
    user: { id: string; email: string; username: string }
    migrated_count?: number
  }
}

export interface UserInfo {
  id: string
  email: string
  username: string
}

export const authAPI = {
  /** 登录 */
  async login(email: string, password: string): Promise<AuthResponse> {
    return fetchJSON(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  /** 注册 */
  async register(email: string, password: string, username: string): Promise<AuthResponse> {
    const anonymousId = getUserId()
    return fetchJSON(`${API_BASE_URL}/api/auth/register?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&username=${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: { 'x-anonymous-id': anonymousId },
    })
  },

  /** 获取当前用户信息 */
  async getMe(): Promise<{ success: boolean; data?: UserInfo; message?: string }> {
    return fetchJSON(`${API_BASE_URL}/api/auth/me`)
  },
}

export const healthAPI = {
  /** 健康检查 */
  async check(): Promise<{ status: string; name?: string; version?: string }> {
    return fetchJSON(`${API_BASE_URL}/health`)
  },
}
