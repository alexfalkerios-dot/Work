import {
  TAX_RATE, RELIABILITY_RATE, NIGHT_MINOR_RATE, NIGHT_MAJOR_RATE,
  HIGH_SEASON_THRESHOLD, HIGH_SEASON_BONUS, FLEX_BONUS_CAP, WEEKEND_BONUS,
  TRAVEL_WORK_BONUS, PER_DIEM_RATE, OT_TIER1_HOURS, OT_TIER1_MULT, OT_TIER2_MULT,
  TRUCK_BONUS, GARBAGE_BONUS,
  DEFAULT_SETTINGS,
  pad2, formatMoney, formatHours, formatDateShort,
  monthLabel, monthShortLabel, dayOfWeek, isWeekendDate,
  daysInMonth, weekdaysInMonth, monthBounds, diffDaysInclusive,
  monthRange, toMinutes, shiftHoursOf, nightHoursOf,
  normalizeShift, normalizeScheduleEntry, computeShiftPay,
  perDiemDaysForMonth, isFullMonthInTrip, computeMonthSummary,
} from './workUtils.js';

// =====================================================================
// 1. Date / time utility functions
// =====================================================================

describe('pad2', () => {
  it('pads single digit to two characters', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(0)).toBe('00');
    expect(pad2(9)).toBe('09');
  });
  it('leaves two-digit numbers unchanged', () => {
    expect(pad2(10)).toBe('10');
    expect(pad2(12)).toBe('12');
    expect(pad2(99)).toBe('99');
  });
});

describe('formatMoney', () => {
  it('formats positive numbers with ruble sign', () => {
    expect(formatMoney(1000)).toMatch(/1\s?000 ₽/);
  });
  it('returns 0 ₽ for NaN / undefined', () => {
    expect(formatMoney(NaN)).toBe('0 ₽');
    expect(formatMoney(undefined)).toBe('0 ₽');
    expect(formatMoney(Infinity)).toBe('0 ₽');
  });
  it('rounds to nearest integer', () => {
    expect(formatMoney(99.6)).toMatch(/100 ₽/);
    expect(formatMoney(99.4)).toMatch(/99 ₽/);
  });
});

describe('formatHours', () => {
  it('formats hours with ч suffix', () => {
    expect(formatHours(8)).toMatch(/8 ч/);
  });
  it('handles fractional hours', () => {
    expect(formatHours(1.5)).toMatch(/1,5 ч/);
  });
  it('returns 0 ч for non-finite values', () => {
    expect(formatHours(NaN)).toMatch(/0 ч/);
    expect(formatHours(undefined)).toMatch(/0 ч/);
  });
});

describe('formatDateShort', () => {
  it('converts YYYY-MM-DD to DD.MM', () => {
    expect(formatDateShort('2026-07-03')).toBe('03.07');
    expect(formatDateShort('2026-12-25')).toBe('25.12');
  });
});

describe('monthLabel', () => {
  it('returns full month name with year', () => {
    expect(monthLabel('2026-01')).toBe('Январь 2026');
    expect(monthLabel('2026-12')).toBe('Декабрь 2026');
    expect(monthLabel('2026-06')).toBe('Июнь 2026');
  });
});

describe('monthShortLabel', () => {
  it('returns short month name with two-digit year', () => {
    expect(monthShortLabel('2026-01')).toBe('янв 26');
    expect(monthShortLabel('2026-06')).toBe('июн 26');
  });
});

describe('dayOfWeek', () => {
  it('returns null for falsy input', () => {
    expect(dayOfWeek('')).toBeNull();
    expect(dayOfWeek(null)).toBeNull();
    expect(dayOfWeek(undefined)).toBeNull();
  });
  it('returns correct day of week (0=Sun, 6=Sat)', () => {
    // 2026-07-03 is a Friday
    expect(dayOfWeek('2026-07-03')).toBe(5);
    // 2026-07-04 is a Saturday
    expect(dayOfWeek('2026-07-04')).toBe(6);
    // 2026-07-05 is a Sunday
    expect(dayOfWeek('2026-07-05')).toBe(0);
  });
});

describe('isWeekendDate', () => {
  it('returns true for Saturday', () => {
    expect(isWeekendDate('2026-07-04')).toBe(true);
  });
  it('returns true for Sunday', () => {
    expect(isWeekendDate('2026-07-05')).toBe(true);
  });
  it('returns false for weekdays', () => {
    expect(isWeekendDate('2026-07-03')).toBe(false); // Friday
    expect(isWeekendDate('2026-07-06')).toBe(false); // Monday
  });
});

describe('daysInMonth', () => {
  it('returns correct days for various months', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29); // leap year
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 6)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('weekdaysInMonth', () => {
  it('counts weekdays correctly', () => {
    // July 2026: 31 days, starts on Wednesday
    // Weekdays: 23
    expect(weekdaysInMonth(2026, 7)).toBe(23);
  });
  it('handles February in a leap year', () => {
    // Feb 2024: 29 days, starts Thursday → 21 weekdays
    expect(weekdaysInMonth(2024, 2)).toBe(21);
  });
  it('handles February in a non-leap year', () => {
    // Feb 2026: 28 days, starts Sunday → 20 weekdays
    expect(weekdaysInMonth(2026, 2)).toBe(20);
  });
});

describe('monthBounds', () => {
  it('returns first and last day of month', () => {
    const { start, end } = monthBounds('2026-07');
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(31);
  });
  it('handles February', () => {
    const { start, end } = monthBounds('2026-02');
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(28);
  });
});

describe('diffDaysInclusive', () => {
  it('returns 1 for same day', () => {
    const d = new Date(2026, 6, 1);
    expect(diffDaysInclusive(d, d)).toBe(1);
  });
  it('returns correct count for a range', () => {
    const a = new Date(2026, 6, 1);
    const b = new Date(2026, 6, 10);
    expect(diffDaysInclusive(a, b)).toBe(10);
  });
});

describe('monthRange', () => {
  it('returns single month for same start/end', () => {
    expect(monthRange('2026-07', '2026-07')).toEqual(['2026-07']);
  });
  it('generates correct range within a year', () => {
    expect(monthRange('2026-06', '2026-09')).toEqual([
      '2026-06', '2026-07', '2026-08', '2026-09',
    ]);
  });
  it('crosses year boundary', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual([
      '2026-11', '2026-12', '2027-01', '2027-02',
    ]);
  });
  it('returns empty array when start > end', () => {
    expect(monthRange('2027-01', '2026-12')).toEqual([]);
  });
});

describe('toMinutes', () => {
  it('converts HH:MM to total minutes', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('01:30')).toBe(90);
    expect(toMinutes('22:00')).toBe(1320);
    expect(toMinutes('23:59')).toBe(1439);
  });
});

// =====================================================================
// 2. Shift hours and night hours
// =====================================================================

describe('shiftHoursOf', () => {
  it('returns 0 for missing times', () => {
    expect(shiftHoursOf('', '08:00')).toBe(0);
    expect(shiftHoursOf('08:00', '')).toBe(0);
    expect(shiftHoursOf('', '')).toBe(0);
  });
  it('calculates normal day shift', () => {
    expect(shiftHoursOf('08:00', '16:00')).toBe(8);
    expect(shiftHoursOf('09:00', '18:00')).toBe(9);
  });
  it('handles overnight shift (end < start)', () => {
    expect(shiftHoursOf('22:00', '06:00')).toBe(8);
    expect(shiftHoursOf('20:00', '04:00')).toBe(8);
  });
  it('handles short shift', () => {
    expect(shiftHoursOf('10:00', '10:30')).toBeCloseTo(0.5);
  });
  it('handles 24-hour shift (end equals start wraps to 24h)', () => {
    // When end <= start, adds 24h, so 00:00 to 00:00 = 24h
    expect(shiftHoursOf('00:00', '00:00')).toBe(24);
  });
});

describe('nightHoursOf', () => {
  it('returns 0 for missing times', () => {
    expect(nightHoursOf('', '08:00')).toBe(0);
    expect(nightHoursOf('08:00', '')).toBe(0);
  });
  it('returns 0 for pure daytime shift', () => {
    expect(nightHoursOf('08:00', '16:00')).toBe(0);
    expect(nightHoursOf('09:00', '17:00')).toBe(0);
  });
  it('calculates night hours for evening shift ending before midnight', () => {
    // 20:00-23:00: night window 22:00-08:00 → 1 hour overlap (22:00-23:00)
    expect(nightHoursOf('20:00', '23:00')).toBe(1);
  });
  it('calculates night hours for overnight shift', () => {
    // 22:00-06:00: entirely in night window → 8 hours
    expect(nightHoursOf('22:00', '06:00')).toBe(8);
  });
  it('calculates night hours for shift starting before night window', () => {
    // 18:00-02:00: night portion = 22:00-02:00 = 4 hours
    expect(nightHoursOf('18:00', '02:00')).toBe(4);
  });
  it('calculates night hours for early morning shift', () => {
    // 04:00-10:00: night portion = 04:00-08:00 = 4 hours
    expect(nightHoursOf('04:00', '10:00')).toBe(4);
  });
});

// =====================================================================
// 3. normalizeShift
// =====================================================================

describe('normalizeShift', () => {
  it('defaults person to p1 for unknown value', () => {
    const s = normalizeShift({ date: '2026-07-01' });
    expect(s.person).toBe('p1');
  });
  it('preserves p2', () => {
    const s = normalizeShift({ person: 'p2', date: '2026-07-01' });
    expect(s.person).toBe('p2');
  });
  it('sets legacyHours to 0 when startTime is present', () => {
    const s = normalizeShift({ date: '2026-07-01', startTime: '08:00', endTime: '16:00', hours: 10 });
    expect(s.legacyHours).toBe(0);
  });
  it('preserves legacyHours when no startTime', () => {
    const s = normalizeShift({ date: '2026-07-01', hours: 10 });
    expect(s.legacyHours).toBe(10);
  });
  it('falls back bonus to extraAmount', () => {
    const s = normalizeShift({ date: '2026-07-01', bonus: 500 });
    expect(s.extraAmount).toBe(500);
  });
  it('prefers extraAmount over bonus', () => {
    const s = normalizeShift({ date: '2026-07-01', extraAmount: 300, bonus: 500 });
    expect(s.extraAmount).toBe(300);
  });
  it('falls back bonusNote to extraNote', () => {
    const s = normalizeShift({ date: '2026-07-01', bonusNote: 'test' });
    expect(s.extraNote).toBe('test');
  });
  it('generates an id if missing', () => {
    const s = normalizeShift({ date: '2026-07-01' });
    expect(s.id).toBe('generated-id');
  });
  it('preserves existing id', () => {
    const s = normalizeShift({ id: 'abc-123', date: '2026-07-01' });
    expect(s.id).toBe('abc-123');
  });
  it('defaults break fields to 0', () => {
    const s = normalizeShift({ date: '2026-07-01' });
    expect(s.breakMin).toBe(0);
    expect(s.quarter1Min).toBe(0);
    expect(s.quarter2Min).toBe(0);
  });
  it('preserves break fields when provided', () => {
    const s = normalizeShift({ date: '2026-07-01', breakMin: 60, quarter1Min: 15, quarter2Min: 15 });
    expect(s.breakMin).toBe(60);
    expect(s.quarter1Min).toBe(15);
    expect(s.quarter2Min).toBe(15);
  });
  it('defaults truckReception and garbageDuty to false', () => {
    const s = normalizeShift({ date: '2026-07-01' });
    expect(s.truckReception).toBe(false);
    expect(s.garbageDuty).toBe(false);
  });
  it('preserves truckReception and garbageDuty when provided', () => {
    const s = normalizeShift({ date: '2026-07-01', truckReception: true, garbageDuty: true });
    expect(s.truckReception).toBe(true);
    expect(s.garbageDuty).toBe(true);
  });
});

// =====================================================================
// 3b. normalizeScheduleEntry
// =====================================================================

describe('normalizeScheduleEntry', () => {
  it('defaults person to p1', () => {
    const e = normalizeScheduleEntry({ date: '2026-07-01' });
    expect(e.person).toBe('p1');
  });
  it('preserves p2', () => {
    const e = normalizeScheduleEntry({ person: 'p2', date: '2026-07-01' });
    expect(e.person).toBe('p2');
  });
  it('defaults optional fields', () => {
    const e = normalizeScheduleEntry({ date: '2026-07-01' });
    expect(e.startTime).toBe('');
    expect(e.endTime).toBe('');
    expect(e.note).toBe('');
    expect(e.id).toBe('generated-id');
  });
  it('preserves provided fields', () => {
    const e = normalizeScheduleEntry({ id: 'x', date: '2026-07-01', person: 'p1', startTime: '08:00', endTime: '16:00', note: 'test' });
    expect(e.id).toBe('x');
    expect(e.startTime).toBe('08:00');
    expect(e.endTime).toBe('16:00');
    expect(e.note).toBe('test');
  });
});

// =====================================================================
// 4. computeShiftPay
// =====================================================================

describe('computeShiftPay', () => {
  const makeShift = (overrides) => ({
    date: '2026-07-06', // Monday
    startTime: '08:00',
    endTime: '16:00',
    rate: 231,
    extraAmount: 0,
    ...overrides,
  });

  it('calculates base pay: hours * rate (no breaks)', () => {
    const pay = computeShiftPay(makeShift());
    expect(pay.grossHours).toBe(8);
    expect(pay.breakHours).toBe(0);
    expect(pay.hours).toBe(8);
    expect(pay.base).toBe(8 * 231);
  });

  it('deducts break time from paid hours', () => {
    const pay = computeShiftPay(makeShift({ breakMin: 60 }));
    expect(pay.grossHours).toBe(8);
    expect(pay.breakHours).toBe(1);
    expect(pay.hours).toBe(7);
    expect(pay.base).toBe(7 * 231);
  });

  it('deducts combined break + quarters from paid hours', () => {
    const pay = computeShiftPay(makeShift({ breakMin: 60, quarter1Min: 15, quarter2Min: 15 }));
    expect(pay.grossHours).toBe(8);
    expect(pay.breakHours).toBe(1.5);
    expect(pay.hours).toBe(6.5);
    expect(pay.base).toBeCloseTo(6.5 * 231);
  });

  it('clamps hours to 0 when breaks exceed shift duration', () => {
    const pay = computeShiftPay(makeShift({ breakMin: 600 }));
    expect(pay.hours).toBe(0);
    expect(pay.base).toBe(0);
  });

  it('scales night hours proportionally with breaks', () => {
    // 22:00-06:00 = 8h gross, all 8h night, with 60 min break → 7h paid, night = 8*(7/8) = 7
    const pay = computeShiftPay(makeShift({ startTime: '22:00', endTime: '06:00', breakMin: 60 }));
    expect(pay.grossHours).toBe(8);
    expect(pay.hours).toBe(7);
    expect(pay.night).toBeCloseTo(8 * (7 / 8));
  });

  it('calculates reliability bonus at 15%', () => {
    const pay = computeShiftPay(makeShift());
    expect(pay.reliabilityBonus).toBeCloseTo(8 * 231 * 0.15);
  });

  it('applies no night bonus for daytime shift', () => {
    const pay = computeShiftPay(makeShift());
    expect(pay.night).toBe(0);
    expect(pay.nightBonus).toBe(0);
    expect(pay.isMajorNight).toBe(false);
  });

  it('applies minor night bonus (20%) when < half of shift is at night', () => {
    // 18:00-02:00 = 8h total, 4h night (exactly half, not > half → minor), no breaks
    const pay = computeShiftPay(makeShift({ startTime: '18:00', endTime: '02:00' }));
    expect(pay.grossHours).toBe(8);
    expect(pay.hours).toBe(8);
    expect(pay.night).toBe(4);
    expect(pay.isMajorNight).toBe(false);
    expect(pay.nightBonus).toBeCloseTo(4 * 231 * 0.20);
  });

  it('applies major night bonus (30%) when > half of shift is at night', () => {
    // 22:00-06:00 = 8h total, 8h night (all night → major), no breaks
    const pay = computeShiftPay(makeShift({ startTime: '22:00', endTime: '06:00' }));
    expect(pay.grossHours).toBe(8);
    expect(pay.hours).toBe(8);
    expect(pay.night).toBe(8);
    expect(pay.isMajorNight).toBe(true);
    expect(pay.nightBonus).toBeCloseTo(8 * 231 * 0.30);
  });

  it('applies weekend bonus on Saturday', () => {
    const pay = computeShiftPay(makeShift({ date: '2026-07-04' })); // Saturday
    expect(pay.weekendBonus).toBe(560);
  });

  it('applies weekend bonus on Sunday', () => {
    const pay = computeShiftPay(makeShift({ date: '2026-07-05' })); // Sunday
    expect(pay.weekendBonus).toBe(560);
  });

  it('no weekend bonus on weekday', () => {
    const pay = computeShiftPay(makeShift({ date: '2026-07-06' })); // Monday
    expect(pay.weekendBonus).toBe(0);
  });

  it('applies truck bonus when truckReception is true', () => {
    const pay = computeShiftPay(makeShift({ truckReception: true }));
    expect(pay.truckBonus).toBe(1150);
  });
  it('no truck bonus when truckReception is false', () => {
    const pay = computeShiftPay(makeShift({ truckReception: false }));
    expect(pay.truckBonus).toBe(0);
  });
  it('no truck bonus when hours are 0', () => {
    const pay = computeShiftPay({ date: '2026-07-06', startTime: '', endTime: '', legacyHours: 0, rate: 231, truckReception: true, extraAmount: 0 });
    expect(pay.truckBonus).toBe(0);
  });
  it('applies garbage bonus when garbageDuty is true', () => {
    const pay = computeShiftPay(makeShift({ garbageDuty: true }));
    expect(pay.garbageBonus).toBe(100);
  });
  it('no garbage bonus when garbageDuty is false', () => {
    const pay = computeShiftPay(makeShift({ garbageDuty: false }));
    expect(pay.garbageBonus).toBe(0);
  });
  it('includes truck and garbage bonuses in taxable total', () => {
    const pay = computeShiftPay(makeShift({ truckReception: true, garbageDuty: true }));
    const payNone = computeShiftPay(makeShift());
    expect(pay.taxable).toBe(payNone.taxable + 1150 + 100);
  });

  it('includes extra amount in taxable total', () => {
    const pay = computeShiftPay(makeShift({ extraAmount: 1000 }));
    const payNoExtra = computeShiftPay(makeShift({ extraAmount: 0 }));
    expect(pay.extra).toBe(1000);
    expect(pay.taxable).toBe(payNoExtra.taxable + 1000);
  });

  it('computes tax as 13% of taxable', () => {
    const pay = computeShiftPay(makeShift());
    expect(pay.tax).toBeCloseTo(pay.taxable * 0.13);
  });

  it('net = taxable - tax', () => {
    const pay = computeShiftPay(makeShift());
    expect(pay.net).toBeCloseTo(pay.taxable - pay.tax);
  });

  it('handles legacy hours (no start/end time)', () => {
    const pay = computeShiftPay({
      date: '2026-07-06',
      startTime: '',
      endTime: '',
      legacyHours: 10,
      rate: 200,
      extraAmount: 0,
    });
    expect(pay.grossHours).toBe(10);
    expect(pay.hours).toBe(10);
    expect(pay.night).toBe(0);
    expect(pay.base).toBe(2000);
  });

  it('returns zero pay for zero hours and zero extra', () => {
    const pay = computeShiftPay({
      date: '2026-07-06',
      startTime: '',
      endTime: '',
      legacyHours: 0,
      rate: 231,
      extraAmount: 0,
    });
    expect(pay.hours).toBe(0);
    expect(pay.base).toBe(0);
    expect(pay.taxable).toBe(0);
    expect(pay.net).toBe(0);
  });

  it('full calculation for a standard weekday 8h daytime shift at rate 231', () => {
    const pay = computeShiftPay(makeShift());
    const expectedBase = 8 * 231; // 1848
    const expectedReliability = expectedBase * 0.15; // 277.2
    const expectedTaxable = expectedBase + expectedReliability; // 2125.2
    const expectedTax = expectedTaxable * 0.13; // 276.276
    const expectedNet = expectedTaxable - expectedTax; // 1848.924
    expect(pay.base).toBe(expectedBase);
    expect(pay.reliabilityBonus).toBeCloseTo(expectedReliability);
    expect(pay.taxable).toBeCloseTo(expectedTaxable);
    expect(pay.tax).toBeCloseTo(expectedTax);
    expect(pay.net).toBeCloseTo(expectedNet);
  });
});

// =====================================================================
// 5. Business trip functions
// =====================================================================

describe('perDiemDaysForMonth', () => {
  it('returns 0 when no trip start', () => {
    expect(perDiemDaysForMonth('2026-07', '', '')).toBe(0);
  });

  it('counts full month when trip covers entire month', () => {
    // Trip: June 1 to Aug 31, month = July → 31 days
    expect(perDiemDaysForMonth('2026-07', '2026-06-01', '2026-08-31')).toBe(31);
  });

  it('counts partial month when trip starts mid-month', () => {
    // Trip starts June 11, month = June → 11th to 30th = 20 days
    expect(perDiemDaysForMonth('2026-06', '2026-06-11', '')).toBe(20);
  });

  it('counts partial month when trip ends mid-month', () => {
    // Trip: June 1 to July 15, month = July → 1st to 15th = 15 days
    expect(perDiemDaysForMonth('2026-07', '2026-06-01', '2026-07-15')).toBe(15);
  });

  it('returns 0 when trip is entirely before the month', () => {
    expect(perDiemDaysForMonth('2026-08', '2026-06-01', '2026-07-15')).toBe(0);
  });

  it('returns 0 when trip is entirely after the month', () => {
    expect(perDiemDaysForMonth('2026-05', '2026-06-11', '2026-08-31')).toBe(0);
  });

  it('handles open-ended trip (no end date) covering full month', () => {
    // Trip starts June 1, no end, month = July → all 31 days
    expect(perDiemDaysForMonth('2026-07', '2026-06-01', '')).toBe(31);
  });
});

describe('isFullMonthInTrip', () => {
  it('returns false when no trip start', () => {
    expect(isFullMonthInTrip('2026-07', '', '')).toBe(false);
  });

  it('returns true when entire month is within trip', () => {
    expect(isFullMonthInTrip('2026-07', '2026-06-01', '2026-08-31')).toBe(true);
  });

  it('returns false when trip starts after month start', () => {
    // Trip starts July 2, month = July → not fully covered
    expect(isFullMonthInTrip('2026-07', '2026-07-02', '2026-08-31')).toBe(false);
  });

  it('returns false when trip ends before month end', () => {
    // Trip ends July 15, month = July (31 days) → not fully covered
    expect(isFullMonthInTrip('2026-07', '2026-06-01', '2026-07-15')).toBe(false);
  });

  it('returns true for open-ended trip starting before month', () => {
    expect(isFullMonthInTrip('2026-07', '2026-06-01', '')).toBe(true);
  });

  it('returns true when trip starts exactly on month start', () => {
    expect(isFullMonthInTrip('2026-07', '2026-07-01', '2026-08-15')).toBe(true);
  });

  it('returns true when trip ends exactly on month end', () => {
    expect(isFullMonthInTrip('2026-07', '2026-06-01', '2026-07-31')).toBe(true);
  });
});

// =====================================================================
// 6. computeMonthSummary
// =====================================================================

describe('computeMonthSummary', () => {
  const settings = {
    p1Name: 'Test1',
    p2Name: 'Test2',
    p1Rate: 231,
    p2Rate: 215,
    tripStart: '',
    tripEnd: '',
    p1OnTrip: false,
    p2OnTrip: false,
  };

  it('returns zero totals when no shifts exist', () => {
    const s = computeMonthSummary('2026-07', 'p1', [], settings, {});
    expect(s.hours).toBe(0);
    expect(s.base).toBe(0);
    expect(s.netTotal).toBe(0);
    expect(s.shiftsCount).toBe(0);
  });

  it('filters shifts by person and month', () => {
    const shifts = [
      { person: 'p1', date: '2026-07-06', startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0 },
      { person: 'p2', date: '2026-07-06', startTime: '08:00', endTime: '16:00', rate: 215, extraAmount: 0 },
      { person: 'p1', date: '2026-08-06', startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0 },
    ];
    const s = computeMonthSummary('2026-07', 'p1', shifts, settings, {});
    expect(s.shiftsCount).toBe(1);
    expect(s.hours).toBe(8);
  });

  it('calculates norm based on weekdays minus holidays', () => {
    const meta = { '2026-07': { holidays: 2 } };
    const s = computeMonthSummary('2026-07', 'p1', [], settings, meta);
    // July 2026 has 23 weekdays, minus 2 holidays = 21, norm = 21*8 = 168
    expect(s.wkd).toBe(23);
    expect(s.holidays).toBe(2);
    expect(s.norm).toBe(168);
  });

  it('awards high season bonus when hours > 120', () => {
    // Create enough shifts to exceed 120 hours
    const shifts = [];
    // 16 shifts of 8h each = 128h (weekday dates in July 2026)
    const weekdays = [];
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-07-${pad2(d)}`;
      if (!isWeekendDate(dateStr)) weekdays.push(dateStr);
    }
    weekdays.slice(0, 16).forEach((date) => {
      shifts.push({ person: 'p1', date, startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0 });
    });
    const s = computeMonthSummary('2026-07', 'p1', shifts, settings, {});
    expect(s.hours).toBe(128);
    expect(s.highSeasonBonus).toBe(7000);
  });

  it('does not award high season bonus when hours <= 120', () => {
    // 15 shifts of 8h each = 120h (exactly at threshold, not above)
    const shifts = [];
    const weekdays = [];
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-07-${pad2(d)}`;
      if (!isWeekendDate(dateStr)) weekdays.push(dateStr);
    }
    weekdays.slice(0, 15).forEach((date) => {
      shifts.push({ person: 'p1', date, startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0 });
    });
    const s = computeMonthSummary('2026-07', 'p1', shifts, settings, {});
    expect(s.hours).toBe(120);
    expect(s.highSeasonBonus).toBe(0);
  });

  it('calculates flex bonus proportionally to hours/norm', () => {
    // 10 shifts of 8h = 80h; norm for July = 23*8=184
    const shifts = [];
    const weekdays = [];
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-07-${pad2(d)}`;
      if (!isWeekendDate(dateStr)) weekdays.push(dateStr);
    }
    weekdays.slice(0, 10).forEach((date) => {
      shifts.push({ person: 'p1', date, startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0 });
    });
    const s = computeMonthSummary('2026-07', 'p1', shifts, settings, {});
    expect(s.flexBonus).toBeCloseTo((80 / 184) * 15000);
  });

  it('caps flex bonus at 15000 when hours >= norm', () => {
    // Create enough shifts to meet or exceed norm (184h for July 2026)
    const shifts = [];
    const weekdays = [];
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-07-${pad2(d)}`;
      if (!isWeekendDate(dateStr)) weekdays.push(dateStr);
    }
    // 23 weekdays * 8h = 184h = exactly norm
    weekdays.forEach((date) => {
      shifts.push({ person: 'p1', date, startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0 });
    });
    const s = computeMonthSummary('2026-07', 'p1', shifts, settings, {});
    expect(s.flexBonus).toBe(15000);
  });

  it('calculates overtime premium with two tiers', () => {
    // norm = 184h for July 2026 (23 weekdays * 8h)
    // We need hours > norm. Use 24 shifts of 8h = 192h → 8h overtime
    // First 2h at 0.5x rate, remaining 6h at 1.0x rate
    const shifts = [];
    const allDays = [];
    for (let d = 1; d <= 31; d++) {
      allDays.push(`2026-07-${pad2(d)}`);
    }
    // Use 24 days
    allDays.slice(0, 24).forEach((date) => {
      shifts.push({ person: 'p1', date, startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0 });
    });
    const s = computeMonthSummary('2026-07', 'p1', shifts, settings, {});
    expect(s.hours).toBe(192);
    expect(s.otHours).toBe(8);
    const expectedOT = 2 * 231 * 0.5 + 6 * 231 * 1.0;
    expect(s.overtimePremium).toBeCloseTo(expectedOT);
  });

  it('includes travel bonus when full month in trip', () => {
    const tripSettings = {
      ...settings,
      tripStart: '2026-06-01',
      tripEnd: '2026-08-31',
      p1OnTrip: true,
    };
    const s = computeMonthSummary('2026-07', 'p1', [], tripSettings, {});
    expect(s.travelBonus).toBe(3000);
  });

  it('does not include travel bonus when month not fully in trip', () => {
    const tripSettings = {
      ...settings,
      tripStart: '2026-07-15',
      tripEnd: '2026-08-31',
      p1OnTrip: true,
    };
    const s = computeMonthSummary('2026-07', 'p1', [], tripSettings, {});
    expect(s.travelBonus).toBe(0);
  });

  it('calculates per diem days and amount', () => {
    const tripSettings = {
      ...settings,
      tripStart: '2026-07-01',
      tripEnd: '2026-07-15',
      p1OnTrip: true,
    };
    const s = computeMonthSummary('2026-07', 'p1', [], tripSettings, {});
    expect(s.perDiemDays).toBe(15);
    expect(s.perDiem).toBe(15 * 500);
  });

  it('does not include trip bonuses when person is not on trip', () => {
    const tripSettings = {
      ...settings,
      tripStart: '2026-06-01',
      tripEnd: '2026-08-31',
      p1OnTrip: false,
    };
    const s = computeMonthSummary('2026-07', 'p1', [], tripSettings, {});
    expect(s.travelBonus).toBe(0);
    expect(s.perDiemDays).toBe(0);
    expect(s.perDiem).toBe(0);
  });

  it('non-taxable income not subject to tax', () => {
    const tripSettings = {
      ...settings,
      tripStart: '2026-06-01',
      tripEnd: '2026-08-31',
      p1OnTrip: true,
    };
    const s = computeMonthSummary('2026-07', 'p1', [], tripSettings, {});
    // netTotal = netTaxable + nonTaxable
    // nonTaxable should be travelBonus + perDiem
    expect(s.nonTaxable).toBe(s.travelBonus + s.perDiem);
    expect(s.netTotal).toBe(s.netTaxable + s.nonTaxable);
    // Tax should only apply to taxableGross, not to nonTaxable
    expect(s.tax).toBeCloseTo(s.taxableGross * TAX_RATE);
  });

  it('aggregates multiple shifts for same person in same month', () => {
    const shifts = [
      { person: 'p1', date: '2026-07-06', startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0 },
      { person: 'p1', date: '2026-07-07', startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 100 },
    ];
    const s = computeMonthSummary('2026-07', 'p1', shifts, settings, {});
    expect(s.shiftsCount).toBe(2);
    expect(s.hours).toBe(16);
    expect(s.extra).toBe(100);
  });

  it('aggregates truck and garbage bonuses across shifts', () => {
    const shifts = [
      { person: 'p1', date: '2026-07-06', startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0, truckReception: true, garbageDuty: false },
      { person: 'p1', date: '2026-07-07', startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0, truckReception: false, garbageDuty: true },
      { person: 'p1', date: '2026-07-08', startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0, truckReception: true, garbageDuty: true },
    ];
    const s = computeMonthSummary('2026-07', 'p1', shifts, settings, {});
    expect(s.truckBonus).toBe(1150 * 2);
    expect(s.truckCount).toBe(2);
    expect(s.garbageBonus).toBe(100 * 2);
    expect(s.garbageCount).toBe(2);
  });

  it('includes truck and garbage bonuses in taxableGross', () => {
    const shifts = [
      { person: 'p1', date: '2026-07-06', startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0, truckReception: true, garbageDuty: true },
    ];
    const s = computeMonthSummary('2026-07', 'p1', shifts, settings, {});
    const sNoBonus = computeMonthSummary('2026-07', 'p1', [
      { person: 'p1', date: '2026-07-06', startTime: '08:00', endTime: '16:00', rate: 231, extraAmount: 0 },
    ], settings, {});
    expect(s.taxableGross).toBe(sNoBonus.taxableGross + 1150 + 100);
  });
});

// =====================================================================
// 7. Constants verification
// =====================================================================

describe('constants', () => {
  it('TAX_RATE is 13%', () => {
    expect(TAX_RATE).toBe(0.13);
  });
  it('RELIABILITY_RATE is 15%', () => {
    expect(RELIABILITY_RATE).toBe(0.15);
  });
  it('NIGHT_MINOR_RATE is 20%', () => {
    expect(NIGHT_MINOR_RATE).toBe(0.20);
  });
  it('NIGHT_MAJOR_RATE is 30%', () => {
    expect(NIGHT_MAJOR_RATE).toBe(0.30);
  });
  it('HIGH_SEASON_THRESHOLD is 120', () => {
    expect(HIGH_SEASON_THRESHOLD).toBe(120);
  });
  it('HIGH_SEASON_BONUS is 7000', () => {
    expect(HIGH_SEASON_BONUS).toBe(7000);
  });
  it('FLEX_BONUS_CAP is 15000', () => {
    expect(FLEX_BONUS_CAP).toBe(15000);
  });
  it('WEEKEND_BONUS is 560', () => {
    expect(WEEKEND_BONUS).toBe(560);
  });
  it('TRAVEL_WORK_BONUS is 3000', () => {
    expect(TRAVEL_WORK_BONUS).toBe(3000);
  });
  it('PER_DIEM_RATE is 500', () => {
    expect(PER_DIEM_RATE).toBe(500);
  });
  it('OT_TIER1_HOURS is 2', () => {
    expect(OT_TIER1_HOURS).toBe(2);
  });
  it('OT_TIER1_MULT is 0.5', () => {
    expect(OT_TIER1_MULT).toBe(0.5);
  });
  it('OT_TIER2_MULT is 1.0', () => {
    expect(OT_TIER2_MULT).toBe(1.0);
  });
  it('TRUCK_BONUS is 1150', () => {
    expect(TRUCK_BONUS).toBe(1150);
  });
  it('GARBAGE_BONUS is 100', () => {
    expect(GARBAGE_BONUS).toBe(100);
  });
  it('DEFAULT_SETTINGS has expected shape', () => {
    expect(DEFAULT_SETTINGS).toHaveProperty('p1Name');
    expect(DEFAULT_SETTINGS).toHaveProperty('p2Name');
    expect(DEFAULT_SETTINGS).toHaveProperty('p1Rate');
    expect(DEFAULT_SETTINGS).toHaveProperty('p2Rate');
    expect(DEFAULT_SETTINGS).toHaveProperty('tripStart');
    expect(DEFAULT_SETTINGS).toHaveProperty('p1OnTrip');
    expect(DEFAULT_SETTINGS).toHaveProperty('p2OnTrip');
    expect(DEFAULT_SETTINGS).toHaveProperty('defaultBreakMin');
    expect(DEFAULT_SETTINGS).toHaveProperty('defaultQuarterMin');
    expect(DEFAULT_SETTINGS.defaultBreakMin).toBe(60);
    expect(DEFAULT_SETTINGS.defaultQuarterMin).toBe(15);
  });
});
