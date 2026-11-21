import React, { useMemo, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import {
  downloadCSV,
  formatDateID,
  formatIDR,
  isCapitalWithdrawalType,
  isCashOutflowType,
  isWithinDateFilter,
} from '../utils/formatters';

type ReportType =
  | 'harian'
  | 'mingguan'
  | 'bulanan'
  | 'tahunan'
  | 'laba-rugi'
  | 'arus-kas';

const REPORT_TYPES: { id: ReportType; label: string; subtitle: string }[] = [
  { id: 'harian', label: 'Laporan Harian', subtitle: 'Ringkasan aktivitas hari ini' },
  { id: 'mingguan', label: 'Laporan Mingguan', subtitle: 'Rekapitulasi 7 hari terakhir' },
  { id: 'bulanan', label: 'Laporan Bulanan', subtitle: 'Rekapitulasi bulan berjalan' },
  { id: 'tahunan', label: 'Laporan Tahunan', subtitle: 'Akumulasi tahun berjalan' },
  { id: 'laba-rugi', label: 'Laporan Laba Rugi', subtitle: 'Performa pendapatan & biaya' },
  { id: 'arus-kas', label: 'Laporan Arus Kas', subtitle: 'Posisi kas masuk & kas keluar' },
];

export const ReportsPage: React.FC = () => {
  const { db } = useBusinessData();
  const [reportType, setReportType] = useState<ReportType>('bulanan');

  const profile = db.businessProfiles[0];
  const businessName =
    profile?.business_name || 'Keripik Bawang — Usaha Keluarga';

  const cashAccountMap = useMemo(
    () => new Map(db.cashAccounts.map((a) => [a.id, a])),
    [db.cashAccounts]
  );

  const computed = useMemo(() => {
    const periodMap: Record<ReportType, 'today' | '7d' | 'month' | 'year'> = {
      harian: 'today',
      mingguan: '7d',
      bulanan: 'month',
      tahunan: 'year',
      'laba-rugi': 'month',
      'arus-kas': 'year',
    };
    const period = periodMap[reportType];

    const payments = db.orderPayments.filter((p) =>
      isWithinDateFilter(p.payment_date, period)
    );
    const expenses = db.expenses.filter((e) =>
      isWithinDateFilter(e.expense_date, period)
    );
    const purchasePayments = db.purchasePayments.filter((pp) =>
      isWithinDateFilter(pp.payment_date, period)
    );
    const batches = db.productionBatches.filter((b) =>
      isWithinDateFilter(b.production_date, period)
    );
    const cashTxPeriod = db.cashTransactions.filter((tx) =>
      isWithinDateFilter(tx.transaction_date, period)
    );

    const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const totalExpense =
      expenses.reduce((s, e) => s + Number(e.amount), 0) +
      purchasePayments.reduce((s, pp) => s + Number(pp.amount), 0);

    const totalModal = db.capitalTransactions.reduce((s, c) => {
      return isCapitalWithdrawalType(c.transaction_type)
        ? s - Number(c.amount)
        : s + Number(c.amount);
    }, 0);

    const batchIds = new Set(batches.map((b) => b.id));
    const batchMaterialCost = db.productionMaterials
      .filter((m) => batchIds.has(m.batch_id))
      .reduce((s, m) => s + Number(m.total_cost), 0);
    const batchExtraCost = db.productionCostItems
      .filter((c) => batchIds.has(c.batch_id))
      .reduce((s, c) => s + Number(c.amount), 0);
    const productionCostTotal = batchMaterialCost + batchExtraCost;

    const cashMaterialOutflow =
      expenses
        .filter((e) => {
          const cat = e.category.toLowerCase();
          return cat.includes('bahan') || cat.includes('kemasan');
        })
        .reduce((s, e) => s + Number(e.amount), 0) +
      purchasePayments.reduce((s, pp) => s + Number(pp.amount), 0);

    const cogs = productionCostTotal > 0 ? productionCostTotal : cashMaterialOutflow;
    const cogsFromProduction = productionCostTotal > 0;
    const operational = Math.max(0, totalExpense - cashMaterialOutflow);
    const grossProfit = totalRevenue - cogs;
    const netProfit = totalRevenue - totalExpense;

    // Arus Kas metrics from cash_transactions & cash_accounts
    let cashInflow = 0;
    let cashOutflow = 0;
    cashTxPeriod.forEach((tx) => {
      const amt = Number(tx.amount);
      if (isCashOutflowType(tx.transaction_type)) {
        cashOutflow += amt;
      } else {
        cashInflow += amt;
      }
    });

    const accountBalances = new Map<string, number>();
    db.cashTransactions.forEach((tx) => {
      const cur = accountBalances.get(tx.cash_account_id) ?? 0;
      const amt = Number(tx.amount);
      accountBalances.set(
        tx.cash_account_id,
        isCashOutflowType(tx.transaction_type) ? cur - amt : cur + amt
      );
    });
    const totalCashBalance = Array.from(accountBalances.values()).reduce(
      (a, b) => a + b,
      0
    );

    return {
      payments,
      expenses,
      purchasePayments,
      cashTxPeriod,
      totalRevenue,
      totalExpense,
      totalModal,
      cogs,
      cogsFromProduction,
      operational,
      grossProfit,
      netProfit,
      cashInflow,
      cashOutflow,
      netCashFlow: cashInflow - cashOutflow,
      accountBalances,
      totalCashBalance,
    };
  }, [db, reportType]);

  const activeMeta = REPORT_TYPES.find((r) => r.id === reportType)!;

  const handleExportCSV = () => {
    if (reportType === 'arus-kas') {
      const headers = [
        'Tanggal',
        'Akun Kas',
        'Jenis Transaksi',
        'Keterangan',
        'Nominal (IDR)',
      ];
      const rows: (string | number)[][] = computed.cashTxPeriod.map((tx) => {
        const isOut = isCashOutflowType(tx.transaction_type);
        return [
          tx.transaction_date,
          cashAccountMap.get(tx.cash_account_id)?.account_name ?? '-',
          tx.transaction_type,
          tx.description || tx.notes || '-',
          isOut ? -Number(tx.amount) : Number(tx.amount),
        ];
      });
      rows.push(['', 'RINGKASAN', 'Total Kas Masuk', '', computed.cashInflow]);
      rows.push(['', 'RINGKASAN', 'Total Kas Keluar', '', -computed.cashOutflow]);
      rows.push(['', 'RINGKASAN', 'Arus Kas Bersih', '', computed.netCashFlow]);
      downloadCSV(`keripik-bawang-arus-kas.csv`, headers, rows);
      return;
    }

    const headers = ['Tanggal', 'Jenis', 'Kategori / Metode', 'Keterangan', 'Nominal (IDR)'];
    const rows: (string | number)[][] = [
      ...computed.payments.map((p) => [
        p.payment_date,
        'Pemasukan',
        p.payment_method,
        p.notes || 'Pembayaran Pesanan',
        Number(p.amount),
      ]),
      ...computed.expenses.map((e) => [
        e.expense_date,
        'Pengeluaran',
        e.category,
        e.description,
        -Number(e.amount),
      ]),
      ...computed.purchasePayments.map((pp) => [
        pp.payment_date,
        'Pembayaran Bahan',
        pp.payment_method,
        pp.notes || 'Pembayaran Pembelian Bahan',
        -Number(pp.amount),
      ]),
    ];

    rows.push(['', 'RINGKASAN', 'Total Pendapatan', '', computed.totalRevenue]);
    rows.push(['', 'RINGKASAN', 'Biaya Produksi / Bahan (HPP)', '', computed.cogs]);
    rows.push(['', 'RINGKASAN', 'Total Pengeluaran Kas', '', computed.totalExpense]);
    rows.push(['', 'RINGKASAN', 'Laba Bersih', '', computed.netProfit]);

    downloadCSV(`keripik-bawang-${reportType}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
            Laporan Bisnis & Keuangan
          </h2>
          <p className="mt-0.5 text-sm text-[#6F574A]">
            Disiapkan oleh Administrator untuk diserahkan kepada Pemilik Usaha (Ibu).
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[#D9CBB8] bg-white text-[#362015] hover:bg-[#FAF6F0] transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Ekspor Excel (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Ekspor PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 no-print">
        {REPORT_TYPES.map((r) => {
          const active = reportType === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setReportType(r.id)}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                active
                  ? 'bg-[#362015] border-[#362015] text-[#FDFBF7]'
                  : 'bg-white border-[#E5D9C8] text-[#2B1B12] hover:bg-[#FAF6F0]'
              }`}
            >
              <div className="text-xs font-semibold">{r.label}</div>
              <div
                className={`mt-0.5 text-[11px] ${
                  active ? 'text-[#D8B25C]' : 'text-[#8A7163]'
                }`}
              >
                {r.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-[#E5D9C8] rounded-xl p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="pb-5 border-b border-[#EFE6DA] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-[#8C6518]">
              {businessName}
              {profile?.brand_name ? ` · ${profile.brand_name}` : ''}
            </div>
            <h3 className="mt-1 text-xl font-display font-semibold text-[#2B1B12]">
              {activeMeta.label}
            </h3>
            <p className="mt-0.5 text-xs text-[#6F574A]">{activeMeta.subtitle}</p>
          </div>
          <div className="text-xs text-[#6F574A] sm:text-right">
            <div>Disiapkan oleh: Administrator</div>
            <div>Penerima: Ibu (Pemilik Usaha)</div>
          </div>
        </div>

        {reportType === 'arus-kas' ? (
          <>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#6F574A]">
                Ringkasan Arus Kas (Tahun Berjalan)
              </h4>
              <div className="divide-y divide-[#F5EFE6] border border-[#EFE6DA] rounded-lg px-4 text-xs">
                <div className="py-3 flex justify-between">
                  <span className="text-[#2B1B12]">Total Kas Masuk (Penjualan & Modal)</span>
                  <span className="font-semibold text-[#1E6B43] tabular-nums">
                    + {formatIDR(computed.cashInflow)}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-[#6F574A]">
                    Total Kas Keluar (Pengeluaran, Belanja Bahan & Penarikan)
                  </span>
                  <span className="tabular-nums text-[#B4382A]">
                    - {formatIDR(computed.cashOutflow)}
                  </span>
                </div>
                <div className="py-3.5 flex justify-between font-semibold text-sm">
                  <span className="text-[#2B1B12]">Arus Kas Bersih Periode Ini</span>
                  <span
                    className={`tabular-nums ${
                      computed.netCashFlow >= 0 ? 'text-[#1E6B43]' : 'text-[#B4382A]'
                    }`}
                  >
                    {formatIDR(computed.netCashFlow)}
                  </span>
                </div>
                <div className="py-3 flex justify-between text-[#6F574A]">
                  <span>Total Saldo Seluruh Akun Kas</span>
                  <span className="font-semibold tabular-nums text-[#2B1B12]">
                    {formatIDR(computed.totalCashBalance)}
                  </span>
                </div>
              </div>
            </div>

            {db.cashAccounts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#6F574A]">
                  Saldo per Akun Kas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {db.cashAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-3.5 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA]"
                    >
                      <div className="text-[11px] text-[#7A6154]">
                        {acc.account_type}
                        {acc.account_number ? ` · ${acc.account_number}` : ''}
                      </div>
                      <div className="text-xs font-semibold text-[#2B1B12] mt-0.5">
                        {acc.account_name}
                      </div>
                      <div className="mt-2 text-sm font-semibold tabular-nums text-[#362015]">
                        {formatIDR(computed.accountBalances.get(acc.id) ?? 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#6F574A]">
                Mutasi Buku Kas ({computed.cashTxPeriod.length} entri)
              </h4>
              {computed.cashTxPeriod.length === 0 ? (
                <p className="text-xs text-[#8A7163] py-6 text-center border border-dashed border-[#E5D9C8] rounded-lg">
                  Belum ada mutasi kas pada tabel cash_transactions untuk tahun berjalan.
                </p>
              ) : (
                <div className="overflow-x-auto border border-[#EFE6DA] rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Akun Kas</th>
                        <th className="py-2.5 px-3">Jenis</th>
                        <th className="py-2.5 px-3">Keterangan</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5EFE6] text-xs">
                      {computed.cashTxPeriod.map((tx) => {
                        const isOut = isCashOutflowType(tx.transaction_type);
                        return (
                          <tr key={tx.id}>
                            <td className="py-2.5 px-3 tabular-nums text-[#5E3A28] whitespace-nowrap">
                              {formatDateID(tx.transaction_date)}
                            </td>
                            <td className="py-2.5 px-3 text-[#2B1B12]">
                              {cashAccountMap.get(tx.cash_account_id)?.account_name ?? '-'}
                            </td>
                            <td
                              className={`py-2.5 px-3 font-medium ${
                                isOut ? 'text-[#B4382A]' : 'text-[#1E6B43]'
                              }`}
                            >
                              {tx.transaction_type}
                            </td>
                            <td className="py-2.5 px-3 text-[#2B1B12]">
                              {tx.description || tx.notes || '-'}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right tabular-nums font-medium whitespace-nowrap ${
                                isOut ? 'text-[#B4382A]' : 'text-[#1E6B43]'
                              }`}
                            >
                              {isOut ? '-' : '+'} {formatIDR(Number(tx.amount))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#6F574A]">
                Ringkasan Finansial
              </h4>
              <div className="divide-y divide-[#F5EFE6] border border-[#EFE6DA] rounded-lg px-4 text-xs">
                <div className="py-3 flex justify-between">
                  <span className="text-[#2B1B12]">Total Pendapatan Penjualan</span>
                  <span className="font-semibold text-[#1E6B43] tabular-nums">
                    {formatIDR(computed.totalRevenue)}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-[#6F574A]">
                    {computed.cogsFromProduction
                      ? 'Biaya Produksi Aktual / HPP (Bahan & Biaya Batch)'
                      : 'Biaya Bahan Baku & Kemasan'}
                  </span>
                  <span className="tabular-nums text-[#B4382A]">
                    - {formatIDR(computed.cogs)}
                  </span>
                </div>
                <div className="py-3 flex justify-between font-medium">
                  <span className="text-[#2B1B12]">Laba Kotor</span>
                  <span className="tabular-nums text-[#2B1B12]">
                    {formatIDR(computed.grossProfit)}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-[#6F574A]">Biaya Operasional & Lainnya</span>
                  <span className="tabular-nums text-[#B4382A]">
                    - {formatIDR(computed.operational)}
                  </span>
                </div>
                <div className="py-3 flex justify-between text-[#6F574A]">
                  <span>Total Pengeluaran Kas (Operasional & Belanja Bahan)</span>
                  <span className="tabular-nums text-[#B4382A]">
                    - {formatIDR(computed.totalExpense)}
                  </span>
                </div>
                <div className="py-3.5 flex justify-between font-semibold text-sm">
                  <span className="text-[#2B1B12]">Laba Bersih</span>
                  <span
                    className={`tabular-nums ${
                      computed.netProfit >= 0 ? 'text-[#1E6B43]' : 'text-[#B4382A]'
                    }`}
                  >
                    {formatIDR(computed.netProfit)}
                  </span>
                </div>
                <div className="py-3 flex justify-between text-[#6F574A]">
                  <span>Posisi Total Modal Tercatat</span>
                  <span className="font-medium tabular-nums text-[#2B1B12]">
                    {formatIDR(computed.totalModal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#6F574A]">
                Rincian Transaksi (
                {computed.payments.length +
                  computed.expenses.length +
                  computed.purchasePayments.length}{' '}
                entri)
              </h4>
              {computed.payments.length +
                computed.expenses.length +
                computed.purchasePayments.length ===
              0 ? (
                <p className="text-xs text-[#8A7163] py-6 text-center border border-dashed border-[#E5D9C8] rounded-lg">
                  Belum ada transaksi pada periode laporan ini.
                </p>
              ) : (
                <div className="overflow-x-auto border border-[#EFE6DA] rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Jenis</th>
                        <th className="py-2.5 px-3">Keterangan</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5EFE6] text-xs">
                      {computed.payments.map((p) => (
                        <tr key={`r-p-${p.id}`}>
                          <td className="py-2.5 px-3 tabular-nums text-[#5E3A28] whitespace-nowrap">
                            {formatDateID(p.payment_date)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#1E6B43]">
                            Pemasukan · {p.payment_method}
                          </td>
                          <td className="py-2.5 px-3 text-[#2B1B12]">
                            {p.notes || 'Pembayaran Pesanan'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-medium text-[#1E6B43] whitespace-nowrap">
                            + {formatIDR(Number(p.amount))}
                          </td>
                        </tr>
                      ))}
                      {computed.expenses.map((e) => (
                        <tr key={`r-e-${e.id}`}>
                          <td className="py-2.5 px-3 tabular-nums text-[#5E3A28] whitespace-nowrap">
                            {formatDateID(e.expense_date)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#B4382A]">
                            Pengeluaran · {e.category}
                          </td>
                          <td className="py-2.5 px-3 text-[#2B1B12]">{e.description}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-medium text-[#B4382A] whitespace-nowrap">
                            - {formatIDR(Number(e.amount))}
                          </td>
                        </tr>
                      ))}
                      {computed.purchasePayments.map((pp) => (
                        <tr key={`r-pp-${pp.id}`}>
                          <td className="py-2.5 px-3 tabular-nums text-[#5E3A28] whitespace-nowrap">
                            {formatDateID(pp.payment_date)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#B4382A]">
                            Pembayaran Bahan · {pp.payment_method}
                          </td>
                          <td className="py-2.5 px-3 text-[#2B1B12]">
                            {pp.notes || 'Pembayaran Pembelian Bahan'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-medium text-[#B4382A] whitespace-nowrap">
                            - {formatIDR(Number(pp.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        <div className="pt-4 border-t border-[#EFE6DA] text-[11px] text-[#8A7163]">
          Laporan bersumber langsung dari database Supabase PostgreSQL.
        </div>
      </div>
    </div>
  );
};
