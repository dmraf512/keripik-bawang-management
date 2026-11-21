export function formatIDR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatNumberID(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('id-ID').format(safe);
}

function parseDateLocal(isoDate: string): Date | null {
  if (!isoDate) return null;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateID(isoDate: string): string {
  if (!isoDate) return '-';
  const parsed = parseDateLocal(isoDate);
  if (!parsed) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(baseIso: string, days: number): string {
  const date = parseDateLocal(baseIso) ?? new Date();
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isWithinDateFilter(
  dateStr: string,
  period: 'today' | '7d' | 'month' | 'year'
): boolean {
  const target = parseDateLocal(dateStr);
  if (!target) return false;

  const now = new Date();
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'today') {
    return targetDay.getTime() === today.getTime();
  }
  if (period === '7d') {
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    return targetDay >= sevenDaysAgo && targetDay <= today;
  }
  if (period === 'month') {
    return (
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth()
    );
  }
  return target.getFullYear() === now.getFullYear();
}

export function isCashOutflowType(transactionType: string): boolean {
  const t = (transactionType || '').toLowerCase();
  return (
    t.includes('out') ||
    t.includes('keluar') ||
    t.includes('expense') ||
    t.includes('withdraw') ||
    t.includes('purchase') ||
    t.includes('tarik') ||
    t.includes('debit') ||
    t.includes('pengeluaran') ||
    t.includes('pembelian')
  );
}

export function isCapitalWithdrawalType(transactionType: string): boolean {
  const t = (transactionType || '').toLowerCase();
  return t.includes('tarik') || t.includes('withdraw') || t.includes('prive');
}

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];

  // UTF-8 BOM for clean Excel compatibility in Indonesian Windows/Mac locales
  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
