import { useEffect, useState } from 'react';
import { setToastListener } from '../lib/toast';

interface ToastItem {
  id: number;
  text: string;
  leaving: boolean;
}

let nextId = 1;

/** 顯示 toast 的宿主，掛在 App 最外層 */
export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    setToastListener((text) => {
      const id = nextId++;
      setItems((list) => [...list, { id, text, leaving: false }]);
      setTimeout(() => {
        setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      }, 1900);
      setTimeout(() => {
        setItems((list) => list.filter((t) => t.id !== id));
      }, 2200);
    });
    return () => setToastListener(null);
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.leaving ? 'leaving' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
