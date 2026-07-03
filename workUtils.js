// Pure business logic and utility functions extracted from Work.jsx for testability.

// ---------- Constants ----------
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

const DEFAULT_SETTINGS = {
  p1Name: 'Я',
  p2Name: 'Жена',
  p1Rate: 231,
  p2Rate: 215,
  tripStart: '2026-06-11',
  tripEnd: '',
  p1OnTrip: true,
  p2OnTrip: true,
};

const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

// ---------- Date / time helpers ----------
function pad2(n) { return String(n).padStart(2, '0'); }

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

function dayOfWeek(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isWeekendDate(dateStr) {
  const dow = dayOfWeek(dateStr);
  return dow === 0 || dow === 6;
}

function daysInMonth(year, month) {
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
  const minutes = overlap(s, e, -120, 480) + overlap(s, e, 1320, 1920);
  return minutes / 60;
}

// ---------- Shift normalization & pay ----------
function normalizeShift(raw) {
  return {
    id: raw.id || 'generated-id',
    person: raw.person === 'p2' ? 'p2' : 'p1',
    date: raw.date,
    startTime: raw.startTime || '',
    endTime: raw.endTime || '',
    legacyHours: raw.startTime ? 0 : (raw.hours || 0),
    rate: raw.rate || 0,
    extraAmount: raw.extraAmount ?? raw.bonus ?? 0,
    extraNote: raw.extraNote ?? raw.bonusNote ?? '',
    note: raw.note || '',
    createdAt: raw.createdAt || 0,
  };
}

function computeShiftPay(shift) {
  const hasTimes = !!(shift.startTime && shift.endTime);
  const hours = hasTimes ? shiftHoursOf(shift.startTime, shift.endTime) : (shift.legacyHours || 0);
  const night = hasTimes ? nightHoursOf(shift.startTime, shift.endTime) : 0;
  const rate = shift.rate || 0;
  const base = hours * rate;
  const isMajorNight = hours > 0 && night > hours / 2;
  const nightBonus = hours > 0 ? (isMajorNight ? hours * rate * NIGHT_MAJOR_RATE : night * rate * NIGHT_MINOR_RATE) : 0;
  const reliabilityBonus = hours * rate * RELIABILITY_RATE;
  const weekend = shift.date ? isWeekendDate(shift.date) : false;
  const weekendBonus = weekend && hours > 0 ? WEEKEND_BONUS : 0;
  const extra = shift.extraAmount || 0;
  const taxable = base + nightBonus + reliabilityBonus + weekendBonus + extra;
  const tax = taxable * TAX_RATE;
  const net = taxable - tax;
  return { hours, night, isMajorNight, base, nightBonus, reliabilityBonus, weekendBonus, extra, taxable, tax, net };
}

// ---------- Business trip helpers ----------
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

// ---------- Monthly summary ----------
function computeMonthSummary(monthKey, person, shifts, settings, monthMeta) {
  const rate = person === 'p1' ? settings.p1Rate : settings.p2Rate;
  const onTrip = person === 'p1' ? settings.p1OnTrip : settings.p2OnTrip;
  const personShifts = shifts.filter((s) => s.person === person && s.date && s.date.slice(0, 7) === monthKey);

  let hours = 0, nightHours = 0, base = 0, nightBonus = 0, reliabilityBonus = 0, weekendBonus = 0, weekendCount = 0, extra = 0;
  personShifts.forEach((s) => {
    const p = computeShiftPay(s);
    hours += p.hours;
    nightHours += p.night;
    base += p.base;
    nightBonus += p.nightBonus;
    reliabilityBonus += p.reliabilityBonus;
    weekendBonus += p.weekendBonus;
    if (p.weekendBonus > 0) weekendCount += 1;
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

  const taxableGross = base + nightBonus + reliabilityBonus + weekendBonus + extra + highSeasonBonus + flexBonus + overtimePremium;
  const tax = taxableGross * TAX_RATE;
  const netTaxable = taxableGross - tax;

  const travelBonus = onTrip && isFullMonthInTrip(monthKey, settings.tripStart, settings.tripEnd) ? TRAVEL_WORK_BONUS : 0;
  const perDiemDays = onTrip ? perDiemDaysForMonth(monthKey, settings.tripStart, settings.tripEnd) : 0;
  const perDiem = perDiemDays * PER_DIEM_RATE;
  const nonTaxable = travelBonus + perDiem;
  const netTotal = netTaxable + nonTaxable;

  return {
    monthKey, person, hours, nightHours, wkd, holidays, norm,
    base, nightBonus, reliabilityBonus, weekendBonus, weekendCount, extra,
    highSeasonBonus, flexBonus, otHours, overtimePremium,
    taxableGross, tax, netTaxable,
    travelBonus, perDiemDays, perDiem, nonTaxable, netTotal,
    shiftsCount: personShifts.length,
  };
}

module.exports = {
  // Constants
  TAX_RATE,
  RELIABILITY_RATE,
  NIGHT_MINOR_RATE,
  NIGHT_MAJOR_RATE,
  HIGH_SEASON_THRESHOLD,
  HIGH_SEASON_BONUS,
  FLEX_BONUS_CAP,
  WEEKEND_BONUS,
  TRAVEL_WORK_BONUS,
  PER_DIEM_RATE,
  OT_TIER1_HOURS,
  OT_TIER1_MULT,
  OT_TIER2_MULT,
  DEFAULT_SETTINGS,
  MONTHS_NOM,
  MONTHS_SHORT,
  // Utilities
  pad2,
  formatMoney,
  formatHours,
  formatDateShort,
  monthLabel,
  monthShortLabel,
  dayOfWeek,
  isWeekendDate,
  daysInMonth,
  weekdaysInMonth,
  monthBounds,
  diffDaysInclusive,
  monthRange,
  toMinutes,
  shiftHoursOf,
  nightHoursOf,
  // Business logic
  normalizeShift,
  computeShiftPay,
  perDiemDaysForMonth,
  isFullMonthInTrip,
  computeMonthSummary,
};
