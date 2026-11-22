import React, { useMemo, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import { useBusinessMetrics } from '../hooks/useBusinessMetrics';
import {
  downloadCSV,
  formatDateID,
  formatDecimalIDR,
  formatIDR,
  formatQuantity,
  isCashOutflowType,
  isWithinDateFilter,
} from '../utils/formatters';

type ReportType =
  | 'harian'
  | 'mingguan'
  | 'bulanan'
  | 'tahunan'
  | 'laba-rugi'
  | 'arus-kas'
  | 'persediaan';

const REPORT_TYPES: { id: ReportType; label: string; subtitle: string }[] = [
  { id: 'harian', label: 'Laporan Harian', subtitle: 'Ringkasan aktivitas hari ini' },
  { id: 'mingguan', label: 'Laporan Mingguan', subtitle: 'Rekapitulasi 7 hari terakhir' },
  { id: 'bulanan', label: 'Laporan Bulanan', subtitle: 'Rekapitulasi bulan berjalan' },
  { id: 'tahunan', label: 'Laporan Tahunan', subtitle: 'Akumulasi tahun berjalan' },
  { id: 'laba-rugi', label: 'Laporan Laba Rugi', subtitle: 'Pendapatan, HPP & beban' },
  { id: 'arus-kas', label: 'Laporan Arus Kas', subtitle: 'Posisi kas & saldo rekening' },
  { id: 'persediaan', label: 'Laporan Persediaan', subtitle: 'Valuasi bahan & stok jadi' },
];

export const ReportsPage: React.FC = () => {
  const { db } = useBusinessData();
  const {
    cashAccountBalanceMap,
    totalCashBalance,
    ingredientStockMap,
    totalIngredientAssetValue,
    finishedGoodsStockList,
    getPeriodFinancials,
  } = useBusinessMetrics();

  const [reportType, setReportType] = useState<ReportType>('bulanan');

  const profile = db.businessProfiles[0];
  const businessName =
    profile?.business_name || 'Keripik Bawang — Usaha Keluarga';

  const cashAccountMap = useMemo(
    () => new Map(db.cashAccounts.map((a) => [a.id, a])),
    [db.cashAccounts]
  );

  const ingredientMap = useMemo(
    () => new Map(db.ingredients.map((i) => [i.id, i])),
    [db.ingredients]
  );

  const skuLabelMap = useMemo(() => {
    const variantMap = new Map(db.productVariants.map((v) => [v.id, v]));
    const map = new Map<string, string>();
    db.productSkus.forEach((sku) => {
      const v = variantMap.get(sku.variant_id);
      map.set(sku.id, `${v?.variant_name ?? 'Varian'} · ${sku.package_name}`);
    });
    return map;
  }, [db.productSkus, db.productVariants]);

  const computed = useMemo(() => {
    const periodMap: Record<ReportType, 'today' | '7d' | 'month' | 'year'> = {
      harian: 'today',
      mingguan: '7d',
      bulanan: 'month',
      tahunan: 'year',
      'laba-rugi': 'month',
      'arus-kas': 'year',
      persediaan: 'month',
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
    const cashTxPeriod = db.cashTransactions.filter((tx) =>
      isWithinDateFilter(tx.transaction_date, period)
    );

    const financials = getPeriodFinancials(period);

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

    return {
      payments,
      expenses,
      purchasePayments,
      cashTxPeriod,
      ...financials,
      cashInflow,
      cashOutflow,
      netCashFlow: cashInflow - cashOutflow,
      totalCashBalance,
    };
  }, [db, reportType, getPeriodFinancials, totalCashBalance]);

  const ingredientStockList = useMemo(
    () => Array.from(ingredientStockMap.values()),
    [ingredientStockMap]
  );

  const activeMeta = REPORT_TYPES.find((r) => r.id === reportType)!;

  const handleExportCSV = () => {
    if (reportType === 'persediaan') {
      const headers = [
        'Jenis Item',
        'Nama',
        'Stok',
        'Satuan',
        'Harga Rata-rata / Jual (IDR)',
        'Nilai Aset (IDR)',
      ];
      const rows: (string | number)[][] = [
        ...ingredientStockList.map((ing) => [
          'Bahan Baku',
          ing.ingredient_name,
          Number(ing.current_stock),
          ing.unit,
          Number(ing.average_unit_cost),
          Number(ing.stock_value),
        ]),
        ...finishedGoodsStockList.map((fg) => [
          'Produk Jadi',
          skuLabelMap.get(fg.sku_id) ?? fg.package_name,
          Number(fg.current_stock),
          'kemasan',
          Number(fg.selling_price),
          Number(fg.current_stock) * Number(fg.selling_price),
        ]),
        ['RINGKASAN', 'Total Nilai Aset Persediaan Bahan', '', '', '', totalIngredientAssetValue],
      ];
      downloadCSV('keripik-bawang-laporan-persediaan.csv', headers, rows);
      return;
    }

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
      rows.push(['', 'RINGKASAN', 'Total Saldo Kas', '', computed.totalCashBalance]);
      downloadCSV('keripik-bawang-arus-kas.csv', headers, rows);
      return;
    }

    const headers = ['Tanggal', 'Jenis', 'Kategori / Metode', 'Keterangan', 'Nominal (IDR)'];
    const rows: (string | number)[][] = [
      ...computed.payments.map((p) => [
        p.payment_date,
        'Pemasukan Penjualan',
        p.payment_method,
        p.notes || 'Pembayaran Pesanan',
        Number(p.amount),
      ]),
      ...computed.expenses.map((e) => [
        e.expense_date,
        'Beban Operasional',
        e.category,
        e.description,
        -Number(e.amount),
      ]),
      ...computed.purchasePayments.map((pp) => [
        pp.payment_date,
        'Pembayaran Bahan (Aset Persediaan)',
        pp.payment_method,
        pp.notes || 'Pembayaran Pembelian Bahan',
        -Number(pp.amount),
      ]),
    ];

    rows.push(['', 'RINGKASAN', 'Total Nilai Pesanan', '', computed.salesOrderTotal]);
    rows.push(['', 'RINGKASAN', 'Total Pendapatan Diterima', '', computed.collectedRevenue]);
    rows.push(['', 'RINGKASAN', 'HPP Produksi Aktual', '', computed.productionHpp]);
    rows.push(['', 'RINGKASAN', 'Laba Kotor', '', computed.grossProfit]);
    rows.push(['', 'RINGKASAN', 'Beban Operasional', '', computed.operatingExpenses]);
    rows.push(['', 'RINGKASAN', 'Laba Bersih', '', computed.netProfit]);

    downloadCSV(`keripik-bawang-${reportType}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
            Laporan Bisnis, Persediaan &amp; Keuangan
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

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 no-print">
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

        {reportType === 'persediaan' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA]">
                <div className="text-[#7A6154]">Nilai Aset Persediaan Bahan</div>
                <div className="mt-1 text-lg font-semibold text-[#8C6518] tabular-nums">
                  {formatIDR(totalIngredientAssetValue)}
                </div>
                <div className="mt-0.5 text-[11px] text-[#8A7163]">
                  {ingredientStockList.length} bahan baku (v_ingredient_stock)
                </div>
              </div>
              <div className="p-4 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA]">
                <div className="text-[#7A6154]">Stok Produk Jadi Tersedia</div>
                <div className="mt-1 text-lg font-semibold text-[#1E6B43] tabular-nums">
                  {formatQuantity(
                    finishedGoodsStockList.reduce(
                      (s, f) => s + Math.max(0, Number(f.current_stock)),
                      0
                    ),
                    'kemasan'
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-[#8A7163]">
                  {finishedGoodsStockList.length} SKU (v_finished_goods_stock)
                </div>
              </div>
              <div className="p-4 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA]">
                <div className="text-[#7A6154]">Total Saldo Kas Saat Ini</div>
                <div className="mt-1 text-lg font-semibold text-[#2B1B12] tabular-nums">
                  {formatIDR(totalCashBalance)}
                </div>
                <div className="mt-0.5 text-[11px] text-[#8A7163]">
                  Sumber: v_cash_account_balances
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#6F574A]">
                Valuasi Persediaan Bahan Baku (v_ingredient_stock)
              </h4>
              {ingredientStockList.length === 0 ? (
                <p className="text-xs text-[#8A7163] py-6 text-center border border-dashed border-[#E5D9C8] rounded-lg">
                  Belum ada data bahan baku terdaftar.
                </p>
              ) : (
                <div className="overflow-x-auto border border-[#EFE6DA] rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                        <th className="py-2.5 px-3">Nama Bahan</th>
                        <th className="py-2.5 px-3 text-right">Stok Kanonis</th>
                        <th className="py-2.5 px-3 text-right">Harga Rata-rata</th>
                        <th className="py-2.5 px-3 text-right">Nilai Aset</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5EFE6] text-xs">
                      {ingredientStockList.map((ing) => (
                        <tr key={ing.ingredient_id}>
                          <td className="py-2.5 px-3 font-medium text-[#2B1B12]">
                            {ing.ingredient_name}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatQuantity(Number(ing.current_stock), ing.unit)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-[#5E3A28]">
                            {formatDecimalIDR(Number(ing.average_unit_cost))} / {ing.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#2B1B12]">
                            {formatIDR(Number(ing.stock_value))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#6F574A]">
                Persediaan Produk Jadi (v_finished_goods_stock)
              </h4>
              {finishedGoodsStockList.length === 0 ? (
                <p className="text-xs text-[#8A7163] py-6 text-center border border-dashed border-[#E5D9C8] rounded-lg">
                  Belum ada data stok produk jadi.
                </p>
              ) : (
                <div className="overflow-x-auto border border-[#EFE6DA] rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                        <th className="py-2.5 px-3">Produk &amp; Kemasan</th>
                        <th className="py-2.5 px-3">Kode SKU</th>
                        <th className="py-2.5 px-3 text-right">Harga Jual</th>
                        <th className="py-2.5 px-3 text-right">Stok Tersedia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5EFE6] text-xs">
                      {finishedGoodsStockList.map((fg) => (
                        <tr key={fg.sku_id}>
                          <td className="py-2.5 px-3 font-medium text-[#2B1B12]">
                            {skuLabelMap.get(fg.sku_id) ?? fg.package_name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#6F574A]">
                            {fg.sku_code || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatIDR(Number(fg.selling_price))}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#1E6B43]">
                            {formatQuantity(Number(fg.current_stock), 'kemasan')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#6F574A]">
                Mutasi Stok Bahan Baku Terbaru ({Math.min(20, db.ingredientStockMovements.length)} entri)
              </h4>
              {db.ingredientStockMovements.length === 0 ? (
                <p className="text-xs text-[#8A7163] py-4 text-center border border-dashed border-[#E5D9C8] rounded-lg">
                  Belum ada catatan mutasi stok bahan baku.
                </p>
              ) : (
                <div className="overflow-x-auto border border-[#EFE6DA] rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                        <th className="py-2 px-3">Tanggal</th>
                        <th className="py-2 px-3">Bahan Baku</th>
                        <th className="py-2 px-3">Jenis</th>
                        <th className="py-2 px-3 text-right">Jumlah</th>
                        <th className="py-2 px-3">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5EFE6] text-xs">
                      {db.ingredientStockMovements.slice(0, 20).map((mov) => {
                        const ing = ingredientMap.get(mov.ingredient_id);
                        return (
                          <tr key={mov.id}>
                            <td className="py-2 px-3 tabular-nums text-[#5E3A28] whitespace-nowrap">
                              {formatDateID(mov.movement_date)}
                            </td>
                            <td className="py-2 px-3 font-medium text-[#2B1B12]">
                              {ing?.name ?? 'Bahan'}
                            </td>
                            <td className="py-2 px-3 text-[#6F574A]">{mov.movement_type}</td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              {formatQuantity(Number(mov.quantity), ing?.unit)}
                            </td>
                            <td className="py-2 px-3 text-[#6F574A]">{mov.notes || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : reportType === 'arus-kas' ? (
          <>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#6F574A]">
                Ringkasan Arus Kas (Tahun Berjalan)
              </h4>
              <div className="divide-y divide-[#F5EFE6] border border-[#EFE6DA] rounded-lg px-4 text-xs">
                <div className="py-3 flex justify-between">
                  <span className="text-[#2B1B12]">Total Kas Masuk (Penjualan, Modal &amp; Penyesuaian)</span>
                  <span className="font-semibold text-[#1E6B43] tabular-nums">
                    + {formatIDR(computed.cashInflow)}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-[#6F574A]">
                    Total Kas Keluar (Pengeluaran, Belanja Bahan &amp; Penarikan)
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
                  <span>Total Saldo Seluruh Akun Kas (v_cash_account_balances)</span>
                  <span className="font-semibold tabular-nums text-[#2B1B12]">
                    {formatIDR(computed.totalCashBalance)}
                  </span>
                </div>
              </div>
            </div>

            {db.cashAccounts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#6F574A]">
                  Saldo per Akun Kas (v_cash_account_balances)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {db.cashAccounts.map((acc) => {
                    const bal = Number(
                      cashAccountBalanceMap.get(acc.id)?.current_balance ?? 0
                    );
                    return (
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
                          {formatIDR(bal)}
                        </div>
                      </div>
                    );
                  })}
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
                Ringkasan Laba Rugi &amp; Posisi Aset
              </h4>
              <div className="divide-y divide-[#F5EFE6] border border-[#EFE6DA] rounded-lg px-4 text-xs">
                <div className="py-3 flex justify-between text-[#6F574A]">
                  <span>Total Nilai Pesanan Periode (v_sales_summary)</span>
                  <span className="font-medium tabular-nums text-[#2B1B12]">
                    {formatIDR(computed.salesOrderTotal)}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-[#2B1B12]">Total Pendapatan Penjualan Diterima</span>
                  <span className="font-semibold text-[#1E6B43] tabular-nums">
                    {formatIDR(computed.collectedRevenue)}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-[#6F574A]">
                    HPP Produksi Aktual ({computed.batchesCount} batch — v_production_batch_costs)
                  </span>
                  <span className="tabular-nums text-[#B4382A]">
                    - {formatIDR(computed.productionHpp)}
                  </span>
                </div>
                <div className="py-3 flex justify-between font-medium">
                  <span className="text-[#2B1B12]">Laba Kotor (Pendapatan - HPP Produksi)</span>
                  <span className="tabular-nums text-[#2B1B12]">
                    {formatIDR(computed.grossProfit)}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-[#6F574A]">Beban Operasional (expenses)</span>
                  <span className="tabular-nums text-[#B4382A]">
                    - {formatIDR(computed.operatingExpenses)}
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
                  <span>
                    Arus Kas Belanja Bahan Baku ke Pemasok (Pembelian Aset Persediaan)
                  </span>
                  <span className="tabular-nums text-[#5E3A28]">
                    {formatIDR(computed.purchaseCashOutflow)}
                  </span>
                </div>
                <div className="py-3 flex justify-between text-[#6F574A]">
                  <span>Nilai Aset Persediaan Bahan Saat Ini (v_ingredient_stock)</span>
                  <span className="font-medium tabular-nums text-[#8C6518]">
                    {formatIDR(totalIngredientAssetValue)}
                  </span>
                </div>
                <div className="py-3 flex justify-between text-[#6F574A]">
                  <span>Total Saldo Seluruh Akun Kas (v_cash_account_balances)</span>
                  <span className="font-medium tabular-nums text-[#2B1B12]">
                    {formatIDR(computed.totalCashBalance)}
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
                            Beban · {e.category}
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
                          <td className="py-2.5 px-3 font-medium text-[#8C6518]">
                            Belanja Bahan · {pp.payment_method}
                          </td>
                          <td className="py-2.5 px-3 text-[#2B1B12]">
                            {pp.notes || 'Pembayaran Pembelian Bahan'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-medium text-[#8C6518] whitespace-nowrap">
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
          Laporan bersumber langsung dari tabel dan 8 view database Supabase PostgreSQL.
        </div>
      </div>
    </div>
  );
};
