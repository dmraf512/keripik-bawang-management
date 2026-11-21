import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CreditCard,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import { supabaseService } from '../services/supabaseService';
import { IngredientRow } from '../types/supabase';
import { formatDateID, formatIDR, getTodayISO } from '../utils/formatters';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';

type MaterialsTab = 'stock' | 'purchases' | 'movements';

export const MaterialsPage: React.FC = () => {
  const { db, isMutating, executeMutation, notifyError } = useBusinessData();
  const [activeTab, setActiveTab] = useState<MaterialsTab>('stock');

  // Ingredient Modal
  const [ingModalOpen, setIngModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [avgCost, setAvgCost] = useState<number>(0);

  // Edit Ingredient Modal
  const [editingIng, setEditingIng] = useState<IngredientRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editStock, setEditStock] = useState<number>(0);
  const [editAvgCost, setEditAvgCost] = useState<number>(0);
  const [editActive, setEditActive] = useState<boolean>(true);

  // Purchase Modal (register_ingredient_purchase)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getTodayISO());
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<
    { ingredient_id: string; quantity: number; unit_price: number }[]
  >([]);

  // Purchase Payment Modal (register_purchase_payment)
  const [payPurchaseId, setPayPurchaseId] = useState<string | null>(null);
  const [payCashAccountId, setPayCashAccountId] = useState('');
  const [payDate, setPayDate] = useState(getTodayISO());
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('Tunai');
  const [payNotes, setPayNotes] = useState('');

  const ingredientMap = useMemo(
    () => new Map(db.ingredients.map((i) => [i.id, i])),
    [db.ingredients]
  );

  const activeCashAccounts = useMemo(
    () => db.cashAccounts.filter((a) => a.is_active),
    [db.cashAccounts]
  );

  const paidByPurchaseMap = useMemo(() => {
    const map = new Map<string, number>();
    db.purchasePayments.forEach((p) => {
      map.set(p.purchase_id, (map.get(p.purchase_id) ?? 0) + Number(p.amount));
    });
    return map;
  }, [db.purchasePayments]);

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) {
      notifyError('Nama bahan dan satuan wajib diisi.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.createIngredient({
          name: name.trim(),
          unit: unit.trim(),
          current_stock: Math.max(0, currentStock),
          average_unit_cost: Math.max(0, avgCost),
        }),
      `Bahan baku "${name.trim()}" berhasil ditambahkan.`
    );

    if (res) {
      setName('');
      setCurrentStock(0);
      setAvgCost(0);
      setIngModalOpen(false);
    }
  };

  const handleOpenEditIngredient = (ing: IngredientRow) => {
    setEditingIng(ing);
    setEditName(ing.name);
    setEditUnit(ing.unit);
    setEditStock(Number(ing.current_stock));
    setEditAvgCost(Number(ing.average_unit_cost));
    setEditActive(ing.is_active);
  };

  const handleUpdateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIng || !editName.trim() || !editUnit.trim()) {
      notifyError('Nama bahan dan satuan wajib diisi.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.updateIngredient(editingIng.id, {
          name: editName.trim(),
          unit: editUnit.trim(),
          current_stock: Math.max(0, editStock),
          average_unit_cost: Math.max(0, editAvgCost),
          is_active: editActive,
        }),
      `Bahan baku "${editName.trim()}" berhasil diperbarui.`
    );

    if (res) {
      setEditingIng(null);
    }
  };

  const handleOpenPurchaseModal = () => {
    setSupplierName('');
    setPurchaseDate(getTodayISO());
    setPurchaseNotes('');
    setPurchaseItems(
      db.ingredients[0]
        ? [
            {
              ingredient_id: db.ingredients[0].id,
              quantity: 1,
              unit_price: Number(db.ingredients[0].average_unit_cost) || 0,
            },
          ]
        : []
    );
    setPurchaseModalOpen(true);
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = purchaseItems.filter((i) => i.ingredient_id && i.quantity > 0);
    if (valid.length === 0) {
      notifyError('Tambahkan minimal 1 item bahan baku yang dibeli.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.registerIngredientPurchase({
          supplier_name: supplierName.trim() || null,
          purchase_date: purchaseDate,
          items: valid,
          notes: purchaseNotes.trim() || null,
        }),
      'Pembelian bahan baku berhasil dicatat dan stok diperbarui.'
    );

    if (res !== null) {
      setPurchaseModalOpen(false);
    }
  };

  const handleOpenPurchasePayment = (purchaseId: string, remaining: number) => {
    setPayPurchaseId(purchaseId);
    setPayAmount(Math.max(0, remaining));
    setPayDate(getTodayISO());
    setPayCashAccountId(activeCashAccounts[0]?.id ?? '');
    setPayNotes('');
  };

  const handleSubmitPurchasePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payPurchaseId) return;
    if (!payCashAccountId) {
      notifyError('Pilih akun kas pembayaran terlebih dahulu.');
      return;
    }
    if (payAmount <= 0) {
      notifyError('Nominal pembayaran harus lebih dari 0.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.registerPurchasePayment({
          purchase_id: payPurchaseId,
          cash_account_id: payCashAccountId,
          payment_date: payDate,
          amount: payAmount,
          payment_method: payMethod,
          notes: payNotes.trim() || null,
        }),
      'Pembayaran pembelian bahan berhasil dicatat.'
    );

    if (res !== null) {
      setPayPurchaseId(null);
    }
  };

  const TABS: { id: MaterialsTab; label: string }[] = [
    { id: 'stock', label: 'Stok Bahan Baku' },
    { id: 'purchases', label: 'Pembelian Bahan' },
    { id: 'movements', label: 'Riwayat Mutasi Stok' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
            Bahan Baku & Pembelian
          </h2>
          <p className="mt-0.5 text-sm text-[#6F574A]">
            Kelola daftar bahan baku, pembelian pemasok (register_ingredient_purchase), dan mutasi stok.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleOpenPurchaseModal}
            disabled={db.ingredients.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[#362015] text-[#362015] hover:bg-[#FAF6F0] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Catat Pembelian</span>
          </button>

          <button
            type="button"
            onClick={() => setIngModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bahan</span>
          </button>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 p-1 bg-[#EFE6DA] border border-[#E5D9C8] rounded-lg flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === t.id
                ? 'bg-[#362015] text-[#FDFBF7]'
                : 'text-[#5E3A28] hover:text-[#2B1B12]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'stock' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
          {db.ingredients.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Belum Ada Daftar Bahan Baku"
              description="Tambahkan bahan baku seperti tepung terigu, bawang merah, minyak goreng, cabai, dan kemasan."
              actionLabel="Tambah Bahan Baku"
              onAction={() => setIngModalOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                    <th className="py-3 px-4">Nama Bahan</th>
                    <th className="py-3 px-4 text-right">Stok Saat Ini</th>
                    <th className="py-3 px-4 text-right">Harga Rata-rata / Satuan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ubah Stok / Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {db.ingredients.map((ing) => {
                    const isEmptyOrLow = Number(ing.current_stock) <= 0;
                    return (
                      <tr key={ing.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="py-3 px-4 font-medium text-[#2B1B12]">
                          {ing.name}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#2B1B12]">
                          {ing.current_stock} {ing.unit}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#2B1B12]">
                          {formatIDR(Number(ing.average_unit_cost))}
                        </td>
                        <td className="py-3 px-4">
                          {isEmptyOrLow ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B4382A]">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>Stok Habis</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E6B43]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Tersedia</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() =>
                                void executeMutation(
                                  () =>
                                    supabaseService.updateIngredient(ing.id, {
                                      name: ing.name,
                                      unit: ing.unit,
                                      current_stock: Math.max(
                                        0,
                                        Number((Number(ing.current_stock) - 1).toFixed(2))
                                      ),
                                      average_unit_cost: Number(ing.average_unit_cost),
                                      is_active: ing.is_active,
                                    }),
                                  `Stok ${ing.name} diperbarui.`
                                )
                              }
                              className="px-2 py-1 rounded border border-[#E5D9C8] text-[#5E3A28] hover:bg-[#FAF6F0] cursor-pointer"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() =>
                                void executeMutation(
                                  () =>
                                    supabaseService.updateIngredient(ing.id, {
                                      name: ing.name,
                                      unit: ing.unit,
                                      current_stock: Number(
                                        (Number(ing.current_stock) + 1).toFixed(2)
                                      ),
                                      average_unit_cost: Number(ing.average_unit_cost),
                                      is_active: ing.is_active,
                                    }),
                                  `Stok ${ing.name} diperbarui.`
                                )
                              }
                              className="px-2 py-1 rounded border border-[#E5D9C8] text-[#5E3A28] hover:bg-[#FAF6F0] cursor-pointer"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditIngredient(ing)}
                              aria-label={`Ubah ${ing.name}`}
                              title="Ubah bahan baku"
                              className="p-1.5 rounded text-[#8A7163] hover:text-[#362015] hover:bg-[#FAF6F0] cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() =>
                                void executeMutation(
                                  () => supabaseService.deleteIngredient(ing.id),
                                  `Bahan "${ing.name}" dihapus.`
                                )
                              }
                              aria-label={`Hapus ${ing.name}`}
                              className="p-1.5 rounded text-[#8A7163] hover:text-[#B4382A] hover:bg-[#FDF2F0] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'purchases' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
          {db.ingredientPurchases.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Belum Ada Catatan Pembelian Bahan"
              description="Catat belanja bahan baku dari pemasok untuk memperbarui stok dan harga rata-rata secara otomatis."
              actionLabel={
                db.ingredients.length > 0 ? 'Catat Pembelian Pertama' : undefined
              }
              onAction={
                db.ingredients.length > 0 ? handleOpenPurchaseModal : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Pemasok</th>
                    <th className="py-3 px-4">Rincian Bahan</th>
                    <th className="py-3 px-4 text-right">Total Tagihan</th>
                    <th className="py-3 px-4 text-right">Sudah Dibayar</th>
                    <th className="py-3 px-4 text-right">Pembayaran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {db.ingredientPurchases.map((pur) => {
                    const items = db.ingredientPurchaseItems.filter(
                      (i) => i.purchase_id === pur.id
                    );
                    const paid = paidByPurchaseMap.get(pur.id) ?? 0;
                    const rem = Math.max(0, Number(pur.total_amount) - paid);
                    return (
                      <tr key={pur.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="py-3 px-4 tabular-nums text-[#5E3A28] whitespace-nowrap">
                          {formatDateID(pur.purchase_date)}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#2B1B12]">
                          {pur.supplier_name || 'Pemasok Umum'}
                        </td>
                        <td className="py-3 px-4 text-[#2B1B12]">
                          {items.map((it) => {
                            const ing = ingredientMap.get(it.ingredient_id);
                            return (
                              <div key={it.id}>
                                {ing?.name ?? 'Bahan'} × {it.quantity} {ing?.unit ?? ''}
                              </div>
                            );
                          })}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold">
                          {formatIDR(Number(pur.total_amount))}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#1E6B43]">
                          {formatIDR(paid)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {rem > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleOpenPurchasePayment(pur.id, rem)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5E3A28] hover:text-[#2B1B12] underline cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Bayar ({formatIDR(rem)})</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-medium text-[#1E6B43]">
                              Lunas
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
          {db.ingredientStockMovements.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Belum Ada Riwayat Mutasi Stok"
              description="Mutasi masuk dan keluar bahan baku akan tercatat otomatis dari pembelian dan batch produksi."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Bahan Baku</th>
                    <th className="py-3 px-4">Jenis Mutasi</th>
                    <th className="py-3 px-4 text-right">Jumlah</th>
                    <th className="py-3 px-4">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {db.ingredientStockMovements.map((mov) => {
                    const ing = ingredientMap.get(mov.ingredient_id);
                    return (
                      <tr key={mov.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="py-3 px-4 tabular-nums text-[#5E3A28] whitespace-nowrap">
                          {formatDateID(mov.movement_date)}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#2B1B12]">
                          {ing?.name ?? 'Bahan'}
                        </td>
                        <td className="py-3 px-4 text-[#5E3A28]">{mov.movement_type}</td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium">
                          {mov.quantity} {ing?.unit ?? ''}
                        </td>
                        <td className="py-3 px-4 text-[#6F574A]">{mov.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah Bahan */}
      <Modal
        open={ingModalOpen}
        onClose={() => setIngModalOpen(false)}
        title="Tambah Bahan Baku Baru"
      >
        <form onSubmit={(e) => void handleCreateIngredient(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Nama Bahan Baku
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Bawang Merah / Tepung Terigu"
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Satuan
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg / liter / pcs"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Stok Awal
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Harga Satuan (IDR)
              </label>
              <input
                type="number"
                min={0}
                value={avgCost}
                onChange={(e) => setAvgCost(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIngModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
            >
              {isMutating ? 'Menyimpan...' : 'Simpan Bahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Catat Pembelian Bahan */}
      <Modal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        title="Catat Pembelian Bahan Baku"
        subtitle="Diproses melalui fungsi register_ingredient_purchase di Supabase."
      >
        <form onSubmit={(e) => void handleSubmitPurchase(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Tanggal Pembelian
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Nama Pemasok / Toko
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Misal: Pasar Tradisional / Toko A"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#2B1B12]">
              Daftar Bahan yang Dibeli
            </label>
            {purchaseItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={item.ingredient_id}
                  onChange={(e) => {
                    const next = [...purchaseItems];
                    next[idx].ingredient_id = e.target.value;
                    setPurchaseItems(next);
                  }}
                  className="col-span-5 px-2.5 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  {db.ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...purchaseItems];
                    next[idx].quantity = Number(e.target.value);
                    setPurchaseItems(next);
                  }}
                  placeholder="Qty"
                  className="col-span-3 px-2.5 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  required
                  value={item.unit_price}
                  onChange={(e) => {
                    const next = [...purchaseItems];
                    next[idx].unit_price = Number(e.target.value);
                    setPurchaseItems(next);
                  }}
                  placeholder="Harga"
                  className="col-span-3 px-2.5 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPurchaseItems((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="col-span-1 p-1.5 text-[#8A7163] hover:text-[#B4382A]"
                  aria-label="Hapus item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setPurchaseItems((prev) => [
                  ...prev,
                  {
                    ingredient_id: db.ingredients[0]?.id ?? '',
                    quantity: 1,
                    unit_price: 0,
                  },
                ])
              }
              className="text-xs font-medium text-[#5E3A28] underline cursor-pointer"
            >
              + Tambah Baris Bahan
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              value={purchaseNotes}
              onChange={(e) => setPurchaseNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-[#EFE6DA] flex items-center justify-between gap-4">
            <div className="text-xs">
              <span className="text-[#7A6154]">Total Pembelian: </span>
              <span className="font-display font-semibold text-sm text-[#2B1B12] tabular-nums">
                {formatIDR(
                  purchaseItems.reduce(
                    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
                    0
                  )
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPurchaseModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isMutating}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
              >
                {isMutating ? 'Menyimpan...' : 'Simpan Pembelian'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Bahan Baku */}
      <Modal
        open={Boolean(editingIng)}
        onClose={() => setEditingIng(null)}
        title="Ubah Bahan Baku"
      >
        <form onSubmit={(e) => void handleUpdateIngredient(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Nama Bahan Baku
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Satuan
              </label>
              <input
                type="text"
                required
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Stok Saat Ini
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={editStock}
                onChange={(e) => setEditStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Harga Rata-rata (IDR)
              </label>
              <input
                type="number"
                min={0}
                value={editAvgCost}
                onChange={(e) => setEditAvgCost(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="edit-ing-active"
              type="checkbox"
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
              className="w-4 h-4 accent-[#362015]"
            />
            <label htmlFor="edit-ing-active" className="text-xs text-[#2B1B12]">
              Bahan baku aktif
            </label>
          </div>
          <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingIng(null)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
            >
              {isMutating ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Bayar Pembelian */}
      <Modal
        open={Boolean(payPurchaseId)}
        onClose={() => setPayPurchaseId(null)}
        title="Catat Pembayaran Pembelian Bahan"
        subtitle="Diproses melalui fungsi register_purchase_payment di Supabase."
      >
        {activeCashAccounts.length === 0 ? (
          <p className="text-xs text-[#5E3A28]">
            Belum ada Akun Kas tersedia. Tambahkan Akun Kas di halaman <strong>Keuangan</strong> terlebih dahulu.
          </p>
        ) : (
          <form
            onSubmit={(e) => void handleSubmitPurchasePayment(e)}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Tanggal Bayar
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
                  min={1}
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
                  Akun Kas Sumber
                </label>
                <select
                  required
                  value={payCashAccountId}
                  onChange={(e) => setPayCashAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  {activeCashAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name}
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
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>

            <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayPurchaseId(null)}
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
