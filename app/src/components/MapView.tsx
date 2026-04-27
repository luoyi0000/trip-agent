import { useEffect, useRef, useState } from 'react'
import { MapPin, AlertCircle, ExternalLink } from 'lucide-react'

/* ──────── TYPES ──────── */

export interface MapMarker {
  name: string
  longitude: number
  latitude: number
  address?: string
  description?: string
  dayIndex?: number
}

interface MapViewProps {
  markers: MapMarker[]
  height?: string
}

/* ──────── HELPERS ──────── */

function isValidCoord(lng: number, lat: number): boolean {
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    lng !== 0 &&
    lat !== 0 &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  )
}

function loadAmapScript(key: string, securityConfig?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as any
    if (w.AMap) {
      resolve()
      return
    }
    // 避免重复加载
    const existing = document.querySelector('script[data-amap]') as HTMLScriptElement
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('高德地图脚本加载失败')))
      return
    }

    // 高德地图 2.0 必须配置安全密钥
    if (securityConfig) {
      w._AMapSecurityConfig = {
        securityJsCode: securityConfig,
      }
    }

    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`
    script.setAttribute('data-amap', 'true')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('高德地图脚本加载失败'))
    document.head.appendChild(script)
  })
}

/* ──────── COMPONENT ──────── */

export default function MapView({ markers, height = '320px' }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const validMarkers = markers.filter(m => isValidCoord(m.longitude, m.latitude))

  useEffect(() => {
    if (validMarkers.length === 0) return

    const key = import.meta.env.VITE_AMAP_JS_KEY as string | undefined
    const securityConfig = import.meta.env.VITE_AMAP_SECURITY_CONFIG as string | undefined
    if (!key) {
      console.error('[MapView] VITE_AMAP_JS_KEY 未配置')
      setLoadError('高德地图 Key 未配置')
      return
    }

    let destroyed = false

    loadAmapScript(key, securityConfig)
      .then(() => {
        if (destroyed || !containerRef.current) return
        const AMap = (window as any).AMap
        if (!AMap) {
          setLoadError('高德地图脚本加载异常')
          return
        }

        // 计算中心点：取所有标记的平均值
        const centerLng =
          validMarkers.reduce((sum, m) => sum + m.longitude, 0) / validMarkers.length
        const centerLat =
          validMarkers.reduce((sum, m) => sum + m.latitude, 0) / validMarkers.length

        const map = new AMap.Map(containerRef.current, {
          zoom: validMarkers.length > 1 ? 11 : 14,
          center: [centerLng, centerLat],
          viewMode: '2D',
        })
        mapRef.current = map

        // 为每个景点添加标记
        validMarkers.forEach((marker, index) => {
          const markerInstance = new AMap.Marker({
            position: [marker.longitude, marker.latitude],
            title: marker.name,
            anchor: 'bottom-center',
            offset: new AMap.Pixel(0, 0),
          })

          // 序号标签（高德 2.0 只接受字符串 content）
          markerInstance.setLabel({
            content: `
              <div style="
                display:flex;align-items:center;gap:4px;
                padding:3px 8px;
                background:#fff;
                border:2px solid #1a1a2e;
                border-radius:8px;
                font-size:11px;
                font-weight:800;
                color:#1a1a2e;
                box-shadow:2px 2px 0 #1a1a2e;
                white-space:nowrap;
                font-family:system-ui,-apple-system,sans-serif;
              ">
                <span style="
                  display:inline-flex;align-items:center;justify-content:center;
                  width:16px;height:16px;
                  background:#a78bfa;
                  color:#fff;
                  border:1.5px solid #1a1a2e;
                  border-radius:50%;
                  font-size:10px;
                ">${index + 1}</span>
                ${marker.name}
              </div>
            `,
            direction: 'top',
            offset: new AMap.Pixel(0, -6),
          })

          // 点击弹出信息窗体
          markerInstance.on('click', () => {
            const infoContent = `
              <div style="
                padding:8px 12px;
                min-width:160px;
                font-family:system-ui,-apple-system,sans-serif;
              ">
                <div style="
                  font-size:13px;
                  font-weight:800;
                  color:#1a1a2e;
                  margin-bottom:4px;
                ">${marker.name}</div>
                ${marker.address ? `<div style="font-size:11px;color:#778;margin-bottom:4px;">${marker.address}</div>` : ''}
                ${marker.description ? `<div style="font-size:11px;color:#556;line-height:1.4;">${marker.description}</div>` : ''}
                ${marker.dayIndex !== undefined ? `<div style="margin-top:6px;"><span style="display:inline-block;padding:2px 8px;background:#e0f8f0;border:1.5px solid #1a1a2e;border-radius:6px;font-size:10px;font-weight:700;color:#1a1a2e;">第${marker.dayIndex + 1}天</span></div>` : ''}
              </div>
            `
            const infoWindow = new AMap.InfoWindow({
              content: infoContent,
              offset: new AMap.Pixel(0, -36),
              closeWhenClickMap: true,
            })
            infoWindow.open(map, markerInstance.getPosition())
          })

          map.add(markerInstance)
        })

        // 多个标记时自动调整视野
        if (validMarkers.length > 1) {
          map.setFitView(null, false, [60, 60, 60, 60], 14)
        }
      })
      .catch((err) => {
        console.error('[MapView] 地图加载失败:', err)
        setLoadError('地图加载失败，请检查高德 Key 配置')
      })

    return () => {
      destroyed = true
      if (mapRef.current) {
        try {
          mapRef.current.destroy()
        } catch {
          // ignore
        }
        mapRef.current = null
      }
    }
  }, [validMarkers])

  /* ──────── RENDER ──────── */

  if (markers.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center bg-gradient-to-br from-[#e0f8f0] to-[#c8e8f0] rounded-xl border-[2.5px] border-[#1a1a2e]"
      >
        <MapPin className="w-8 h-8 text-[#6bcb9e] mb-2" />
        <span className="text-xs font-bold text-[#889]">暂无景点位置数据</span>
      </div>
    )
  }

  if (validMarkers.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center bg-gradient-to-br from-[#fff8dc] to-[#ffe4f0] rounded-xl border-[2.5px] border-[#1a1a2e]"
      >
        <AlertCircle className="w-8 h-8 text-[#f5a623] mb-2" />
        <span className="text-xs font-bold text-[#889]">景点坐标无效，无法显示地图</span>
      </div>
    )
  }

  // 地图加载失败提示
  if (loadError) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center bg-gradient-to-br from-[#fff8dc] to-[#ffe4f0] rounded-xl border-[2.5px] border-[#1a1a2e] p-4"
      >
        <AlertCircle className="w-8 h-8 text-[#f5a623] mb-2" />
        <span className="text-xs font-bold text-[#1a1a2e] mb-1">地图加载失败</span>
        <span className="text-[10px] text-[#778] text-center mb-3">{loadError}</span>
        <a
          href="https://console.amap.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-bold text-[#a78bfa] hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          前往高德控制台开启 JS API
        </a>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded-xl border-[2.5px] border-[#1a1a2e] overflow-hidden"
    />
  )
}
