import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import { Plus, Home, Heart, BarChart3, Settings as SettingsIcon, X, Trash2, AlertCircle, Moon, Sun, Plane, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar, Truck, Trash, ImagePlus, Video, Send, Download, Target, Flame, Award, Wallet, Clock, TrendingUp, Users, PartyPopper, Pencil, Camera, History as HistoryIcon, LockKeyhole, Paperclip, FileText, MessageCircle } from 'lucide-react';
// ДОБАВЛЕНЫ ИКОНКИ: Wallet/Clock/TrendingUp/Users — для более наглядных карточек статистики;
// PartyPopper — маркер праздничного дня; Pencil/Camera — редактирование имени/аватара; HistoryIcon — кнопка «История» на главном экране.
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  ЦЕЛЬ (копилка) — прогресс считается от суммы чистого дохода (net) по сменам
  с датой >= даты создания цели. Так каждая новая цель стартует с нуля.

  ХРАНЕНИЕ ФОТО/ВИДЕО: изображения ужимаются на устройстве (canvas) и хранятся как
  data URL прямо в объекте цели/поста. Если подключите свой backend — замените
  функцию uploadMedia() на реальную загрузку файла и сохраняйте вернувшийся URL.
*/

/*
  ЖУРНАЛ ИЗМЕНЕНИЙ ПО ЗАПРОСУ ПОЛЬЗОВАТЕЛЯ (что и где менялось)
  ------------------------------------------------------------
  1) ДИЗАЙН ПЛАШЕК: обновлены getTheme()/panel/well стили (более глубокие тени,
     тонкие градиенты-«блики»), StatCard теперь с цветной иконкой на аватаре-плашке,
     PayslipCard/GoalHeroCard получили более выразительные акценты. Ищите блок
     "---------- Дизайн-токены и тема ----------" и компонент StatCard.

  2) АВАТАРКИ И ПЕРЕИМЕНОВАНИЕ В СТАТИСТИКЕ: в settings добавлены p1Avatar/p2Avatar
     (data URL, как у фото цели). PersonStamp теперь рисует фото, если оно есть.
     Новый компонент PeopleEditModal (открывается иконкой карандаша в StatsView)
     позволяет сменить фото и имя прямо из вкладки «Статистика».

  3) ПРАЗДНИКИ АВТОМАТИЧЕСКИ: HOLIDAY_MD — список праздничных дат (1-7 января,
     23 февраля, 8 марта, 1 мая, 9 мая, 12 июня, 4 ноября) на каждый год.
     isHolidayDate()/holidayWeekdaysInMonth() считают, сколько праздников-будних
     дней в месяце — норма часов автоматически уменьшается на 8ч за каждый такой день.
     Часы, отработанные в праздник, ИСКЛЮЧЕНЫ из расчёта премий «Высокий сезон» и
     «Любые временные возможности» (см. computeMonthSummary — nonHolidayHours), но
     ПРЕМИЯ НАДЁЖНОСТИ по ним продолжает начисляться как обычно (это уже «сухая
     ставка» — hours × rate × 15%, без дополнительного удвоения). Ручного поля
     «праздничных дней» больше нет — старое хранилище monthMeta удалено.

  4) ФИКС НАЛОЖЕНИЯ ЭЛЕМЕНТОВ: убран `position: fixed` для фонового градиента и
     нижней навигации — именно fixed-элементы «слетают» и наслаиваются друг на
     друга, когда родительский контейнер отрисовывается в масштабируемом окне
     (мобильный предпросмотр). Теперь всё приложение — это один flex-column на
     `100dvh`: скроллится только область контента, а нав-бар — обычный последний
     элемент flex-колонки, который просто всегда внизу. Ищите корневой return в App().

  5) ВВОД ВРЕМЕНИ ЦИФРАМИ: новый компонент TimeField — обычное текстовое поле
     с inputMode="numeric", вызывает цифровую клавиатуру на телефоне вместо
     крутилки. Вводите 4 цифры подряд — они сами разделятся на ЧЧ:ММ. Заменяет
     все <input type="time"> в AddFormModal и ScheduleView.

  6) СВОЙ КАЛЕНДАРЬ ДЛЯ ВЫБОРА ДАТЫ: новый компонент MonthCalendar — общая сетка
     месяца (переиспользуется и для выбора даты, и для сетки в «Расписании»).
     В AddFormModal и в форме расписания вместо <input type="date"> теперь сразу
     открыт этот календарь. В «Расписании» клик по дню в верхнем календаре сразу
     подставляет эту дату в форму добавления смены/записи. Праздники подсвечены.

  7) ПЛАШКИ ЗАРПЛАТЫ/АВАНСА НА ГЛАВНОМ ЭКРАНЕ: ADVANCE_DAY=27 (аванс — часы
     1–15 числа, БЕЗ доплат/премий, только ставка) и SALARY_DAY=12 (зарплата —
     часы 16–конец месяца + ВСЕ премии месяца). nextPayoutDate() переносит дату на
     более ранний будний день, если она попадает на субботу(-1 день) или
     воскресенье(-2 дня). На главном экране под общей плашкой — по одной плашке
     на каждого человека, заголовок и сумма меняются на «аванс»/«зарплату» в
     зависимости от того, какая дата ближе. Кнопка «История» открывает
     PayoutHistoryModal со списком прошлых выплат. Ищите computeAdvanceAmount,
     computeSalaryAmount, nextPayoutDate, PayoutCard, PayoutHistoryModal.
*/

// ---------- Хранилище ----------
const SHIFTS_KEY = 'shifts';
const SETTINGS_KEY = 'settings';
const SCHEDULE_KEY = 'scheduleEntries';
const GOALS_KEY = 'goals';
const POSTS_KEY = 'posts';
const WALL_KEY = 'ourWallMessages';
const THEME_KEY = 'theme';
const WALL_PASSWORD = 'кактус';

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
  p1Avatar: '', // data URL фото профиля (необязательно) — редактируется во вкладке «Статистика»
  p2Avatar: '',
  p1Rate: 231,
  p2Rate: 215,
  tripStart: '2026-06-11',
  tripEnd: '',
  p1OnTrip: true,
  p2OnTrip: true,
  defaultBreakMin: 60,
  defaultQuarterMin: 15,
  monthlyGoal: 26000,
};

const P1_COLOR = '#14b8a6';
const P2_COLOR = '#7c5cfc';
const PINK_A = '#f472b6';
const PINK_B = '#a855f7';
const HERO_A = '#5b7cfa';
const HERO_B = '#8b5cf6';

const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WEEKDAY_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WEEKDAY_MON_FIRST = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

// ---------- Праздники (авто) и даты выплат ----------
// Список праздничных дат в формате «ММ-ДД» — повторяются каждый год.
// Чтобы добавить/убрать праздник, просто отредактируйте этот массив.
const HOLIDAY_MD = ['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '02-23', '03-08', '05-01', '05-09', '06-12', '11-04'];
const ADVANCE_DAY = 27; // число месяца, когда приходит аванс (часы 1–15 текущего месяца)
const SALARY_DAY = 12;  // число месяца, когда приходит зарплата (часы 16–конец предыдущего месяца + премии)

// ---------- Дизайн-токены и тема (светлая/тёмная) ----------
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
const SYSTEM_SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";

const LIGHT_BG = 'linear-gradient(180deg, #F3F1FB 0%, #F6F3FA 40%, #FBF2F5 100%)';
const DARK_BG = 'linear-gradient(180deg, #0E0D14 0%, #121019 45%, #150F16 100%)';

function getTheme(dark) {
  return {
    dark,
    bgGradient: dark ? DARK_BG : LIGHT_BG,
    panel: dark
      ? { backgroundColor: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 14px 34px -16px rgba(0,0,0,0.6)' }
      : { backgroundColor: 'rgba(255,255,255,0.94)', border: '1px solid rgba(15,23,42,0.05)', boxShadow: '0 10px 28px -16px rgba(30,41,59,0.14)' },
    well: dark
      ? { backgroundColor: 'rgba(255,255,255,0.075)', border: '1px solid rgba(255,255,255,0.1)' }
      : { backgroundColor: 'rgba(15,23,42,0.035)', border: '1px solid rgba(15,23,42,0.07)' },
    nav: dark
      ? { backgroundColor: 'rgba(24,22,30,0.82)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.65)' }
      : { backgroundColor: 'rgba(255,255,255,0.86)', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 16px 40px -12px rgba(30,41,59,0.2)' },
    textPrimary: dark ? '#F2F1F7' : '#1C1C1E',
    textSecondary: dark ? '#9A98A5' : '#6E6E73',
    textTertiary: dark ? '#6E6C78' : '#AEAEB2',
    divider: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
    danger: dark ? '#FF6961' : '#DC2626',
  };
}
const ThemeCtx = React.createContext(getTheme(false));
function useTheme() { return useContext(ThemeCtx); }

const EMPHASIS_DARK = {
  backgroundColor: 'rgba(15,15,22,0.82)',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 12px 30px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
};
function tintStyle(hex, alpha) {
  const a = alpha ?? 0.12;
  return { backgroundColor: hexToRgba(hex, a), border: `1px solid ${hexToRgba(hex, a + 0.22)}` };
}
function specularButton(hex, hex2) {
  return {
    backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 50%), linear-gradient(135deg, ${hex}, ${hex2 || hexToRgba(hex, 0.82)})`,
    boxShadow: `0 10px 26px -8px ${hexToRgba(hex, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.4)`,
  };
}

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
// Праздник ли эта дата (сравниваем только «ММ-ДД», год не важен — см. HOLIDAY_MD)
function isHolidayDate(dateStr) {
  if (!dateStr) return false;
  return HOLIDAY_MD.includes(dateStr.slice(5, 10));
}
function daysInMonth(year, month) { // month: 1-12
  return new Date(year, month, 0).getDate();
}
// Сколько праздничных дат в данном месяце приходится на будний день
// (только они уменьшают норму часов — праздник в выходной и так не входил в норму).
function holidayWeekdaysInMonth(year, month) {
  const dim = daysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= dim; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const dateStr = `${year}-${pad2(month)}-${pad2(d)}`;
    if (dow !== 0 && dow !== 6 && isHolidayDate(dateStr)) count += 1;
  }
  return count;
}
// Перенос даты выплаты на более ранний будний день, если она попадает на выходной:
// суббота -> пятница (−1 день), воскресенье -> пятница (−2 дня).
function shiftPayDateForWeekend(date) {
  const d = new Date(date);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() - 1);
  else if (dow === 0) d.setDate(d.getDate() - 2);
  return d;
}
// Ближайшая (на сегодня или в будущем) фактическая дата выплаты для числа месяца `payDay`,
// с переносом на будний день. Возвращает { date: Date, monthKey: 'YYYY-MM' } — monthKey это
// месяц, В КОТОРОМ формально приходится число payDay (до переноса).
function nextPayoutOccurrence(payDay, fromDate) {
  let y = fromDate.getFullYear();
  let m = fromDate.getMonth() + 1;
  const from0 = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  for (let i = 0; i < 4; i++) {
    const dim = daysInMonth(y, m);
    const nominalDay = Math.min(payDay, dim);
    const actual = shiftPayDateForWeekend(new Date(y, m - 1, nominalDay));
    if (actual >= from0) {
      return { date: actual, monthKey: `${y}-${pad2(m)}` };
    }
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return { date: from0, monthKey: `${y}-${pad2(m)}` };
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
function addMonths(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
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
function computeMonthSummary(monthKey, person, shifts, settings) {
  const rate = person === 'p1' ? settings.p1Rate : settings.p2Rate;
  const onTrip = person === 'p1' ? settings.p1OnTrip : settings.p2OnTrip;
  const personShifts = shifts.filter((s) => s.person === person && s.date && s.date.slice(0, 7) === monthKey);

  let hours = 0, holidayHours = 0, nightHours = 0, base = 0, nightBonus = 0, reliabilityBonus = 0, weekendBonus = 0, weekendCount = 0, truckBonus = 0, truckCount = 0, garbageBonus = 0, garbageCount = 0, extra = 0;
  personShifts.forEach((s) => {
    const p = computeShiftPay(s);
    hours += p.hours;
    if (isHolidayDate(s.date)) holidayHours += p.hours;
    nightHours += p.night;
    base += p.base;
    nightBonus += p.nightBonus;
    // Премия надёжности начисляется как обычно и на праздничные смены —
    // это уже «сухая ставка» (hours × rate × 15%), без какого-либо удвоения.
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
  const holidays = holidayWeekdaysInMonth(y, m); // авто, вместо ручного ввода
  const norm = Math.max(0, wkd - holidays) * 8;
  const effectiveRate = hours > 0 ? base / hours : rate;

  // Часы, отработанные в праздник, не участвуют в премиях «Высокий сезон» и
  // «Любые временные возможности» — используем nonHolidayHours вместо hours.
  const nonHolidayHours = Math.max(0, hours - holidayHours);
  const highSeasonBonus = nonHolidayHours > HIGH_SEASON_THRESHOLD ? HIGH_SEASON_BONUS : 0;
  const flexBonus = norm > 0 ? Math.min(nonHolidayHours / norm, 1) * FLEX_BONUS_CAP : 0;
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
    monthKey, person, hours, holidayHours, nightHours, wkd, holidays, norm,
    base, nightBonus, reliabilityBonus, weekendBonus, weekendCount, truckBonus, truckCount, garbageBonus, garbageCount, extra,
    highSeasonBonus, flexBonus, otHours, overtimePremium,
    taxableGross, tax, netTaxable,
    travelBonus, perDiemDays, perDiem, nonTaxable, netTotal,
    shiftsCount: personShifts.length,
  };
}

// ---------- Аванс (1–15 число, без доплат/премий) и Зарплата (16–конец месяца + все премии) ----------
function splitShiftsByHalf(monthKey, person, shifts) {
  const first = [], second = [];
  shifts.forEach((s) => {
    if (s.person !== person || !s.date || s.date.slice(0, 7) !== monthKey) return;
    const day = Number(s.date.slice(8, 10));
    if (day <= 15) first.push(s); else second.push(s);
  });
  return { first, second };
}
// Аванс: только «сухие» часы × ставка за 1-15 число, БЕЗ ночных/выходных/премий — как просил пользователь.
function computeAdvanceAmount(monthKey, person, shifts, settings) {
  const rate = person === 'p1' ? settings.p1Rate : settings.p2Rate;
  const { first } = splitShiftsByHalf(monthKey, person, shifts);
  let hours = 0;
  first.forEach((s) => { hours += computeShiftPay(s).hours; });
  const gross = hours * rate;
  const tax = gross * TAX_RATE;
  return { hours, gross, tax, net: gross - tax };
}
// Зарплата: часы 16-конец месяца (по полному расчёту смены: ночные/выходные/премия надёжности и т.д.)
// + ВСЕ месячные премии (высокий сезон, гибкая премия, переработка) + командировочные/нетто-премии месяца.
function computeSalaryAmount(monthKey, person, shifts, settings) {
  const { second } = splitShiftsByHalf(monthKey, person, shifts);
  let base = 0, nightBonus = 0, reliabilityBonus = 0, weekendBonus = 0, truckBonus = 0, garbageBonus = 0, extra = 0, hours = 0;
  second.forEach((s) => {
    const p = computeShiftPay(s);
    hours += p.hours;
    base += p.base; nightBonus += p.nightBonus; reliabilityBonus += p.reliabilityBonus;
    weekendBonus += p.weekendBonus; truckBonus += p.truckBonus; garbageBonus += p.garbageBonus; extra += p.extra;
  });
  const monthSummary = computeMonthSummary(monthKey, person, shifts, settings); // для месячных премий и командировочных
  const taxablePart = base + nightBonus + reliabilityBonus + weekendBonus + truckBonus + garbageBonus + extra
    + monthSummary.highSeasonBonus + monthSummary.flexBonus + monthSummary.overtimePremium;
  const tax = taxablePart * TAX_RATE;
  const net = taxablePart - tax + monthSummary.nonTaxable;
  return { hours, taxablePart, tax, nonTaxable: monthSummary.nonTaxable, net };
}
// Возвращает данные для «плашки» на главном экране: какая выплата ближе (аванс 27-го или зарплата 12-го),
// с учётом переноса даты при попадании на выходной, и предполагаемую сумму по уже введённым сменам.
function computeNextPayout(person, shifts, settings, fromDate) {
  const advOcc = nextPayoutOccurrence(ADVANCE_DAY, fromDate); // аванс месяца advOcc.monthKey, выплата в этом же месяце
  const salOcc = nextPayoutOccurrence(SALARY_DAY, fromDate);  // зарплата за 2-ю половину месяца ДО salOcc.monthKey
  const isAdvanceNext = advOcc.date <= salOcc.date;
  if (isAdvanceNext) {
    const amount = computeAdvanceAmount(advOcc.monthKey, person, shifts, settings);
    return { type: 'advance', date: advOcc.date, amount: amount.net };
  }
  const salaryForMonth = addMonths(salOcc.monthKey, -1);
  const amount = computeSalaryAmount(salaryForMonth, person, shifts, settings);
  return { type: 'salary', date: salOcc.date, amount: amount.net };
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

// ---------- Цели (копилка) ----------
function normalizeGoal(raw) {
  return {
    id: raw.id || genId(),
    title: raw.title || 'Наша цель',
    emoji: raw.emoji || '🎯',
    imageDataUrl: raw.imageDataUrl || '',
    targetAmount: raw.targetAmount || 0,
    startDate: raw.startDate || todayStr(),
    createdAt: raw.createdAt || Date.now(),
  };
}
function computeGoalProgress(goal, shifts) {
  if (!goal) return { collected: 0, target: 0, pct: 0, remaining: 0 };
  const collected = shifts
    .filter((s) => s.date && s.date >= goal.startDate)
    .reduce((sum, s) => sum + computeShiftPay(s).net, 0);
  const target = goal.targetAmount || 0;
  const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((collected / target) * 100))) : 0;
  const remaining = Math.max(0, target - collected);
  return { collected, target, pct, remaining };
}

// ---------- Посты (наш блог) ----------
function normalizePost(raw) {
  return {
    id: raw.id || genId(),
    text: raw.text || '',
    media: Array.isArray(raw.media) ? raw.media : [],
    createdAt: raw.createdAt || Date.now(),
  };
}
function normalizeWallMessage(raw) {
  return {
    id: raw.id || genId(),
    text: raw.text || '',
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    deviceLabel: raw.deviceLabel || 'Устройство',
    createdAt: raw.createdAt || Date.now(),
  };
}
function getDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Устройство';
  if (navigator.userAgentData && navigator.userAgentData.model) return navigator.userAgentData.model;
  const ua = navigator.userAgent || '';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android[^;]*;\s*(?:[^;]+;\s*)?([^;)]+?)(?:\s+Build\/[^;)]+)?[;)].*$/i);
    return match && match[1] ? match[1].trim() : 'Android';
  }
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Браузер';
}
function formatPostDate(ts) {
  const d = new Date(ts);
  return `${pad2(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---------- Изображения: сжатие на устройстве ----------
// Замените на реальную загрузку на свой сервер (fetch('/api/upload', {method:'POST', body: formData}))
// если хотите хранить оригиналы файлов, а не data URL.
function resizeImageFile(file, maxDim, quality, keepPng) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = (e) => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('image decode failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(keepPng ? 'image/png' : 'image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// ---------- Календарная сетка (пн-первый, как Apple Calendar) ----------
function buildCalendarGrid(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=вс..6=сб
  const startOffset = (firstDow + 6) % 7; // делаем понедельник первым
  const dim = daysInMonth(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevDim = daysInMonth(prevYear, prevMonth);
  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: prevDim - startOffset + i + 1, current: false, dateStr: null });
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({ day: d, current: true, dateStr: `${year}-${pad2(month)}-${pad2(d)}` });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay, current: false, dateStr: null });
    nextDay += 1;
  }
  return cells;
}

// ---------- Экспорт в Apple Calendar (.ics) ----------
function icsDateTime(dateStr, timeStr, addDay) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0);
  if (addDay) dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}${pad2(dt.getMonth() + 1)}${pad2(dt.getDate())}T${pad2(dt.getHours())}${pad2(dt.getMinutes())}00`;
}
function icsNowUtc() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}
function icsEscape(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function generateICS(entries, settings) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nasha Smena//RU', 'CALSCALE:GREGORIAN'];
  entries.forEach((e) => {
    if (!e.date || !e.startTime || !e.endTime) return;
    const name = e.person === 'p1' ? settings.p1Name : settings.p2Name;
    const overnight = e.endTime <= e.startTime;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@nasha-smena`);
    lines.push(`DTSTAMP:${icsNowUtc()}`);
    lines.push(`DTSTART:${icsDateTime(e.date, e.startTime, false)}`);
    lines.push(`DTEND:${icsDateTime(e.date, e.endTime, overnight)}`);
    lines.push(`SUMMARY:${icsEscape(`Смена — ${name}`)}`);
    if (e.note) lines.push(`DESCRIPTION:${icsEscape(e.note)}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function downloadICS(entries, settings) {
  const ics = generateICS(entries, settings);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nashi-smeny.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- «Мы»: серия дней подряд и дни вместе ----------
function computeStreak(shifts) {
  const dateSet = new Set(shifts.map((s) => s.date));
  let streak = 0;
  const cursor = new Date();
  for (let guard = 0; guard < 3650; guard++) {
    const ds = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`;
    if (dateSet.has(ds)) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
}
function computeDaysTogether(shifts, scheduleEntries) {
  const dates = [...shifts.map((s) => s.date), ...scheduleEntries.map((s) => s.date)].filter(Boolean).sort();
  if (dates.length === 0) return 0;
  const [y, m, d] = dates[0].split('-').map(Number);
  const first = new Date(y, m - 1, d);
  const now = new Date();
  return Math.max(0, Math.round((now - first) / 86400000));
}
function computeMonthlyRecord(shifts) {
  const counts = {};
  shifts.forEach((s) => { const mk = s.date.slice(0, 7); counts[mk] = (counts[mk] || 0) + 1; });
  const values = Object.values(counts);
  return values.length ? Math.max(...values) : 0;
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [shifts, setShifts] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [darkMode, setDarkMode] = useState(false);
  const [goals, setGoals] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [filterPerson, setFilterPerson] = useState('all');
  const [homeMonth, setHomeMonth] = useState(currentMonthKey());
  const [statsPerson, setStatsPerson] = useState('p1');
  const [statsMonth, setStatsMonth] = useState('');
  const [statsScope, setStatsScope] = useState('month');
  const [usPeriod, setUsPeriod] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState(null);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [peopleDraft, setPeopleDraft] = useState(null);
  const [peoplePhotoBusy, setPeoplePhotoBusy] = useState(false);
  const [showPayoutHistory, setShowPayoutHistory] = useState(false);
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [scheduleForm, setScheduleForm] = useState(null);
  const [scheduleEditingId, setScheduleEditingId] = useState(null);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleFilterPerson, setScheduleFilterPerson] = useState('all');
  const [calendarMonth, setCalendarMonth] = useState(currentMonthKey());
  const [postDraft, setPostDraft] = useState({ text: '', media: [] });
  const [postBusy, setPostBusy] = useState(false);
  const [wallMessages, setWallMessages] = useState([]);
  const [wallUnlocked, setWallUnlocked] = useState(false);
  const [wallPassword, setWallPassword] = useState('');
  const [wallPasswordError, setWallPasswordError] = useState('');
  const [wallDraft, setWallDraft] = useState({ text: '', attachments: [] });
  const [wallBusy, setWallBusy] = useState(false);

  useEffect(() => {
    (async () => {
      let loadedSettings = DEFAULT_SETTINGS;
      let loadedShifts = [];
      let loadedSchedule = [];
      let loadedDark = false;
      let loadedGoals = [];
      let loadedPosts = [];
      let loadedWallMessages = [];
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
        const res = await window.storage.get(SCHEDULE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed)) loadedSchedule = parsed.map(normalizeScheduleEntry);
        }
      } catch (e) {}
      try {
        const res = await window.storage.get(THEME_KEY, false);
        if (res && res.value) loadedDark = !!JSON.parse(res.value).dark;
      } catch (e) {}
      try {
        const res = await window.storage.get(GOALS_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed)) loadedGoals = parsed.map(normalizeGoal);
        }
      } catch (e) {}
      try {
        const res = await window.storage.get(POSTS_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed)) loadedPosts = parsed.map(normalizePost);
        }
      } catch (e) {}
      try {
        const res = await window.storage.get(WALL_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed)) loadedWallMessages = parsed.map(normalizeWallMessage);
        }
      } catch (e) {}
      setSettings(loadedSettings);
      setSettingsDraft(loadedSettings);
      setShifts(loadedShifts);
      setScheduleEntries(loadedSchedule);
      setDarkMode(loadedDark);
      setGoals(loadedGoals);
      setPosts(loadedPosts);
      setWallMessages(loadedWallMessages);
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
      setUsPeriod(currentMonthKey());
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

  const persistGoals = useCallback(async (next) => {
    setGoals(next);
    try {
      await window.storage.set(GOALS_KEY, JSON.stringify(next), false);
    } catch (e) {
      setSaveError('Не удалось сохранить цель.');
    }
  }, []);

  const persistPosts = useCallback(async (next) => {
    setPosts(next);
    try {
      await window.storage.set(POSTS_KEY, JSON.stringify(next), false);
    } catch (e) {
      setSaveError('Не удалось сохранить пост.');
    }
  }, []);

  const persistWallMessages = useCallback(async (next) => {
    setWallMessages(next);
    try {
      const result = await window.storage.set(WALL_KEY, JSON.stringify(next), false);
      setSaveError(result ? '' : 'Не удалось сохранить сообщение на стене.');
    } catch (e) {
      setSaveError('Не удалось сохранить сообщение на стене.');
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      window.storage.set(THEME_KEY, JSON.stringify({ dark: next }), false).catch(() => {});
      return next;
    });
  }, []);

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
    setShowAddModal(false);
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
    setShowAddModal(true);
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
      monthlyGoal: Math.max(0, parseFloat(settingsDraft.monthlyGoal) || 0),
    };
    persistSettings(clean);
    setShowSettings(false);
  }

  function openGoalModal() {
    const active = goals[goals.length - 1];
    setGoalForm(active ? {
      title: active.title, emoji: active.emoji, imageDataUrl: active.imageDataUrl,
      targetAmount: String(active.targetAmount), startDate: active.startDate, _editingId: active.id,
    } : { title: '', emoji: '🎯', imageDataUrl: '', targetAmount: '', startDate: todayStr(), _editingId: null });
    setShowGoalModal(true);
  }

  function handleGoalSubmit(e) {
    e.preventDefault();
    if (!goalForm.title.trim()) return;
    const target = parseFloat(goalForm.targetAmount) || 0;
    const entry = normalizeGoal({
      id: goalForm._editingId || undefined,
      title: goalForm.title.trim(),
      emoji: goalForm.emoji || '🎯',
      imageDataUrl: goalForm.imageDataUrl || '',
      targetAmount: target,
      startDate: goalForm.startDate || todayStr(),
    });
    const next = goalForm._editingId ? goals.map((g) => (g.id === goalForm._editingId ? entry : g)) : [...goals, entry];
    persistGoals(next);
    setShowGoalModal(false);
  }

  async function handleGoalImage(file) {
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 480, 0.92, true);
      setGoalForm((f) => ({ ...f, imageDataUrl: dataUrl }));
    } catch (e) {
      setSaveError('Не удалось обработать фото.');
    }
  }

  // ---- Аватарки и имена из вкладки «Статистика» (п.2 запроса) ----
  function openPeopleModal() {
    setPeopleDraft({ p1Name: settings.p1Name, p2Name: settings.p2Name, p1Avatar: settings.p1Avatar, p2Avatar: settings.p2Avatar });
    setShowPeopleModal(true);
  }
  async function handlePersonPhoto(person, file) {
    if (!file) return;
    setPeoplePhotoBusy(true);
    try {
      const dataUrl = await resizeImageFile(file, 320, 0.9, false);
      setPeopleDraft((d) => ({ ...d, [person === 'p1' ? 'p1Avatar' : 'p2Avatar']: dataUrl }));
    } catch (e) {
      setSaveError('Не удалось обработать фото профиля.');
    } finally {
      setPeoplePhotoBusy(false);
    }
  }
  function savePeopleForm(e) {
    e.preventDefault();
    persistSettings({
      ...settings,
      p1Name: peopleDraft.p1Name.trim() || 'Я',
      p2Name: peopleDraft.p2Name.trim() || 'Жена',
      p1Avatar: peopleDraft.p1Avatar || '',
      p2Avatar: peopleDraft.p2Avatar || '',
    });
    setShowPeopleModal(false);
  }

  async function handlePostMediaAdd(files) {
    if (!files || !files.length) return;
    setPostBusy(true);
    try {
      const items = [];
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith('video/');
        const dataUrl = isVideo ? await readFileAsDataUrl(file) : await resizeImageFile(file, 1280, 0.85, false);
        items.push({ id: genId(), url: dataUrl, type: isVideo ? 'video' : 'image' });
      }
      setPostDraft((d) => ({ ...d, media: [...d.media, ...items] }));
    } catch (e) {
      setSaveError('Не удалось обработать медиафайл.');
    } finally {
      setPostBusy(false);
    }
  }

  function removePostDraftMedia(id) {
    setPostDraft((d) => ({ ...d, media: d.media.filter((m) => m.id !== id) }));
  }

  function handlePostSubmit() {
    if (!postDraft.text.trim() && postDraft.media.length === 0) return;
    const entry = normalizePost({ text: postDraft.text.trim(), media: postDraft.media });
    persistPosts([entry, ...posts]);
    setPostDraft({ text: '', media: [] });
  }

  function handlePostDelete(id) {
    persistPosts(posts.filter((p) => p.id !== id));
  }

  function unlockWall(e) {
    e.preventDefault();
    if (wallPassword.trim().toLowerCase() === WALL_PASSWORD) {
      setWallUnlocked(true);
      setWallPassword('');
      setWallPasswordError('');
    } else {
      setWallPasswordError('Неверный код доступа.');
    }
  }

  async function handleWallFileAdd(files) {
    if (!files || !files.length) return;
    setWallBusy(true);
    try {
      const items = [];
      for (const file of Array.from(files)) {
        if (file.size > 8 * 1024 * 1024) {
          throw new Error('Файл больше 8 МБ');
        }
        items.push({
          id: genId(),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          url: await readFileAsDataUrl(file),
        });
      }
      setWallDraft((draft) => ({ ...draft, attachments: [...draft.attachments, ...items] }));
    } catch (e) {
      setSaveError(e.message === 'Файл больше 8 МБ' ? 'Для тестовой стены размер файла ограничен 8 МБ.' : 'Не удалось прочитать файл.');
    } finally {
      setWallBusy(false);
    }
  }

  function removeWallAttachment(id) {
    setWallDraft((draft) => ({ ...draft, attachments: draft.attachments.filter((file) => file.id !== id) }));
  }

  function handleWallSubmit() {
    if (!wallDraft.text.trim() && wallDraft.attachments.length === 0) return;
    const entry = normalizeWallMessage({
      text: wallDraft.text.trim(),
      attachments: wallDraft.attachments,
      deviceLabel: getDeviceLabel(),
    });
    persistWallMessages([...wallMessages, entry]);
    setWallDraft({ text: '', attachments: [] });
  }

  function handleWallDelete(id) {
    persistWallMessages(wallMessages.filter((message) => message.id !== id));
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
    if (homeMonth !== 'all') filtered = filtered.filter((s) => s.date.slice(0, 7) === homeMonth);
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
  }, [shifts, filterPerson, homeMonth]);

  const homeMonthShifts = useMemo(() => shifts.filter((s) => homeMonth === 'all' || s.date.slice(0, 7) === homeMonth), [shifts, homeMonth]);
  const homeTotals = useMemo(() => {
    let total = 0, p1 = 0, p2 = 0;
    homeMonthShifts.forEach((s) => {
      const net = computeShiftPay(s).net;
      total += net;
      if (s.person === 'p1') p1 += net; else p2 += net;
    });
    return { total, p1, p2 };
  }, [homeMonthShifts]);

  const activeGoal = goals.length ? goals[goals.length - 1] : null;
  const goalProgress = useMemo(() => computeGoalProgress(activeGoal, shifts), [activeGoal, shifts]);

  const monthSummaries = useMemo(() => {
    const map = {};
    payrollMonths.forEach((mk) => {
      map[mk] = {
        p1: computeMonthSummary(mk, 'p1', shifts, settings),
        p2: computeMonthSummary(mk, 'p2', shifts, settings),
      };
    });
    return map;
  }, [payrollMonths, shifts, settings]);

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

  const effectiveStatsMonth = payrollMonths.includes(statsMonth) ? statsMonth : (payrollMonths[0] || currentMonthKey());

  const statsScopedShifts = useMemo(() => {
    if (statsScope === 'year') return shifts.filter((s) => s.date.slice(0, 4) === effectiveStatsMonth.slice(0, 4));
    return shifts.filter((s) => s.date.slice(0, 7) === effectiveStatsMonth);
  }, [shifts, statsScope, effectiveStatsMonth]);

  const statsAgg = useMemo(() => {
    let hours = 0, p1 = 0, p2 = 0, count = 0;
    statsScopedShifts.forEach((s) => {
      const p = computeShiftPay(s);
      hours += p.hours;
      count += 1;
      if (s.person === 'p1') p1 += p.net; else p2 += p.net;
    });
    const total = p1 + p2;
    return {
      hours, count, total, p1, p2,
      avg: count > 0 ? total / count : 0,
      p1Pct: total > 0 ? Math.round((p1 / total) * 1000) / 10 : 0,
      p2Pct: total > 0 ? Math.round((p2 / total) * 1000) / 10 : 0,
    };
  }, [statsScopedShifts]);

  const usScopedShifts = useMemo(() => {
    if (usPeriod === 'all') return shifts;
    return shifts.filter((s) => s.date.slice(0, 7) === usPeriod);
  }, [shifts, usPeriod]);
  const usTotal = useMemo(() => usScopedShifts.reduce((sum, s) => sum + computeShiftPay(s).net, 0), [usScopedShifts]);
  const streak = useMemo(() => computeStreak(shifts), [shifts]);
  const daysTogether = useMemo(() => computeDaysTogether(shifts, scheduleEntries), [shifts, scheduleEntries]);
  const monthlyRecord = useMemo(() => computeMonthlyRecord(shifts), [shifts]);

  const calendarGrid = useMemo(() => buildCalendarGrid(calendarMonth), [calendarMonth]);
  const calendarDayPeople = useMemo(() => {
    const map = {};
    scheduleEntries.forEach((e) => {
      if (!map[e.date]) map[e.date] = new Set();
      map[e.date].add(e.person);
    });
    return map;
  }, [scheduleEntries]);
  const nextShift = useMemo(() => {
    const today = todayStr();
    const upcoming = scheduleEntries
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    return upcoming[0] || null;
  }, [scheduleEntries]);

  // ---- Плашки «Предположительная выплата аванса/зарплаты» на главном экране (п.7 запроса) ----
  const payoutCards = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return ['p1', 'p2'].map((person) => {
      const payout = computeNextPayout(person, shifts, settings, today);
      const dateLabel = `${payout.date.getDate()} ${MONTHS_GEN[payout.date.getMonth()]}`;
      const title = payout.type === 'advance'
        ? `Предположительная выплата аванса ${dateLabel}`
        : `Предположительная выплата зарплаты ${dateLabel}`;
      return {
        person,
        name: person === 'p1' ? settings.p1Name : settings.p2Name,
        color: person === 'p1' ? P1_COLOR : P2_COLOR,
        avatar: person === 'p1' ? settings.p1Avatar : settings.p2Avatar,
        type: payout.type, title, amount: payout.amount, date: payout.date,
      };
    });
  }, [shifts, settings]);

  // История прошлых выплат (и аванс, и зарплата) для кнопки «История» под плашками.
  const payoutHistory = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entries = [];
    ['p1', 'p2'].forEach((person) => {
      for (let i = 0; i < 15; i++) {
        const mk = addMonths(currentMonthKey(), -i);
        const [y, m] = mk.split('-').map(Number);
        const advDate = shiftPayDateForWeekend(new Date(y, m - 1, Math.min(ADVANCE_DAY, daysInMonth(y, m))));
        if (advDate <= today) {
          const adv = computeAdvanceAmount(mk, person, shifts, settings);
          if (adv.hours > 0) entries.push({ person, type: 'advance', date: advDate, amount: adv.net, monthKey: mk });
        }
        const nextMk = addMonths(mk, 1);
        const [ny, nm] = nextMk.split('-').map(Number);
        const salDate = shiftPayDateForWeekend(new Date(ny, nm - 1, Math.min(SALARY_DAY, daysInMonth(ny, nm))));
        if (salDate <= today) {
          const sal = computeSalaryAmount(mk, person, shifts, settings);
          if (sal.hours > 0 && salDate <= today) entries.push({ person, type: 'salary', date: salDate, amount: sal.net, monthKey: mk });
        }
      }
    });
    return entries.sort((a, b) => b.date - a.date).slice(0, 40);
  }, [shifts, settings]);

  const theme = getTheme(darkMode);

  if (loading || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bgGradient, fontFamily: SYSTEM_SANS }}>
        <p className="text-sm" style={{ color: theme.textSecondary }}>Загрузка…</p>
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

  return (
    <ThemeCtx.Provider value={theme}>
      {/*
        ФИКС НАЛОЖЕНИЯ ЭЛЕМЕНТОВ (см. журнал изменений в начале файла, п.4):
        раньше фон и нижняя навигация были `position: fixed` — на телефоне (особенно
        в масштабируемом окне предпросмотра) это вызывало ровно ту картину с фото:
        нав-бар «съезжал» и наслаивался на список, а фон не покрывал часть экрана.
        Теперь ВСЁ приложение — один flex-column высотой 100dvh: скроллится только
        внутренняя область с контентом, а nav — обычный последний элемент колонки,
        который просто всегда внизу. Никакого fixed/position-хака больше нет.
      */}
      <div className="w-full" style={{ minHeight: '100dvh', background: theme.bgGradient, fontFamily: SYSTEM_SANS }}>
        <style>{`
          .font-display { font-family: ${SYSTEM_SANS}; }
          .font-mono-num { font-family: ui-monospace, 'SF Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-variant-numeric: tabular-nums; }
          .glass-divide > * + * { border-top: 1px solid ${theme.divider}; }
          input, textarea, select, button { font-family: inherit; }
          input:focus, textarea:focus, select:focus, button:focus { outline: none; }
          ::placeholder { color: ${theme.textTertiary}; opacity: 1; }
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
          }
        `}</style>

        <div className="max-w-md mx-auto flex flex-col" style={{ height: '100dvh' }}>
          <div className="flex-1 overflow-y-auto overscroll-contain relative" style={{ WebkitOverflowScrolling: 'touch' }}>
            <header className="flex items-center justify-between px-5 pt-6 pb-4">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight" style={{ color: theme.textPrimary }}>
                  {tab === 'wall' ? 'Наша Стена' : 'Наша смена'}
                </h1>
                <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                  {tab === 'wall' ? 'Личные сообщения и файлы' : 'Часы, премии и командировочные'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleDarkMode}
                  className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ ...theme.panel, color: theme.textPrimary }}
                  aria-label="Тема"
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  onClick={() => { setSettingsDraft(settings); setShowSettings(true); }}
                  className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ ...theme.panel, color: theme.textPrimary }}
                  aria-label="Настройки"
                >
                  <SettingsIcon size={18} />
                </button>
              </div>
            </header>

            {saveError && (
              <div className="mx-5 mb-4 flex items-center gap-2 rounded-2xl text-xs px-3 py-2.5" style={{ ...tintStyle('#b91c1c', 0.1), color: darkMode ? '#FCA5A5' : '#991b1b' }}>
                <AlertCircle size={14} className="shrink-0" />
                {saveError}
              </div>
            )}

            <main className="px-5 relative pb-8">
              {tab === 'home' && (
                <HomeView
                  goal={activeGoal}
                  progress={goalProgress}
                  onOpenGoal={openGoalModal}
                  settings={settings}
                  homeMonth={homeMonth}
                  setHomeMonth={setHomeMonth}
                  availableMonths={shiftMonths}
                  totals={homeTotals}
                  groups={groupedShifts}
                  filterPerson={filterPerson}
                  setFilterPerson={setFilterPerson}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                  payoutCards={payoutCards}
                  onOpenHistory={() => setShowPayoutHistory(true)}
                />
              )}
              {tab === 'stats' && (
                <StatsView
                  agg={statsAgg}
                  overallStats={overallStats}
                  settings={settings}
                  shiftsCount={shifts.length}
                  availableMonths={payrollMonths}
                  monthSummaries={monthSummaries}
                  statsMonth={effectiveStatsMonth}
                  setStatsMonth={setStatsMonth}
                  statsScope={statsScope}
                  setStatsScope={setStatsScope}
                  statsPerson={statsPerson}
                  setStatsPerson={setStatsPerson}
                  onEditPeople={openPeopleModal}
                />
              )}
              {tab === 'us' && (
                <UsView
                  settings={settings}
                  usPeriod={usPeriod}
                  setUsPeriod={setUsPeriod}
                  availableMonths={payrollMonths}
                  usTotal={usTotal}
                  homeP1={homeTotals.p1}
                  shiftsCount={shifts.length}
                  monthlyRecord={monthlyRecord}
                  goal={activeGoal}
                  progress={goalProgress}
                  onOpenGoal={openGoalModal}
                  streak={streak}
                  daysTogether={daysTogether}
                  posts={posts}
                  postDraft={postDraft}
                  setPostDraft={setPostDraft}
                  onAddMedia={handlePostMediaAdd}
                  onRemoveMedia={removePostDraftMedia}
                  onPublish={handlePostSubmit}
                  onDeletePost={handlePostDelete}
                  postBusy={postBusy}
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
                  calendarMonth={calendarMonth}
                  setCalendarMonth={setCalendarMonth}
                  calendarGrid={calendarGrid}
                  calendarDayPeople={calendarDayPeople}
                  nextShift={nextShift}
                  onExportICS={() => downloadICS(scheduleEntries, settings)}
                  onPickDate={(dateStr) => setScheduleForm((f) => ({ ...f, date: dateStr }))}
                />
              )}
              {tab === 'wall' && (
                <WallView
                  unlocked={wallUnlocked}
                  password={wallPassword}
                  setPassword={(value) => { setWallPassword(value); setWallPasswordError(''); }}
                  passwordError={wallPasswordError}
                  onUnlock={unlockWall}
                  messages={wallMessages}
                  draft={wallDraft}
                  setDraft={setWallDraft}
                  onAddFile={handleWallFileAdd}
                  onRemoveFile={removeWallAttachment}
                  onPublish={handleWallSubmit}
                  onDelete={handleWallDelete}
                  busy={wallBusy}
                  onLock={() => setWallUnlocked(false)}
                />
              )}
            </main>
          </div>

          <nav className="shrink-0 px-4 pt-2 relative z-10" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <div className="relative">
              <div className="grid grid-cols-6 gap-1 rounded-3xl px-2 py-2 items-center" style={theme.nav}>
                <TabButton icon={Home} label="Главная" active={tab === 'home'} onClick={() => setTab('home')} />
                <TabButton icon={BarChart3} label="Статистика" active={tab === 'stats'} onClick={() => setTab('stats')} />
                <TabButton icon={MessageCircle} label="Наша Стена" active={tab === 'wall'} onClick={() => setTab('wall')} />
                <div />
                <TabButton icon={Heart} label="Мы" active={tab === 'us'} onClick={() => setTab('us')} />
                <TabButton icon={Calendar} label="Расписание" active={tab === 'schedule'} onClick={() => setTab('schedule')} />
              </div>
              <button
                onClick={() => { resetForm(form.person); setShowAddModal(true); }}
                className="absolute left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                style={{ top: '-22px', ...specularButton(HERO_A, HERO_B) }}
                aria-label="Добавить смену"
              >
                <Plus size={26} color="#fff" strokeWidth={2.4} />
              </button>
            </div>
          </nav>

          {showAddModal && (
          <AddFormModal
            form={form}
            setForm={setForm}
            settings={settings}
            onPersonSelect={handlePersonSelect}
            onSubmit={handleSubmit}
            formError={formError}
            preview={preview}
            editingId={editingId}
            onClose={() => { setShowAddModal(false); resetForm(form.person); }}
          />
        )}

        {showSettings && (
          <SettingsModal
            draft={settingsDraft}
            setDraft={setSettingsDraft}
            onSave={saveSettingsForm}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showGoalModal && (
          <GoalFormModal
            form={goalForm}
            setForm={setGoalForm}
            onSubmit={handleGoalSubmit}
            onImage={handleGoalImage}
            onClose={() => setShowGoalModal(false)}
          />
        )}

        {showPeopleModal && (
          <PeopleEditModal
            draft={peopleDraft}
            setDraft={setPeopleDraft}
            onSave={savePeopleForm}
            onClose={() => setShowPeopleModal(false)}
            onPhoto={handlePersonPhoto}
            busy={peoplePhotoBusy}
          />
        )}

        {showPayoutHistory && (
          <PayoutHistoryModal
            settings={settings}
            history={payoutHistory}
            onClose={() => setShowPayoutHistory(false)}
          />
        )}
      </div>
      </div>
    </ThemeCtx.Provider>
  );
}

function TabButton({ icon: Icon, label, active, onClick }) {
  const theme = useTheme();
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-2xl transition-all duration-300"
      style={active ? { backgroundColor: hexToRgba(HERO_B, 0.16), boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' } : undefined}
    >
      <Icon size={20} strokeWidth={active ? 2.3 : 1.8} style={{ color: active ? HERO_B : theme.textTertiary }} />
      <span className="text-xs font-medium" style={{ color: active ? HERO_B : theme.textTertiary }}>{label}</span>
    </button>
  );
}

function PersonStamp({ letter, color, size, avatar }) {
  const dims = size === 'sm' ? 'w-6 h-6 text-xs' : size === 'lg' ? 'w-11 h-11 text-base' : 'w-8 h-8 text-sm';
  if (avatar) {
    return (
      <span
        className={`${dims} rounded-full overflow-hidden shrink-0 block`}
        style={{ boxShadow: `0 0 0 2px rgba(255,255,255,0.85), 0 2px 6px -1px ${hexToRgba(color, 0.5)}` }}
      >
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }
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
  const theme = useTheme();
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: theme.textSecondary }}>{label}</span>
      {children}
    </label>
  );
}

function formatWallFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function WallAttachment({ file, compact = false, onRemove }) {
  const theme = useTheme();
  const isImage = file.type && file.type.startsWith('image/');
  const isVideo = file.type && file.type.startsWith('video/');
  return (
    <div className={`relative overflow-hidden rounded-2xl ${compact ? 'w-20 shrink-0' : ''}`} style={theme.well}>
      {isImage ? (
        <img src={file.url} alt={file.name || ''} className={compact ? 'w-20 h-20 object-cover' : 'w-full max-h-64 object-cover'} />
      ) : isVideo ? (
        <video src={file.url} controls className={compact ? 'w-20 h-20 object-cover' : 'w-full max-h-64 object-cover'} />
      ) : (
        <a
          href={file.url}
          download={file.name || 'файл'}
          className="flex items-center gap-2 px-3 py-2.5 min-w-0"
          style={{ color: theme.textPrimary }}
        >
          <FileText size={18} className="shrink-0" style={{ color: HERO_B }} />
          <span className="min-w-0">
            <span className="block text-xs font-medium truncate">{file.name || 'Файл'}</span>
            <span className="block text-[10px]" style={{ color: theme.textTertiary }}>{formatWallFileSize(file.size)}</span>
          </span>
          <Download size={14} className="shrink-0" style={{ color: theme.textSecondary }} />
        </a>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.62)' }}
          aria-label="Удалить вложение"
        >
          <X size={11} color="#fff" />
        </button>
      )}
    </div>
  );
}

function WallView({ unlocked, password, setPassword, passwordError, onUnlock, messages, draft, setDraft, onAddFile, onRemoveFile, onPublish, onDelete, busy, onLock }) {
  const theme = useTheme();
  const fileRef = useRef(null);
  const orderedMessages = useMemo(() => messages.slice().sort((a, b) => a.createdAt - b.createdAt), [messages]);

  if (!unlocked) {
    return (
      <div className="pt-1 space-y-4">
        <div className="rounded-3xl p-5" style={theme.panel}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ ...tintStyle(HERO_B, 0.14), color: HERO_B }}>
            <LockKeyhole size={22} />
          </div>
          <h2 className="font-display text-lg font-semibold" style={{ color: theme.textPrimary }}>Наша Стена закрыта</h2>
          <p className="text-sm mt-1.5 mb-5" style={{ color: theme.textSecondary }}>
            Введите код, чтобы открыть личную стену сообщений и файлов.
          </p>
          <form onSubmit={onUnlock} className="space-y-3">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Код доступа"
              className="w-full rounded-2xl px-4 py-3 text-sm"
              style={{ ...theme.well, color: theme.textPrimary }}
            />
            {passwordError && <p className="text-xs" style={{ color: theme.danger }}>{passwordError}</p>}
            <button type="submit" className="w-full rounded-2xl py-3 text-sm font-semibold text-white" style={specularButton(HERO_A, HERO_B)}>
              Открыть стену
            </button>
          </form>
          <p className="text-[11px] mt-4" style={{ color: theme.textTertiary }}>
            Тестовый код задаётся прямо в приложении и не является настоящей защитой.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-1 space-y-3">
      <div className="rounded-3xl px-4 py-3 flex items-center justify-between" style={theme.panel}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundImage: `linear-gradient(135deg, ${HERO_A}, ${HERO_B})`, color: '#fff' }}>
            <MessageCircle size={19} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: theme.textPrimary }}>Избранные</p>
            <p className="text-xs truncate" style={{ color: theme.textSecondary }}>Наша Стена · {messages.length} сообщений</p>
          </div>
        </div>
        <button type="button" onClick={onLock} className="text-xs rounded-full px-2.5 py-1.5" style={{ ...theme.well, color: theme.textSecondary }}>
          Закрыть
        </button>
      </div>

      <div className="rounded-3xl p-3 min-h-[42vh] space-y-3" style={{ background: theme.dark ? 'rgba(19,25,34,0.72)' : 'rgba(225,235,244,0.65)', border: `1px solid ${theme.divider}` }}>
        {orderedMessages.length === 0 ? (
          <div className="min-h-[34vh] flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: theme.dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.7)', color: HERO_B }}>
              <MessageCircle size={24} />
            </div>
            <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>Пока здесь пусто</p>
            <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Сохраняйте сюда мысли, сообщения и файлы.</p>
          </div>
        ) : (
          orderedMessages.map((message) => (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[88%] rounded-2xl rounded-br-md px-3.5 py-2.5" style={{ backgroundColor: theme.dark ? 'rgba(76,116,178,0.72)' : '#d8fdd2', color: theme.textPrimary, boxShadow: '0 2px 6px rgba(15,23,42,0.06)' }}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[10px] font-semibold truncate" style={{ color: theme.dark ? '#D8E8FF' : '#3b7a4a' }}>{message.deviceLabel}</span>
                  <span className="text-[10px] shrink-0" style={{ color: theme.dark ? 'rgba(255,255,255,0.65)' : '#6b7f70' }}>{formatPostDate(message.createdAt)}</span>
                </div>
                {message.text && <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>}
                {message.attachments.length > 0 && (
                  <div className={`space-y-2 ${message.text ? 'mt-2' : ''}`}>
                    {message.attachments.map((file) => <WallAttachment key={file.id} file={file} />)}
                  </div>
                )}
                <div className="flex justify-end mt-1">
                  <button type="button" onClick={() => onDelete(message.id)} className="text-[10px]" style={{ color: theme.dark ? 'rgba(255,255,255,0.58)' : '#6b7f70' }}>
                    удалить
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-3xl p-3" style={theme.panel}>
        {draft.attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {draft.attachments.map((file) => <WallAttachment key={file.id} file={file} compact onRemove={() => onRemoveFile(file.id)} />)}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={theme.well} aria-label="Прикрепить файл">
            <Paperclip size={17} style={{ color: theme.textSecondary }} />
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { onAddFile(e.target.files); e.target.value = ''; }} />
          <textarea
            rows={1}
            placeholder="Сообщение"
            value={draft.text}
            onChange={(e) => setDraft((value) => ({ ...value, text: e.target.value }))}
            className="flex-1 rounded-2xl px-3 py-2.5 text-sm resize-none"
            style={{ ...theme.well, color: theme.textPrimary }}
          />
          <button type="button" onClick={onPublish} disabled={busy || (!draft.text.trim() && draft.attachments.length === 0)} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white disabled:opacity-40" style={specularButton(HERO_A, HERO_B)} aria-label="Отправить">
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] mt-2 px-1" style={{ color: theme.textTertiary }}>
          Файлы хранятся локально на этом устройстве · до 8 МБ каждый
        </p>
      </div>
    </div>
  );
}

// Ввод времени 4 цифрами подряд с цифровой клавиатурой (inputMode="numeric") вместо системной
// «крутилки» iOS — печатаете, например, 1 4 3 0, и поле само подставляет двоеточие: 14:30 (п.5 запроса).
function TimeField({ value, onChange }) {
  const theme = useTheme();
  const [raw, setRaw] = useState(() => (value || '').replace(':', ''));
  useEffect(() => { setRaw((value || '').replace(':', '')); }, [value]);

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    setRaw(digits);
    if (digits.length === 4) {
      const hh = Math.min(23, parseInt(digits.slice(0, 2), 10));
      const mm = Math.min(59, parseInt(digits.slice(2, 4), 10));
      onChange(`${pad2(hh)}:${pad2(mm)}`);
    } else {
      onChange('');
    }
  }
  const display = raw.length <= 2 ? raw : `${raw.slice(0, 2)}:${raw.slice(2)}`;
  return (
    <input
      type="text" inputMode="numeric" pattern="[0-9:]*" maxLength={5}
      value={display} onChange={handleChange} placeholder="ЧЧ:ММ"
      className="w-full rounded-xl px-3 py-2 text-sm font-mono-num"
      style={{ ...theme.well, color: theme.textPrimary }}
    />
  );
}

// Свой календарь для выбора даты — открыт сразу на форме, вместо системного iOS-пикера (п.6 запроса).
// Управляет своим отображаемым месяцем внутри (стартует с месяца текущего значения `value`).
function DatePickerField({ value, onChange }) {
  const theme = useTheme();
  const [viewMonth, setViewMonth] = useState(() => (value ? value.slice(0, 7) : currentMonthKey()));
  const grid = useMemo(() => buildCalendarGrid(viewMonth), [viewMonth]);
  const today = todayStr();
  return (
    <div className="rounded-2xl p-3" style={theme.well}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: theme.textPrimary }}>{monthLabel(viewMonth)}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, -1))} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)' }}>
            <ChevronLeft size={12} style={{ color: theme.textPrimary }} />
          </button>
          <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)' }}>
            <ChevronRight size={12} style={{ color: theme.textPrimary }} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 mb-0.5">
        {WEEKDAY_MON_FIRST.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium" style={{ color: theme.textTertiary }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {grid.map((cell, i) => {
          const isToday = cell.dateStr === today;
          const isSelected = cell.dateStr && cell.dateStr === value;
          const holiday = cell.dateStr && isHolidayDate(cell.dateStr);
          return (
            <button
              type="button" key={i} disabled={!cell.dateStr}
              onClick={() => onChange(cell.dateStr)}
              className="flex items-center justify-center"
              style={{ height: 30 }}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono-num"
                style={{
                  color: !cell.current ? theme.textTertiary : holiday ? '#e11d48' : theme.textPrimary,
                  fontWeight: holiday ? 700 : 400,
                  ...(isToday ? { backgroundColor: hexToRgba(HERO_B, 0.16), fontWeight: 700, color: HERO_B } : {}),
                  ...(isSelected ? { ...specularButton(HERO_A, HERO_B), color: '#fff', fontWeight: 700 } : {}),
                }}
              >
                {cell.day}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  const theme = useTheme();
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange} className="flex items-center justify-between gap-3 w-full py-2.5">
      <span className="text-sm" style={{ color: theme.textPrimary }}>{label}</span>
      <span className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0" style={{ backgroundColor: checked ? '#34C759' : 'rgba(120,120,128,0.32)' }}>
        <span className="inline-block h-5 w-5 rounded-full bg-white transition-transform duration-200" style={{ transform: checked ? 'translateX(20px)' : 'translateX(2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </span>
    </button>
  );
}

function LineItem({ label, value, accent, bold }) {
  const theme = useTheme();
  const colorMap = { rose: '#e11d48', amber: '#b45309', emerald: '#059669', indigo: '#4f46e5' };
  const color = colorMap[accent] || (bold ? theme.textPrimary : theme.textSecondary);
  const sign = value < 0 ? '−' : '';
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <span className="text-sm" style={{ color: bold ? theme.textPrimary : theme.textSecondary, fontWeight: bold ? 500 : 400 }}>{label}</span>
      <span className="font-mono-num text-sm shrink-0" style={{ color, fontWeight: bold ? 600 : 500 }}>{sign}{formatMoney(Math.abs(value))}</span>
    </div>
  );
}

function GoalHeroCard({ goal, progress, settings, totals, onOpenGoal }) {
  return (
    <div className="rounded-3xl p-5 relative overflow-hidden mb-5" style={{ backgroundImage: `linear-gradient(135deg, ${HERO_A}, ${HERO_B})`, boxShadow: `0 16px 40px -14px ${hexToRgba(HERO_B, 0.5)}` }}>
      <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 85% -10%, rgba(255,255,255,0.5), transparent 55%)' }} />
      <p className="text-sm relative" style={{ color: 'rgba(255,255,255,0.75)' }}>Наш общий доход</p>
      <p className="font-mono-num text-3xl font-bold text-white relative">{formatMoney(totals.total)}</p>
      <div className="flex items-center gap-5 mt-3 relative">
        <div className="flex items-center gap-2">
          <PersonStamp letter={settings.p1Name.charAt(0).toUpperCase()} color={P1_COLOR} size="sm" avatar={settings.p1Avatar} />
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{settings.p1Name}</p>
            <p className="font-mono-num text-sm font-semibold text-white">{formatMoney(totals.p1)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PersonStamp letter={settings.p2Name.charAt(0).toUpperCase()} color={P2_COLOR} size="sm" avatar={settings.p2Avatar} />
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{settings.p2Name}</p>
            <p className="font-mono-num text-sm font-semibold text-white">{formatMoney(totals.p2)}</p>
          </div>
        </div>
        {goal && (
          <div className="ml-auto shrink-0">
            {goal.imageDataUrl ? (
              <img src={goal.imageDataUrl} alt="" className="w-14 h-14 object-contain" style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.25))' }} />
            ) : (
              <span className="text-4xl">{goal.emoji}</span>
            )}
          </div>
        )}
      </div>

      {goal ? (
        <button onClick={onOpenGoal} className="w-full text-left mt-4 relative">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-white font-medium truncate pr-2">Цель: {goal.title} {goal.emoji}</span>
            <span className="text-white font-mono-num font-semibold shrink-0">{progress.pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Осталось {formatMoney(progress.remaining)} из {formatMoney(progress.target)}
          </p>
        </button>
      ) : (
        <button onClick={onOpenGoal} className="w-full mt-4 rounded-2xl py-2.5 text-sm font-medium text-white relative" style={{ backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)' }}>
          + Создать цель
        </button>
      )}
    </div>
  );
}

// Плашка «Предположительная выплата аванса/зарплаты» для одного человека (см. computeNextPayout).
function PayoutCard({ card }) {
  const theme = useTheme();
  const Icon = card.type === 'advance' ? Wallet : TrendingUp;
  return (
    <div className="rounded-3xl p-4 relative overflow-hidden" style={theme.panel}>
      <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ backgroundImage: `linear-gradient(160deg, ${hexToRgba(card.color, 0.14)}, transparent 60%)` }} />
      <div className="flex items-center gap-2 mb-2 relative">
        <PersonStamp letter={card.name.charAt(0).toUpperCase()} color={card.color} size="sm" avatar={card.avatar} />
        <span className="text-xs font-medium truncate" style={{ color: theme.textSecondary }}>{card.title}</span>
      </div>
      <div className="flex items-center gap-1.5 relative">
        <Icon size={14} style={{ color: card.color }} />
        <span className="font-mono-num text-lg font-bold" style={{ color: theme.textPrimary }}>{formatMoney(card.amount)}</span>
      </div>
      <p className="text-xs mt-0.5 relative" style={{ color: theme.textTertiary }}>
        {card.type === 'advance' ? 'аванс · часы 1–15' : 'зарплата · часы 16–конец + премии'}
      </p>
    </div>
  );
}

// Модалка «История выплат» — прошлые авансы и зарплаты по обоим людям.
function PayoutHistoryModal({ settings, history, onClose }) {
  const theme = useTheme();
  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: 'rgba(10,10,15,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-md p-5 pb-8 overflow-y-auto rounded-t-3xl" style={{ ...theme.nav, maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(120,120,128,0.3)' }} />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold" style={{ color: theme.textPrimary }}>История выплат</h2>
          <button onClick={onClose} className="p-1" style={{ color: theme.textSecondary }} aria-label="Закрыть"><X size={20} /></button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: theme.textTertiary }}>Пока нет прошлых выплат — появятся после первой смены.</p>
        ) : (
          <div className="rounded-3xl overflow-hidden glass-divide" style={theme.panel}>
            {history.map((h, i) => {
              const name = h.person === 'p1' ? settings.p1Name : settings.p2Name;
              const color = h.person === 'p1' ? P1_COLOR : P2_COLOR;
              const avatar = h.person === 'p1' ? settings.p1Avatar : settings.p2Avatar;
              const dateLabel = `${pad2(h.date.getDate())}.${pad2(h.date.getMonth() + 1)}.${h.date.getFullYear()}`;
              return (
                <div key={`${h.person}-${h.type}-${h.monthKey}-${i}`} className="flex items-center gap-3 px-3.5 py-3">
                  <PersonStamp letter={name.charAt(0).toUpperCase()} color={color} size="sm" avatar={avatar} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: theme.textPrimary }}>{h.type === 'advance' ? 'Аванс' : 'Зарплата'} · {name}</p>
                    <p className="text-xs" style={{ color: theme.textTertiary }}>{dateLabel}</p>
                  </div>
                  <span className="font-mono-num text-sm font-semibold" style={{ color: theme.textPrimary }}>{formatMoney(h.amount)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeView({ goal, progress, onOpenGoal, settings, homeMonth, setHomeMonth, availableMonths, totals, groups, filterPerson, setFilterPerson, onEdit, onDelete, payoutCards, onOpenHistory }) {
  const theme = useTheme();
  const months = useMemo(() => {
    const cur = currentMonthKey();
    return Array.from(new Set([cur, ...availableMonths])).sort().reverse();
  }, [availableMonths]);

  return (
    <div className="pt-1">
      <GoalHeroCard goal={goal} progress={progress} settings={settings} totals={totals} onOpenGoal={onOpenGoal} />

      {/* Плашки «Предположительная выплата аванса/зарплаты» — по одной на человека (п.7 запроса) */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {payoutCards.map((c) => <PayoutCard key={c.person} card={c} />)}
      </div>
      <button
        type="button" onClick={onOpenHistory}
        className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-medium mb-5 transition-all active:scale-95"
        style={theme.well}
      >
        <HistoryIcon size={15} style={{ color: theme.textPrimary }} />
        <span style={{ color: theme.textPrimary }}>История выплат</span>
        <ChevronRight size={15} style={{ color: theme.textSecondary }} />
      </button>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        <FilterChip active={filterPerson === 'all'} onClick={() => setFilterPerson('all')}>Все</FilterChip>
        <FilterChip active={filterPerson === 'p1'} onClick={() => setFilterPerson('p1')} color={P1_COLOR}>{settings.p1Name}</FilterChip>
        <FilterChip active={filterPerson === 'p2'} onClick={() => setFilterPerson('p2')} color={P2_COLOR}>{settings.p2Name}</FilterChip>
        <select
          value={homeMonth}
          onChange={(e) => setHomeMonth(e.target.value)}
          className="ml-auto text-xs rounded-full px-3 py-1.5"
          style={{ ...theme.well, color: theme.textPrimary }}
        >
          <option value="all">Все месяцы</option>
          {months.map((mk) => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
        </select>
      </div>

      {groups.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: theme.textSecondary }}>Записей пока нет.</p>
          <p className="text-sm" style={{ color: theme.textSecondary }}>Нажмите «+», чтобы добавить первую смену.</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.month}>
            <div className="flex items-baseline justify-between mb-2 px-1">
              <h3 className="font-display text-sm font-semibold" style={{ color: theme.textPrimary }}>{g.label}</h3>
              <span className="font-mono-num text-sm" style={{ color: theme.textSecondary }}>{formatMoney(g.total)}</span>
            </div>
            <div className="rounded-3xl overflow-hidden glass-divide" style={theme.panel}>
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

function FilterChip({ active, onClick, children, color }) {
  const theme = useTheme();
  const style = active ? (color ? tintStyle(color, 0.16) : EMPHASIS_DARK) : theme.well;
  const textColor = active ? (color || '#ffffff') : theme.textPrimary;
  return (
    <button onClick={onClick} className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all" style={style}>
      <span style={{ color: textColor }}>{children}</span>
    </button>
  );
}

function ShiftRow({ shift, settings, onEdit, onDelete }) {
  const theme = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const color = shift.person === 'p1' ? P1_COLOR : P2_COLOR;
  const name = shift.person === 'p1' ? settings.p1Name : settings.p2Name;
  const pay = computeShiftPay(shift);
  const weekend = shift.date ? isWeekendDate(shift.date) : false;
  const hasTimes = shift.startTime && shift.endTime;
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <PersonStamp letter={name.charAt(0).toUpperCase()} color={color} size="sm" avatar={shift.person === 'p1' ? settings.p1Avatar : settings.p2Avatar} />
      <button type="button" onClick={onEdit} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="font-mono-num" style={{ color: weekend ? P2_COLOR : theme.textPrimary, fontWeight: weekend ? 600 : 400 }}>
            {formatDateShort(shift.date)} {WEEKDAY_SHORT[dayOfWeek(shift.date)]}
          </span>
          {hasTimes && <span className="text-xs font-mono-num" style={{ color: theme.textSecondary }}>{shift.startTime}–{shift.endTime}</span>}
          {pay.breakHours > 0 && <span className="text-xs font-mono-num" style={{ color: theme.textTertiary }}>−{Math.round(pay.breakHours * 60)} мин</span>}
          {pay.nightBonus > 0 && <Moon size={12} style={{ color: '#818cf8' }} className="shrink-0" />}
          {isHolidayDate(shift.date) && <PartyPopper size={12} style={{ color: '#d97706' }} className="shrink-0" />}
          {shift.truckReception && <Truck size={12} style={{ color: '#d97706' }} className="shrink-0" />}
          {shift.garbageDuty && <Trash size={12} style={{ color: '#d97706' }} className="shrink-0" />}
          {pay.extra !== 0 && <span className="text-xs font-mono-num" style={{ color: '#d97706' }}>{pay.extra > 0 ? '+' : ''}{formatMoney(pay.extra)}</span>}
        </div>
        {shift.note && <p className="text-xs truncate mt-0.5" style={{ color: theme.textTertiary }}>{shift.note}</p>}
      </button>
      <span className="font-mono-num text-sm font-semibold" style={{ color: theme.textPrimary }}>{formatMoney(pay.net)}</span>
      {confirmDelete ? (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onDelete} className="text-xs text-white rounded-full px-2 py-1" style={{ backgroundColor: theme.danger }}>Удалить</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs px-1" style={{ color: theme.textSecondary }}>Нет</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="p-1 shrink-0" style={{ color: theme.textTertiary }} aria-label="Удалить запись">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

function AddFormModal({ form, setForm, settings, onPersonSelect, onSubmit, formError, preview, editingId, onClose }) {
  const theme = useTheme();
  const [showExtra, setShowExtra] = useState(!!(form.extraAmount || form.extraNote));
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const showBreakdown = preview.hours > 0 || preview.extra !== 0;

  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: 'rgba(10,10,15,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-md p-5 pb-8 overflow-y-auto rounded-t-3xl" style={{ ...theme.nav, maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(120,120,128,0.3)' }} />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold" style={{ color: theme.textPrimary }}>{editingId ? 'Изменить смену' : 'Новая смена'}</h2>
          <button onClick={onClose} className="p-1" style={{ color: theme.textSecondary }} aria-label="Закрыть"><X size={20} /></button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => onPersonSelect('p1')} className="flex items-center gap-2 justify-center rounded-2xl py-3 transition-all" style={form.person === 'p1' ? tintStyle(P1_COLOR, 0.14) : theme.well}>
              <PersonStamp letter={settings.p1Name.charAt(0).toUpperCase()} color={P1_COLOR} size="sm" avatar={settings.p1Avatar} />
              <span className="text-sm font-medium" style={{ color: form.person === 'p1' ? P1_COLOR : theme.textPrimary }}>{settings.p1Name}</span>
            </button>
            <button type="button" onClick={() => onPersonSelect('p2')} className="flex items-center gap-2 justify-center rounded-2xl py-3 transition-all" style={form.person === 'p2' ? tintStyle(P2_COLOR, 0.14) : theme.well}>
              <PersonStamp letter={settings.p2Name.charAt(0).toUpperCase()} color={P2_COLOR} size="sm" avatar={settings.p2Avatar} />
              <span className="text-sm font-medium" style={{ color: form.person === 'p2' ? P2_COLOR : theme.textPrimary }}>{settings.p2Name}</span>
            </button>
          </div>

          <div className="rounded-3xl p-4 space-y-4" style={theme.panel}>
            <Field label="Дата смены">
              <DatePickerField value={form.date} onChange={(d) => setForm((f) => ({ ...f, date: d }))} />
            </Field>
            {form.date && (
              <p className="text-xs -mt-2 font-medium" style={{ color: isWeekendDate(form.date) ? P2_COLOR : theme.textTertiary }}>
                {WEEKDAY_FULL[dayOfWeek(form.date)]}{isWeekendDate(form.date) ? ' — премия выходного дня +560 ₽' : ''}
              </p>
            )}
            {form.date && isHolidayDate(form.date) && (
              <p className="text-xs -mt-2 font-medium flex items-center gap-1" style={{ color: '#d97706' }}>
                <PartyPopper size={12} /> Праздничный день — часы не учитываются в премиях «Высокий сезон» и «Любые временные возможности»
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Начало смены">
                <TimeField value={form.startTime} onChange={(v) => setForm((f) => ({ ...f, startTime: v }))} />
              </Field>
              <Field label="Конец смены">
                <TimeField value={form.endTime} onChange={(v) => setForm((f) => ({ ...f, endTime: v }))} />
              </Field>
            </div>
            <div>
              <span className="block text-xs font-medium mb-1.5" style={{ color: theme.textSecondary }}>Перерывы, мин (не оплачиваются)</span>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" inputMode="numeric" min="0" step="5" placeholder="Брейк" aria-label="Брейк, минут" value={form.breakMin} onChange={update('breakMin')} className="w-full rounded-xl px-2 py-2 text-sm font-mono-num text-center" style={{ ...theme.well, color: theme.textPrimary }} />
                <input type="number" inputMode="numeric" min="0" step="5" placeholder="Пятнашка 1" aria-label="Пятнашка 1, минут" value={form.quarter1Min} onChange={update('quarter1Min')} className="w-full rounded-xl px-2 py-2 text-sm font-mono-num text-center" style={{ ...theme.well, color: theme.textPrimary }} />
                <input type="number" inputMode="numeric" min="0" step="5" placeholder="Пятнашка 2" aria-label="Пятнашка 2, минут" value={form.quarter2Min} onChange={update('quarter2Min')} className="w-full rounded-xl px-2 py-2 text-sm font-mono-num text-center" style={{ ...theme.well, color: theme.textPrimary }} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <span className="text-xs text-center" style={{ color: theme.textTertiary }}>Брейк</span>
                <span className="text-xs text-center" style={{ color: theme.textTertiary }}>Пятнашка 1</span>
                <span className="text-xs text-center" style={{ color: theme.textTertiary }}>Пятнашка 2</span>
              </div>
            </div>
            <Field label="Ставка, ₽/ч">
              <input type="number" inputMode="decimal" min="0" step="1" placeholder="231" value={form.rate} onChange={update('rate')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
            </Field>
            {preview.grossHours > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs rounded-xl px-3 py-2" style={theme.well}>
                <span className="font-mono-num" style={{ color: theme.textSecondary }}>{formatHours(preview.grossHours)} по графику</span>
                {preview.breakHours > 0 && <span className="font-mono-num" style={{ color: theme.textSecondary }}>− {formatHours(preview.breakHours)} перерывы</span>}
                <span className="font-mono-num font-semibold" style={{ color: theme.textPrimary }}>= {formatHours(preview.hours)} оплачено</span>
                {preview.night > 0 && (
                  <span className="flex items-center gap-1" style={{ color: '#818cf8' }}>
                    <Moon size={12} /> {formatHours(preview.night)} в ночном окне · {preview.isMajorNight ? '+30% на всю смену' : '+20% на эти часы'}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setForm((f) => ({ ...f, truckReception: !f.truckReception }))} className="flex items-center gap-2 justify-center rounded-2xl py-3 transition-all" style={form.truckReception ? tintStyle('#d97706', 0.14) : theme.well}>
              <Truck size={16} style={{ color: form.truckReception ? '#d97706' : theme.textTertiary }} />
              <span className="text-sm font-medium" style={{ color: form.truckReception ? '#d97706' : theme.textPrimary }}>Приёмка машины</span>
            </button>
            <button type="button" onClick={() => setForm((f) => ({ ...f, garbageDuty: !f.garbageDuty }))} className="flex items-center gap-2 justify-center rounded-2xl py-3 transition-all" style={form.garbageDuty ? tintStyle('#d97706', 0.14) : theme.well}>
              <Trash size={16} style={{ color: form.garbageDuty ? '#d97706' : theme.textTertiary }} />
              <span className="text-sm font-medium" style={{ color: form.garbageDuty ? '#d97706' : theme.textPrimary }}>Выгрузка мусора</span>
            </button>
          </div>

          <button type="button" onClick={() => setShowExtra((v) => !v)} className="flex items-center gap-1 text-xs font-medium" style={{ color: theme.textSecondary }}>
            {showExtra ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Ручная корректировка (необязательно)
          </button>
          {showExtra && (
            <div className="rounded-3xl p-4 space-y-4" style={theme.panel}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Сумма, ₽">
                  <input type="number" inputMode="decimal" step="1" placeholder="0" value={form.extraAmount} onChange={update('extraAmount')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
                </Field>
                <Field label="За что">
                  <input type="text" placeholder="Напр. разовая доплата" value={form.extraNote} onChange={update('extraNote')} className="w-full rounded-xl px-3 py-2 text-sm" style={{ ...theme.well, color: theme.textPrimary }} />
                </Field>
              </div>
              <p className="text-xs" style={{ color: theme.textTertiary }}>Можно указать и отрицательную сумму — для коррекции. Облагается налогом 13%, как и остальные надбавки.</p>
            </div>
          )}

          <Field label="Заметка (необязательно)">
            <textarea rows={2} placeholder="Любые детали смены" value={form.note} onChange={update('note')} className="w-full rounded-xl px-3 py-2 text-sm resize-none" style={{ ...theme.well, color: theme.textPrimary }} />
          </Field>

          {formError && <p className="text-xs font-medium" style={{ color: theme.danger }}>{formError}</p>}

          {showBreakdown && (
            <div className="rounded-3xl overflow-hidden glass-divide" style={theme.panel}>
              {preview.hours > 0 && <LineItem label={`Оплата по ставке (${formatHours(preview.hours)} × ${form.rate || 0}₽)`} value={preview.base} />}
              {preview.nightBonus > 0 && <LineItem label={`Доплата за вечер/ночь (${preview.isMajorNight ? '30%' : '20%'})`} value={preview.nightBonus} accent="indigo" />}
              {preview.reliabilityBonus > 0 && <LineItem label="Премия надёжности (15%)" value={preview.reliabilityBonus} accent="amber" />}
              {preview.weekendBonus > 0 && <LineItem label="Премия выходного дня" value={preview.weekendBonus} accent="amber" />}
              {preview.truckBonus > 0 && <LineItem label="Приёмка машины" value={preview.truckBonus} accent="amber" />}
              {preview.garbageBonus > 0 && <LineItem label="Выгрузка мусора" value={preview.garbageBonus} accent="amber" />}
              {preview.extra !== 0 && <LineItem label={form.extraNote || 'Ручная корректировка'} value={preview.extra} accent="amber" />}
              <LineItem label="НДФЛ 13%" value={-preview.tax} accent="rose" />
            </div>
          )}

          <div className="flex items-center justify-between rounded-3xl px-4 py-3.5" style={EMPHASIS_DARK}>
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>К выплате за смену</span>
            <span className="font-mono-num text-white text-lg font-semibold">{formatMoney(preview.net)}</span>
          </div>

          <p className="text-xs -mt-2" style={{ color: theme.textTertiary }}>Месячные премии (высокий сезон, гибкий график, переработка) и командировочные — во вкладке «Статистика».</p>

          <button type="submit" className="w-full text-white rounded-2xl py-3.5 text-sm font-semibold active:scale-95 transition-transform" style={specularButton(HERO_A, HERO_B)}>
            {editingId ? 'Сохранить изменения' : 'Сохранить смену'}
          </button>
        </form>
      </div>
    </div>
  );
}

function GoalFormModal({ form, setForm, onSubmit, onImage, onClose }) {
  const theme = useTheme();
  const fileRef = useRef(null);
  if (!form) return null;
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const emojiOptions = ['🎯', '🏝', '✈️', '🏡', '🚗', '💍', '🎓', '👶', '🎉'];
  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: 'rgba(10,10,15,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-md p-5 pb-8 overflow-y-auto rounded-t-3xl" style={{ ...theme.nav, maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(120,120,128,0.3)' }} />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold" style={{ color: theme.textPrimary }}>Наша цель</h2>
          <button onClick={onClose} className="p-1" style={{ color: theme.textSecondary }} aria-label="Закрыть"><X size={20} /></button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex items-center justify-center">
            <button type="button" onClick={() => fileRef.current && fileRef.current.click()} className="w-24 h-24 rounded-3xl flex items-center justify-center relative overflow-hidden" style={theme.well}>
              {form.imageDataUrl ? (
                <img src={form.imageDataUrl} alt="" className="w-20 h-20 object-contain" />
              ) : (
                <span className="text-4xl">{form.emoji}</span>
              )}
              <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full flex items-center justify-center" style={specularButton(HERO_A, HERO_B)}>
                <ImagePlus size={12} color="#fff" />
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files && e.target.files[0])} />
          </div>
          <p className="text-xs text-center -mt-2" style={{ color: theme.textTertiary }}>Лучше всего смотрится PNG без фона — как открытка</p>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            {emojiOptions.map((em) => (
              <button
                key={em} type="button" onClick={() => setForm((f) => ({ ...f, emoji: em, imageDataUrl: '' }))}
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                style={form.emoji === em && !form.imageDataUrl ? tintStyle(HERO_B, 0.18) : theme.well}
              >
                {em}
              </button>
            ))}
          </div>

          <Field label="Название цели">
            <input type="text" placeholder="Напр. Отпуск у моря" value={form.title} onChange={update('title')} className="w-full rounded-xl px-3 py-2 text-sm" style={{ ...theme.well, color: theme.textPrimary }} required />
          </Field>
          <Field label="Сумма цели, ₽">
            <input type="number" inputMode="decimal" min="0" step="1000" placeholder="50000" value={form.targetAmount} onChange={update('targetAmount')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
          </Field>
          <Field label="Считать доход начиная с">
            <input type="date" value={form.startDate} onChange={update('startDate')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
          </Field>
          <p className="text-xs" style={{ color: theme.textTertiary }}>Прогресс — это весь чистый доход по сменам с этой даты. Создав новую цель, отсчёт начнётся заново.</p>

          <button type="submit" className="w-full text-white rounded-2xl py-3 text-sm font-semibold" style={specularButton(HERO_A, HERO_B)}>
            Сохранить цель
          </button>
        </form>
      </div>
    </div>
  );
}

function StatCard({ label, value, accentColor, icon: Icon }) {
  const theme = useTheme();
  const c = accentColor || HERO_B;
  return (
    <div className="rounded-3xl p-4 relative overflow-hidden" style={theme.panel}>
      <div className="absolute inset-0 opacity-60 pointer-events-none" style={{ backgroundImage: `linear-gradient(150deg, ${hexToRgba(c, 0.12)}, transparent 65%)` }} />
      <div className="flex items-center justify-between mb-2 relative">
        <p className="text-xs" style={{ color: theme.textSecondary }}>{label}</p>
        {Icon && (
          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: hexToRgba(c, 0.16) }}>
            <Icon size={12} style={{ color: c }} />
          </span>
        )}
      </div>
      <p className="font-mono-num text-xl font-semibold relative" style={{ color: theme.textPrimary }}>{value}</p>
    </div>
  );
}

function PayslipCard({ summary, name, color, avatar }) {
  const theme = useTheme();
  const s = summary;
  return (
    <div className="rounded-3xl overflow-hidden" style={theme.panel}>
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundImage: `linear-gradient(120deg, ${hexToRgba(color, 0.16)}, ${hexToRgba(color, 0.05)})`, borderBottom: `1px solid ${theme.divider}` }}>
        <div className="flex items-center gap-2">
          <PersonStamp letter={name.charAt(0).toUpperCase()} color={color} size="sm" avatar={avatar} />
          <span className="text-sm font-medium" style={{ color: theme.textPrimary }}>{name}</span>
        </div>
        <span className="font-mono-num text-xs" style={{ color: theme.textSecondary }}>{formatHours(s.hours)} · норма {s.norm}ч</span>
      </div>

      <div className="flex items-center justify-between px-4 py-2 text-xs" style={{ color: theme.textSecondary, backgroundColor: theme.dark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)', borderBottom: `1px solid ${theme.divider}` }}>
        <span>Будних дней: {s.wkd}</span>
        <span className="flex items-center gap-1">
          {s.holidays > 0 && <PartyPopper size={12} style={{ color: '#d97706' }} />}
          праздничных: <span className="font-mono-num font-medium" style={{ color: theme.textPrimary }}>{s.holidays}</span> (авто)
        </span>
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
      <div style={{ borderTop: `1px solid ${theme.divider}` }}>
        <LineItem label="Начислено до налога" value={s.taxableGross} bold />
        <LineItem label="НДФЛ 13%" value={-s.tax} accent="rose" />
      </div>

      {s.nonTaxable > 0 && (
        <>
          <div className="px-3.5 pt-2.5 pb-1 text-xs font-medium uppercase tracking-wide" style={{ color: '#059669', backgroundColor: 'rgba(16,185,129,0.08)' }}>Без НДФЛ</div>
          <div className="glass-divide">
            {s.travelBonus > 0 && <LineItem label="Премия «Путешествуй и работай»" value={s.travelBonus} accent="emerald" />}
            {s.perDiem > 0 && <LineItem label={`Командировочные (${s.perDiemDays} дн. × 500₽)`} value={s.perDiem} accent="emerald" />}
          </div>
        </>
      )}

      <div className="flex items-center justify-between px-4 py-3.5" style={specularButton(color, hexToRgba(color, 0.7))}>
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>Итого к выплате</span>
        <span className="font-mono-num text-white text-lg font-semibold">{formatMoney(s.netTotal)}</span>
      </div>
    </div>
  );
}

function StatsView({ agg, settings, shiftsCount, availableMonths, monthSummaries, statsMonth, setStatsMonth, statsScope, setStatsScope, statsPerson, setStatsPerson, onEditPeople }) {
  const theme = useTheme();
  if (shiftsCount === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm" style={{ color: theme.textSecondary }}>Пока нет данных для статистики.</p>
      </div>
    );
  }
  const monthData = monthSummaries[statsMonth];
  const personName = statsPerson === 'p1' ? settings.p1Name : settings.p2Name;
  const personColor = statsPerson === 'p1' ? P1_COLOR : P2_COLOR;
  const personAvatar = statsPerson === 'p1' ? settings.p1Avatar : settings.p2Avatar;
  const donutData = [{ name: 'p1', value: agg.p1 > 0 ? agg.p1 : 0.0001 }, { name: 'p2', value: agg.p2 > 0 ? agg.p2 : 0.0001 }];

  return (
    <div className="pt-1 space-y-5">
      {/* Быстрое редактирование аватарок и имён прямо из статистики (п.2 запроса) */}
      <div className="flex items-center justify-between rounded-3xl p-3" style={theme.panel}>
        <div className="flex items-center -space-x-2">
          <PersonStamp letter={settings.p1Name.charAt(0).toUpperCase()} color={P1_COLOR} size="sm" avatar={settings.p1Avatar} />
          <PersonStamp letter={settings.p2Name.charAt(0).toUpperCase()} color={P2_COLOR} size="sm" avatar={settings.p2Avatar} />
          <span className="text-xs pl-3" style={{ color: theme.textSecondary }}>{settings.p1Name} · {settings.p2Name}</span>
        </div>
        <button type="button" onClick={onEditPeople} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={theme.well} aria-label="Изменить фото и имена">
          <Pencil size={14} style={{ color: theme.textPrimary }} />
        </button>
      </div>

      <div className="flex rounded-2xl p-1" style={theme.well}>
        <button type="button" onClick={() => setStatsScope('month')} className="flex-1 rounded-xl py-2 text-sm font-medium transition-all" style={statsScope === 'month' ? EMPHASIS_DARK : undefined}>
          <span style={{ color: statsScope === 'month' ? '#fff' : theme.textSecondary }}>Месяц</span>
        </button>
        <button type="button" onClick={() => setStatsScope('year')} className="flex-1 rounded-xl py-2 text-sm font-medium transition-all" style={statsScope === 'year' ? EMPHASIS_DARK : undefined}>
          <span style={{ color: statsScope === 'year' ? '#fff' : theme.textSecondary }}>Год</span>
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-sm font-semibold" style={{ color: theme.textPrimary }}>
          {statsScope === 'year' ? statsMonth.slice(0, 4) : monthLabel(statsMonth)}
        </h3>
        <select value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)} className="text-xs rounded-full px-3 py-1.5" style={{ ...theme.well, color: theme.textPrimary }}>
          {availableMonths.map((mk) => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Часы" value={formatHours(agg.hours)} icon={Clock} accentColor={HERO_B} />
        <StatCard label="Доход" value={formatMoney(agg.total)} icon={Wallet} accentColor="#16a34a" />
        <StatCard label="Смены" value={String(agg.count)} icon={Users} accentColor={P1_COLOR} />
        <StatCard label="Ср. за смену" value={formatMoney(agg.avg)} icon={TrendingUp} accentColor={P2_COLOR} />
      </div>

      <div className="rounded-3xl p-4" style={theme.panel}>
        <h3 className="font-display text-sm font-semibold mb-3" style={{ color: theme.textPrimary }}>Доход</h3>
        {agg.total > 0 ? (
          <div className="flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={44} outerRadius={64} paddingAngle={3} stroke="none">
                    <Cell fill={P1_COLOR} />
                    <Cell fill={P2_COLOR} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-mono-num text-sm font-bold" style={{ color: theme.textPrimary }}>{formatMoney(agg.total)}</span>
                <span className="text-xs" style={{ color: theme.textTertiary }}>всего</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: P1_COLOR }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: theme.textSecondary }}>{settings.p1Name}</p>
                  <p className="font-mono-num text-sm font-semibold" style={{ color: theme.textPrimary }}>{formatMoney(agg.p1)}</p>
                </div>
                <span className="text-xs font-mono-num" style={{ color: theme.textTertiary }}>{agg.p1Pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: P2_COLOR }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: theme.textSecondary }}>{settings.p2Name}</p>
                  <p className="font-mono-num text-sm font-semibold" style={{ color: theme.textPrimary }}>{formatMoney(agg.p2)}</p>
                </div>
                <span className="text-xs font-mono-num" style={{ color: theme.textTertiary }}>{agg.p2Pct}%</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-center py-4" style={{ color: theme.textTertiary }}>Нет данных за этот период</p>
        )}
      </div>

      {statsScope === 'month' && monthData && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FilterChip active={statsPerson === 'p1'} onClick={() => setStatsPerson('p1')} color={P1_COLOR}>{settings.p1Name}</FilterChip>
            <FilterChip active={statsPerson === 'p2'} onClick={() => setStatsPerson('p2')} color={P2_COLOR}>{settings.p2Name}</FilterChip>
          </div>
          <PayslipCard summary={monthData[statsPerson]} name={personName} color={personColor} avatar={personAvatar} />
        </div>
      )}
    </div>
  );
}

function UsView({ settings, usPeriod, setUsPeriod, availableMonths, usTotal, homeP1, shiftsCount, monthlyRecord, goal, progress, onOpenGoal, streak, daysTogether, posts, postDraft, setPostDraft, onAddMedia, onRemoveMedia, onPublish, onDeletePost, postBusy }) {
  const theme = useTheme();
  const fileRef = useRef(null);
  const periods = useMemo(() => {
    const cur = currentMonthKey();
    return Array.from(new Set([cur, ...availableMonths])).sort().reverse();
  }, [availableMonths]);

  return (
    <div className="pt-1 space-y-5">
      <div className="rounded-3xl p-5 relative overflow-hidden" style={{ backgroundImage: `linear-gradient(135deg, ${PINK_A}, ${PINK_B})`, boxShadow: `0 16px 40px -14px ${hexToRgba(PINK_B, 0.5)}` }}>
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 90% 0%, rgba(255,255,255,0.6), transparent 55%)' }} />
        <div className="flex items-center gap-1.5 relative">
          <Heart size={14} fill="#fff" color="#fff" />
          <span className="text-sm text-white font-medium">Вместе мы сила!</span>
        </div>
        <p className="font-mono-num text-3xl font-bold text-white mt-1 relative">{formatMoney(usTotal)}</p>
        <div className="flex items-center justify-between mt-1 relative">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {usPeriod === 'all' ? 'заработали за всё время' : `заработали в ${monthLabel(usPeriod).split(' ')[0].toLowerCase()}`}
          </p>
          <select
            value={usPeriod} onChange={(e) => setUsPeriod(e.target.value)}
            className="text-xs rounded-full px-2.5 py-1 shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff' }}
          >
            <option value="all" style={{ color: '#111' }}>Всё время</option>
            {periods.map((mk) => <option key={mk} value={mk} style={{ color: '#111' }}>{monthLabel(mk)}</option>)}
          </select>
        </div>
        <div className="flex items-center -space-x-2 mt-3 relative">
          <PersonStamp letter={settings.p1Name.charAt(0).toUpperCase()} color={P1_COLOR} size="lg" avatar={settings.p1Avatar} />
          <PersonStamp letter={settings.p2Name.charAt(0).toUpperCase()} color={P2_COLOR} size="lg" avatar={settings.p2Avatar} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Смен вместе" value={String(shiftsCount)} icon={Users} accentColor={HERO_B} />
        <StatCard label="Рекорд месяца (смен)" value={String(monthlyRecord)} icon={Award} accentColor="#d97706" />
        <StatCard label="Цель месяца" value={formatMoney(settings.monthlyGoal)} icon={Target} accentColor={P1_COLOR} />
        <StatCard label="На мечту" value={goal ? formatMoney(goal.targetAmount) : '—'} icon={Heart} accentColor={P2_COLOR} />
      </div>

      <button onClick={onOpenGoal} className="w-full rounded-3xl p-4 text-left" style={theme.panel}>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span style={{ color: theme.textPrimary }}>До цели осталось</span>
          <span className="font-mono-num font-semibold" style={{ color: PINK_B }}>{progress.pct}%</span>
        </div>
        <p className="font-mono-num text-lg font-bold mb-2" style={{ color: theme.textPrimary }}>{formatMoney(progress.remaining)}</p>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress.pct}%`, backgroundImage: `linear-gradient(90deg, ${PINK_A}, ${PINK_B})` }} />
        </div>
      </button>

      <div>
        <h3 className="font-display text-sm font-semibold mb-3 px-1" style={{ color: theme.textPrimary }}>Наша история</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl p-4" style={{ ...tintStyle('#f97316', 0.1), border: `1px solid ${hexToRgba('#f97316', 0.2)}` }}>
            <Flame size={18} style={{ color: '#f97316' }} className="mb-2" />
            <p className="font-mono-num text-xl font-bold" style={{ color: theme.textPrimary }}>{streak}</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>дней подряд без пропусков</p>
          </div>
          <div className="rounded-3xl p-4" style={{ ...tintStyle(PINK_B, 0.1), border: `1px solid ${hexToRgba(PINK_B, 0.2)}` }}>
            <Heart size={18} style={{ color: PINK_B }} className="mb-2" fill={PINK_B} />
            <p className="font-mono-num text-xl font-bold" style={{ color: theme.textPrimary }}>{daysTogether}</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>дней с вами в команде</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold mb-3 px-1" style={{ color: theme.textPrimary }}>Наш блог</h3>
        <div className="rounded-3xl p-4 space-y-3" style={theme.panel}>
          <textarea
            rows={2} placeholder="Как прошла поездка?.."
            value={postDraft.text}
            onChange={(e) => setPostDraft((d) => ({ ...d, text: e.target.value }))}
            className="w-full rounded-xl px-3 py-2 text-sm resize-none"
            style={{ ...theme.well, color: theme.textPrimary }}
          />
          {postDraft.media.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {postDraft.media.map((m) => (
                <div key={m.id} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden" style={theme.well}>
                  {m.type === 'video' ? (
                    <video src={m.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button onClick={() => onRemoveMedia(m.id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <X size={10} color="#fff" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current && fileRef.current.click()} disabled={postBusy} className="w-9 h-9 rounded-full flex items-center justify-center" style={theme.well}>
                <ImagePlus size={16} style={{ color: theme.textSecondary }} />
              </button>
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { onAddMedia(e.target.files); e.target.value = ''; }} />
              {postBusy && <span className="text-xs" style={{ color: theme.textTertiary }}>Обработка…</span>}
            </div>
            <button
              type="button" onClick={onPublish}
              disabled={postBusy || (!postDraft.text.trim() && postDraft.media.length === 0)}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              style={specularButton(PINK_A, PINK_B)}
            >
              <Send size={14} /> Опубликовать
            </button>
          </div>
        </div>

        {posts.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: theme.textTertiary }}>Постов пока нет — поделитесь первым моментом</p>
        ) : (
          <div className="space-y-3 mt-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onDelete={() => onDeletePost(post.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, onDelete }) {
  const theme = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="rounded-3xl p-4" style={theme.panel}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs" style={{ color: theme.textTertiary }}>{formatPostDate(post.createdAt)}</span>
        {confirmDelete ? (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onDelete} className="text-xs text-white rounded-full px-2 py-0.5" style={{ backgroundColor: theme.danger }}>Удалить</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-1" style={{ color: theme.textSecondary }}>Нет</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{ color: theme.textTertiary }}><Trash2 size={14} /></button>
        )}
      </div>
      {post.text && <p className="text-sm mb-2" style={{ color: theme.textPrimary }}>{post.text}</p>}
      {post.media.length > 0 && (
        <div className={`grid gap-1.5 rounded-2xl overflow-hidden ${post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.media.map((m) => (
            <div key={m.id} className="aspect-square">
              {m.type === 'video' ? (
                <video src={m.url} className="w-full h-full object-cover" controls />
              ) : (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsModal({ draft, setDraft, onSave, onClose }) {
  const theme = useTheme();
  const update = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const toggle = (key) => () => setDraft((d) => ({ ...d, [key]: !d[key] }));
  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: 'rgba(10,10,15,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-md p-5 pb-8 overflow-y-auto rounded-t-3xl" style={{ ...theme.nav, maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(120,120,128,0.3)' }} />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold" style={{ color: theme.textPrimary }}>Настройки</h2>
          <button onClick={onClose} className="p-1" style={{ color: theme.textSecondary }} aria-label="Закрыть"><X size={20} /></button>
        </div>
        <form onSubmit={onSave} className="space-y-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя (человек 1)">
                <input type="text" value={draft.p1Name} onChange={update('p1Name')} className="w-full rounded-xl px-3 py-2 text-sm" style={{ ...theme.well, color: theme.textPrimary }} />
              </Field>
              <Field label="Ставка, ₽/ч">
                <input type="number" inputMode="decimal" min="0" value={draft.p1Rate} onChange={update('p1Rate')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя (человек 2)">
                <input type="text" value={draft.p2Name} onChange={update('p2Name')} className="w-full rounded-xl px-3 py-2 text-sm" style={{ ...theme.well, color: theme.textPrimary }} />
              </Field>
              <Field label="Ставка, ₽/ч">
                <input type="number" inputMode="decimal" min="0" value={draft.p2Rate} onChange={update('p2Rate')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
              </Field>
            </div>
            <Field label="Цель месяца, ₽ (для вкладки «Мы»)">
              <input type="number" inputMode="decimal" min="0" value={draft.monthlyGoal} onChange={update('monthlyGoal')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
            </Field>
          </div>

          <div className="pt-1" style={{ borderTop: `1px solid ${theme.divider}` }}>
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide mt-4 mb-3" style={{ color: theme.textSecondary }}>
              <Plane size={13} /> Командировка
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Дата начала">
                <input type="date" value={draft.tripStart} onChange={update('tripStart')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
              </Field>
              <Field label="Окончание (если есть)">
                <input type="date" value={draft.tripEnd} onChange={update('tripEnd')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
              </Field>
            </div>
            <div className="rounded-2xl px-3.5 mb-2" style={theme.well}>
              <Toggle checked={!!draft.p1OnTrip} onChange={toggle('p1OnTrip')} label={`${draft.p1Name || 'Человек 1'} в командировке`} />
            </div>
            <div className="rounded-2xl px-3.5" style={theme.well}>
              <Toggle checked={!!draft.p2OnTrip} onChange={toggle('p2OnTrip')} label={`${draft.p2Name || 'Человек 2'} в командировке`} />
            </div>
            <p className="text-xs mt-2" style={{ color: theme.textTertiary }}>Командировочные (500₽/день) и премия «Путешествуй и работай» считаются по этим датам, независимо от смен.</p>
          </div>

          <div className="pt-1" style={{ borderTop: `1px solid ${theme.divider}` }}>
            <div className="text-xs font-medium uppercase tracking-wide mt-4 mb-3" style={{ color: theme.textSecondary }}>Перерывы по умолчанию</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Брейк, мин">
                <input type="number" inputMode="numeric" min="0" step="5" value={draft.defaultBreakMin} onChange={update('defaultBreakMin')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
              </Field>
              <Field label="Каждая пятнашка, мин">
                <input type="number" inputMode="numeric" min="0" step="5" value={draft.defaultQuarterMin} onChange={update('defaultQuarterMin')} className="w-full rounded-xl px-3 py-2 text-sm font-mono-num" style={{ ...theme.well, color: theme.textPrimary }} />
              </Field>
            </div>
          </div>

          <button type="submit" className="w-full text-white rounded-2xl py-3 text-sm font-semibold mt-2" style={specularButton(HERO_A, HERO_B)}>
            Сохранить настройки
          </button>
        </form>
      </div>
    </div>
  );
}

// Строка с фото + именем одного человека — используется в PeopleEditModal.
function PersonAvatarEditor({ label, name, onNameChange, avatar, color, onPickPhoto }) {
  const theme = useTheme();
  const fileRef = useRef(null);
  return (
    <div className="flex items-center gap-3 rounded-2xl p-3" style={theme.well}>
      <button
        type="button"
        onClick={() => fileRef.current && fileRef.current.click()}
        className="relative shrink-0"
        aria-label={`Сменить фото — ${label}`}
      >
        <PersonStamp letter={(name || label).charAt(0).toUpperCase()} color={color} size="lg" avatar={avatar} />
        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={specularButton(HERO_A, HERO_B)}>
          <Camera size={11} color="#fff" />
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onPickPhoto(e.target.files && e.target.files[0]); e.target.value = ''; }} />
      <div className="flex-1 min-w-0">
        <span className="block text-xs font-medium mb-1" style={{ color: theme.textSecondary }}>{label}</span>
        <input
          type="text" value={name} onChange={(e) => onNameChange(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={{ backgroundColor: theme.dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.85)', color: theme.textPrimary, border: `1px solid ${theme.divider}` }}
        />
      </div>
    </div>
  );
}

// Модалка «Фото и имена», открывается иконкой карандаша во вкладке «Статистика» (п.2 запроса).
function PeopleEditModal({ draft, setDraft, onSave, onClose, onPhoto, busy }) {
  const theme = useTheme();
  if (!draft) return null;
  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: 'rgba(10,10,15,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-md p-5 pb-8 overflow-y-auto rounded-t-3xl" style={{ ...theme.nav, maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(120,120,128,0.3)' }} />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold" style={{ color: theme.textPrimary }}>Фото и имена</h2>
          <button onClick={onClose} className="p-1" style={{ color: theme.textSecondary }} aria-label="Закрыть"><X size={20} /></button>
        </div>
        <form onSubmit={onSave} className="space-y-3">
          <PersonAvatarEditor
            label="Человек 1" name={draft.p1Name} avatar={draft.p1Avatar} color={P1_COLOR}
            onNameChange={(v) => setDraft((d) => ({ ...d, p1Name: v }))}
            onPickPhoto={(f) => onPhoto('p1', f)}
          />
          <PersonAvatarEditor
            label="Человек 2" name={draft.p2Name} avatar={draft.p2Avatar} color={P2_COLOR}
            onNameChange={(v) => setDraft((d) => ({ ...d, p2Name: v }))}
            onPickPhoto={(f) => onPhoto('p2', f)}
          />
          {busy && <p className="text-xs" style={{ color: theme.textTertiary }}>Обработка фото…</p>}
          <button type="submit" className="w-full text-white rounded-2xl py-3 text-sm font-semibold mt-2" style={specularButton(HERO_A, HERO_B)}>
            Сохранить
          </button>
        </form>
      </div>
    </div>
  );
}

function CalendarGrid({ monthKey, grid, dayPeople, settings, onPrev, onNext, onSelectDate, selectedDate }) {
  const theme = useTheme();
  const today = todayStr();
  return (
    <div className="rounded-3xl p-4" style={theme.panel}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-base font-semibold" style={{ color: theme.textPrimary }}>{monthLabel(monthKey)}</h3>
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="w-7 h-7 rounded-full flex items-center justify-center" style={theme.well}><ChevronLeft size={14} style={{ color: theme.textPrimary }} /></button>
          <button onClick={onNext} className="w-7 h-7 rounded-full flex items-center justify-center" style={theme.well}><ChevronRight size={14} style={{ color: theme.textPrimary }} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 mb-1">
        {WEEKDAY_MON_FIRST.map((d) => (
          <div key={d} className="text-center text-xs font-medium" style={{ color: theme.textTertiary }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1.5">
        {grid.map((cell, i) => {
          const people = cell.dateStr ? dayPeople[cell.dateStr] : null;
          const isToday = cell.dateStr === today;
          const isSelected = !!selectedDate && cell.dateStr === selectedDate;
          const holiday = cell.dateStr && isHolidayDate(cell.dateStr);
          return (
            // Клик по дню сразу создаёт смену/запись на эту дату (п.6 запроса) — если передан onSelectDate.
            <button
              type="button" key={i} disabled={!cell.dateStr}
              onClick={() => cell.dateStr && onSelectDate && onSelectDate(cell.dateStr)}
              className="flex flex-col items-center justify-center gap-0.5"
              style={{ height: 34, cursor: cell.dateStr && onSelectDate ? 'pointer' : 'default' }}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono-num"
                style={{
                  color: !cell.current ? theme.textTertiary : holiday ? '#e11d48' : theme.textPrimary,
                  fontWeight: holiday ? 700 : 400,
                  ...(isToday ? { backgroundColor: hexToRgba(HERO_B, 0.16), fontWeight: 700, color: HERO_B } : {}),
                  ...(isSelected ? { ...specularButton(HERO_A, HERO_B), color: '#fff', fontWeight: 700 } : {}),
                }}
              >
                {cell.day}
              </span>
              <div className="flex items-center gap-0.5" style={{ height: 5 }}>
                {holiday && !(people && people.size) && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#e11d48' }} />}
                {people && people.has('p1') && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: P1_COLOR }} />}
                {people && people.has('p2') && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: P2_COLOR }} />}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 flex-wrap" style={{ borderTop: `1px solid ${theme.divider}` }}>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: P1_COLOR }} />
          <span className="text-xs" style={{ color: theme.textSecondary }}>{settings.p1Name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: P2_COLOR }} />
          <span className="text-xs" style={{ color: theme.textSecondary }}>{settings.p2Name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#e11d48' }} />
          <span className="text-xs" style={{ color: theme.textSecondary }}>праздник</span>
        </div>
        {onSelectDate && <span className="text-xs ml-auto" style={{ color: theme.textTertiary }}>нажмите на день →</span>}
      </div>
    </div>
  );
}

function NextShiftCard({ shift, settings }) {
  const theme = useTheme();
  if (!shift) {
    return (
      <div className="rounded-3xl p-4" style={theme.panel}>
        <h3 className="font-display text-sm font-semibold mb-1" style={{ color: theme.textPrimary }}>Ближайшая смена</h3>
        <p className="text-sm" style={{ color: theme.textTertiary }}>В расписании пока ничего не запланировано</p>
      </div>
    );
  }
  const color = shift.person === 'p1' ? P1_COLOR : P2_COLOR;
  const name = shift.person === 'p1' ? settings.p1Name : settings.p2Name;
  const isToday = shift.date === todayStr();
  const label = isToday ? `Сегодня, ${formatDateShort(shift.date)}` : formatDateShort(shift.date);
  return (
    <div className="rounded-3xl p-4" style={theme.panel}>
      <h3 className="font-display text-sm font-semibold mb-3" style={{ color: theme.textPrimary }}>Ближайшая смена</h3>
      <div className="flex items-center gap-3">
        <PersonStamp letter={name.charAt(0).toUpperCase()} color={color} size="md" avatar={shift.person === 'p1' ? settings.p1Avatar : settings.p2Avatar} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color }}>{label} {WEEKDAY_SHORT[dayOfWeek(shift.date)]}</p>
          <p className="font-mono-num text-sm" style={{ color: theme.textPrimary }}>{shift.startTime}–{shift.endTime}</p>
          {shift.note && <p className="text-xs mt-0.5" style={{ color: theme.textTertiary }}>{shift.note}</p>}
        </div>
        {nightHoursOf(shift.startTime, shift.endTime) > 0 && <Moon size={16} style={{ color: '#818cf8' }} />}
      </div>
    </div>
  );
}

function ScheduleView({ entries, settings, form, setForm, onSubmit, error, editingId, onCancelEdit, onEdit, onDelete, filterPerson, setFilterPerson, calendarMonth, setCalendarMonth, calendarGrid, calendarDayPeople, nextShift, onExportICS, onPickDate }) {
  const theme = useTheme();
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
      <CalendarGrid
        monthKey={calendarMonth}
        grid={calendarGrid}
        dayPeople={calendarDayPeople}
        settings={settings}
        onPrev={() => setCalendarMonth(addMonths(calendarMonth, -1))}
        onNext={() => setCalendarMonth(addMonths(calendarMonth, 1))}
        onSelectDate={onPickDate}
        selectedDate={form.date}
      />

      <NextShiftCard shift={nextShift} settings={settings} />

      <button type="button" onClick={onExportICS} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium" style={theme.well}>
        <Download size={15} style={{ color: theme.textPrimary }} />
        <span style={{ color: theme.textPrimary }}>Экспорт в Apple Calendar (.ics)</span>
      </button>
      <p className="text-xs -mt-3 px-1" style={{ color: theme.textTertiary }}>
        Скачает файл со всеми сменами из расписания — откройте его на iPhone, и Календарь предложит их добавить.
      </p>

      <div>
        <h3 className="font-display text-sm font-semibold mb-3 px-1" style={{ color: theme.textPrimary }}>
          {editingId ? 'Изменить запись' : 'Добавить в расписание'}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          {editingId && (
            <div className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs" style={{ ...tintStyle('#d97706', 0.1), color: theme.dark ? '#fbbf24' : '#92400e' }}>
              <span>Редактирование записи расписания</span>
              <button type="button" onClick={onCancelEdit} className="underline font-medium">Отменить</button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button" onClick={() => setForm((f) => ({ ...f, person: 'p1' }))}
              className="flex items-center gap-2 justify-center rounded-2xl py-2.5 transition-all"
              style={form.person === 'p1' ? tintStyle(P1_COLOR, 0.14) : theme.well}
            >
              <PersonStamp letter={settings.p1Name.charAt(0).toUpperCase()} color={P1_COLOR} size="sm" avatar={settings.p1Avatar} />
              <span className="text-sm font-medium" style={{ color: form.person === 'p1' ? P1_COLOR : theme.textPrimary }}>{settings.p1Name}</span>
            </button>
            <button
              type="button" onClick={() => setForm((f) => ({ ...f, person: 'p2' }))}
              className="flex items-center gap-2 justify-center rounded-2xl py-2.5 transition-all"
              style={form.person === 'p2' ? tintStyle(P2_COLOR, 0.14) : theme.well}
            >
              <PersonStamp letter={settings.p2Name.charAt(0).toUpperCase()} color={P2_COLOR} size="sm" avatar={settings.p2Avatar} />
              <span className="text-sm font-medium" style={{ color: form.person === 'p2' ? P2_COLOR : theme.textPrimary }}>{settings.p2Name}</span>
            </button>
          </div>
          <div className="rounded-3xl p-4 space-y-3" style={theme.panel}>
            {/* Дата теперь выбирается кликом по календарю выше — своя, не системная (п.6 запроса) */}
            <div className="flex items-center justify-between rounded-xl px-3 py-2" style={theme.well}>
              <span className="text-xs" style={{ color: theme.textSecondary }}>Дата записи</span>
              <span className="font-mono-num text-sm font-semibold" style={{ color: isWeekendDate(form.date) ? P2_COLOR : theme.textPrimary }}>
                {form.date ? `${formatDateShort(form.date)} ${WEEKDAY_SHORT[dayOfWeek(form.date)]}` : '—'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Начало">
                <TimeField value={form.startTime} onChange={(v) => setForm((f) => ({ ...f, startTime: v }))} />
              </Field>
              <Field label="Конец">
                <TimeField value={form.endTime} onChange={(v) => setForm((f) => ({ ...f, endTime: v }))} />
              </Field>
            </div>
            <Field label="Заметка (необязательно)">
              <input type="text" placeholder="Напр. подработка, замена" value={form.note} onChange={update('note')} className="w-full rounded-xl px-3 py-2 text-sm" style={{ ...theme.well, color: theme.textPrimary }} />
            </Field>
          </div>
          {error && <p className="text-xs font-medium" style={{ color: theme.danger }}>{error}</p>}
          <button type="submit" className="w-full text-white rounded-2xl py-3 text-sm font-semibold active:scale-95 transition-transform" style={specularButton(HERO_A, HERO_B)}>
            {editingId ? 'Сохранить изменения' : 'Добавить в расписание'}
          </button>
        </form>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pt-1">
        <FilterChip active={filterPerson === 'all'} onClick={() => setFilterPerson('all')}>Все</FilterChip>
        <FilterChip active={filterPerson === 'p1'} onClick={() => setFilterPerson('p1')} color={P1_COLOR}>{settings.p1Name}</FilterChip>
        <FilterChip active={filterPerson === 'p2'} onClick={() => setFilterPerson('p2')} color={P2_COLOR}>{settings.p2Name}</FilterChip>
      </div>

      {groups.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: theme.textSecondary }}>В расписании пока пусто.</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.month}>
            <h3 className="font-display text-sm font-semibold mb-2 px-1" style={{ color: theme.textPrimary }}>{g.label}</h3>
            <div className="rounded-3xl overflow-hidden glass-divide" style={theme.panel}>
              {g.items.map((entry) => {
                const color = entry.person === 'p1' ? P1_COLOR : P2_COLOR;
                const name = entry.person === 'p1' ? settings.p1Name : settings.p2Name;
                const weekend = isWeekendDate(entry.date);
                return (
                  <div key={entry.id} className="flex items-center gap-3 px-3.5 py-3">
                    <PersonStamp letter={name.charAt(0).toUpperCase()} color={color} size="sm" avatar={entry.person === 'p1' ? settings.p1Avatar : settings.p2Avatar} />
                    <button type="button" onClick={() => onEdit(entry)} className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-mono-num" style={{ color: weekend ? P2_COLOR : theme.textPrimary, fontWeight: weekend ? 600 : 400 }}>
                          {formatDateShort(entry.date)} {WEEKDAY_SHORT[dayOfWeek(entry.date)]}
                        </span>
                        <span className="text-xs font-mono-num" style={{ color: theme.textSecondary }}>{entry.startTime}–{entry.endTime}</span>
                      </div>
                      {entry.note && <p className="text-xs truncate mt-0.5" style={{ color: theme.textTertiary }}>{entry.note}</p>}
                    </button>
                    <button onClick={() => onDelete(entry.id)} className="p-1 shrink-0" style={{ color: theme.textTertiary }} aria-label="Удалить запись">
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
  );
}