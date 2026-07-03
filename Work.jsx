import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, List, BarChart3, Settings as SettingsIcon, X, Trash2, AlertCircle, Moon, Plane, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  TAX_RATE, RELIABILITY_RATE, NIGHT_MINOR_RATE, NIGHT_MAJOR_RATE,
  HIGH_SEASON_THRESHOLD, HIGH_SEASON_BONUS, FLEX_BONUS_CAP, WEEKEND_BONUS,
  TRAVEL_WORK_BONUS, PER_DIEM_RATE, OT_TIER1_HOURS, OT_TIER1_MULT, OT_TIER2_MULT,
  DEFAULT_SETTINGS, MONTHS_NOM, MONTHS_SHORT,
  pad2, formatMoney, formatHours, formatDateShort,
  monthLabel, monthShortLabel, dayOfWeek, isWeekendDate,
  daysInMonth, weekdaysInMonth, monthBounds, diffDaysInclusive,
  monthRange, toMinutes, shiftHoursOf, nightHoursOf,
  normalizeShift, computeShiftPay,
  perDiemDaysForMonth, isFullMonthInTrip, computeMonthSummary,
} from './workUtils.js';

/*
  ПРАВИЛА НАЧИСЛЕНИЙ (по описанию пользователя)
  ------------------------------------------------
  За смену (считается по каждой смене отдельно):
   - Оплата по ставке: часы × ставка
   - Вечер/ночь: если < половины смены попадает в 22:00–08:00 → +20% на эти часы;
                 если > половины смены попадает в 22:00–08:00 → +30% на ВСЮ смену
   - Премия надёжности: 15% × часы × ставка
   - Премия выходного дня: 560 ₽, если дата смены — суббота или воскресенье
   Всё это облагается НДФЛ 13%.

  За месяц (считается по сумме часов за месяц на человека):
   - Норма = (будних дней в месяце − праздничных) × 8
   - Премия «Высокий сезон»: 7000 ₽, если часов за месяц > 120
   - Премия «Любые временные возможности»: до 15 000 ₽ пропорционально часам/норме,
     при часах ≥ норме — 15 000 ₽ фиксировано
   - Переработка: часы сверх нормы; первые 2 часа — доплата +0.5×ставки,
     остальные — доплата +1×ставки (это доплата поверх уже учтённой в базовой оплате ставки)
   Всё это тоже облагается НДФЛ 13%.

  Без НДФЛ, по календарным дням командировки (11.06.2026 →):
   - Командировочные: 500 ₽ за каждый день командировки (даже нерабочий)
   - Премия «Путешествуй и работай»: 3000 ₽ за месяц, если ВЕСЬ месяц полностью
     попадает в период командировки
*/

// ---------- Хранилище ----------
const SHIFTS_KEY = 'shifts';
const SETTINGS_KEY = 'settings';
const MONTH_META_KEY = 'monthMeta';

const P1_COLOR = '#0f766e';
const P2_COLOR = '#6d28d9';

const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WEEKDAY_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [tab, setTab] = useState('add');
  const [shifts, setShifts] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [monthMeta, setMonthMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [statsPerson, setStatsPerson] = useState('p1');
  const [statsMonth, setStatsMonth] = useState('');

  useEffect(() => {
    (async () => {
      let loadedSettings = DEFAULT_SETTINGS;
      let loadedShifts = [];
      let loadedMeta = {};
      try {
        const res = await window.storage.get(SETTINGS_KEY, false);
        if (res && res.value) loadedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(res.value) };
      } catch (e) {}
      try {
        const res = await window.storage.get(SHIFTS_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed)) loadedShifts = parsed.map(normalizeShift);
        }
      } catch (e) {}
      try {
        const res = await window.storage.get(MONTH_META_KEY, false);
        if (res && res.value) loadedMeta = JSON.parse(res.value) || {};
      } catch (e) {}
      setSettings(loadedSettings);
      setSettingsDraft(loadedSettings);
      setShifts(loadedShifts);
      setMonthMeta(loadedMeta);
      setForm({
        date: todayStr(),
        person: 'p1',
        startTime: '',
        endTime: '',
        rate: String(loadedSettings.p1Rate ?? ''),
        extraAmount: '',
        extraNote: '',
        note: '',
      });
      setStatsMonth(currentMonthKey());
      setLoading(false);
    })();
  }, []);

  const persistShifts = useCallback(async (next) => {
    setShifts(next);
    try {
      const result = await window.storage.set(SHIFTS_KEY, JSON.stringify(next), false);
      setSaveError(result ? '' : 'Не удалось сохранить. Попробуйте ещё раз.');
    } catch (e) {
      setSaveError('Не удалось сохранить. Проверьте соединение.');
    }
  }, []);

  const persistSettings = useCallback(async (next) => {
    setSettings(next);
    try {
      await window.storage.set(SETTINGS_KEY, JSON.stringify(next), false);
    } catch (e) {
      setSaveError('Не удалось сохранить настройки.');
    }
  }, []);

  const persistMonthMeta = useCallback(async (next) => {
    setMonthMeta(next);
    try {
      await window.storage.set(MONTH_META_KEY, JSON.stringify(next), false);
    } catch (e) {
      setSaveError('Не удалось сохранить настройки месяца.');
    }
  }, []);

  const updateHolidays = useCallback((monthKey, value) => {
    const n = Math.max(0, parseInt(value, 10) || 0);
    setMonthMeta((prev) => {
      const next = { ...prev, [monthKey]: { ...prev[monthKey], holidays: n } };
      persistMonthMeta(next);
      return next;
    });
  }, [persistMonthMeta]);

  function resetForm(person) {
    const p = person || 'p1';
    setForm({
      date: todayStr(),
      person: p,
      startTime: '',
      endTime: '',
      rate: String((p === 'p1' ? settings.p1Rate : settings.p2Rate) ?? ''),
      extraAmount: '',
      extraNote: '',
      note: '',
    });
    setEditingId(null);
    setFormError('');
  }

  function handlePersonSelect(person) {
    setForm((f) => {
      const oldDefault = f.person === 'p1' ? settings.p1Rate : settings.p2Rate;
      const usingDefault = f.rate === '' || Number(f.rate) === Number(oldDefault);
      const newDefault = person === 'p1' ? settings.p1Rate : settings.p2Rate;
      return { ...f, person, rate: usingDefault ? String(newDefault ?? '') : f.rate };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const rate = parseFloat(form.rate) || 0;
    const extraAmount = parseFloat(form.extraAmount) || 0;
    const hasTimes = !!(form.startTime && form.endTime);

    if (!form.date) return setFormError('Укажите дату смены');
    if (rate < 0) return setFormError('Ставка не может быть отрицательной');
    if (!hasTimes && extraAmount === 0) return setFormError('Укажите время смены или сумму корректировки');
    if (hasTimes && form.startTime === form.endTime) return setFormError('Время начала и окончания смены совпадает');

    const prevCreatedAt = editingId ? shifts.find((s) => s.id === editingId)?.createdAt : null;
    const entry = {
      id: editingId || genId(),
      date: form.date,
      person: form.person,
      startTime: form.startTime,
      endTime: form.endTime,
      legacyHours: 0,
      rate,
      extraAmount,
      extraNote: form.extraNote.trim(),
      note: form.note.trim(),
      createdAt: prevCreatedAt || Date.now(),
    };

    const next = editingId ? shifts.map((s) => (s.id === editingId ? entry : s)) : [...shifts, entry];
    persistShifts(next);
    resetForm(form.person);
    setTab('table');
  }

  function startEdit(shift) {
    setForm({
      date: shift.date,
      person: shift.person,
      startTime: shift.startTime || '',
      endTime: shift.endTime || '',
      rate: String(shift.rate || ''),
      extraAmount: shift.extraAmount ? String(shift.extraAmount) : '',
      extraNote: shift.extraNote || '',
      note: shift.note || '',
    });
    setEditingId(shift.id);
    setFormError('');
    setTab('add');
  }

  function handleDelete(id) {
    persistShifts(shifts.filter((s) => s.id !== id));
  }

  function saveSettingsForm(e) {
    e.preventDefault();
    const clean = {
      p1Name: settingsDraft.p1Name.trim() || 'Я',
      p2Name: settingsDraft.p2Name.trim() || 'Жена',
      p1Rate: parseFloat(settingsDraft.p1Rate) || 0,
      p2Rate: parseFloat(settingsDraft.p2Rate) || 0,
      tripStart: settingsDraft.tripStart || '',
      tripEnd: settingsDraft.tripEnd || '',
      p1OnTrip: !!settingsDraft.p1OnTrip,
      p2OnTrip: !!settingsDraft.p2OnTrip,
    };
    persistSettings(clean);
    setShowSettings(false);
  }

  const shiftMonths = useMemo(() => {
    return Array.from(new Set(shifts.map((s) => s.date.slice(0, 7)))).sort().reverse();
  }, [shifts]);

  const payrollMonths = useMemo(() => {
    const base = shifts.map((s) => s.date.slice(0, 7));
    let tripMonths = [];
    if (settings.tripStart) {
      const tripStartMonth = settings.tripStart.slice(0, 7);
      const curMonth = currentMonthKey();
      const tripEndMonth = settings.tripEnd ? settings.tripEnd.slice(0, 7) : null;
      const rangeEnd = tripEndMonth && tripEndMonth < curMonth ? tripEndMonth : curMonth;
      tripMonths = monthRange(tripStartMonth, rangeEnd);
    }
    return Array.from(new Set([...base, ...tripMonths])).sort().reverse();
  }, [shifts, settings.tripStart, settings.tripEnd]);

  const groupedShifts = useMemo(() => {
    let filtered = shifts;
    if (filterPerson !== 'all') filtered = filtered.filter((s) => s.person === filterPerson);
    if (filterMonth !== 'all') filtered = filtered.filter((s) => s.date.slice(0, 7) === filterMonth);
    const groups = {};
    filtered.forEach((s) => {
      const mk = s.date.slice(0, 7);
      if (!groups[mk]) groups[mk] = [];
      groups[mk].push(s);
    });
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([mk, items]) => ({
        month: mk,
        label: monthLabel(mk),
        items: [...items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
        total: items.reduce((sum, s) => sum + computeShiftPay(s).net, 0),
      }));
  }, [shifts, filterPerson, filterMonth]);

  const monthSummaries = useMemo(() => {
    const map = {};
    payrollMonths.forEach((mk) => {
      map[mk] = {
        p1: computeMonthSummary(mk, 'p1', shifts, settings, monthMeta),
        p2: computeMonthSummary(mk, 'p2', shifts, settings, monthMeta),
      };
    });
    return map;
  }, [payrollMonths, shifts, settings, monthMeta]);

  const overallStats = useMemo(() => {
    const cmk = currentMonthKey();
    const sortedMonths = payrollMonths.slice().sort();
    let netAll = 0, netP1 = 0, netP2 = 0, thisMonthNet = 0, bonusNetAll = 0;
    sortedMonths.forEach((mk) => {
      const p1 = monthSummaries[mk].p1;
      const p2 = monthSummaries[mk].p2;
      netAll += p1.netTotal + p2.netTotal;
      netP1 += p1.netTotal;
      netP2 += p2.netTotal;
      bonusNetAll += (p1.taxableGross - p1.base) * (1 - TAX_RATE) + p1.nonTaxable;
      bonusNetAll += (p2.taxableGross - p2.base) * (1 - TAX_RATE) + p2.nonTaxable;
      if (mk === cmk) thisMonthNet += p1.netTotal + p2.netTotal;
    });
    const monthlyArr = sortedMonths.slice(-6).map((mk) => ({
      month: mk,
      label: monthShortLabel(mk),
      p1: monthSummaries[mk].p1.netTotal,
      p2: monthSummaries[mk].p2.netTotal,
    }));
    return { netAll, netP1, netP2, thisMonthNet, bonusNetAll, monthlyArr };
  }, [payrollMonths, monthSummaries]);

  if (loading || !form) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-stone-400 text-sm">Загрузка…</p>
      </div>
    );
  }

  const preview = computeShiftPay({
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    rate: parseFloat(form.rate) || 0,
    extraAmount: parseFloat(form.extraAmount) || 0,
  });

  const effectiveStatsMonth = payrollMonths.includes(statsMonth) ? statsMonth : (payrollMonths[0] || currentMonthKey());

  return (
    <div className="min-h-screen bg-stone-100" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Slab:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'IBM Plex Slab', serif; }
        .font-mono-num { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
      `}</style>

      <div className="max-w-md mx-auto pb-24">
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <div>
            <h1 className="font-display text-2xl text-stone-900 font-semibold tracking-tight">Табель смен</h1>
            <p className="text-stone-500 text-xs mt-0.5">Часы, премии и командировочные</p>
          </div>
          <button
            onClick={() => { setSettingsDraft(settings); setShowSettings(true); }}
            className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-500 active:scale-95 transition-transform focus:ring-2 focus:ring-stone-400"
            aria-label="Настройки"
          >
            <SettingsIcon size={18} />
          </button>
        </header>

        {saveError && (
          <div className="mx-5 mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">
            <AlertCircle size={14} className="shrink-0" />
            {saveError}
          </div>
        )}

        <main className="px-5">
          {tab === 'add' && (
            <AddForm
              form={form}
              setForm={setForm}
              settings={settings}
              onPersonSelect={handlePersonSelect}
              onSubmit={handleSubmit}
              formError={formError}
              preview={preview}
              editingId={editingId}
              onCancelEdit={() => resetForm(form.person)}
            />
          )}
          {tab === 'table' && (
            <TableView
              groups={groupedShifts}
              settings={settings}
              filterPerson={filterPerson}
              setFilterPerson={setFilterPerson}
              filterMonth={filterMonth}
              setFilterMonth={setFilterMonth}
              availableMonths={shiftMonths}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          )}
          {tab === 'stats' && (
            <StatsView
              overallStats={overallStats}
              settings={settings}
              shiftsCount={shifts.length}
              availableMonths={payrollMonths}
              monthSummaries={monthSummaries}
              statsMonth={effectiveStatsMonth}
              setStatsMonth={setStatsMonth}
              statsPerson={statsPerson}
              setStatsPerson={setStatsPerson}
              onHolidaysChange={updateHolidays}
            />
          )}
        </main>
      </div>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200">
        <div className="max-w-md mx-auto grid grid-cols-3">
          <TabButton icon={Plus} label="Добавить" active={tab === 'add'} onClick={() => setTab('add')} />
          <TabButton icon={List} label="Таблица" active={tab === 'table'} onClick={() => setTab('table')} />
          <TabButton icon={BarChart3} label="Статистика" active={tab === 'stats'} onClick={() => setTab('stats')} />
        </div>
      </nav>

      {showSettings && (
        <SettingsModal
          draft={settingsDraft}
          setDraft={setSettingsDraft}
          onSave={saveSettingsForm}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2.5 focus:ring-2 focus:ring-inset focus:ring-stone-400 ${active ? 'text-teal-700' : 'text-stone-400'}`}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      <span className={`text-xs ${active ? 'font-medium' : ''}`}>{label}</span>
    </button>
  );
}

function PersonStamp({ letter, color, size }) {
  const dims = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  return (
    <span
      className={`${dims} rounded-full flex items-center justify-center font-display font-semibold text-white shrink-0`}
      style={{ backgroundColor: color, boxShadow: `0 0 0 2px white, 0 0 0 3px ${color}55` }}
    >
      {letter}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-stone-500 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function LineItem({ label, value, accent, bold }) {
  const colorMap = { rose: 'text-rose-700', amber: 'text-amber-700', emerald: 'text-emerald-700', indigo: 'text-indigo-700' };
  const colorClass = colorMap[accent] || 'text-stone-800';
  const sign = value < 0 ? '−' : '';
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <span className={`text-sm ${bold ? 'font-medium text-stone-800' : 'text-stone-600'}`}>{label}</span>
      <span className={`font-mono-num text-sm shrink-0 ${bold ? 'font-semibold' : ''} ${colorClass}`}>{sign}{formatMoney(Math.abs(value))}</span>
    </div>
  );
}

function AddForm({ form, setForm, settings, onPersonSelect, onSubmit, formError, preview, editingId, onCancelEdit }) {
  const [showExtra, setShowExtra] = useState(!!(form.extraAmount || form.extraNote));
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const showBreakdown = preview.hours > 0 || preview.extra !== 0;

  return (
    <form onSubmit={onSubmit} className="space-y-5 pt-1">
      {editingId && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <span>Редактирование записи</span>
          <button type="button" onClick={onCancelEdit} className="underline">Отменить</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onPersonSelect('p1')}
          className={`flex items-center gap-2 justify-center rounded-xl py-3 border-2 transition-colors ${form.person === 'p1' ? 'border-teal-700 bg-teal-50' : 'border-stone-200 bg-white'}`}
        >
          <PersonStamp letter={settings.p1Name.charAt(0).toUpperCase()} color={P1_COLOR} size="sm" />
          <span className={`text-sm font-medium ${form.person === 'p1' ? 'text-teal-800' : 'text-stone-600'}`}>{settings.p1Name}</span>
        </button>
        <button
          type="button"
          onClick={() => onPersonSelect('p2')}
          className={`flex items-center gap-2 justify-center rounded-xl py-3 border-2 transition-colors ${form.person === 'p2' ? 'border-violet-700 bg-violet-50' : 'border-stone-200 bg-white'}`}
        >
          <PersonStamp letter={settings.p2Name.charAt(0).toUpperCase()} color={P2_COLOR} size="sm" />
          <span className={`text-sm font-medium ${form.person === 'p2' ? 'text-violet-800' : 'text-stone-600'}`}>{settings.p2Name}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
        <Field label="Дата смены">
          <input
            type="date"
            value={form.date}
            onChange={update('date')}
            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </Field>
        {form.date && (
          <p className={`text-xs -mt-2 ${isWeekendDate(form.date) ? 'text-violet-600 font-medium' : 'text-stone-400'}`}>
            {WEEKDAY_FULL[dayOfWeek(form.date)]}{isWeekendDate(form.date) ? ' — премия выходного дня +560 ₽' : ''}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало смены">
            <input
              type="time"
              value={form.startTime}
              onChange={update('startTime')}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </Field>
          <Field label="Конец смены">
            <input
              type="time"
              value={form.endTime}
              onChange={update('endTime')}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </Field>
        </div>
        <Field label="Ставка, ₽/ч">
          <input
            type="number" inputMode="decimal" min="0" step="1" placeholder="231"
            value={form.rate} onChange={update('rate')}
            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </Field>
        {preview.hours > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs bg-stone-50 rounded-lg px-3 py-2">
            <span className="font-mono-num font-medium text-stone-700">{formatHours(preview.hours)}</span>
            {preview.night > 0 && (
              <span className="flex items-center gap-1 text-indigo-700">
                <Moon size={12} /> {formatHours(preview.night)} в ночном окне · {preview.isMajorNight ? '+30% на всю смену' : '+20% на эти часы'}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowExtra((v) => !v)}
        className="flex items-center gap-1 text-xs text-stone-500 font-medium"
      >
        {showExtra ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Ручная корректировка (необязательно)
      </button>
      {showExtra && (
        <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Сумма, ₽">
              <input
                type="number" inputMode="decimal" step="1" placeholder="0"
                value={form.extraAmount} onChange={update('extraAmount')}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono-num focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
              />
            </Field>
            <Field label="За что">
              <input
                type="text" placeholder="Напр. разовая доплата"
                value={form.extraNote} onChange={update('extraNote')}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
              />
            </Field>
          </div>
          <p className="text-xs text-stone-400">Можно указать и отрицательную сумму — для коррекции. Облагается налогом 13%, как и остальные надбавки.</p>
        </div>
      )}

      <Field label="Заметка (необязательно)">
        <textarea
          rows={2} placeholder="Любые детали смены"
          value={form.note} onChange={update('note')}
          className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-100 resize-none"
        />
      </Field>

      {formError && <p className="text-red-700 text-xs">{formError}</p>}

      {showBreakdown && (
        <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
          {preview.hours > 0 && (
            <LineItem label={`Оплата по ставке (${formatHours(preview.hours)} × ${form.rate || 0}₽)`} value={preview.base} />
          )}
          {preview.nightBonus > 0 && (
            <LineItem label={`Доплата за вечер/ночь (${preview.isMajorNight ? '30%' : '20%'})`} value={preview.nightBonus} accent="indigo" />
          )}
          {preview.reliabilityBonus > 0 && <LineItem label="Премия надёжности (15%)" value={preview.reliabilityBonus} accent="amber" />}
          {preview.weekendBonus > 0 && <LineItem label="Премия выходного дня" value={preview.weekendBonus} accent="amber" />}
          {preview.extra !== 0 && <LineItem label={form.extraNote || 'Ручная корректировка'} value={preview.extra} accent="amber" />}
          <LineItem label="НДФЛ 13%" value={-preview.tax} accent="rose" />
        </div>
      )}

      <div className="flex items-center justify-between bg-stone-900 rounded-xl px-4 py-3.5">
        <span className="text-stone-300 text-sm">К выплате за смену</span>
        <span className="font-mono-num text-white text-lg font-semibold">{formatMoney(preview.net)}</span>
      </div>

      <p className="text-xs text-stone-400 -mt-2">Месячные премии (высокий сезон, гибкий график, переработка) и командировочные — во вкладке «Статистика».</p>

      <button
        type="submit"
        className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-xl py-3.5 text-sm font-medium active:scale-95 transition-transform focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
      >
        {editingId ? 'Сохранить изменения' : 'Сохранить смену'}
      </button>
    </form>
  );
}

function FilterChip({ active, onClick, children, color }) {
  return (
    <button
      onClick={onClick}
      style={active && color ? { backgroundColor: color } : undefined}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active ? `text-white border-transparent ${!color ? 'bg-stone-800' : ''}` : 'bg-white text-stone-500 border-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

function TableView({ groups, settings, filterPerson, setFilterPerson, filterMonth, setFilterMonth, availableMonths, onEdit, onDelete }) {
  return (
    <div className="pt-1">
      <div className="flex items-center gap-2 mb-5 overflow-x-auto">
        <FilterChip active={filterPerson === 'all'} onClick={() => setFilterPerson('all')}>Все</FilterChip>
        <FilterChip active={filterPerson === 'p1'} onClick={() => setFilterPerson('p1')} color={P1_COLOR}>{settings.p1Name}</FilterChip>
        <FilterChip active={filterPerson === 'p2'} onClick={() => setFilterPerson('p2')} color={P2_COLOR}>{settings.p2Name}</FilterChip>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="ml-auto text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-600 focus:ring-2 focus:ring-stone-300"
        >
          <option value="all">Все месяцы</option>
          {availableMonths.map((mk) => (
            <option key={mk} value={mk}>{monthLabel(mk)}</option>
          ))}
        </select>
      </div>

      {groups.length === 0 && (
        <div className="text-center py-16">
          <p className="text-stone-400 text-sm">Записей пока нет.</p>
          <p className="text-stone-400 text-sm">Добавьте первую смену на вкладке «Добавить».</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.month}>
            <div className="flex items-baseline justify-between mb-2 px-1">
              <h3 className="font-display text-sm font-semibold text-stone-700">{g.label}</h3>
              <span className="font-mono-num text-sm text-stone-500">{formatMoney(g.total)}</span>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
              {g.items.map((s) => (
                <ShiftRow key={s.id} shift={s} settings={settings} onEdit={() => onEdit(s)} onDelete={() => onDelete(s.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShiftRow({ shift, settings, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const color = shift.person === 'p1' ? P1_COLOR : P2_COLOR;
  const name = shift.person === 'p1' ? settings.p1Name : settings.p2Name;
  const pay = computeShiftPay(shift);
  const weekend = shift.date ? isWeekendDate(shift.date) : false;
  const hasTimes = shift.startTime && shift.endTime;
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <PersonStamp letter={name.charAt(0).toUpperCase()} color={color} size="sm" />
      <button type="button" onClick={onEdit} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 text-sm text-stone-800 flex-wrap">
          <span className={`font-mono-num ${weekend ? 'text-violet-700 font-medium' : ''}`}>
            {formatDateShort(shift.date)} {WEEKDAY_SHORT[dayOfWeek(shift.date)]}
          </span>
          {hasTimes && <span className="text-stone-500 text-xs font-mono-num">{shift.startTime}–{shift.endTime}</span>}
          {pay.nightBonus > 0 && <Moon size={12} className="text-indigo-500 shrink-0" />}
          {pay.extra !== 0 && (
            <span className="text-amber-700 text-xs font-mono-num">{pay.extra > 0 ? '+' : ''}{formatMoney(pay.extra)}</span>
          )}
        </div>
        {shift.note && <p className="text-xs text-stone-400 truncate mt-0.5">{shift.note}</p>}
      </button>
      <span className="font-mono-num text-sm font-semibold text-stone-900">{formatMoney(pay.net)}</span>
      {confirmDelete ? (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onDelete} className="text-xs text-white bg-red-700 rounded px-1.5 py-1">Удалить</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-stone-400 px-1">Нет</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="text-stone-300 p-1 shrink-0" aria-label="Удалить запись">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <p className="text-xs text-stone-500 mb-1">{label}</p>
      <p className={`font-mono-num text-xl font-semibold ${accent || 'text-stone-900'}`}>{value}</p>
    </div>
  );
}

function PayslipCard({ summary, name, color, onHolidaysChange }) {
  const s = summary;
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100" style={{ backgroundColor: `${color}0d` }}>
        <div className="flex items-center gap-2">
          <PersonStamp letter={name.charAt(0).toUpperCase()} color={color} size="sm" />
          <span className="text-sm font-medium text-stone-800">{name}</span>
        </div>
        <span className="font-mono-num text-xs text-stone-500">{formatHours(s.hours)} · норма {s.norm}ч</span>
      </div>

      <div className="flex items-center justify-between px-4 py-2 text-xs text-stone-400 bg-stone-50 border-b border-stone-100">
        <span>Будних дней: {s.wkd}, праздничных:</span>
        <input
          type="number" min="0" value={s.holidays}
          onChange={(e) => onHolidaysChange(e.target.value)}
          className="w-14 text-right bg-white border border-stone-200 rounded px-1.5 py-0.5 font-mono-num text-stone-700"
        />
      </div>

      <div className="divide-y divide-stone-100">
        <LineItem label="Оплата по ставке" value={s.base} />
        {s.nightBonus > 0 && <LineItem label="Доплата за вечер/ночь" value={s.nightBonus} accent="indigo" />}
        {s.reliabilityBonus > 0 && <LineItem label="Премия надёжности" value={s.reliabilityBonus} accent="amber" />}
        {s.weekendBonus > 0 && <LineItem label={`Премия выходного дня (${s.weekendCount})`} value={s.weekendBonus} accent="amber" />}
        {s.highSeasonBonus > 0 && <LineItem label="Премия «Высокий сезон»" value={s.highSeasonBonus} accent="amber" />}
        {s.flexBonus > 0 && <LineItem label="Премия «Любые временные возможности»" value={s.flexBonus} accent="amber" />}
        {s.overtimePremium > 0 && <LineItem label={`Доплата за переработку (${formatHours(s.otHours)})`} value={s.overtimePremium} accent="amber" />}
        {s.extra !== 0 && <LineItem label="Разовые корректировки" value={s.extra} accent="amber" />}
      </div>
      <div className="border-t border-stone-200">
        <LineItem label="Начислено до налога" value={s.taxableGross} bold />
        <LineItem label="НДФЛ 13%" value={-s.tax} accent="rose" />
      </div>

      {s.nonTaxable > 0 && (
        <>
          <div className="px-3.5 pt-2.5 pb-1 text-xs font-medium uppercase tracking-wide text-emerald-700 bg-emerald-50/60">Без НДФЛ</div>
          <div className="divide-y divide-stone-100">
            {s.travelBonus > 0 && <LineItem label="Премия «Путешествуй и работай»" value={s.travelBonus} accent="emerald" />}
            {s.perDiem > 0 && <LineItem label={`Командировочные (${s.perDiemDays} дн. × 500₽)`} value={s.perDiem} accent="emerald" />}
          </div>
        </>
      )}

      <div className="flex items-center justify-between bg-stone-900 px-4 py-3.5">
        <span className="text-stone-300 text-sm">Итого к выплате</span>
        <span className="font-mono-num text-white text-lg font-semibold">{formatMoney(s.netTotal)}</span>
      </div>
    </div>
  );
}

function StatsView({ overallStats, settings, shiftsCount, availableMonths, monthSummaries, statsMonth, setStatsMonth, statsPerson, setStatsPerson, onHolidaysChange }) {
  if (shiftsCount === 0 && overallStats.netAll === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-400 text-sm">Пока нет данных для статистики.</p>
      </div>
    );
  }
  const monthData = monthSummaries[statsMonth];
  const personName = statsPerson === 'p1' ? settings.p1Name : settings.p2Name;
  const personColor = statsPerson === 'p1' ? P1_COLOR : P2_COLOR;

  return (
    <div className="pt-1 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Всего к выплате" value={formatMoney(overallStats.netAll)} />
        <StatCard label="В этом месяце" value={formatMoney(overallStats.thisMonthNet)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={settings.p1Name} value={formatMoney(overallStats.netP1)} accent="text-teal-700" />
        <StatCard label={settings.p2Name} value={formatMoney(overallStats.netP2)} accent="text-violet-700" />
      </div>
      <StatCard label="Премии и командировочные, на руки" value={formatMoney(overallStats.bonusNetAll)} accent="text-amber-700" />

      <div>
        <div className="flex items-center justify-between mb-3 px-1 gap-2">
          <h3 className="font-display text-sm font-semibold text-stone-700 shrink-0">Расчётный лист</h3>
          <select
            value={statsMonth}
            onChange={(e) => setStatsMonth(e.target.value)}
            className="text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-600 focus:ring-2 focus:ring-stone-300 min-w-0"
          >
            {availableMonths.map((mk) => (
              <option key={mk} value={mk}>{monthLabel(mk)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <FilterChip active={statsPerson === 'p1'} onClick={() => setStatsPerson('p1')} color={P1_COLOR}>{settings.p1Name}</FilterChip>
          <FilterChip active={statsPerson === 'p2'} onClick={() => setStatsPerson('p2')} color={P2_COLOR}>{settings.p2Name}</FilterChip>
        </div>
        {monthData && (
          <PayslipCard
            summary={monthData[statsPerson]}
            name={personName}
            color={personColor}
            onHolidaysChange={(v) => onHolidaysChange(statsMonth, v)}
          />
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <h3 className="font-display text-sm font-semibold text-stone-700 mb-3">По месяцам, на руки</h3>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={overallStats.monthlyArr} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
              <YAxis
                width={38}
                tick={{ fontSize: 10, fill: '#78716c' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : v)}
              />
              <Tooltip
                formatter={(value, name) => [formatMoney(value), name === 'p1' ? settings.p1Name : settings.p2Name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === 'p1' ? settings.p1Name : settings.p2Name)} />
              <Bar dataKey="p1" name="p1" fill={P1_COLOR} radius={[3, 3, 0, 0]} />
              <Bar dataKey="p2" name="p2" fill={P2_COLOR} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ draft, setDraft, onSave, onClose }) {
  const update = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const toggle = (key) => () => setDraft((d) => ({ ...d, [key]: !d[key] }));
  return (
    <div
      className="fixed inset-0 flex items-end justify-center z-50"
      style={{ backgroundColor: 'rgba(28,25,23,0.45)' }}
      onClick={onClose}
    >
      <div className="bg-white rounded-t-2xl w-full max-w-md p-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-stone-900">Настройки</h2>
          <button onClick={onClose} className="text-stone-400 p-1" aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя (человек 1)">
                <input
                  type="text" value={draft.p1Name} onChange={update('p1Name')}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </Field>
              <Field label="Ставка, ₽/ч">
                <input
                  type="number" inputMode="decimal" min="0" value={draft.p1Rate} onChange={update('p1Rate')}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя (человек 2)">
                <input
                  type="text" value={draft.p2Name} onChange={update('p2Name')}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
                />
              </Field>
              <Field label="Ставка, ₽/ч">
                <input
                  type="number" inputMode="decimal" min="0" value={draft.p2Rate} onChange={update('p2Rate')}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono-num focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
                />
              </Field>
            </div>
          </div>

          <div className="pt-1 border-t border-stone-100">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-500 mt-4 mb-3">
              <Plane size={13} /> Командировка
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Дата начала">
                <input
                  type="date" value={draft.tripStart} onChange={update('tripStart')}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </Field>
              <Field label="Окончание (если есть)">
                <input
                  type="date" value={draft.tripEnd} onChange={update('tripEnd')}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-600 mb-2">
              <input type="checkbox" checked={!!draft.p1OnTrip} onChange={toggle('p1OnTrip')} className="rounded border-stone-300" />
              {draft.p1Name || 'Человек 1'} в командировке
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={!!draft.p2OnTrip} onChange={toggle('p2OnTrip')} className="rounded border-stone-300" />
              {draft.p2Name || 'Человек 2'} в командировке
            </label>
            <p className="text-xs text-stone-400 mt-2">Командировочные (500₽/день) и премия «Путешествуй и работай» считаются по этим датам, независимо от смен — они появятся в статистике, даже если смен в месяце не было.</p>
          </div>

          <button type="submit" className="w-full bg-stone-900 text-white rounded-xl py-3 text-sm font-medium mt-2">
            Сохранить настройки
          </button>
        </form>
      </div>
    </div>
  );
}