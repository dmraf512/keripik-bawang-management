import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, CreditCard, Plus, Search, Trash2 } from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import { useBusinessMetrics } from '../hooks/useBusinessMetrics';
import { supabaseService } from '../services/supabaseService';
import { PageId } from '../types/supabase';
import { addDaysISO, formatDateID, formatIDR, getTodayISO } from '../utils/formatters';
import { EmptyState } from '../components/common/EmptyState';
import {
  OrderStatusLabel,
  PaymentStatusLabel,
  normalizeOrderStatusLabel,
} from '../components/common/StatusLabel';
import { Modal } from '../components/common/Modal';

interface OrdersPageProps {
  onNavigate: (page: PageId) => void;
  externalModalOpen?: boolean;
  onCloseExternalModal?: () => void;
}

const ORDER_STATUS_FILTERS = [
  'Semua',
  'Menunggu',
  'Diproses',
  'Selesai Diproduksi',
  'Siap Diambil/Dikirim',
  'Selesai',
] as const;

const ORDER_STATUS_VALUES = [
  'Menunggu',
  'Diproses',
  'Selesai Diproduksi',
  'Siap Diambil/Dikirim',
  'Selesai',
] as const;

export const OrdersPage: React.FC<OrdersPageProps> = ({
  onNavigate,
  externalModalOpen = false,
  onCloseExternalModal,
}) => {
  const { db, isMutating, executeMutation, notifyError } = useBusinessData();
  const { orderPaymentStatusMap } = useBusinessMetrics();
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [localModalOpen, setLocalModalOpen] = useState(false);

  // Payment Modal State
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(getTodayISO());
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('Tunai');
  const [payCashAccountId, setPayCashAccountId] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // New Order Form State
  const today = getTodayISO();
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [orderDate, setOrderDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDaysISO(today, 2));
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [initialPaidAmount, setInitialPaidAmount] = useState<number>(0);
  const [initialCashAccountId, setInitialCashAccountId] = useState('');
  const [initialPayMethod, setInitialPayMethod] = useState('Tunai');
  const [notes, setNotes] = useState('');

  const isModalOpen = localModalOpen || externalModalOpen;
  const closeModal = () => {
    setLocalModalOpen(false);
    onCloseExternalModal?.();
  };

  const customerMap = useMemo(
    () => new Map(db.customers.map((c) => [c.id, c])),
    [db.customers]
  );

  const skuOptions = useMemo(() => {
    const productMap = new Map(db.products.map((p) => [p.id, p]));
    const variantMap = new Map(db.productVariants.map((v) => [v.id, v]));
    return db.productSkus.map((sku) => {
      const variant = variantMap.get(sku.variant_id);
      const product = variant ? productMap.get(variant.product_id) : undefined;
      return {
        ...sku,
        label: `${product?.name ?? 'Keripik Bawang'} · ${
          variant?.variant_name ?? 'Varian'
        } (${sku.package_name})`,
      };
    });
  }, [db.products, db.productVariants, db.productSkus]);

  const activeSkuOptions = useMemo(
    () => skuOptions.filter((s) => s.is_active),
    [skuOptions]
  );

  const skuLabelMap = useMemo(
    () => new Map(skuOptions.map((s) => [s.id, s.label])),
    [skuOptions]
  );

  const itemsByOrderMap = useMemo(() => {
    const map = new Map<string, typeof db.orderItems>();
    db.orderItems.forEach((item) => {
      const existing = map.get(item.order_id) ?? [];
      existing.push(item);
      map.set(item.order_id, existing);
    });
    return map;
  }, [db.orderItems]);

  const paidByOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    db.orderPayments.forEach((p) => {
      map.set(p.order_id, (map.get(p.order_id) ?? 0) + Number(p.amount));
    });
    return map;
  }, [db.orderPayments]);

  const activeCashAccounts = useMemo(
    () => db.cashAccounts.filter((a) => a.is_active),
    [db.cashAccounts]
  );

  useEffect(() => {
    if (!isModalOpen) return;
    if (!selectedSkuId && activeSkuOptions[0]) {
      setSelectedSkuId(activeSkuOptions[0].id);
      setUnitPrice(Number(activeSkuOptions[0].selling_price));
    }
    if (!initialCashAccountId && activeCashAccounts[0]) {
      setInitialCashAccountId(activeCashAccounts[0].id);
    }
    if (!selectedCustomerId && db.customers[0]) {
      setSelectedCustomerId(db.customers[0].id);
    }
  }, [
    isModalOpen,
    selectedSkuId,
    activeSkuOptions,
    initialCashAccountId,
    activeCashAccounts,
    selectedCustomerId,
    db.customers,
  ]);

  const handleSkuChange = (skuId: string) => {
    setSelectedSkuId(skuId);
    const found = skuOptions.find((s) => s.id === skuId);
    if (found) {
      setUnitPrice(Number(found.selling_price));
    }
  };

  const computedSubtotal =
    (Number.isFinite(quantity) ? Math.max(0, quantity) : 0) *
    (Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0);
  const computedTotal = Math.max(
    0,
    computedSubtotal - (Number.isFinite(discount) ? Math.max(0, discount) : 0)
  );

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSkuId) {
      notifyError('Pilih ukuran kemasan (SKU) produk terlebih dahulu.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      notifyError('Jumlah pesanan minimal 1.');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      notifyError('Harga satuan tidak valid.');
      return;
    }
    if (!Number.isFinite(discount) || discount < 0) {
      notifyError('Diskon tidak boleh bernilai negatif.');
      return;
    }
    if (!Number.isFinite(initialPaidAmount) || initialPaidAmount < 0) {
      notifyError('Nominal pembayaran awal tidak valid.');
      return;
    }
    if (initialPaidAmount > computedTotal + 0.01) {
      notifyError('Pembayaran awal tidak boleh melebihi total tagihan pesanan.');
      return;
    }
    if (customerMode === 'existing' && !selectedCustomerId) {
      notifyError('Pilih pelanggan atau buat pelanggan baru.');
      return;
    }
    if (customerMode === 'new' && !newCustomerName.trim()) {
      notifyError('Nama pelanggan wajib diisi.');
      return;
    }
    if (initialPaidAmount > 0 && !initialCashAccountId && !activeCashAccounts[0]?.id) {
      notifyError('Pilih akun kas penerima pembayaran (buat akun kas di menu Keuangan jika belum ada).');
      return;
    }

    const prefix = `MTO-${getTodayISO().slice(2).replace(/-/g, '')}-`;
    const maxSuffix = db.orders.reduce((max, o) => {
      if (!o.order_number.startsWith(prefix)) return max;
      const suffixNum = Number.parseInt(o.order_number.slice(prefix.length), 10);
      return Number.isFinite(suffixNum) && suffixNum > max ? suffixNum : max;
    }, 0);
    const orderNumber = `${prefix}${String(maxSuffix + 1).padStart(3, '0')}`;

    const result = await executeMutation(async () => {
      let customerId = selectedCustomerId || null;
      let createdCustomerId: string | null = null;
      if (customerMode === 'new') {
        const createdCustomer = await supabaseService.createCustomer({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
        });
        customerId = createdCustomer.id;
        createdCustomerId = createdCustomer.id;
      }

      const cashAccId = initialCashAccountId || activeCashAccounts[0]?.id || '';

      try {
        return await supabaseService.createOrder({
          order_number: orderNumber,
          customer_id: customerId,
          order_date: orderDate,
          due_date: dueDate || null,
          status: 'Menunggu',
          discount: Math.max(0, discount),
          notes: notes.trim() || null,
          items: [
            {
              sku_id: selectedSkuId,
              quantity: Math.max(1, quantity),
              unit_price: Math.max(0, unitPrice),
            },
          ],
          initial_payment:
            initialPaidAmount > 0 && cashAccId
              ? {
                  amount: initialPaidAmount,
                  cash_account_id: cashAccId,
                  payment_method: initialPayMethod,
                  payment_date: orderDate,
                  notes: 'Pembayaran awal saat pencatatan pesanan',
                }
              : undefined,
        });
      } catch (err) {
        const orderErrMsg = err instanceof Error ? err.message : String(err);
        if (createdCustomerId) {
          try {
            await supabaseService.deleteCustomer(createdCustomerId);
          } catch (rbErr) {
            const rbMsg = rbErr instanceof Error ? rbErr.message : String(rbErr);
            throw new Error(
              `${orderErrMsg}. PERINGATAN ROLLBACK: Pelanggan baru gagal dihapus otomatis (${rbMsg}).`
            );
          }
        }
        throw err;
      }
    }, `Pesanan ${orderNumber} berhasil disimpan ke Supabase.`);

    if (result) {
      setNewCustomerName('');
      setNewCustomerPhone('');
      setQuantity(1);
      setDiscount(0);
      setInitialPaidAmount(0);
      setNotes('');
      closeModal();
    }
  };

  const handleOpenPaymentModal = (orderId: string, remaining: number) => {
    setPaymentOrderId(orderId);
    setPayAmount(Math.max(0, remaining));
    setPayDate(getTodayISO());
    setPayCashAccountId(activeCashAccounts[0]?.id ?? '');
    setPayNotes('');
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentOrderId) return;
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      notifyError('Nominal pembayaran harus lebih besar dari 0.');
      return;
    }
    const payView = orderPaymentStatusMap.get(paymentOrderId);
    const remaining = Number(
      payView?.remaining_payment ??
        Math.max(0, (payView?.total_amount ?? 0) - (paidByOrderMap.get(paymentOrderId) ?? 0))
    );
    if (payView && payAmount > remaining + 0.01) {
      notifyError(
        `Nominal pembayaran (${formatIDR(payAmount)}) melebihi sisa tagihan (${formatIDR(remaining)}).`
      );
      return;
    }
    const cashId = payCashAccountId || activeCashAccounts[0]?.id;
    if (!cashId) {
      notifyError('Pilih akun kas penerima terlebih dahulu.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.registerOrderPayment({
          order_id: paymentOrderId,
          cash_account_id: cashId,
          payment_date: payDate,
          amount: payAmount,
          payment_method: payMethod,
          notes: payNotes.trim() || null,
        }),
      'Pembayaran pesanan berhasil dicatat.'
    );

    if (res !== null) {
      setPaymentOrderId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return db.orders.filter((order) => {
      if (
        statusFilter !== 'Semua' &&
        normalizeOrderStatusLabel(order.status) !== statusFilter
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const custName = order.customer_id
          ? customerMap.get(order.customer_id)?.name ?? ''
          : '';
        return (
          order.order_number.toLowerCase().includes(q) ||
          custName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [db.orders, statusFilter, searchQuery, customerMap]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
            Manajemen Pesanan (Made to Order)
          </h2>
          <p className="mt-0.5 text-sm text-[#6F574A]">
            Produksi dimulai berdasarkan pesanan pelanggan yang tercatat di database.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!selectedSkuId && skuOptions[0]) {
              setSelectedSkuId(skuOptions[0].id);
              setUnitPrice(Number(skuOptions[0].selling_price));
            }
            if (!initialCashAccountId && activeCashAccounts[0]) {
              setInitialCashAccountId(activeCashAccounts[0].id);
            }
            if (!selectedCustomerId && db.customers[0]) {
              setSelectedCustomerId(db.customers[0].id);
            }
            setLocalModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pesanan</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-[#E5D9C8] rounded-xl p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 flex-wrap">
            {ORDER_STATUS_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#362015] text-[#FDFBF7]'
                    : 'bg-[#FAF6F0] text-[#5E3A28] hover:bg-[#EFE6DA]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-[#8A7163] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID pesanan atau pelanggan..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg text-[#2B1B12] placeholder-[#8A7163] focus:outline-none focus:border-[#C59B43]"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Tidak Ada Pesanan Ditemukan"
            description="Belum ada pesanan yang sesuai filter ini. Tambahkan pesanan baru untuk mulai mencatat antrean MTO."
            actionLabel="Tambah Pesanan Baru"
            onAction={() => setLocalModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                  <th className="py-3 px-4">ID Pesanan</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Tanggal Pesan</th>
                  <th className="py-3 px-4">Estimasi Selesai</th>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4 text-right">Jumlah</th>
                  <th className="py-3 px-4 text-right">Total Harga</th>
                  <th className="py-3 px-4">Status Pembayaran</th>
                  <th className="py-3 px-4">Status Pesanan</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5EFE6] text-xs">
                {filteredOrders.map((order) => {
                  const items = itemsByOrderMap.get(order.id) ?? [];
                  const totalQty = items.reduce((s, i) => s + Number(i.quantity), 0);
                  const payView = orderPaymentStatusMap.get(order.id);
                  const totalAmt = Number(payView?.total_amount ?? order.total_amount);
                  const paid = Number(payView?.total_paid ?? paidByOrderMap.get(order.id) ?? 0);
                  const remaining = Number(
                    payView?.remaining_payment ?? Math.max(0, totalAmt - paid)
                  );
                  const payStatus =
                    payView?.payment_status ??
                    (paid >= totalAmt && totalAmt > 0
                      ? 'Lunas'
                      : paid > 0
                      ? 'DP / Sebagian'
                      : 'Belum Bayar');
                  const customerName = order.customer_id
                    ? customerMap.get(order.customer_id)?.name ?? 'Pelanggan'
                    : 'Pelanggan Umum';

                  return (
                    <tr key={order.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-[#2B1B12] tabular-nums whitespace-nowrap">
                        {order.order_number}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#2B1B12]">
                        {customerName}
                      </td>
                      <td className="py-3.5 px-4 text-[#5E3A28] tabular-nums whitespace-nowrap">
                        {formatDateID(order.order_date)}
                      </td>
                      <td className="py-3.5 px-4 text-[#5E3A28] tabular-nums whitespace-nowrap">
                        {order.due_date ? formatDateID(order.due_date) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-[#2B1B12]">
                        {items.length === 0 ? (
                          <span className="text-[#8A7163]">-</span>
                        ) : (
                          items.map((item) => (
                            <div key={item.id} className="whitespace-nowrap">
                              {skuLabelMap.get(item.sku_id) ?? 'SKU'} × {item.quantity}
                            </div>
                          ))
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-[#2B1B12] tabular-nums">
                        {totalQty}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[#2B1B12] tabular-nums whitespace-nowrap">
                        <div>{formatIDR(totalAmt)}</div>
                        {paid > 0 && (
                          <div className="text-[11px] font-normal text-[#6F574A]">
                            Dibayar: {formatIDR(paid)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <PaymentStatusLabel status={payStatus} />
                          {remaining > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(order.id, remaining)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5E3A28] hover:text-[#2B1B12] underline cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Catat Bayar</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <OrderStatusLabel status={order.status} />
                          <select
                            aria-label={`Ubah status pesanan ${order.order_number}`}
                            disabled={isMutating}
                            value={normalizeOrderStatusLabel(order.status)}
                            onChange={(e) =>
                              void executeMutation(
                                () =>
                                  supabaseService.updateOrderStatus(
                                    order.id,
                                    e.target.value
                                  ),
                                `Status pesanan ${order.order_number} diperbarui.`
                              )
                            }
                            className="block w-full text-[11px] bg-[#FAF6F0] border border-[#E5D9C8] rounded px-2 py-1 text-[#5E3A28]"
                          >
                            {ORDER_STATUS_VALUES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() =>
                            void executeMutation(
                              () => supabaseService.deleteOrder(order.id),
                              `Pesanan ${order.order_number} dihapus.`
                            )
                          }
                          aria-label={`Hapus pesanan ${order.order_number}`}
                          className="p-1.5 rounded-md text-[#8A7163] hover:text-[#B4382A] hover:bg-[#FDF2F0] transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Order Modal */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title="Catat Pesanan Baru (MTO)"
        subtitle="Pesanan tersimpan langsung ke tabel orders dan order_items Supabase."
      >
        {activeSkuOptions.length === 0 ? (
          <div className="space-y-4 text-xs text-[#5E3A28]">
            <p className="leading-relaxed">
              Belum ada SKU ukuran kemasan produk yang terdaftar di database. Silakan buat varian/ukuran kemasan produk terlebih dahulu di halaman <strong>Produk</strong> agar pesanan dapat dikaitkan dengan SKU resmi.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-[#E5D9C8] cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  closeModal();
                  onNavigate('produk');
                }}
                className="px-4 py-2 rounded-lg bg-[#362015] text-[#FDFBF7] cursor-pointer"
              >
                Buka Halaman Produk
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmitOrder(e)} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#2B1B12]">
                  Pelanggan
                </label>
                {db.customers.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCustomerMode((m) => (m === 'existing' ? 'new' : 'existing'))
                    }
                    className="text-[11px] font-medium text-[#5E3A28] underline cursor-pointer"
                  >
                    {customerMode === 'existing'
                      ? '+ Pelanggan Baru'
                      : 'Pilih Pelanggan Tersimpan'}
                  </button>
                )}
              </div>

              {customerMode === 'existing' && db.customers.length > 0 ? (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  <option value="">-- Pilih Pelanggan --</option>
                  {db.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Nama pelanggan..."
                    className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                  />
                  <input
                    type="text"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="No. HP / WA (opsional)"
                    className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Tanggal Pesan
                </label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Estimasi Selesai
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Pilih Varian & Ukuran Kemasan (SKU)
              </label>
              <select
                required
                value={selectedSkuId}
                onChange={(e) => handleSkuChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              >
                <option value="">-- Pilih Produk --</option>
                {activeSkuOptions.map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {sku.label} · {formatIDR(Number(sku.selling_price))}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Jumlah (Qty)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Harga Satuan (IDR)
                </label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  required
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Diskon (IDR)
                </label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
                />
              </div>
            </div>

            {/* Optional Initial Payment */}
            {activeCashAccounts.length > 0 && (
              <div className="p-3.5 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA] space-y-3">
                <div className="text-xs font-medium text-[#2B1B12]">
                  Pembayaran Awal / DP (Opsional)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-[#6F574A] mb-1">
                      Nominal Diterima
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      max={computedTotal}
                      value={initialPaidAmount}
                      onChange={(e) => setInitialPaidAmount(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5D9C8] rounded-md tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6F574A] mb-1">
                      Akun Kas
                    </label>
                    <select
                      value={initialCashAccountId}
                      onChange={(e) => setInitialCashAccountId(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5D9C8] rounded-md"
                    >
                      {activeCashAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6F574A] mb-1">
                      Metode
                    </label>
                    <select
                      value={initialPayMethod}
                      onChange={(e) => setInitialPayMethod(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5D9C8] rounded-md"
                    >
                      <option value="Tunai">Tunai</option>
                      <option value="Transfer Bank">Transfer Bank</option>
                      <option value="QRIS">QRIS</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Catatan Pesanan (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan khusus pelanggan..."
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>

            <div className="pt-3 border-t border-[#EFE6DA] flex items-center justify-between gap-4">
              <div className="text-xs">
                <span className="text-[#7A6154]">Total Harga: </span>
                <span className="font-display font-semibold text-sm text-[#2B1B12] tabular-nums">
                  {formatIDR(computedTotal)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28] hover:bg-[#FAF6F0] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] disabled:opacity-60 cursor-pointer"
                >
                  {isMutating ? 'Menyimpan...' : 'Simpan Pesanan'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Register Order Payment Modal */}
      <Modal
        open={Boolean(paymentOrderId)}
        onClose={() => setPaymentOrderId(null)}
        title="Catat Pembayaran Pesanan"
        subtitle="Diproses melalui fungsi database register_order_payment."
      >
        {activeCashAccounts.length === 0 ? (
          <div className="space-y-4 text-xs text-[#5E3A28]">
            <p>
              Belum ada Akun Kas yang tersedia. Tambahkan Akun Kas terlebih dahulu di halaman <strong>Keuangan</strong> agar penerimaan kas dapat dicatat.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPaymentOrderId(null)}
                className="px-4 py-2 rounded-lg border border-[#E5D9C8]"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentOrderId(null);
                  onNavigate('keuangan');
                }}
                className="px-4 py-2 rounded-lg bg-[#362015] text-[#FDFBF7]"
              >
                Buka Halaman Keuangan
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmitPayment(e)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Tanggal Pembayaran
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                />
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
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Akun Kas Penerima
                </label>
                <select
                  required
                  value={payCashAccountId}
                  onChange={(e) => setPayCashAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  {activeCashAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} ({acc.account_type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  <option value="Tunai">Tunai</option>
                  <option value="Transfer Bank">Transfer Bank</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Catatan (Opsional)
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Misal: Pelunasan transfer"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>

            <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPaymentOrderId(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
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
        )}
      </Modal>
    </div>
  );
};
