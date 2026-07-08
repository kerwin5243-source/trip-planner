/** 極簡 toast 事件匯流排：任何地方呼叫 toast()，由 ToastHost 顯示 */

type Listener = (text: string) => void;

let listener: Listener | null = null;

export function toast(text: string): void {
  listener?.(text);
}

export function setToastListener(l: Listener | null): void {
  listener = l;
}
