import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, ChefHat, ClipboardList, Receipt } from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import { DateFilterPeriod, PageId } from '../types/supabase';
import {
  formatDateID,
  formatIDR,
  formatNumberID,
  isCapitalWithdrawalType,
  isCashOutflowType,
  isWithinDateFilter,
} from '../utils/formatters';
import { StatCard } from '../components/common/StatCard';
import { EmptyState } from '../components/common/EmptyState';
import {
  BatchStatusLabel,
  OrderStatusLabel,
  PaymentStatusLabel,
  normalizeBatchStatusLabel,
  normalizeOrderStatusLabel,
} from '../components/common/StatusLabel';

interface DashboardPageProps {
  onNavigate: (page: PageId) => void;
  onOpenNewOrder: () => void;
}

const DATE_FILTERS: { id: DateFilterPeriod; label: string }[] = [
  { id: 'today', label: 'Hari Ini' },
  { id: '7d', label: '7 Hari' },
  { id: 'month', label: 'Bulan Ini' },
  { id: 'year', label: 'Tahun Ini' },
];

const ORDER_STATUS_BUCKETS = [
  'Menunggu',
  'Diproses',
  'Selesai Diproduksi',
  'Siap Diambil/Dikirim',
  'Selesai',
] as const;

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenNewOrder,
}) => {
  const { db } = useBusinessData();
  const [period, setPeriod] = useState<DateFilterPeriod>('month');

  const customerMap = useMemo(
    () => new Map(db.customers.map((c) => [c.id, c])),
    [db.customers]
  );

  const skuLabelMap = useMemo(() => {
    const variantMap = new Map(db.productVariants.map((v) => [v.id, v]));
    const map = new Map<string, string>();
    db.productSkus.forEach((sku) => {
      const variant = variantMap.get(sku.variant_id);
      map.set(
        sku.id,
        `${variant?.variant_name ?? 'Produk'} · ${sku.package_name}`
      );
    });
    return map;
  }, [db.productSkus, db.productVariants]);

  const paymentByOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    db.orderPayments.forEach((p) => {
      map.set(p.order_id, (map.get(p.order_id) ?? 0) + Number(p.amount));
    });
    return map;
  }, [db.orderPayments]);

  const orderItemsByOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    db.orderItems.forEach((item) => {
      map.set(item.order_id, (map.get(item.order_id) ?? 0) + Number(item.quantity));
    });
    return map;
  }, [db.orderItems]);

  const filteredData = useMemo(() => {
    const orders = db.orders.filter((o) => isWithinDateFilter(o.order_date, period));
    const orderPayments = db.orderPayments.filter((p) =>
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

    const totalPenjualan = orderPayments.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );
    const totalPengeluaran =
      expenses.reduce((sum, e) => sum + Number(e.amount), 0) +
      purchasePayments.reduce((sum, pp) => sum + Number(pp.amount), 0);

    const totalModal = db.capitalTransactions.reduce((sum, c) => {
      return isCapitalWithdrawalType(c.transaction_type)
        ? sum - Number(c.amount)
        : sum + Number(c.amount);
    }, 0);

    const batchIds = new Set(batches.map((b) => b.id));
    const batchMaterialCost = db.productionMaterials
      .filter((m) => batchIds.has(m.batch_id))
      .reduce((s, m) => s + Number(m.total_cost), 0);
    const batchExtraCost = db.productionCostItems
      .filter((c) => batchIds.has(c.batch_id))
      .reduce((s, c) => s + Number(c.amount), 0);
    const productionCostTotal = batchMaterialCost + batchExtraCost;

    const materialExpenses =
      expenses
        .filter((e) => {
          const cat = e.category.toLowerCase();
          return cat.includes('bahan') || cat.includes('kemasan');
        })
        .reduce((s, e) => s + Number(e.amount), 0) +
      purchasePayments.reduce((s, pp) => s + Number(pp.amount), 0);

    const hpp = productionCostTotal > 0 ? productionCostTotal : materialExpenses;
    const labaKotor = totalPenjualan - hpp;
    const labaBersih = totalPenjualan - totalPengeluaran;

    return {
      orders,
      orderPayments,
      expenses,
      purchasePayments,
      batches,
      totalPenjualan,
      totalPengeluaran,
      totalModal,
      labaKotor,
      labaBersih,
    };
  }, [db, period]);

  const chartSeries = useMemo(() => {
    const map = new Map<
      string,
      { date: string; label: string; penjualan: number; pengeluaran: number; laba: number }
    >();

    const ensureBucket = (isoDate: string) => {
      if (!map.has(isoDate)) {
        map.set(isoDate, {
          date: isoDate,
          label: formatDateID(isoDate),
          penjualan: 0,
          pengeluaran: 0,
          laba: 0,
        });
      }
      return map.get(isoDate)!;
    };

    filteredData.orderPayments.forEach((p) => {
      ensureBucket(p.payment_date).penjualan += Number(p.amount);
    });

    filteredData.expenses.forEach((e) => {
      ensureBucket(e.expense_date).pengeluaran += Number(e.amount);
    });

    filteredData.purchasePayments.forEach((pp) => {
      ensureBucket(pp.payment_date).pengeluaran += Number(pp.amount);
    });

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        ...row,
        laba: row.penjualan - row.pengeluaran,
      }));
  }, [filteredData]);

  const recentTransactions = useMemo(() => {
    if (db.cashTransactions.length > 0) {
      return db.cashTransactions.slice(0, 6).map((tx) => {
        const isOut = isCashOutflowType(tx.transaction_type);
        return {
          id: tx.id,
          date: tx.transaction_date,
          type: isOut ? ('Keluar' as const) : ('Masuk' as const),
          title: tx.transaction_type,
          detail: tx.description || tx.notes || '-',
          amount: Number(tx.amount),
        };
      });
    }

    const fallback = [
      ...db.orderPayments.map((p) => ({
        id: `pay-${p.id}`,
        date: p.payment_date,
        type: 'Masuk' as const,
        title: `Pembayaran Pesanan (${p.payment_method})`,
        detail: p.notes || 'Penerimaan penjualan',
        amount: Number(p.amount),
      })),
      ...db.expenses.map((e) => ({
        id: `exp-${e.id}`,
        date: e.expense_date,
        type: 'Keluar' as const,
        title: e.category,
        detail: e.description,
        amount: Number(e.amount),
      })),
      ...db.purchasePayments.map((pp) => ({
        id: `pur-${pp.id}`,
        date: pp.payment_date,
        type: 'Keluar' as const,
        title: `Pembayaran Bahan Baku (${pp.payment_method})`,
        detail: pp.notes || 'Pembayaran pemasok',
        amount: Number(pp.amount),
      })),
    ];
    return fallback.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }, [db.cashTransactions, db.orderPayments, db.expenses, db.purchasePayments]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Menunggu: 0,
      Diproses: 0,
      'Selesai Diproduksi': 0,
      'Siap Diambil/Dikirim': 0,
      Selesai: 0,
    };
    filteredData.orders.forEach((o) => {
      const normalized = normalizeOrderStatusLabel(o.status);
      counts[normalized] = (counts[normalized] ?? 0) + 1;
    });
    return counts;
  }, [filteredData.orders]);

  const productionSummary = useMemo(() => {
    const batches = filteredData.batches;
    const totalBatch = batches.length;
    const aktif = batches.filter(
      (b) => normalizeBatchStatusLabel(b.status) === 'Sedang Diproduksi'
    ).length;
    const totalUnitTarget = batches.reduce(
      (s, b) => s + Number(b.planned_quantity),
      0
    );
    const totalUnitProduced = batches.reduce(
      (s, b) => s + Number(b.actual_quantity ?? 0),
      0
    );
    return { totalBatch, aktif, totalUnitTarget, totalUnitProduced };
  }, [filteredData.batches]);

  const recentOrders = useMemo(() => db.orders.slice(0, 5), [db.orders]);

  const periodLabel =
    DATE_FILTERS.find((d) => d.id === period)?.label ?? 'Bulan Ini';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
            Ringkasan Operasional & Keuangan
          </h2>
          <p className="mt-0.5 text-sm text-[#6F574A]">
            Pantauan bisnis Made-to-Order · Periode: {periodLabel}
          </p>
        </div>

        <div
          className="inline-flex items-center gap-1 p-1 bg-[#EFE6DA] border border-[#E5D9C8] rounded-lg self-start sm:self-auto"
          role="group"
          aria-label="Filter periode tanggal"
        >
          {DATE_FILTERS.map((f) => {
            const active = period === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setPeriod(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#362015] text-[#FDFBF7] shadow-2xs'
                    : 'text-[#5E3A28] hover:text-[#2B1B12]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5 Financial Summary Cards */}
      <section aria-label="Ringkasan Keuangan">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            label="Total Penjualan"
            value={formatIDR(filteredData.totalPenjualan)}
            helperText={`${filteredData.orderPayments.length} pembayaran (${periodLabel})`}
            emphasis="positive"
          />
          <StatCard
            label="Total Pengeluaran"
            value={formatIDR(filteredData.totalPengeluaran)}
            helperText={`${filteredData.expenses.length + filteredData.purchasePayments.length} catatan keluar`}
            emphasis="negative"
          />
          <StatCard
            label="Total Modal"
            value={formatIDR(filteredData.totalModal)}
            helperText={`${db.capitalTransactions.length} transaksi modal`}
            emphasis="accent"
          />
          <StatCard
            label="Laba Kotor"
            value={formatIDR(filteredData.labaKotor)}
            helperText="Penjualan dikurangi biaya produksi"
            emphasis={filteredData.labaKotor >= 0 ? 'default' : 'negative'}
          />
          <StatCard
            label="Laba Bersih"
            value={formatIDR(filteredData.labaBersih)}
            helperText="Penjualan dikurangi total pengeluaran"
            emphasis={filteredData.labaBersih >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </section>

      {/* Analytics Charts */}
      <section aria-label="Analitik Keuangan" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
              Grafik Penjualan
            </h3>
            <p className="text-xs text-[#8A7163]">
              Penerimaan pembayaran pesanan ({periodLabel})
            </p>
          </div>
          {chartSeries.length === 0 ? (
            <div className="flex-1 min-h-[210px] flex items-center justify-center text-xs text-[#8A7163] text-center px-4">
              Belum ada data penjualan pada periode {periodLabel}.
            </div>
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C59B43" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#C59B43" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE6DA" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7A6154' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#7A6154' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}rb`}
                  />
                  <Tooltip
                    formatter={(value) => [formatIDR(Number(value ?? 0)), 'Penjualan']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E5D9C8',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="penjualan"
                    stroke="#362015"
                    strokeWidth={2}
                    fill="url(#salesFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
              Grafik Pengeluaran
            </h3>
            <p className="text-xs text-[#8A7163]">
              Biaya bahan & operasional ({periodLabel})
            </p>
          </div>
          {chartSeries.length === 0 ? (
            <div className="flex-1 min-h-[210px] flex items-center justify-center text-xs text-[#8A7163] text-center px-4">
              Belum ada data pengeluaran pada periode {periodLabel}.
            </div>
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE6DA" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7A6154' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#7A6154' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}rb`}
                  />
                  <Tooltip
                    formatter={(value) => [formatIDR(Number(value ?? 0)), 'Pengeluaran']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E5D9C8',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="pengeluaran" fill="#8C4A32" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
              Grafik Laba
            </h3>
            <p className="text-xs text-[#8A7163]">
              Selisih penjualan & pengeluaran ({periodLabel})
            </p>
          </div>
          {chartSeries.length === 0 ? (
            <div className="flex-1 min-h-[210px] flex items-center justify-center text-xs text-[#8A7163] text-center px-4">
              Belum ada data laba pada periode {periodLabel}.
            </div>
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE6DA" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7A6154' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#7A6154' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}rb`}
                  />
                  <Tooltip
                    formatter={(value) => [formatIDR(Number(value ?? 0)), 'Laba']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E5D9C8',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="laba"
                    stroke="#C59B43"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#362015', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Business Activity */}
      <section aria-label="Aktivitas Bisnis" className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-[#EFE6DA] flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
                Pesanan Terbaru
              </h3>
              <p className="text-xs text-[#8A7163]">
                Antrean produksi berbasis pesanan (Made to Order)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('pesanan')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#5E3A28] hover:text-[#2B1B12] whitespace-nowrap cursor-pointer"
            >
              <span>Lihat Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Belum Ada Pesanan Tercatat"
              description="Tambahkan pesanan pelanggan pertama Anda ke database Supabase."
              actionLabel="Tambah Pesanan Baru"
              onAction={onOpenNewOrder}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] text-[11px] font-medium text-[#8A7163]">
                    <th className="py-2.5 px-4">ID Pesanan</th>
                    <th className="py-2.5 px-4">Pelanggan</th>
                    <th className="py-2.5 px-4">Estimasi Selesai</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                    <th className="py-2.5 px-4">Pembayaran</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {recentOrders.map((order) => {
                    const paid = paymentByOrderMap.get(order.id) ?? 0;
                    const payStatus =
                      paid >= Number(order.total_amount) && Number(order.total_amount) > 0
                        ? 'Lunas'
                        : paid > 0
                        ? 'DP / Sebagian'
                        : 'Belum Bayar';
                    const qty = orderItemsByOrderMap.get(order.id) ?? 0;
                    const customerName = order.customer_id
                      ? customerMap.get(order.customer_id)?.name ?? 'Pelanggan'
                      : 'Pelanggan Umum';

                    return (
                      <tr key={order.id} className="hover:bg-[#FAF6F0]/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-[#2B1B12] tabular-nums whitespace-nowrap">
                          {order.order_number}
                        </td>
                        <td className="py-3 px-4 text-[#2B1B12] font-medium">
                          <div>{customerName}</div>
                          <div className="text-[11px] text-[#8A7163]">
                            {qty} item · {formatDateID(order.order_date)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[#5E3A28] tabular-nums whitespace-nowrap">
                          {order.due_date ? formatDateID(order.due_date) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-[#2B1B12] tabular-nums whitespace-nowrap">
                          {formatIDR(Number(order.total_amount))}
                        </td>
                        <td className="py-3 px-4">
                          <PaymentStatusLabel status={payStatus} />
                        </td>
                        <td className="py-3 px-4">
                          <OrderStatusLabel status={order.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="xl:col-span-5 space-y-4">
          <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
                Ringkasan Status Pesanan
              </h3>
              <span className="text-xs text-[#8A7163] tabular-nums">
                {filteredData.orders.length} pesanan ({periodLabel})
              </span>
            </div>
            <div className="divide-y divide-[#F5EFE6]">
              {ORDER_STATUS_BUCKETS.map((status) => (
                <div
                  key={status}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <OrderStatusLabel status={status} />
                  <span className="text-sm font-semibold text-[#2B1B12] tabular-nums">
                    {formatNumberID(statusCounts[status] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
                Ringkasan Produksi
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('produksi')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#5E3A28] hover:text-[#2B1B12] cursor-pointer"
              >
                <span>Kelola Produksi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {filteredData.batches.length === 0 ? (
              <div className="py-4 text-center">
                <ChefHat className="w-5 h-5 text-[#8A7163] mx-auto mb-1.5" />
                <p className="text-xs text-[#8A7163]">
                  Belum ada batch produksi pada periode {periodLabel}.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 pb-3.5 border-b border-[#EFE6DA]">
                  <div>
                    <div className="text-[11px] text-[#8A7163]">Total Batch</div>
                    <div className="text-base font-semibold text-[#2B1B12] tabular-nums">
                      {productionSummary.totalBatch}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8A7163]">Diproses</div>
                    <div className="text-base font-semibold text-[#A14B1A] tabular-nums">
                      {productionSummary.aktif}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8A7163]">Output Aktual</div>
                    <div className="text-base font-semibold text-[#1E6B43] tabular-nums">
                      {productionSummary.totalUnitProduced}/{productionSummary.totalUnitTarget}
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-2.5">
                  {filteredData.batches.slice(0, 3).map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-[#2B1B12] truncate">
                          {batch.batch_number} · {skuLabelMap.get(batch.sku_id) ?? 'SKU'}
                        </div>
                        <div className="text-[11px] text-[#8A7163] truncate tabular-nums">
                          {batch.actual_quantity ?? 0}/{batch.planned_quantity} unit ·{' '}
                          {formatDateID(batch.production_date)}
                        </div>
                      </div>
                      <BatchStatusLabel status={batch.status} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Transaksi Terbaru */}
      <section className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EFE6DA] flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
              Transaksi Terbaru
            </h3>
            <p className="text-xs text-[#8A7163]">
              Arus kas masuk dan kas keluar dari buku kas Supabase
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('keuangan')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#5E3A28] hover:text-[#2B1B12] whitespace-nowrap cursor-pointer"
          >
            <span>Lihat Keuangan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Belum Ada Transaksi Tercatat"
            description="Transaksi kas yang Anda catat akan muncul secara kronologis di sini."
          />
        ) : (
          <div className="divide-y divide-[#F5EFE6]">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#2B1B12] truncate">
                    {tx.title}
                  </div>
                  <div className="text-[11px] text-[#8A7163] truncate">
                    {formatDateID(tx.date)} · {tx.detail}
                  </div>
                </div>
                <div
                  className={`text-xs font-semibold tabular-nums whitespace-nowrap ${
                    tx.type === 'Masuk' ? 'text-[#1E6B43]' : 'text-[#B4382A]'
                  }`}
                >
                  {tx.type === 'Masuk' ? '+' : '-'} {formatIDR(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
