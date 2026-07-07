import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/db';
import {
  createExpense,
  currencies,
  expenseCategoryMeta,
  todayISO,
  uuid,
  type ExpenseCategory,
  type ExpenseMember,
  type ExpenseRecord,
} from '../models/types';

/** 自己的成員固定用這個 id，重複呼叫 put 也不會多建 */
const SELF_MEMBER_ID = 'self';

const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

function formatDateHeader(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdayNames[d.getDay()]})`;
}

function formatAmount(n: number): string {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}

const memberEmojis = ['🙂', '😎', '🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🦁', '🐸'];

/* ===== 新增成員小表單 ===== */
function MemberForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(memberEmojis[1]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await db.expenseMembers.add({
      id: uuid(),
      name: name.trim(),
      type: 'virtual',
      avatarEmoji: emoji,
    });
    onDone();
  }

  return (
    <form className="form member-form" onSubmit={handleSubmit}>
      <label>
        成員名稱
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：小明"
          autoFocus
        />
      </label>
      <div className="emoji-picker">
        {memberEmojis.map((em) => (
          <button
            key={em}
            type="button"
            className={`emoji-option ${em === emoji ? 'selected' : ''}`}
            onClick={() => setEmoji(em)}
          >
            {em}
          </button>
        ))}
      </div>
      <div className="form-row">
        <button type="button" className="btn-secondary" onClick={onDone}>
          取消
        </button>
        <button type="submit" className="btn-primary">
          新增成員
        </button>
      </div>
    </form>
  );
}

/* ===== 開銷表單（新增/編輯共用） ===== */
interface ExpenseDraft {
  amount: string;
  currency: string;
  category: ExpenseCategory;
  description: string;
  date: string;
  paidById: string;
  splitWithIds: string[];
}

function ExpenseForm({
  initial,
  members,
  onSave,
  onCancel,
}: {
  initial: ExpenseDraft;
  members: ExpenseMember[];
  onSave: (draft: ExpenseDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ExpenseDraft>(initial);
  const [error, setError] = useState('');
  const set = <K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // 付款人不能同時是分帳對象
  const splitCandidates = members.filter((m) => m.id !== draft.paidById);

  function toggleSplit(id: string) {
    set(
      'splitWithIds',
      draft.splitWithIds.includes(id)
        ? draft.splitWithIds.filter((x) => x !== id)
        : [...draft.splitWithIds, id],
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = Number(draft.amount);
    if (!amount || amount <= 0) {
      setError('請輸入正確的金額');
      return;
    }
    onSave(draft);
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          金額
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft.amount}
            onChange={(e) => set('amount', e.target.value)}
            autoFocus
          />
        </label>
        <label>
          幣別
          <select value={draft.currency} onChange={(e) => set('currency', e.target.value)}>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          分類
          <select
            value={draft.category}
            onChange={(e) => set('category', e.target.value as ExpenseCategory)}
          >
            {(Object.keys(expenseCategoryMeta) as ExpenseCategory[]).map((c) => (
              <option key={c} value={c}>
                {expenseCategoryMeta[c].emoji} {expenseCategoryMeta[c].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          日期
          <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
        </label>
      </div>

      <label>
        描述
        <input
          type="text"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="例如：一蘭拉麵"
        />
      </label>

      <label>
        付款人
        <select
          value={draft.paidById}
          onChange={(e) => {
            const paidById = e.target.value;
            setDraft((d) => ({
              ...d,
              paidById,
              splitWithIds: d.splitWithIds.filter((x) => x !== paidById),
            }));
          }}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.avatarEmoji} {m.name}
            </option>
          ))}
        </select>
      </label>

      {splitCandidates.length > 0 && (
        <fieldset className="bg-picker">
          <legend>與誰分帳（平均分攤，不勾 = 付款人自己出）</legend>
          <div className="split-chips">
            {splitCandidates.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`split-chip ${draft.splitWithIds.includes(m.id) ? 'selected' : ''}`}
                onClick={() => toggleSplit(m.id)}
              >
                {m.avatarEmoji} {m.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-row">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="btn-primary">
          儲存
        </button>
      </div>
    </form>
  );
}

/* ===== 分帳結算 ===== */
function SettleUp({
  expenses,
  members,
}: {
  expenses: ExpenseRecord[];
  members: ExpenseMember[];
}) {
  // balances[memberId][currency] = 已付 - 應分攤（正數 = 應收回）
  const balances = new Map<string, Map<string, number>>();
  const add = (memberId: string, currency: string, delta: number) => {
    const byCurrency = balances.get(memberId) ?? new Map<string, number>();
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + delta);
    balances.set(memberId, byCurrency);
  };

  for (const ex of expenses) {
    const share = ex.amount / (ex.splitWithIds.length + 1); // +1 = 付款人本人
    add(ex.paidById, ex.currency, ex.amount - share);
    for (const id of ex.splitWithIds) add(id, ex.currency, -share);
  }

  const rows = members
    .map((m) => {
      const byCurrency = [...(balances.get(m.id) ?? new Map<string, number>())].filter(
        ([, v]) => Math.abs(v) >= 0.01,
      );
      return { member: m, byCurrency };
    })
    .filter((r) => r.byCurrency.length > 0);

  if (rows.length === 0) return null;

  return (
    <details className="settle-card">
      <summary>💱 分帳結算</summary>
      <ul>
        {rows.map(({ member, byCurrency }) => (
          <li key={member.id}>
            <span>
              {member.avatarEmoji} {member.name}
            </span>
            <span>
              {byCurrency.map(([currency, v]) => (
                <span key={currency} className={v > 0 ? 'settle-receive' : 'settle-pay'}>
                  {v > 0 ? '應收' : '應付'} {formatAmount(Math.abs(v))} {currency}{' '}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ===== 主頁面 ===== */
export default function ExpensesPage() {
  const { id } = useParams<{ id: string }>();
  // trip：undefined = 載入中，null = 找不到
  const trip = useLiveQuery(async () => (id ? ((await db.trips.get(id)) ?? null) : null), [id]);
  const expenses = useLiveQuery(
    () => (id ? db.expenses.where('tripId').equals(id).toArray() : []),
    [id],
  );
  const members = useLiveQuery(() => db.expenseMembers.toArray(), []);

  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  // 確保「我」永遠存在（固定 id，put 具冪等性，StrictMode 重跑也安全）
  useEffect(() => {
    db.expenseMembers.put({ id: SELF_MEMBER_ID, name: '我', type: 'self', avatarEmoji: '🙂' });
  }, []);

  if (trip === undefined || !expenses || !members) return null;
  if (trip === null) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>找不到這趟旅程</p>
          <Link to="/">回首頁</Link>
        </div>
      </div>
    );
  }

  const memberById = new Map(members.map((m) => [m.id, m]));

  // 每個幣別的總額
  const totals = new Map<string, number>();
  for (const ex of expenses) totals.set(ex.currency, (totals.get(ex.currency) ?? 0) + ex.amount);

  // 依日期分組（新的在上）
  const byDate = new Map<string, ExpenseRecord[]>();
  for (const ex of [...expenses].sort((a, b) => b.date.localeCompare(a.date))) {
    const list = byDate.get(ex.date) ?? [];
    list.push(ex);
    byDate.set(ex.date, list);
  }

  const defaultDate =
    todayISO() >= trip.startDate && todayISO() <= trip.endDate ? todayISO() : trip.startDate;

  const emptyDraft: ExpenseDraft = {
    amount: '',
    currency: 'TWD',
    category: 'food',
    description: '',
    date: defaultDate,
    paidById: SELF_MEMBER_ID,
    splitWithIds: [],
  };

  const editingExpense = editing && editing !== 'new' ? expenses.find((e) => e.id === editing) : null;

  async function handleSave(draft: ExpenseDraft) {
    if (editing === 'new') {
      await db.expenses.add(
        createExpense({
          tripId: trip!.id,
          amount: Number(draft.amount),
          currency: draft.currency,
          category: draft.category,
          description: draft.description.trim(),
          paidById: draft.paidById,
          splitWithIds: draft.splitWithIds,
          date: draft.date,
        }),
      );
    } else if (editingExpense) {
      await db.expenses.put({
        ...editingExpense,
        amount: Number(draft.amount),
        currency: draft.currency,
        category: draft.category,
        description: draft.description.trim(),
        paidById: draft.paidById,
        splitWithIds: draft.splitWithIds,
        date: draft.date,
      });
    }
    setEditing(null);
  }

  async function handleDelete(expenseId: string) {
    if (!window.confirm('確定要刪除這筆開銷嗎？')) return;
    await db.expenses.delete(expenseId);
  }

  async function handleDeleteMember(member: ExpenseMember) {
    const used = expenses!.some(
      (e) => e.paidById === member.id || e.splitWithIds.includes(member.id),
    );
    if (used) {
      window.alert(`「${member.name}」還有開銷紀錄，無法刪除。`);
      return;
    }
    if (!window.confirm(`確定要刪除成員「${member.name}」嗎？`)) return;
    await db.expenseMembers.delete(member.id);
  }

  return (
    <div className="page">
      <header className="app-header">
        <Link to={`/trip/${trip.id}`} className="back-btn" aria-label="返回">
          ‹
        </Link>
        <h1>{trip.title} — 記帳</h1>
      </header>

      {editing !== null ? (
        <ExpenseForm
          initial={
            editingExpense
              ? {
                  amount: String(editingExpense.amount),
                  currency: editingExpense.currency,
                  category: editingExpense.category,
                  description: editingExpense.description,
                  date: editingExpense.date,
                  paidById: memberById.has(editingExpense.paidById)
                    ? editingExpense.paidById
                    : SELF_MEMBER_ID,
                  splitWithIds: editingExpense.splitWithIds.filter((x) => memberById.has(x)),
                }
              : emptyDraft
          }
          members={members}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      ) : addingMember ? (
        <MemberForm onDone={() => setAddingMember(false)} />
      ) : (
        <>
          <div className="summary-card">
            <h2>總支出</h2>
            {totals.size === 0 ? (
              <p className="hint">還沒有任何開銷</p>
            ) : (
              <div className="totals">
                {[...totals].map(([currency, total]) => (
                  <div key={currency} className="total-line">
                    <span className="total-amount">{formatAmount(total)}</span>
                    <span className="total-currency">{currency}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="member-chips">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className="member-chip"
                onClick={() => m.type !== 'self' && handleDeleteMember(m)}
                title={m.type === 'self' ? undefined : '點一下刪除成員'}
              >
                {m.avatarEmoji} {m.name}
              </button>
            ))}
            <button type="button" className="member-chip add" onClick={() => setAddingMember(true)}>
              ＋ 成員
            </button>
          </div>

          <SettleUp expenses={expenses} members={members} />

          {[...byDate].map(([date, list]) => (
            <section key={date} className="trip-section">
              <h2>{formatDateHeader(date)}</h2>
              <ul className="item-list">
                {list.map((ex) => {
                  const payer = memberById.get(ex.paidById);
                  const meta = expenseCategoryMeta[ex.category];
                  return (
                    <li key={ex.id} className="item-card">
                      <div className="expense-emoji">{meta.emoji}</div>
                      <div className="item-body">
                        <div className="item-title">{ex.description || meta.label}</div>
                        <div className="item-meta">
                          {meta.label} · {payer ? `${payer.avatarEmoji} ${payer.name}` : '？'} 付款
                          {ex.splitWithIds.length > 0 && ` · ${ex.splitWithIds.length + 1} 人分帳`}
                        </div>
                      </div>
                      <div className="expense-amount">
                        {formatAmount(ex.amount)}
                        <span className="total-currency">{ex.currency}</span>
                      </div>
                      <div className="item-actions">
                        <button type="button" onClick={() => setEditing(ex.id)} aria-label="編輯">
                          ✏️
                        </button>
                        <button type="button" onClick={() => handleDelete(ex.id)} aria-label="刪除">
                          🗑️
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <button type="button" className="fab" onClick={() => setEditing('new')} aria-label="新增開銷">
            ＋
          </button>
        </>
      )}
    </div>
  );
}
