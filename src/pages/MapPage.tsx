import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { useLiveQuery } from 'dexie-react-hooks';
import iso from 'i18n-iso-countries';
import { useEffect, useMemo, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import countriesUrl from 'world-atlas/countries-110m.json?url';
import BottomNav from '../components/BottomNav';
import { db } from '../db/db';

const MAP_W = 980;
const MAP_H = 500;
const ANTARCTICA = '010'; // 南極洲不列入地圖與統計

/** ISO 數字碼 → alpha-2；查不到（如科索沃）回傳 null */
function toAlpha2(numericId: string | undefined): string | null {
  if (!numericId) return null;
  return iso.numericToAlpha2(numericId) ?? null;
}

const regionNames = new Intl.DisplayNames(['zh-Hant'], { type: 'region' });

function countryName(alpha2: string, fallback: string): string {
  try {
    return regionNames.of(alpha2) ?? fallback;
  } catch {
    return fallback;
  }
}

interface CountryShape {
  key: string;
  alpha2: string | null; // null = 無法標記（無 ISO 代碼的區域）
  name: string;
  d: string;
}

export default function MapPage() {
  const [shapes, setShapes] = useState<CountryShape[] | null>(null);
  const [zoom, setZoom] = useState({ k: 1, x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const visited = useLiveQuery(() => db.visitedCountries.toArray(), []);
  const visitedCodes = useMemo(() => new Set((visited ?? []).map((v) => v.code)), [visited]);

  // 載入世界國界（打包進 app，離線也能用）並投影成 SVG 路徑
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(countriesUrl);
      const topology = (await res.json()) as Topology<{
        countries: GeometryCollection<{ name: string }>;
      }>;
      const fc = feature(topology, topology.objects.countries) as FeatureCollection<
        Geometry,
        { name: string }
      >;
      fc.features = fc.features.filter((f) => String(f.id) !== ANTARCTICA);
      const projection = geoNaturalEarth1().fitSize([MAP_W, MAP_H], fc);
      const path = geoPath(projection);
      const result: CountryShape[] = fc.features
        .map((f) => {
          const alpha2 = toAlpha2(f.id ? String(f.id).padStart(3, '0') : undefined);
          return {
            key: String(f.id ?? f.properties.name),
            alpha2,
            name: alpha2 ? countryName(alpha2, f.properties.name) : f.properties.name,
            d: path(f) ?? '',
          };
        })
        .filter((s) => s.d);
      if (!cancelled) setShapes(result);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalCountries = useMemo(
    () => new Set((shapes ?? []).map((s) => s.alpha2).filter(Boolean)).size,
    [shapes],
  );

  async function toggleCountry(shape: CountryShape) {
    if (!shape.alpha2) return;
    if (visitedCodes.has(shape.alpha2)) {
      await db.visitedCountries.delete(shape.alpha2);
    } else {
      await db.visitedCountries.put({
        code: shape.alpha2,
        name: shape.name,
        visitedAt: new Date().toISOString(),
      });
    }
  }

  /* ===== 縮放與拖曳 ===== */
  const vw = MAP_W / zoom.k;
  const vh = MAP_H / zoom.k;
  const clampView = (x: number, y: number, k: number) => ({
    x: Math.max(0, Math.min(MAP_W - MAP_W / k, x)),
    y: Math.max(0, Math.min(MAP_H - MAP_H / k, y)),
  });

  function zoomBy(factor: number) {
    setZoom((z) => {
      const k = Math.max(1, Math.min(8, z.k * factor));
      // 以目前視窗中心為縮放中心
      const cx = z.x + MAP_W / z.k / 2;
      const cy = z.y + MAP_H / z.k / 2;
      const { x, y } = clampView(cx - MAP_W / k / 2, cy - MAP_H / k / 2, k);
      return { k, x, y };
    });
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, x: zoom.x, y: zoom.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = MAP_W / zoom.k / rect.width;
    const { x, y } = clampView(
      drag.x - (e.clientX - drag.startX) * scale,
      drag.y - (e.clientY - drag.startY) * scale,
      zoom.k,
    );
    setZoom((z) => ({ ...z, x, y }));
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    // 幾乎沒移動 → 視為點擊（交給 path 的 onClick）
    if (drag && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) {
      suppressClickRef.current = true;
    }
  }

  const suppressClickRef = useRef(false);

  const percent = totalCountries ? Math.round((visitedCodes.size / totalCountries) * 1000) / 10 : 0;
  const sortedVisited = [...(visited ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  return (
    <div className="page with-nav">
      <header className="app-header">
        <h1>世界地圖</h1>
      </header>

      <div className="summary-card map-stats">
        <div className="map-stat-main">
          <span className="map-stat-number">{visitedCodes.size}</span>
          <span className="map-stat-label">/ {totalCountries || '—'} 個國家</span>
          <span className="map-stat-percent">{percent}%</span>
        </div>
        <div className="progress-row">
          <div className="progress-bar">
            <div className="progress-fill gold" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <p className="hint">點地圖上的國家解除迷霧；再點一次可取消</p>
      </div>

      <div className="map-frame">
        {!shapes ? (
          <div className="map-loading">🗺️ 地圖載入中…</div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`${zoom.x} ${zoom.y} ${vw} ${vh}`}
            className="world-map"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <defs>
              <linearGradient id="visited-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#41d6b0" />
                <stop offset="1" stopColor="#f5c66b" />
              </linearGradient>
            </defs>
            {shapes.map((s) => {
              const isVisited = s.alpha2 !== null && visitedCodes.has(s.alpha2);
              return (
                <path
                  key={s.key}
                  d={s.d}
                  className={`country ${isVisited ? 'visited' : ''} ${s.alpha2 ? '' : 'inert'}`}
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    toggleCountry(s);
                  }}
                >
                  <title>{s.name}</title>
                </path>
              );
            })}
          </svg>
        )}
        <div className="map-zoom">
          <button type="button" onClick={() => zoomBy(1.6)} aria-label="放大">
            ＋
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="縮小">
            －
          </button>
        </div>
      </div>

      {sortedVisited.length > 0 && (
        <section className="trip-section">
          <h2>已解鎖的足跡</h2>
          <div className="member-chips">
            {sortedVisited.map((v) => (
              <button
                key={v.code}
                type="button"
                className="member-chip visited-chip"
                onClick={() => db.visitedCountries.delete(v.code)}
                title="點一下移除"
              >
                {v.name} ✕
              </button>
            ))}
          </div>
        </section>
      )}

      <BottomNav />
    </div>
  );
}
