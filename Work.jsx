import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, List, BarChart3, Settings as SettingsIcon, X, Trash2, AlertCircle, Moon, Plane, ChevronDown, ChevronUp, Calendar, Truck, Trash } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/*
  ПРАВИЛА НАЧИСЛЕНИЙ (по описанию пользователя)
  ------------------------------------------------
  За смену (считается по каждой смене отдельно):
   - Оплата по ставке: часы × ставка
   - Вечер/ночь: если < половины смены попадает в 22:00–08:00 → +20% на эти часы;
                 если > половины смены попадает в 22:00–08:00 → +30% на ВСЮ смену
   - Премия надёжности: 15% × часы × ставка
   - Премия выходного дня: 560 ₽, если дата смены — суббота или воскресенье
   - Приёмка машины: 1150 ₽, если отмечено на смене
   - Выгрузка мусора: 100 ₽, если отмечено на смене
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

  Расписание (вкладка «Расписание») — отдельные данные, в расчёт не идут, только для просмотра графика.
*/

// ---------- Хранилище ----------
const SHIFTS_KEY = 'shifts';
const SETTINGS_KEY = 'settings';
const MONTH_META_KEY = 'monthMeta';
const SCHEDULE_KEY = 'scheduleEntries';

// ---------- Константы начислений ----------
const TAX_RATE = 0.13;
const RELIABILITY_RATE = 0.15;
const NIGHT_MINOR_RATE = 0.20;
const NIGHT_MAJOR_RATE = 0.30;
const HIGH_SEASON_THRESHOLD = 120;
const HIGH_SEASON_BONUS = 7000;
const FLEX_BONUS_CAP = 15000;
const WEEKEND_BONUS = 560;
const TRAVEL_WORK_BONUS = 3000;
const PER_DIEM_RATE = 500;
const OT_TIER1_HOURS = 2;
const OT_TIER1_MULT = 0.5;
const OT_TIER2_MULT = 1.0;
const TRUCK_BONUS = 1150;
const GARBAGE_BONUS = 100;

const DEFAULT_SETTINGS = {
  p1Name: 'Я',
  p2Name: 'Жена',
  p1Rate: 231,
  p2Rate: 215,
  tripStart: '2026-06-11',
  tripEnd: '',
  p1OnTrip: true,
  p2OnTrip: true,
  defaultBreakMin: 60,
  defaultQuarterMin: 15,
};

const P1_COLOR = '#0f766e';
const P2_COLOR = '#6d28d9';

const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WEEKDAY_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

// ---------- iOS 27 Liquid Glass — токены дизайна ----------
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
const SYSTEM_SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";
const GLASS_PANEL = {
  backgroundColor: 'rgba(255,255,255,0.6)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '0 10px 32px -12px rgba(30,41,59,0.16), inset 0 1px 0 rgba(255,255,255,0.55)',
};
const GLASS_PANEL_TIGHT = { ...GLASS_PANEL, boxShadow: '0 6px 20px -10px rgba(30,41,59,0.14), inset 0 1px 0 rgba(255,255,255,0.5)' };
const GLASS_WELL = {
  backgroundColor: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(148,163,184,0.3)',
  boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.05)',
};
const GLASS_NAV = {
  backgroundColor: 'rgba(255,255,255,0.7)',
  backdropFilter: 'blur(30px) saturate(180%)',
  WebkitBackdropFilter: 'blur(30px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: '0 16px 40px -10px rgba(30,41,59,0.25), inset 0 1px 0 rgba(255,255,255,0.6)',
};
const GLASS_DARK = {
  backgroundColor: 'rgba(20,20,30,0.75)',
  backdropFilter: 'blur(22px) saturate(160%)',
  WebkitBackdropFilter: 'blur(22px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: '0 10px 30px -8px rgba(15,23,42,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
};
function tintStyle(hex, alpha) {
  const a = alpha ?? 0.12;
  return { backgroundColor: hexToRgba(hex, a), border: `1px solid ${hexToRgba(hex, a + 0.22)}` };
}
function specularButton(hex) {
  return {
    backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0) 50%), linear-gradient(135deg, ${hex}, ${hexToRgba(hex, 0.82)})`,
    boxShadow: `0 10px 26px -8px ${hexToRgba(hex, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.45)`,
  };
}
const BG_GRADIENT = `
  radial-gradient(ellipse 60% 50% at 10% 6%, rgba(15,118,110,0.28), transparent 60%),
  radial-gradient(ellipse 55% 45% at 90% 10%, rgba(109,40,217,0.24), transparent 60%),
  radial-gradient(ellipse 65% 55% at 50% 100%, rgba(217,119,6,0.18), transparent 60%),
  linear-gradient(165deg, #eef2f9 0%, #f0edfa 45%, #fdf1f2 100%)
`;

// ---------- Даты и время ----------
function pad2(n) { return String(n).padStart(2, '0'); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function formatMoney(n) {
  const v = Number.isFinite(n) ? n : 0;
  return Math.round(v).toLocaleString('ru-RU') + ' ₽';
}
function formatHours(h) {
  const v = Number.isFinite(h) ? h : 0;
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ч';
}
function formatDateShort(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}.${m}`;
}
function monthLabel(mk) {
  const [y, m] = mk.split('-').map(Number);
  return `${MONTHS_NOM[m - 1]} ${y}`;
}
function monthShortLabel(mk) {
  const [y, m] = mk.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}
function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function dayOfWeek(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0 = вс ... 6 = сб
}
function isWeekendDate(dateStr) {
  const dow = dayOfWeek(dateStr);
  return dow === 0 || dow === 6;
}
function daysInMonth(year, month) { // month: 1-12
  return new Date(year, month, 0).getDate();
}
function weekdaysInMonth(year, month) {
  const dim = daysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= dim; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}
function monthBounds(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m - 1, daysInMonth(y, m)) };
}
function diffDaysInclusive(a, b) {
  return Math.round((b - a) / 86400000) + 1;
}
function monthRange(startKey, endKey) {
  const [sy, sm] = startKey.split('-').map(Number);
  const [ey, em] = endKey.split('-').map(Number);
  const out = [];
  let y = sy, m = sm, guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 600) {
    out.push(`${y}-${pad2(m)}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    guard += 1;
  }
  return out;
}
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function shiftHoursOf(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const s = toMinutes(startTime);
  let e = toMinutes(endTime);
  if (e <= s) e += 24 * 60;
  return (e - s) / 60;
}
function nightHoursOf(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const s = toMinutes(startTime);
  let e = toMinutes(endTime);
  if (e <= s) e += 24 * 60;
  const overlap = (a1, b1, a2, b2) => Math.max(0, Math.min(b1, b2) - Math.max(a1, a2));
  // окно A: 22:00 предыдущего дня -> 08:00 текущего; окно B: 22:00 текущего -> 08:00 следующего
  const minutes = overlap(s, e, -120, 480) + overlap(s, e, 1320, 1920);
  return minutes / 60;
}

// ---------- Нормализация и расчёты по смене ----------
function normalizeShift(raw) {
  return {
    id: raw.id || genId(),
    person: raw.person === 'p2' ? 'p2' : 'p1',
    date: raw.date,
    startTime: raw.startTime || '',
    endTime: raw.endTime || '',
    legacyHours: raw.startTime ? 0 : (raw.hours || 0),
    breakMin: raw.breakMin || 0,
    quarter1Min: raw.quarter1Min || 0,
    quarter2Min: raw.quarter2Min || 0,
    truckReception: !!raw.truckReception,
    garbageDuty: !!raw.garbageDuty,
    rate: raw.rate || 0,
    extraAmount: raw.extraAmount ?? raw.bonus ?? 0,
    extraNote: raw.extraNote ?? raw.bonusNote ?? '',
    note: raw.note || '',
    createdAt: raw.createdAt || Date.now(),
  };
}

function computeShiftPay(shift) {
  const hasTimes = !!(shift.startTime && shift.endTime);
  const grossHours = hasTimes ? shiftHoursOf(shift.startTime, shift.endTime) : (shift.legacyHours || 0);
  const grossNight = hasTimes ? nightHoursOf(shift.startTime, shift.endTime) : 0;
  const breakHours = ((shift.breakMin || 0) + (shift.quarter1Min || 0) + (shift.quarter2Min || 0)) / 60;
  // Брейк и пятнашки неоплачиваемые — вычитаем из часов. Момент перерыва внутри смены неизвестен,
  // поэтому ночные часы уменьшаем в той же пропорции, что и общие (доля ночи от этого не меняется).
  const hours = Math.max(0, grossHours - breakHours);
  const night = grossHours > 0 ? grossNight * (hours / grossHours) : 0;
  const rate = shift.rate || 0;
  const base = hours * rate;
  const isMajorNight = hours > 0 && night > hours / 2;
  const nightBonus = hours > 0 ? (isMajorNight ? hours * rate * NIGHT_MAJOR_RATE : night * rate * NIGHT_MINOR_RATE) : 0;
  const reliabilityBonus = hours * rate * RELIABILITY_RATE;
  const weekend = shift.date ? isWeekendDate(shift.date) : false;
  const weekendBonus = weekend && hours > 0 ? WEEKEND_BONUS : 0;
  const truckBonus = shift.truckReception && hours > 0 ? TRUCK_BONUS : 0;
  const garbageBonus = shift.garbageDuty && hours > 0 ? GARBAGE_BONUS : 0;
  const extra = shift.extraAmount || 0;
  const taxable = base + nightBonus + reliabilityBonus + weekendBonus + truckBonus + garbageBonus + extra;
  const tax = taxable * TAX_RATE;
  const net = taxable - tax;
  return { grossHours, breakHours, hours, night, isMajorNight, base, nightBonus, reliabilityBonus, weekendBonus, truckBonus, garbageBonus, extra, taxable, tax, net };
}

// ---------- Командировка: премии по календарю ----------
function perDiemDaysForMonth(monthKey, tripStart, tripEnd) {
  if (!tripStart) return 0;
  const { start: monthStart, end: monthEnd } = monthBounds(monthKey);
  const [ty, tm, td] = tripStart.split('-').map(Number);
  const ts = new Date(ty, tm - 1, td);
  let te = monthEnd;
  if (tripEnd) {
    const [ey, em, ed] = tripEnd.split('-').map(Number);
    te = new Date(ey, em - 1, ed);
  }
  const overlapStart = ts > monthStart ? ts : monthStart;
  const overlapEnd = te < monthEnd ? te : monthEnd;
  if (overlapEnd < overlapStart) return 0;
  return diffDaysInclusive(overlapStart, overlapEnd);
}
function isFullMonthInTrip(monthKey, tripStart, tripEnd) {
  if (!tripStart) return false;
  const { start: monthStart, end: monthEnd } = monthBounds(monthKey);
  const [ty, tm, td] = tripStart.split('-').map(Number);
  const ts = new Date(ty, tm - 1, td);
  if (monthStart < ts) return false;
  if (tripEnd) {
    const [ey, em, ed] = tripEnd.split('-').map(Number);
    const te = new Date(ey, em - 1, ed);
    if (monthEnd > te) return false;
  }
  return true;
}

// ---------- Расчёт за месяц на человека ----------
function computeMonthSummary(monthKey, person, shifts, settings, monthMeta) {
  const rate = person === 'p1' ? settings.p1Rate : settings.p2Rate;
  const onTrip = person === 'p1' ? settings.p1OnTrip : settings.p2OnTrip;
  const personShifts = shifts.filter((s) => s.person === person && s.date && s.date.slice(0, 7) === monthKey);

  let hours = 0, nightHours = 0, base = 0, nightBonus = 0, reliabilityBonus = 0, weekendBonus = 0, weekendCount = 0, truckBonus = 0, truckCount = 0, garbageBonus = 0, garbageCount = 0, extra = 0;
  personShifts.forEach((s) => {
    const p = computeShiftPay(s);
    hours += p.hours;
    nightHours += p.night;
    base += p.base;
    nightBonus += p.nightBonus;
    reliabilityBonus += p.reliabilityBonus;
    weekendBonus += p.weekendBonus;
    if (p.weekendBonus > 0) weekendCount += 1;
    truckBonus += p.truckBonus;
    if (p.truckBonus > 0) truckCount += 1;
    garbageBonus += p.garbageBonus;
    if (p.garbageBonus > 0) garbageCount += 1;
    extra += p.extra;
  });

  const [y, m] = monthKey.split('-').map(Number);
  const wkd = weekdaysInMonth(y, m);
  const holidays = (monthMeta && monthMeta[monthKey] && monthMeta[monthKey].holidays) || 0;
  const norm = Math.max(0, wkd - holidays) * 8;
  const effectiveRate = hours > 0 ? base / hours : rate;

  const highSeasonBonus = hours > HIGH_SEASON_THRESHOLD ? HIGH_SEASON_BONUS : 0;
  const flexBonus = norm > 0 ? Math.min(hours / norm, 1) * FLEX_BONUS_CAP : 0;
  const otHours = Math.max(0, hours - norm);
  const ot1 = Math.min(otHours, OT_TIER1_HOURS);
  const ot2 = Math.max(0, otHours - OT_TIER1_HOURS);
  const overtimePremium = ot1 * effectiveRate * OT_TIER1_MULT + ot2 * effectiveRate * OT_TIER2_MULT;

  const taxableGross = base + nightBonus + reliabilityBonus + weekendBonus + truckBonus + garbageBonus + extra + highSeasonBonus + flexBonus + overtimePremium;
  const tax = taxableGross * TAX_RATE;
  const netTaxable = taxableGross - tax;

  const travelBonus = onTrip && isFullMonthInTrip(monthKey, settings.tripStart, settings.tripEnd) ? TRAVEL_WORK_BONUS : 0;
  const perDiemDays = onTrip ? perDiemDaysForMonth(monthKey, settings.tripStart, settings.tripEnd) : 0;
  const perDiem = perDiemDays * PER_DIEM_RATE;
  const nonTaxable = travelBonus + perDiem;
  const netTotal = netTaxable + nonTaxable;

  return {
    monthKey, person, hours, nightHours, wkd, holidays, norm,
    base, nightBonus, reliabilityBonus, weekendBonus, weekendCount, truckBonus, truckCount, garbageBonus, garbageCount, extra,
    highSeasonBonus, flexBonus, otHours, overtimePremium,
    taxableGross, tax, netTaxable,
    travelBonus, perDiemDays, perDiem, nonTaxable, netTotal,
    shiftsCount: personShifts.length,
  };
}

// ---------- Расписание (просмотр графика, в расчёт премий не входит) ----------
function normalizeScheduleEntry(raw) {
  return {
    id: raw.id || genId(),
    person: raw.person === 'p2' ? 'p2' : 'p1',
    date: raw.date,
    startTime: raw.startTime || '',
    endTime: raw.endTime || '',
    note: raw.note || '',
    createdAt: raw.createdAt || Date.now(),
  };
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
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [scheduleForm, setScheduleForm] = useState(null);
  const [scheduleEditingId, setScheduleEditingId] = useState(null);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleFilterPerson, setScheduleFilterPerson] = useState('all');

  useEffect(() => {
    (async () => {
      let loadedSettings = DEFAULT_SETTINGS;
      let loadedShifts = [];
      let loadedMeta = {};
      let loadedSchedule = [];
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
      try {
        const res = await window.storage.get(SCHEDULE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed)) loadedSchedule = parsed.map(normalizeScheduleEntry);
        }
      } catch (e) {}
      setSettings(loadedSettings);
      setSettingsDraft(loadedSettings);
      setShifts(loadedShifts);
      setMonthMeta(loadedMeta);
      setScheduleEntries(loadedSchedule);
      setForm({
        date: todayStr(),
        person: 'p1',
        startTime: '',
        endTime: '',
        breakMin: String(loadedSettings.defaultBreakMin ?? ''),
        quarter1Min: String(loadedSettings.defaultQuarterMin ?? ''),
        quarter2Min: String(loadedSettings.defaultQuarterMin ?? ''),
        truckReception: false,
        garbageDuty: false,
        rate: String(loadedSettings.p1Rate ?? ''),
        extraAmount: '',
        extraNote: '',
        note: '',
      });
      setScheduleForm({ date: todayStr(), person: 'p1', startTime: '', endTime: '', note: '' });
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

  const persistSchedule = useCallback(async (next) => {
    setScheduleEntries(next);
    try {
      const result = await window.storage.set(SCHEDULE_KEY, JSON.stringify(next), false);
      setSaveError(result ? '' : 'Не удалось сохранить расписание. Попробуйте ещё раз.');
    } catch (e) {
      setSaveError('Не удалось сохранить расписание. Проверьте соединение.');
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
      breakMin: String(settings.defaultBreakMin ?? ''),
      quarter1Min: String(settings.defaultQuarterMin ?? ''),
      quarter2Min: String(settings.defaultQuarterMin ?? ''),
      truckReception: false,
      garbageDuty: false,
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
    const breakMin = Math.max(0, parseInt(form.breakMin, 10) || 0);
    const quarter1Min = Math.max(0, parseInt(form.quarter1Min, 10) || 0);
    const quarter2Min = Math.max(0, parseInt(form.quarter2Min, 10) || 0);
    const hasTimes = !!(form.startTime && form.endTime);

    if (!form.date) return setFormError('Укажите дату смены');
    if (rate < 0) return setFormError('Ставка не может быть отрицательной');
    if (!hasTimes && extraAmount === 0) return setFormError('Укажите время смены или сумму корректировки');
    if (hasTimes && form.startTime === form.endTime) return setFormError('Время начала и окончания смены совпадает');
    if (hasTimes) {
      const gross = shiftHoursOf(form.startTime, form.endTime);
      const breaks = (breakMin + quarter1Min + quarter2Min) / 60;
      if (breaks >= gross) return setFormError('Перерывы (брейк + пятнашки) не могут быть длиннее самой смены');
    }

    const prevCreatedAt = editingId ? shifts.find((s) => s.id === editingId)?.createdAt : null;
    const entry = {
      id: editingId || genId(),
      date: form.date,
      person: form.person,
      startTime: form.startTime,
      endTime: form.endTime,
      legacyHours: 0,
      breakMin,
      quarter1Min,
      quarter2Min,
      truckReception: !!form.truckReception,
      garbageDuty: !!form.garbageDuty,
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
      breakMin: String(shift.breakMin || 0),
      quarter1Min: String(shift.quarter1Min || 0),
      quarter2Min: String(shift.quarter2Min || 0),
      truckReception: !!shift.truckReception,
      garbageDuty: !!shift.garbageDuty,
      rate: String(shift.rate || ''),
      extraAmount: shift.extraAmount ? String(shift.extraAmount) : '',
      extraNote: shift.extraNote || '',
      note: shift.note || '',
    });
    setEditingId(shift.id);
    setFormError('');
    setTab('add');
  }

  function resetScheduleForm(person) {
    setScheduleForm({ date: todayStr(), person: person || 'p1', startTime: '', endTime: '', note: '' });
    setScheduleEditingId(null);
    setScheduleError('');
  }

  function handleScheduleSubmit(e) {
    e.preventDefault();
    if (!scheduleForm.date) return setScheduleError('Укажите дату');
    if (!scheduleForm.startTime || !scheduleForm.endTime) return setScheduleError('Укажите время начала и конца');
    if (scheduleForm.startTime === scheduleForm.endTime) return setScheduleError('Время начала и окончания совпадает');

    const prevCreatedAt = scheduleEditingId ? scheduleEntries.find((s) => s.id === scheduleEditingId)?.createdAt : null;
    const entry = {
      id: scheduleEditingId || genId(),
      date: scheduleForm.date,
      person: scheduleForm.person,
      startTime: scheduleForm.startTime,
      endTime: scheduleForm.endTime,
      note: scheduleForm.note.trim(),
      createdAt: prevCreatedAt || Date.now(),
    };
    const next = scheduleEditingId
      ? scheduleEntries.map((s) => (s.id === scheduleEditingId ? entry : s))
      : [...scheduleEntries, entry];
    persistSchedule(next);
    resetScheduleForm(scheduleForm.person);
  }

  function startScheduleEdit(entry) {
    setScheduleForm({
      date: entry.date,
      person: entry.person,
      startTime: entry.startTime || '',
      endTime: entry.endTime || '',
      note: entry.note || '',
    });
    setScheduleEditingId(entry.id);
    setScheduleError('');
  }

  function handleScheduleDelete(id) {
    persistSchedule(scheduleEntries.filter((s) => s.id !== id));
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
      defaultBreakMin: Math.max(0, parseInt(settingsDraft.defaultBreakMin, 10) || 0),
      defaultQuarterMin: Math.max(0, parseInt(settingsDraft.defaultQuarterMin, 10) || 0),
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG_GRADIENT, fontFamily: SYSTEM_SANS }}>
        <p className="text-sm" style={{ color: '#6E6E73' }}>Загрузка…</p>
      </div>
    );
  }

  const preview = computeShiftPay({
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    breakMin: parseInt(form.breakMin, 10) || 0,
    quarter1Min: parseInt(form.quarter1Min, 10) || 0,
    quarter2Min: parseInt(form.quarter2Min, 10) || 0,
    truckReception: !!form.truckReception,
    garbageDuty: !!form.garbageDuty,
    rate: parseFloat(form.rate) || 0,
    extraAmount: parseFloat(form.extraAmount) || 0,
  });

  const effectiveStatsMonth = payrollMonths.includes(statsMonth) ? statsMonth : (payrollMonths[0] || currentMonthKey());

  return (
    <div className="min-h-screen relative" style={{ fontFamily: SYSTEM_SANS }}>
      <style>{`
        .font-display { font-family: ${SYSTEM_SANS}; }
        .font-mono-num { font-family: ui-monospace, 'SF Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-variant-numeric: tabular-nums; }
        .glass-divide > * + * { border-top: 1px solid rgba(255,255,255,0.45); }
        input, textarea, select, button { font-family: inherit; }
        input:focus, textarea:focus, select:focus, button:focus { outline: none; }
        ::placeholder { color: rgba(60,60,67,0.38); }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none" style={{ background: BG_GRADIENT }} />

      <div className="relative max-w-md mx-auto pb-32">
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight" style={{ color: '#1C1C1E' }}>Табель смен</h1>
            <p className="text-xs mt-0.5" style={{ color: '#6E6E73' }}>Часы, премии и командировочные</p>
          </div>
          <button
            onClick={() => { setSettingsDraft(settings); setShowSettings(true); }}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ ...GLASS_PANEL_TIGHT, color: '#3C3C43' }}
            aria-label="Настройки"
          >
            <SettingsIcon size={18} />
          </button>
        </header>

        {saveError && (
          <div className="mx-5 mb-4 flex items-center gap-2 rounded-2xl text-xs px-3 py-2.5" style={{ ...tintStyle('#b91c1c', 0.1), color: '#991b1b' }}>
            <AlertCircle size={14} className="shrink-0" />
            {saveError}
          </div>
        )}

        <main className="px-5 relative">
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
          {tab === 'schedule' && (
            <ScheduleView
              entries={scheduleEntries}
              settings={settings}
              form={scheduleForm}
              setForm={setScheduleForm}
              onSubmit={handleScheduleSubmit}
              error={scheduleError}
              editingId={scheduleEditingId}
              onCancelEdit={() => resetScheduleForm(scheduleForm.person)}
              onEdit={startScheduleEdit}
              onDelete={handleScheduleDelete}
              filterPerson={scheduleFilterPerson}
              setFilterPerson={setScheduleFilterPerson}
            />
          )}
        </main>
      </div>

      <nav className="fixed bottom-4 inset-x-4 z-40">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1 rounded-3xl px-2 py-2" style={GLASS_NAV}>
          <TabButton icon={Plus} label="Добавить" active={tab === 'add'} onClick={() => setTab('add')} />
          <TabButton icon={List} label="Таблица" active={tab === 'table'} onClick={() => setTab('table')} />
          <TabButton icon={BarChart3} label="Статистика" active={tab === 'stats'} onClick={() => setTab('stats')} />
          <TabButton icon={Calendar} label="Расписание" active={tab === 'schedule'} onClick={() => setTab('schedule')} />
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
      className="relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-2xl transition-all duration-300"
      style={active ? { backgroundColor: hexToRgba(P1_COLOR, 0.14), boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' } : undefined}
    >
      <Icon size={20} strokeWidth={active ? 2.3 : 1.8} style={{ color: active ? P1_COLOR : '#8E8E93' }} />
      <span className="text-xs font-medium" style={{ color: active ? P1_COLOR : '#8E8E93' }}>{label}</span>
    </button>
  );
}

function PersonStamp({ letter, color, size }) {
  const dims = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  return (
    <span
      className={`${dims} rounded-full flex items-center justify-center font-display font-semibold text-white shrink-0`}
      style={{
        backgroundImage: `linear-gradient(150deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%), linear-gradient(135deg, ${color}, ${hexToRgba(color, 0.85)})`,
        boxShadow: `0 0 0 2px rgba(255,255,255,0.85), 0 2px 6px -1px ${hexToRgba(color, 0.5)}`,
      }}
    >
      {letter}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: '#6E6E73' }}>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange} className="flex items-center justify-between gap-3 w-full py-2.5">
      <span className="text-sm" style={{ color: '#3C3C43' }}>{label}</span>
      <span className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0" style={{ backgroundColor: checked ? '#34C759' : 'rgba(120,120,128,0.32)' }}>
        <span className="inline-block h-5 w-5 rounded-full bg-white transition-transform duration-200" style={{ transform: checked ? 'translateX(20px)' : 'translateX(2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </span>
    </button>
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
    <form onSubmit={onSubmit} className="space-y-4 pt-1">
      {editingId && (
        <div className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs" style={{ ...tintStyle('#b45309', 0.1), color: '#92400e' }}>
          <span>Редактирование записи</span>
          <button type="button" onClick={onCancelEdit} className="underline font-medium">Отменить</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onPersonSelect('p1')}
          className="flex items-center gap-2 justify-center rounded-2xl py-3 transition-all"
          style={form.person === 'p1' ? tintStyle(P1_COLOR, 0.14) : GLASS_WELL}
        >
          <PersonStamp letter={settings.p1Name.charAt(0).toUpperCase()} color={P1_COLOR} size="sm" />
          <span className="text-sm font-medium" style={{ color: form.person === 'p1' ? P1_COLOR : '#3C3C43' }}>{settings.p1Name}</span>
        </button>
        <button
          type="button"
          onClick={() => onPersonSelect('p2')}
          className="flex items-center gap-2 justify-center rounded-2xl py-3 transition-all"
          style={form.person === 'p2' ? tintStyle(P2_COLOR, 0.14) : GLASS_WELL}
        >
          <PersonStamp letter={settings.p2Name.charAt(0).toUpperCase()} color={P2_COLOR} size="sm" />
          <span className="text-sm font-medium" style={{ color: form.person === 'p2' ? P2_COLOR : '#3C3C43' }}>{settings.p2Name}</span>
        </button>
      </div>

      <div className="rounded-3xl p-4 space-y-4" style={GLASS_PANEL}>
        <Field label="Дата смены">
          <input
            type="date"
            value={form.date}
            onChange={update('date')}
            className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
            style={GLASS_WELL}
          />
        </Field>
        {form.date && (
          <p className="text-xs -mt-2 font-medium" style={{ color: isWeekendDate(form.date) ? P2_COLOR : '#8E8E93' }}>
            {WEEKDAY_FULL[dayOfWeek(form.date)]}{isWeekendDate(form.date) ? ' — премия выходного дня +560 ₽' : ''}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало смены">
            <input
              type="time"
              value={form.startTime}
              onChange={update('startTime')}
              className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
              style={GLASS_WELL}
            />
          </Field>
          <Field label="Конец смены">
            <input
              type="time"
              value={form.endTime}
              onChange={update('endTime')}
              className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
              style={GLASS_WELL}
            />
          </Field>
        </div>
        <div>
          <span className="block text-xs font-medium mb-1.5" style={{ color: '#6E6E73' }}>Перерывы, мин (не оплачиваются)</span>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number" inputMode="numeric" min="0" step="5" placeholder="Брейк" aria-label="Брейк, минут"
              value={form.breakMin} onChange={update('breakMin')}
              className="w-full rounded-xl px-2 py-2 text-sm font-mono-num text-center"
              style={GLASS_WELL}
            />
            <input
              type="number" inputMode="numeric" min="0" step="5" placeholder="Пятнашка 1" aria-label="Пятнашка 1, минут"
              value={form.quarter1Min} onChange={update('quarter1Min')}
              className="w-full rounded-xl px-2 py-2 text-sm font-mono-num text-center"
              style={GLASS_WELL}
            />
            <input
              type="number" inputMode="numeric" min="0" step="5" placeholder="Пятнашка 2" aria-label="Пятнашка 2, минут"
              value={form.quarter2Min} onChange={update('quarter2Min')}
              className="w-full rounded-xl px-2 py-2 text-sm font-mono-num text-center"
              style={GLASS_WELL}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <span className="text-xs text-center" style={{ color: '#AEAEB2' }}>Брейк</span>
            <span className="text-xs text-center" style={{ color: '#AEAEB2' }}>Пятнашка 1</span>
            <span className="text-xs text-center" style={{ color: '#AEAEB2' }}>Пятнашка 2</span>
          </div>
        </div>
        <Field label="Ставка, ₽/ч">
          <input
            type="number" inputMode="decimal" min="0" step="1" placeholder="231"
            value={form.rate} onChange={update('rate')}
            className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
            style={GLASS_WELL}
          />
        </Field>
        {preview.grossHours > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs rounded-xl px-3 py-2" style={GLASS_WELL}>
            <span className="font-mono-num" style={{ color: '#6E6E73' }}>{formatHours(preview.grossHours)} по графику</span>
            {preview.breakHours > 0 && (
              <span className="font-mono-num" style={{ color: '#6E6E73' }}>− {formatHours(preview.breakHours)} перерывы</span>
            )}
            <span className="font-mono-num font-semibold" style={{ color: '#1C1C1E' }}>= {formatHours(preview.hours)} оплачено</span>
            {preview.night > 0 && (
              <span className="flex items-center gap-1" style={{ color: '#5856D6' }}>
                <Moon size={12} /> {formatHours(preview.night)} в ночном окне · {preview.isMajorNight ? '+30% на всю смену' : '+20% на эти часы'}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, truckReception: !f.truckReception }))}
          className="flex items-center gap-2 justify-center rounded-2xl py-3 transition-all"
          style={form.truckReception ? tintStyle('#d97706', 0.14) : GLASS_WELL}
        >
          <Truck size={16} style={{ color: form.truckReception ? '#b45309' : '#8E8E93' }} />
          <span className="text-sm font-medium" style={{ color: form.truckReception ? '#92400e' : '#3C3C43' }}>Приёмка машины</span>
        </button>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, garbageDuty: !f.garbageDuty }))}
          className="flex items-center gap-2 justify-center rounded-2xl py-3 transition-all"
          style={form.garbageDuty ? tintStyle('#d97706', 0.14) : GLASS_WELL}
        >
          <Trash size={16} style={{ color: form.garbageDuty ? '#b45309' : '#8E8E93' }} />
          <span className="text-sm font-medium" style={{ color: form.garbageDuty ? '#92400e' : '#3C3C43' }}>Выгрузка мусора</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowExtra((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium"
        style={{ color: '#6E6E73' }}
      >
        {showExtra ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Ручная корректировка (необязательно)
      </button>
      {showExtra && (
        <div className="rounded-3xl p-4 space-y-4" style={GLASS_PANEL}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Сумма, ₽">
              <input
                type="number" inputMode="decimal" step="1" placeholder="0"
                value={form.extraAmount} onChange={update('extraAmount')}
                className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
                style={GLASS_WELL}
              />
            </Field>
            <Field label="За что">
              <input
                type="text" placeholder="Напр. разовая доплата"
                value={form.extraNote} onChange={update('extraNote')}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={GLASS_WELL}
              />
            </Field>
          </div>
          <p className="text-xs" style={{ color: '#8E8E93' }}>Можно указать и отрицательную сумму — для коррекции. Облагается налогом 13%, как и остальные надбавки.</p>
        </div>
      )}

      <Field label="Заметка (необязательно)">
        <textarea
          rows={2} placeholder="Любые детали смены"
          value={form.note} onChange={update('note')}
          className="w-full rounded-xl px-3 py-2 text-sm resize-none"
          style={GLASS_WELL}
        />
      </Field>

      {formError && <p className="text-xs font-medium" style={{ color: '#b91c1c' }}>{formError}</p>}

      {showBreakdown && (
        <div className="rounded-3xl overflow-hidden glass-divide" style={GLASS_PANEL}>
          {preview.hours > 0 && (
            <LineItem label={`Оплата по ставке (${formatHours(preview.hours)} × ${form.rate || 0}₽)`} value={preview.base} />
          )}
          {preview.nightBonus > 0 && (
            <LineItem label={`Доплата за вечер/ночь (${preview.isMajorNight ? '30%' : '20%'})`} value={preview.nightBonus} accent="indigo" />
          )}
          {preview.reliabilityBonus > 0 && <LineItem label="Премия надёжности (15%)" value={preview.reliabilityBonus} accent="amber" />}
          {preview.weekendBonus > 0 && <LineItem label="Премия выходного дня" value={preview.weekendBonus} accent="amber" />}
          {preview.truckBonus > 0 && <LineItem label="Приёмка машины" value={preview.truckBonus} accent="amber" />}
          {preview.garbageBonus > 0 && <LineItem label="Выгрузка мусора" value={preview.garbageBonus} accent="amber" />}
          {preview.extra !== 0 && <LineItem label={form.extraNote || 'Ручная корректировка'} value={preview.extra} accent="amber" />}
          <LineItem label="НДФЛ 13%" value={-preview.tax} accent="rose" />
        </div>
      )}

      <div className="flex items-center justify-between rounded-3xl px-4 py-3.5" style={GLASS_DARK}>
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>К выплате за смену</span>
        <span className="font-mono-num text-white text-lg font-semibold">{formatMoney(preview.net)}</span>
      </div>

      <p className="text-xs -mt-2" style={{ color: '#AEAEB2' }}>Месячные премии (высокий сезон, гибкий график, переработка) и командировочные — во вкладке «Статистика».</p>

      <button
        type="submit"
        className="w-full text-white rounded-2xl py-3.5 text-sm font-semibold active:scale-95 transition-transform"
        style={specularButton(P1_COLOR)}
      >
        {editingId ? 'Сохранить изменения' : 'Сохранить смену'}
      </button>
    </form>
  );
}

function FilterChip({ active, onClick, children, color }) {
  const style = active ? (color ? tintStyle(color, 0.16) : GLASS_DARK) : GLASS_WELL;
  const textColor = active ? (color || '#ffffff') : '#3C3C43';
  return (
    <button onClick={onClick} className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all" style={style}>
      <span style={{ color: textColor }}>{children}</span>
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
          className="ml-auto text-xs rounded-full px-3 py-1.5"
          style={{ ...GLASS_WELL, color: '#3C3C43' }}
        >
          <option value="all">Все месяцы</option>
          {availableMonths.map((mk) => (
            <option key={mk} value={mk}>{monthLabel(mk)}</option>
          ))}
        </select>
      </div>

      {groups.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: '#8E8E93' }}>Записей пока нет.</p>
          <p className="text-sm" style={{ color: '#8E8E93' }}>Добавьте первую смену на вкладке «Добавить».</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.month}>
            <div className="flex items-baseline justify-between mb-2 px-1">
              <h3 className="font-display text-sm font-semibold" style={{ color: '#3C3C43' }}>{g.label}</h3>
              <span className="font-mono-num text-sm" style={{ color: '#6E6E73' }}>{formatMoney(g.total)}</span>
            </div>
            <div className="rounded-3xl overflow-hidden glass-divide" style={GLASS_PANEL}>
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
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="font-mono-num" style={{ color: weekend ? P2_COLOR : '#1C1C1E', fontWeight: weekend ? 600 : 400 }}>
            {formatDateShort(shift.date)} {WEEKDAY_SHORT[dayOfWeek(shift.date)]}
          </span>
          {hasTimes && <span className="text-xs font-mono-num" style={{ color: '#6E6E73' }}>{shift.startTime}–{shift.endTime}</span>}
          {pay.breakHours > 0 && <span className="text-xs font-mono-num" style={{ color: '#AEAEB2' }}>−{Math.round(pay.breakHours * 60)} мин</span>}
          {pay.nightBonus > 0 && <Moon size={12} style={{ color: '#5856D6' }} className="shrink-0" />}
          {shift.truckReception && <Truck size={12} style={{ color: '#b45309' }} className="shrink-0" />}
          {shift.garbageDuty && <Trash size={12} style={{ color: '#b45309' }} className="shrink-0" />}
          {pay.extra !== 0 && (
            <span className="text-xs font-mono-num" style={{ color: '#b45309' }}>{pay.extra > 0 ? '+' : ''}{formatMoney(pay.extra)}</span>
          )}
        </div>
        {shift.note && <p className="text-xs truncate mt-0.5" style={{ color: '#AEAEB2' }}>{shift.note}</p>}
      </button>
      <span className="font-mono-num text-sm font-semibold" style={{ color: '#1C1C1E' }}>{formatMoney(pay.net)}</span>
      {confirmDelete ? (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onDelete} className="text-xs text-white rounded-full px-2 py-1" style={{ backgroundColor: '#b91c1c' }}>Удалить</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs px-1" style={{ color: '#8E8E93' }}>Нет</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="p-1 shrink-0" style={{ color: '#C7C7CC' }} aria-label="Удалить запись">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-3xl p-4" style={GLASS_PANEL}>
      <p className="text-xs mb-1" style={{ color: '#6E6E73' }}>{label}</p>
      <p className={`font-mono-num text-xl font-semibold ${accent || ''}`} style={!accent ? { color: '#1C1C1E' } : undefined}>{value}</p>
    </div>
  );
}

function PayslipCard({ summary, name, color, onHolidaysChange }) {
  const s = summary;
  return (
    <div className="rounded-3xl overflow-hidden" style={GLASS_PANEL}>
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: hexToRgba(color, 0.1), borderBottom: '1px solid rgba(255,255,255,0.5)' }}>
        <div className="flex items-center gap-2">
          <PersonStamp letter={name.charAt(0).toUpperCase()} color={color} size="sm" />
          <span className="text-sm font-medium" style={{ color: '#1C1C1E' }}>{name}</span>
        </div>
        <span className="font-mono-num text-xs" style={{ color: '#6E6E73' }}>{formatHours(s.hours)} · норма {s.norm}ч</span>
      </div>

      <div className="flex items-center justify-between px-4 py-2 text-xs" style={{ color: '#8E8E93', backgroundColor: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.5)' }}>
        <span>Будних дней: {s.wkd}, праздничных:</span>
        <input
          type="number" min="0" value={s.holidays}
          onChange={(e) => onHolidaysChange(e.target.value)}
          className="w-14 text-right rounded-lg px-1.5 py-0.5 font-mono-num"
          style={{ ...GLASS_WELL, color: '#3C3C43' }}
        />
      </div>

      <div className="glass-divide">
        <LineItem label="Оплата по ставке" value={s.base} />
        {s.nightBonus > 0 && <LineItem label="Доплата за вечер/ночь" value={s.nightBonus} accent="indigo" />}
        {s.reliabilityBonus > 0 && <LineItem label="Премия надёжности" value={s.reliabilityBonus} accent="amber" />}
        {s.weekendBonus > 0 && <LineItem label={`Премия выходного дня (${s.weekendCount})`} value={s.weekendBonus} accent="amber" />}
        {s.truckBonus > 0 && <LineItem label={`Приёмка машины (${s.truckCount})`} value={s.truckBonus} accent="amber" />}
        {s.garbageBonus > 0 && <LineItem label={`Выгрузка мусора (${s.garbageCount})`} value={s.garbageBonus} accent="amber" />}
        {s.highSeasonBonus > 0 && <LineItem label="Премия «Высокий сезон»" value={s.highSeasonBonus} accent="amber" />}
        {s.flexBonus > 0 && <LineItem label="Премия «Любые временные возможности»" value={s.flexBonus} accent="amber" />}
        {s.overtimePremium > 0 && <LineItem label={`Доплата за переработку (${formatHours(s.otHours)})`} value={s.overtimePremium} accent="amber" />}
        {s.extra !== 0 && <LineItem label="Разовые корректировки" value={s.extra} accent="amber" />}
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.5)' }}>
        <LineItem label="Начислено до налога" value={s.taxableGross} bold />
        <LineItem label="НДФЛ 13%" value={-s.tax} accent="rose" />
      </div>

      {s.nonTaxable > 0 && (
        <>
          <div className="px-3.5 pt-2.5 pb-1 text-xs font-medium uppercase tracking-wide" style={{ color: '#047857', backgroundColor: 'rgba(16,185,129,0.08)' }}>Без НДФЛ</div>
          <div className="glass-divide">
            {s.travelBonus > 0 && <LineItem label="Премия «Путешествуй и работай»" value={s.travelBonus} accent="emerald" />}
            {s.perDiem > 0 && <LineItem label={`Командировочные (${s.perDiemDays} дн. × 500₽)`} value={s.perDiem} accent="emerald" />}
          </div>
        </>
      )}

      <div className="flex items-center justify-between px-4 py-3.5" style={GLASS_DARK}>
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Итого к выплате</span>
        <span className="font-mono-num text-white text-lg font-semibold">{formatMoney(s.netTotal)}</span>
      </div>
    </div>
  );
}

function StatsView({ overallStats, settings, shiftsCount, availableMonths, monthSummaries, statsMonth, setStatsMonth, statsPerson, setStatsPerson, onHolidaysChange }) {
  if (shiftsCount === 0 && overallStats.netAll === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm" style={{ color: '#8E8E93' }}>Пока нет данных для статистики.</p>
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
          <h3 className="font-display text-sm font-semibold shrink-0" style={{ color: '#3C3C43' }}>Расчётный лист</h3>
          <select
            value={statsMonth}
            onChange={(e) => setStatsMonth(e.target.value)}
            className="text-xs rounded-full px-3 py-1.5 min-w-0"
            style={{ ...GLASS_WELL, color: '#3C3C43' }}
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

      <div className="rounded-3xl p-4" style={GLASS_PANEL}>
        <h3 className="font-display text-sm font-semibold mb-3" style={{ color: '#3C3C43' }}>По месяцам, на руки</h3>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={overallStats.monthlyArr} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.25)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8E8E93' }} axisLine={false} tickLine={false} />
              <YAxis
                width={38}
                tick={{ fontSize: 10, fill: '#8E8E93' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : v)}
              />
              <Tooltip
                formatter={(value, name) => [formatMoney(value), name === 'p1' ? settings.p1Name : settings.p2Name]}
                contentStyle={{ fontSize: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === 'p1' ? settings.p1Name : settings.p2Name)} />
              <Bar dataKey="p1" name="p1" fill={P1_COLOR} radius={[6, 6, 0, 0]} />
              <Bar dataKey="p2" name="p2" fill={P2_COLOR} radius={[6, 6, 0, 0]} />
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
      style={{ backgroundColor: 'rgba(15,15,20,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-5 pb-8 overflow-y-auto rounded-t-3xl"
        style={{ ...GLASS_NAV, maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(120,120,128,0.3)' }} />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold" style={{ color: '#1C1C1E' }}>Настройки</h2>
          <button onClick={onClose} className="p-1" style={{ color: '#8E8E93' }} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя (человек 1)">
                <input
                  type="text" value={draft.p1Name} onChange={update('p1Name')}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={GLASS_WELL}
                />
              </Field>
              <Field label="Ставка, ₽/ч">
                <input
                  type="number" inputMode="decimal" min="0" value={draft.p1Rate} onChange={update('p1Rate')}
                  className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
                  style={GLASS_WELL}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя (человек 2)">
                <input
                  type="text" value={draft.p2Name} onChange={update('p2Name')}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={GLASS_WELL}
                />
              </Field>
              <Field label="Ставка, ₽/ч">
                <input
                  type="number" inputMode="decimal" min="0" value={draft.p2Rate} onChange={update('p2Rate')}
                  className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
                  style={GLASS_WELL}
                />
              </Field>
            </div>
          </div>

          <div className="pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.5)' }}>
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide mt-4 mb-3" style={{ color: '#6E6E73' }}>
              <Plane size={13} /> Командировка
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Дата начала">
                <input
                  type="date" value={draft.tripStart} onChange={update('tripStart')}
                  className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
                  style={GLASS_WELL}
                />
              </Field>
              <Field label="Окончание (если есть)">
                <input
                  type="date" value={draft.tripEnd} onChange={update('tripEnd')}
                  className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
                  style={GLASS_WELL}
                />
              </Field>
            </div>
            <div className="rounded-2xl px-3.5 mb-2" style={GLASS_WELL}>
              <Toggle checked={!!draft.p1OnTrip} onChange={toggle('p1OnTrip')} label={`${draft.p1Name || 'Человек 1'} в командировке`} />
            </div>
            <div className="rounded-2xl px-3.5" style={GLASS_WELL}>
              <Toggle checked={!!draft.p2OnTrip} onChange={toggle('p2OnTrip')} label={`${draft.p2Name || 'Человек 2'} в командировке`} />
            </div>
            <p className="text-xs mt-2" style={{ color: '#8E8E93' }}>Командировочные (500₽/день) и премия «Путешествуй и работай» считаются по этим датам, независимо от смен — они появятся в статистике, даже если смен в месяце не было.</p>
          </div>

          <div className="pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.5)' }}>
            <div className="text-xs font-medium uppercase tracking-wide mt-4 mb-3" style={{ color: '#6E6E73' }}>Перерывы по умолчанию</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Брейк, мин">
                <input
                  type="number" inputMode="numeric" min="0" step="5" value={draft.defaultBreakMin} onChange={update('defaultBreakMin')}
                  className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
                  style={GLASS_WELL}
                />
              </Field>
              <Field label="Каждая пятнашка, мин">
                <input
                  type="number" inputMode="numeric" min="0" step="5" value={draft.defaultQuarterMin} onChange={update('defaultQuarterMin')}
                  className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
                  style={GLASS_WELL}
                />
              </Field>
            </div>
            <p className="text-xs mt-2" style={{ color: '#8E8E93' }}>Эти значения подставляются в новую смену — можно поменять для конкретного дня прямо в форме добавления.</p>
          </div>

          <button type="submit" className="w-full text-white rounded-2xl py-3 text-sm font-semibold mt-2" style={specularButton('#1C1C1E')}>
            Сохранить настройки
          </button>
        </form>
      </div>
    </div>
  );
}

function ScheduleView({ entries, settings, form, setForm, onSubmit, error, editingId, onCancelEdit, onEdit, onDelete, filterPerson, setFilterPerson }) {
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const filtered = filterPerson === 'all' ? entries : entries.filter((e) => e.person === filterPerson);
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      const mk = e.date.slice(0, 7);
      if (!map[mk]) map[mk] = [];
      map[mk].push(e);
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([mk, items]) => ({
        month: mk,
        label: monthLabel(mk),
        items: [...items].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
      }));
  }, [filtered]);

  if (!form) return null;

  return (
    <div className="pt-1 space-y-5">
      <p className="text-xs -mt-1" style={{ color: '#8E8E93' }}>Это просто график на память — сюда можно вносить смены заранее, в расчёт премий и налога он не попадает.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        {editingId && (
          <div className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs" style={{ ...tintStyle('#b45309', 0.1), color: '#92400e' }}>
            <span>Редактирование записи расписания</span>
            <button type="button" onClick={onCancelEdit} className="underline font-medium">Отменить</button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, person: 'p1' }))}
            className="flex items-center gap-2 justify-center rounded-2xl py-2.5 transition-all"
            style={form.person === 'p1' ? tintStyle(P1_COLOR, 0.14) : GLASS_WELL}
          >
            <PersonStamp letter={settings.p1Name.charAt(0).toUpperCase()} color={P1_COLOR} size="sm" />
            <span className="text-sm font-medium" style={{ color: form.person === 'p1' ? P1_COLOR : '#3C3C43' }}>{settings.p1Name}</span>
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, person: 'p2' }))}
            className="flex items-center gap-2 justify-center rounded-2xl py-2.5 transition-all"
            style={form.person === 'p2' ? tintStyle(P2_COLOR, 0.14) : GLASS_WELL}
          >
            <PersonStamp letter={settings.p2Name.charAt(0).toUpperCase()} color={P2_COLOR} size="sm" />
            <span className="text-sm font-medium" style={{ color: form.person === 'p2' ? P2_COLOR : '#3C3C43' }}>{settings.p2Name}</span>
          </button>
        </div>
        <div className="rounded-3xl p-4 space-y-3" style={GLASS_PANEL}>
          <Field label="Дата">
            <input
              type="date" value={form.date} onChange={update('date')}
              className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
              style={GLASS_WELL}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Начало">
              <input
                type="time" value={form.startTime} onChange={update('startTime')}
                className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
                style={GLASS_WELL}
              />
            </Field>
            <Field label="Конец">
              <input
                type="time" value={form.endTime} onChange={update('endTime')}
                className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
                style={GLASS_WELL}
              />
            </Field>
          </div>
          <Field label="Заметка (необязательно)">
            <input
              type="text" placeholder="Напр. подработка, замена"
              value={form.note} onChange={update('note')}
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={GLASS_WELL}
            />
          </Field>
        </div>
        {error && <p className="text-xs font-medium" style={{ color: '#b91c1c' }}>{error}</p>}
        <button
          type="submit"
          className="w-full text-white rounded-2xl py-3 text-sm font-semibold active:scale-95 transition-transform"
          style={specularButton('#48484A')}
        >
          {editingId ? 'Сохранить изменения' : 'Добавить в расписание'}
        </button>
      </form>

      <div className="flex items-center gap-2 overflow-x-auto pt-2">
        <FilterChip active={filterPerson === 'all'} onClick={() => setFilterPerson('all')}>Все</FilterChip>
        <FilterChip active={filterPerson === 'p1'} onClick={() => setFilterPerson('p1')} color={P1_COLOR}>{settings.p1Name}</FilterChip>
        <FilterChip active={filterPerson === 'p2'} onClick={() => setFilterPerson('p2')} color={P2_COLOR}>{settings.p2Name}</FilterChip>
      </div>

      {groups.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: '#8E8E93' }}>В расписании пока пусто.</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.month}>
            <h3 className="font-display text-sm font-semibold mb-2 px-1" style={{ color: '#3C3C43' }}>{g.label}</h3>
            <div className="rounded-3xl overflow-hidden glass-divide" style={GLASS_PANEL}>
              {g.items.map((entry) => {
                const color = entry.person === 'p1' ? P1_COLOR : P2_COLOR;
                const name = entry.person === 'p1' ? settings.p1Name : settings.p2Name;
                const weekend = isWeekendDate(entry.date);
                return (
                  <div key={entry.id} className="flex items-center gap-3 px-3.5 py-3">
                    <PersonStamp letter={name.charAt(0).toUpperCase()} color={color} size="sm" />
                    <button type="button" onClick={() => onEdit(entry)} className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-mono-num" style={{ color: weekend ? P2_COLOR : '#1C1C1E', fontWeight: weekend ? 600 : 400 }}>
                          {formatDateShort(entry.date)} {WEEKDAY_SHORT[dayOfWeek(entry.date)]}
                        </span>
                        <span className="text-xs font-mono-num" style={{ color: '#6E6E73' }}>{entry.startTime}–{entry.endTime}</span>
                      </div>
                      {entry.note && <p className="text-xs truncate mt-0.5" style={{ color: '#AEAEB2' }}>{entry.note}</p>}
                    </button>
                    <button onClick={() => onDelete(entry.id)} className="p-1 shrink-0" style={{ color: '#C7C7CC' }} aria-label="Удалить запись">
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );}
