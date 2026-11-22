import React, { useMemo, useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import { useBusinessMetrics } from '../hooks/useBusinessMetrics';
import { supabaseService } from '../services/supabaseService';
import { formatDateID, formatIDR, getTodayISO } from '../utils/formatters';
import { StatCard } from '../components/common/StatCard';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';

export const SalesPage: React.FC = () => {
  const { db, isMutating, executeMutation, notifyError } = useBusinessData();
  const { salesSummaryList, orderPaymentStatusMap } = useBusinessMetrics();
  const [modalOpen, setModalOpen] = useState(false);

  const [orderId, setOrderId] = useState('');
  const [cashAccountId, setCashAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayISO());
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [notes, setNotes] = useState('');

  const orderMap = useMemo(
    () => new Map(db.orders.map((o) => [o.id, o])),
    [db.orders]
  );

  const cashAccountMap = useMemo(
    () => new Map(db.cashAccounts.map((a) => [a.id, a])),
    [db.cashAccounts]
  );

  const activeCashAccounts = useMemo(
    () => db.cashAccounts.filter((a) => a.is_active),
    [db.cashAccounts]
  );

  const summary = useMemo(() => {
    const totalIncome = salesSummaryList.reduce((s, o) => s + Number(o.total_paid), 0);
    const totalOrderValue = salesSummaryList.reduce((s, o) => s + Number(o.total_amount), 0);
    const outstandingReceivables = salesSummaryList.reduce(
      (s, o) => s + Number(o.remaining_payment),
      0
    );

    const paidPerOrder = new Map<string, number>();
    orderPaymentStatusMap.forEach((row, id) => {
      paidPerOrder.set(id, Number(row.total_paid));
    });

    const variantMap = new Map(db.productVariants.map((v) => [v.id, v]));
    const skuMap = new Map(db.productSkus.map((s) => [s.id, s]));
    const byVariant = new Map<string, { qty: number; revenue: number }>();

    ['Original', 'Pedas', 'Balado'].forEach((v) =>
      byVariant.set(v, { qty: 0, revenue: 0 })
    );

    db.orderItems.forEach((item) => {
      const sku = skuMap.get(item.sku_id);
      const variant = sku ? variantMap.get(sku.variant_id) : undefined;
      const vName = variant?.variant_name ?? 'Lainnya';
      const cur = byVariant.get(vName) ?? { qty: 0, revenue: 0 };
      byVariant.set(vName, {
        qty: cur.qty + Number(item.quantity),
        revenue: cur.revenue + Number(item.subtotal),
      });
    });

    return {
      totalIncome,
      totalOrderValue,
      outstandingReceivables,
      byVariant: Array.from(byVariant.entries()),
      paidPerOrder,
    };
  }, [salesSummaryList, orderPaymentStatusMap, db.orderItems, db.productSkus, db.productVariants]);

  const unpaidOrders = useMemo(() => {
    return db.orders.filter((o) => {
      const payView = orderPaymentStatusMap.get(o.id);
      return Number(payView?.remaining_payment ?? Number(o.total_amount)) > 0;
    });
  }, [db.orders, orderPaymentStatusMap]);

  const handleOpenModal = () => {
    const firstOrder = unpaidOrders[0] ?? db.orders[0];
    setOrderId(firstOrder?.id ?? '');
    if (firstOrder) {
      const payView = orderPaymentStatusMap.get(firstOrder.id);
      const rem = Number(
        payView?.remaining_payment ??
          Math.max(
            0,
            Number(firstOrder.total_amount) - (summary.paidPerOrder.get(firstOrder.id) ?? 0)
          )
      );
      setAmount(Math.max(0, rem));
    }
    setCashAccountId(activeCashAccounts[0]?.id ?? '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) {
      notifyError('Pilih pesanan yang akan dibayar.');
      return;
    }
    if (!cashAccountId) {
      notifyError('Pilih akun kas penerima pembayaran.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      notifyError('Nominal pembayaran harus lebih dari 0.');
      return;
    }
    const payView = orderPaymentStatusMap.get(orderId);
    const ord = orderMap.get(orderId);
    const remaining = Number(
      payView?.remaining_payment ??
        Math.max(
          0,
          Number(ord?.total_amount ?? 0) - (summary.paidPerOrder.get(orderId) ?? 0)
        )
    );
    if (ord && amount > remaining + 0.01) {
      notifyError(
        `Nominal pembayaran (${formatIDR(amount)}) melebihi sisa tagihan (${formatIDR(remaining)}).`
      );
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.registerOrderPayment({
          order_id: orderId,
          cash_account_id: cashAccountId,
          payment_date: paymentDate,
          amount,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
        }),
      'Pembayaran pesanan berhasil dicatat ke database.'
    );

    if (res !== null) {
      setNotes('');
      setAmount(0);
      setModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
            Penjualan & Pembayaran Pesanan
          </h2>
          <p className="mt-0.5 text-sm text-[#6F574A]">
            Catatan penerimaan pembayaran dari tabel order_payments dan performa varian.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          disabled={db.orders.length === 0 || activeCashAccounts.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Pembayaran Pesanan</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Kas Masuk (Penjualan)"
          value={formatIDR(summary.totalIncome)}
          helperText={`${db.orderPayments.length} catatan pembayaran`}
          emphasis="positive"
        />
        <StatCard
          label="Total Nilai Pesanan"
          value={formatIDR(summary.totalOrderValue)}
          helperText={`${db.orders.length} pesanan terdaftar`}
        />
        <StatCard
          label="Sisa Tagihan Belum Lunas"
          value={formatIDR(summary.outstandingReceivables)}
          helperText={`${unpaidOrders.length} pesanan menunggu pelunasan`}
          emphasis={summary.outstandingReceivables > 0 ? 'accent' : 'default'}
        />
      </div>

      <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs">
        <h3 className="text-sm font-display font-semibold text-[#2B1B12] mb-3.5">
          Ringkasan Penjualan per Varian
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summary.byVariant.map(([variant, stats]) => (
            <div
              key={variant}
              className="p-4 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA]"
            >
              <div className="text-xs font-medium text-[#6F574A]">
                Varian {variant}
              </div>
              <div className="mt-1 text-lg font-display font-semibold text-[#2B1B12] tabular-nums">
                {formatIDR(stats.revenue)}
              </div>
              <div className="mt-1 text-xs text-[#8A7163] tabular-nums">
                {stats.qty} kemasan dipesan
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EFE6DA]">
          <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
            Riwayat Pembayaran Pesanan
          </h3>
        </div>

        {db.orderPayments.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Belum Ada Catatan Pembayaran"
            description="Setiap pembayaran pesanan yang dicatat melalui fungsi register_order_payment akan tampil di sini."
            actionLabel={
              db.orders.length > 0 && activeCashAccounts.length > 0
                ? 'Catat Pembayaran Pertama'
                : undefined
            }
            onAction={
              db.orders.length > 0 && activeCashAccounts.length > 0
                ? handleOpenModal
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Ref. Pesanan</th>
                  <th className="py-3 px-4">Akun Kas</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4">Catatan</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5EFE6] text-xs">
                {db.orderPayments.map((pay) => {
                  const ord = orderMap.get(pay.order_id);
                  const acc = cashAccountMap.get(pay.cash_account_id);
                  return (
                    <tr key={pay.id} className="hover:bg-[#FAF6F0]/50">
                      <td className="py-3 px-4 tabular-nums whitespace-nowrap text-[#5E3A28]">
                        {formatDateID(pay.payment_date)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#2B1B12] whitespace-nowrap">
                        {ord?.order_number ?? pay.order_id}
                      </td>
                      <td className="py-3 px-4 text-[#2B1B12]">
                        {acc?.account_name ?? '-'}
                      </td>
                      <td className="py-3 px-4 text-[#5E3A28]">{pay.payment_method}</td>
                      <td className="py-3 px-4 text-[#6F574A]">{pay.notes || '-'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-[#1E6B43] tabular-nums whitespace-nowrap">
                        {formatIDR(Number(pay.amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Catat Pembayaran Pesanan"
        subtitle="Diproses oleh fungsi register_order_payment di Supabase."
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Pilih Pesanan
            </label>
            <select
              required
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                const payView = orderPaymentStatusMap.get(e.target.value);
                const ord = orderMap.get(e.target.value);
                if (payView) {
                  setAmount(Math.max(0, Number(payView.remaining_payment)));
                } else if (ord) {
                  const paid = summary.paidPerOrder.get(ord.id) ?? 0;
                  setAmount(Math.max(0, Number(ord.total_amount) - paid));
                }
              }}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            >
              {db.orders.map((o) => {
                const payView = orderPaymentStatusMap.get(o.id);
                const paid = Number(payView?.total_paid ?? summary.paidPerOrder.get(o.id) ?? 0);
                const rem = Number(
                  payView?.remaining_payment ?? Math.max(0, Number(o.total_amount) - paid)
                );
                return (
                  <option key={o.id} value={o.id}>
                    {o.order_number} · Sisa: {formatIDR(rem)}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Tanggal
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Akun Kas
              </label>
              <select
                required
                value={cashAccountId}
                onChange={(e) => setCashAccountId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              >
                {activeCashAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              >
                <option value="Tunai">Tunai</option>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="QRIS">QRIS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Nominal (IDR)
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pelunasan transfer..."
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
            >
              {isMutating ? 'Menyimpan...' : 'Simpan Pembayaran'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
