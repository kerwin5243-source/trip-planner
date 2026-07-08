import { useState } from 'react';
import { searchPlaces } from '../lib/geo';
import type { PlaceRef } from '../models/types';

/** 地點搜尋欄（Nominatim）：輸入關鍵字 → 按搜尋 → 點選結果 */
export default function PlaceSearch({
  placeholder,
  onSelect,
}: {
  placeholder?: string;
  onSelect: (place: PlaceRef) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceRef[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch() {
    if (!query.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const found = await searchPlaces(query.trim());
      setResults(found);
      if (found.length === 0) setError('找不到符合的地點，換個關鍵字試試');
    } catch {
      setError('搜尋失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="place-search">
      <div className="place-search-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? '搜尋地點，例如：金閣寺'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
        />
        <button type="button" className="btn-secondary place-search-btn" onClick={handleSearch}>
          {busy ? '…' : '🔍'}
        </button>
      </div>
      {error && <p className="hint">{error}</p>}
      {results && results.length > 0 && (
        <ul className="place-results">
          {results.map((p, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  setResults(null);
                  setQuery('');
                }}
              >
                📍 {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
