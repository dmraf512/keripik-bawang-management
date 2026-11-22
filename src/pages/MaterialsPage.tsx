import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CreditCard,
  Pencil,
  Plus,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import { useBusinessMetrics } from '../hooks/useBusinessMetrics';
import { supabaseService } from '../services/supabaseService';
import {
  IngredientAdjustmentType,
  IngredientRow,
  MaterialType,
} from '../types/supabase';
import {
  formatDateID,
  formatDecimalIDR,
  formatIDR,
  formatQuantity,
  getTodayISO,
} from '../utils/formatters';
import {
  MATERIAL_TYPE_OPTIONS,
  convertToCanonicalQuantity,
  getAdjustmentUnitOptions,
  getCanonicalUnit,
  getMaterialTypeLabel,
  getPurchaseUnitOptions,
  inferMaterialType,
  roundPrecision,
} from '../utils/units';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { StatCard } from '../components/common/StatCard';

type MaterialsTab = 'stock' | 'purchases' | 'movements';

interface PurchaseItemDraft {
  ingredient_id: string;
  input_quantity: number;
  input_unit: string;
  input_unit_price: number;
}

export const MaterialsPage: React.FC = () => {
  const { db, isMutating, executeMutation, notifyError } = useBusinessData();
  const {
    ingredientStockMap,
    totalIngredientAssetValue,
    purchasePaymentStatusMap,
  } = useBusinessMetrics();

  const [activeTab, setActiveTab] = useState<MaterialsTab>('stock');

  // Create Ingredient Modal
  const [ingModalOpen, setIngModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('solid');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [avgCost, setAvgCost] = useState<number>(0);

  // Edit Ingredient Metadata Modal (tanpa mutasi stok langsung)
  const [editingIng, setEditingIng] = useState<IngredientRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editMaterialType, setEditMaterialType] = useState<MaterialType>('solid');
  const [editAvgCost, setEditAvgCost] = useState<number>(0);
  const [editActive, setEditActive] = useState<boolean>(true);

  // Adjust Stock Modal (via adjust_ingredient_stock RPC)
  const [adjustingIng, setAdjustingIng] = useState<IngredientRow | null>(null);
  const [adjustType, setAdjustType] =
    useState<IngredientAdjustmentType>('adjustment_in');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustUnit, setAdjustUnit] = useState<string>('gram');
  const [adjustNotes, setAdjustNotes] = useState<string>('');

  // Purchase Modal (register_ingredient_purchase)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getTodayISO());
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemDraft[]>([]);

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

  const lowOrEmptyCount = useMemo(() => {
    let count = 0;
    db.ingredients.forEach((ing) => {
      const stockView = ingredientStockMap.get(ing.id);
      const stock = Number(stockView?.current_stock ?? ing.current_stock);
      if (stock <= 0) count += 1;
    });
    return count;
  }, [db.ingredients, ingredientStockMap]);

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      notifyError('Nama bahan baku wajib diisi.');
      return;
    }
    if (!Number.isFinite(currentStock) || currentStock < 0) {
      notifyError('Stok awal bahan baku tidak valid.');
      return;
    }
    if (!Number.isFinite(avgCost) || avgCost < 0) {
      notifyError('Harga rata-rata bahan baku tidak valid.');
      return;
    }

    const canonicalUnit = getCanonicalUnit(materialType);
    const res = await executeMutation(
      () =>
        supabaseService.createIngredient({
          name: name.trim(),
          material_type: materialType,
          unit: canonicalUnit,
          current_stock: Math.max(0, currentStock),
          average_unit_cost: Math.max(0, avgCost),
        }),
      `Bahan baku "${name.trim()}" (${canonicalUnit}) berhasil ditambahkan.`
    );

    if (res) {
      setName('');
      setMaterialType('solid');
      setCurrentStock(0);
      setAvgCost(0);
      setIngModalOpen(false);
    }
  };

  const handleOpenEditIngredient = (ing: IngredientRow) => {
    setEditingIng(ing);
    setEditName(ing.name);
    setEditMaterialType(inferMaterialType(ing.material_type, ing.unit, ing.name));
    setEditAvgCost(Number(ing.average_unit_cost));
    setEditActive(ing.is_active);
  };

  const handleUpdateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIng || !editName.trim()) {
      notifyError('Nama bahan baku wajib diisi.');
      return;
    }
    if (!Number.isFinite(editAvgCost) || editAvgCost < 0) {
      notifyError('Harga rata-rata tidak valid.');
      return;
    }

    const canonicalUnit = getCanonicalUnit(editMaterialType);
    if (canonicalUnit !== editingIng.unit) {
      const hasStock = Number(editingIng.current_stock) > 0;
      const hasHistory =
        db.ingredientStockMovements.some((m) => m.ingredient_id === editingIng.id) ||
        db.ingredientPurchaseItems.some((p) => p.ingredient_id === editingIng.id) ||
        db.productionMaterials.some((pm) => pm.ingredient_id === editingIng.id) ||
        db.productRecipeItems.some((r) => r.ingredient_id === editingIng.id);

      if (hasStock || hasHistory) {
        notifyError(
          `Satuan dasar (${editingIng.unit} → ${canonicalUnit}) tidak dapat diubah karena bahan masih memiliki stok atau sudah tercatat di riwayat pembelian, mutasi, produksi, maupun resep.`
        );
        return;
      }
    }

    const res = await executeMutation(
      () =>
        supabaseService.updateIngredient(editingIng.id, {
          name: editName.trim(),
          material_type: editMaterialType,
          unit: canonicalUnit,
          average_unit_cost: Math.max(0, editAvgCost),
          is_active: editActive,
        }),
      `Informasi bahan baku "${editName.trim()}" berhasil diperbarui.`
    );

    if (res) {
      setEditingIng(null);
    }
  };

  const handleOpenAdjustStock = (ing: IngredientRow) => {
    const mt = inferMaterialType(ing.material_type, ing.unit, ing.name);
    const options = getAdjustmentUnitOptions(mt);
    setAdjustingIng(ing);
    setAdjustType('adjustment_in');
    setAdjustQuantity(0);
    setAdjustUnit(options[0]?.unit ?? getCanonicalUnit(mt));
    setAdjustNotes('');
  };

  const handleSubmitAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingIng) return;
    if (!Number.isFinite(adjustQuantity) || adjustQuantity <= 0) {
      notifyError('Jumlah penyesuaian stok harus lebih dari 0.');
      return;
    }
    if (!adjustNotes.trim()) {
      notifyError('Catatan alasan penyesuaian stok wajib diisi.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.adjustIngredientStock({
          ingredient_id: adjustingIng.id,
          adjustment_type: adjustType,
          quantity: adjustQuantity,
          unit: adjustUnit,
          notes: adjustNotes.trim(),
        }),
      `Stok "${adjustingIng.name}" berhasil disesuaikan melalui adjust_ingredient_stock.`
    );

    if (res !== null) {
      setAdjustingIng(null);
    }
  };

  const buildDefaultPurchaseDraft = (ing?: IngredientRow): PurchaseItemDraft => {
    if (!ing) {
      return {
        ingredient_id: '',
        input_quantity: 1,
        input_unit: 'gram',
        input_unit_price: 0,
      };
    }
    const mt = inferMaterialType(ing.material_type, ing.unit, ing.name);
    const options = getPurchaseUnitOptions(mt);
    // Default ke kg/liter jika tersedia agar lebih praktis saat belanja pemasok
    const preferredOption =
      options.find((o) => o.unit === 'kg' || o.unit === 'liter') ?? options[0];
    const baseCost = Number(ing.average_unit_cost) || 0;
    return {
      ingredient_id: ing.id,
      input_quantity: 1,
      input_unit: preferredOption.unit,
      input_unit_price: roundPrecision(baseCost * preferredOption.factor, 6),
    };
  };

  const handleOpenPurchaseModal = () => {
    setSupplierName('');
    setPurchaseDate(getTodayISO());
    setPurchaseNotes('');
    const firstIng = db.ingredients[0];
    setPurchaseItems(firstIng ? [buildDefaultPurchaseDraft(firstIng)] : []);
    setPurchaseModalOpen(true);
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0) {
      notifyError('Tambahkan minimal 1 item bahan baku.');
      return;
    }
    const hasInvalid = purchaseItems.some(
      (i) =>
        !i.ingredient_id ||
        !Number.isFinite(i.input_quantity) ||
        i.input_quantity <= 0 ||
        !Number.isFinite(i.input_unit_price) ||
        i.input_unit_price < 0
    );
    if (hasInvalid) {
      notifyError('Pastikan seluruh item pembelian memiliki bahan, jumlah > 0, dan harga >= 0 yang valid.');
      return;
    }

    const mappedItems = purchaseItems.map((item) => {
      const ing = ingredientMap.get(item.ingredient_id);
      const mt = inferMaterialType(ing?.material_type, ing?.unit, ing?.name);
      const conv = convertToCanonicalQuantity(item.input_quantity, item.input_unit, mt);
      const canonicalUnitPrice = roundPrecision(
        item.input_unit_price / conv.conversionFactor,
        6
      );
      return {
        ingredient_id: item.ingredient_id,
        input_quantity: roundPrecision(item.input_quantity, 4),
        input_unit: item.input_unit,
        input_unit_price: roundPrecision(item.input_unit_price, 6),
        conversion_factor: conv.conversionFactor,
        quantity: conv.canonicalQuantity,
        unit_price: canonicalUnitPrice,
      };
    });

    const res = await executeMutation(
      () =>
        supabaseService.registerIngredientPurchase({
          supplier_name: supplierName.trim() || null,
          purchase_date: purchaseDate,
          items: mappedItems,
          notes: purchaseNotes.trim() || null,
        }),
      'Pembelian bahan baku berhasil dicatat dan stok kanonis diperbarui.'
    );

    if (res !== null) {
      setPurchaseModalOpen(false);
    }
  };

  const handleOpenPurchasePayment = (purchaseId: string, remaining: number) => {
    setPayPurchaseId(purchaseId);
    setPayAmount(Math.max(0, roundPrecision(remaining, 4)));
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
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      notifyError('Nominal pembayaran harus lebih dari 0.');
      return;
    }
    const statusView = purchasePaymentStatusMap.get(payPurchaseId);
    const remaining = Number(statusView?.remaining_payment ?? 0);
    if (statusView && payAmount > remaining + 0.01) {
      notifyError(
        `Nominal pembayaran (${formatDecimalIDR(payAmount, 2)}) melebihi sisa tagihan (${formatDecimalIDR(remaining, 2)}).`
      );
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

  const adjustingMaterialType = adjustingIng
    ? inferMaterialType(adjustingIng.material_type, adjustingIng.unit, adjustingIng.name)
    : 'solid';
  const adjustingConversion = convertToCanonicalQuantity(
    adjustQuantity,
    adjustUnit,
    adjustingMaterialType
  );

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
            Bahan Baku &amp; Pembelian
          </h2>
          <p className="mt-0.5 text-sm text-[#6F574A]">
            Penyimpanan kanonis (gram / ml / pcs), konversi kg/liter/butir, nilai persediaan, dan audit mutasi stok.
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

      {/* Ringkasan Persediaan dari v_ingredient_stock */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Jenis Bahan Baku"
          value={`${db.ingredients.length} item`}
          helperText={`${db.ingredients.filter((i) => i.is_active).length} aktif`}
        />
        <StatCard
          label="Nilai Aset Persediaan Bahan"
          value={formatIDR(totalIngredientAssetValue)}
          helperText="Sumber: v_ingredient_stock (aset, bukan beban)"
          emphasis="accent"
        />
        <StatCard
          label="Bahan Stok Habis"
          value={`${lowOrEmptyCount} item`}
          helperText={
            lowOrEmptyCount > 0 ? 'Perlu belanja bahan segera' : 'Seluruh bahan tersedia'
          }
          emphasis={lowOrEmptyCount > 0 ? 'negative' : 'positive'}
        />
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
              description="Tambahkan bahan baku seperti tepung terigu (gram), minyak goreng (ml), telur (gram/butir), dan kemasan (pcs)."
              actionLabel="Tambah Bahan Baku"
              onAction={() => setIngModalOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                    <th className="py-3 px-4">Nama Bahan</th>
                    <th className="py-3 px-4">Jenis / Satuan</th>
                    <th className="py-3 px-4 text-right">Stok Kanonis</th>
                    <th className="py-3 px-4 text-right">Harga Rata-rata / Satuan</th>
                    <th className="py-3 px-4 text-right">Nilai Persediaan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Penyesuaian / Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {db.ingredients.map((ing) => {
                    const stockView = ingredientStockMap.get(ing.id);
                    const stockQty = Number(stockView?.current_stock ?? ing.current_stock);
                    const avgUnitCost = Number(
                      stockView?.average_unit_cost ?? ing.average_unit_cost
                    );
                    const stockVal = Number(
                      stockView?.stock_value ?? stockQty * avgUnitCost
                    );
                    const unit = stockView?.unit ?? ing.unit;
                    const mt = inferMaterialType(ing.material_type, unit, ing.name);
                    const isEmptyOrLow = stockQty <= 0;

                    return (
                      <tr key={ing.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="py-3 px-4 font-medium text-[#2B1B12]">
                          <div>{ing.name}</div>
                          {!ing.is_active && (
                            <span className="text-[10px] text-[#8A7163]">Nonaktif</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#6F574A]">
                          {getMaterialTypeLabel(mt)} · {unit}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#2B1B12]">
                          {formatQuantity(stockQty, unit)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#2B1B12]">
                          {formatDecimalIDR(avgUnitCost)} / {unit}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium text-[#362015]">
                          {formatIDR(stockVal)}
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
                              onClick={() => handleOpenAdjustStock(ing)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#D9CBB8] bg-[#FAF6F0] text-[#362015] hover:bg-[#EFE6DA] text-[11px] font-medium cursor-pointer"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              <span>Sesuaikan Stok</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditIngredient(ing)}
                              aria-label={`Ubah ${ing.name}`}
                              title="Ubah info bahan baku"
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
              description="Catat belanja bahan baku dari pemasok untuk memperbarui stok dan harga rata-rata tertimbang secara otomatis."
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
                    const statusView = purchasePaymentStatusMap.get(pur.id);
                    const totalAmt = Number(statusView?.total_amount ?? pur.total_amount);
                    const paid = Number(statusView?.total_paid ?? 0);
                    const rem = Number(
                      statusView?.remaining_payment ?? Math.max(0, totalAmt - paid)
                    );
                    return (
                      <tr key={pur.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="py-3 px-4 tabular-nums text-[#5E3A28] whitespace-nowrap">
                          {formatDateID(pur.purchase_date)}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#2B1B12]">
                          {pur.supplier_name || 'Pemasok Umum'}
                        </td>
                        <td className="py-3 px-4 text-[#2B1B12] space-y-0.5">
                          {items.map((it) => {
                            const ing = ingredientMap.get(it.ingredient_id);
                            const hasInput =
                              it.input_quantity !== null &&
                              it.input_quantity !== undefined &&
                              it.input_unit &&
                              it.input_unit !== ing?.unit;
                            return (
                              <div key={it.id}>
                                {ing?.name ?? 'Bahan'} ×{' '}
                                {hasInput ? (
                                  <>
                                    {formatQuantity(Number(it.input_quantity), it.input_unit)}{' '}
                                    <span className="text-[#7A6154]">
                                      ({formatQuantity(Number(it.quantity), ing?.unit)})
                                    </span>
                                  </>
                                ) : (
                                  formatQuantity(Number(it.quantity), ing?.unit)
                                )}
                              </div>
                            );
                          })}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold">
                          {formatIDR(totalAmt)}
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
              description="Mutasi masuk, keluar produksi, dan penyesuaian stok akan tercatat otomatis di sini."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Bahan Baku</th>
                    <th className="py-3 px-4">Jenis Mutasi</th>
                    <th className="py-3 px-4 text-right">Jumlah Kanonis</th>
                    <th className="py-3 px-4 text-right">Biaya Satuan</th>
                    <th className="py-3 px-4">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {db.ingredientStockMovements.map((mov) => {
                    const ing = ingredientMap.get(mov.ingredient_id);
                    const hasInput =
                      mov.input_quantity !== null &&
                      mov.input_quantity !== undefined &&
                      mov.input_unit &&
                      mov.input_unit !== ing?.unit;
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
                          <div>{formatQuantity(Number(mov.quantity), ing?.unit)}</div>
                          {hasInput && (
                            <div className="text-[11px] text-[#8A7163]">
                              Input: {formatQuantity(Number(mov.input_quantity), mov.input_unit)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#5E3A28]">
                          {mov.unit_cost !== null
                            ? formatDecimalIDR(Number(mov.unit_cost))
                            : '-'}
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
        subtitle="Satuan dasar ditetapkan otomatis berdasarkan jenis bahan (gram, ml, atau pcs)."
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
              placeholder="Contoh: Bawang Merah / Minyak Goreng / Telur Ayam"
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Jenis Bahan &amp; Satuan Penyimpanan Kanonis
            </label>
            <select
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value as MaterialType)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            >
              {MATERIAL_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[#7A6154]">
              {MATERIAL_TYPE_OPTIONS.find((o) => o.value === materialType)?.helper}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Stok Awal ({getCanonicalUnit(materialType)})
              </label>
              <input
                type="number"
                step="any"
                min={0}
                required
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Harga Rata-rata / {getCanonicalUnit(materialType)} (IDR)
              </label>
              <input
                type="number"
                step="any"
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

      {/* Modal Sesuaikan Stok (adjust_ingredient_stock) */}
      <Modal
        open={Boolean(adjustingIng)}
        onClose={() => setAdjustingIng(null)}
        title={`Sesuaikan Stok — ${adjustingIng?.name ?? ''}`}
        subtitle="Diproses melalui fungsi adjust_ingredient_stock agar tercatat di riwayat mutasi stok."
      >
        {adjustingIng && (
          <form onSubmit={(e) => void handleSubmitAdjustStock(e)} className="space-y-4">
            <div className="p-3 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA] text-xs flex items-center justify-between">
              <span className="text-[#6F574A]">Stok Kanonis Saat Ini:</span>
              <span className="font-semibold text-[#2B1B12] tabular-nums">
                {formatQuantity(Number(adjustingIng.current_stock), adjustingIng.unit)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Jenis Penyesuaian
                </label>
                <select
                  value={adjustType}
                  onChange={(e) =>
                    setAdjustType(e.target.value as IngredientAdjustmentType)
                  }
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  <option value="adjustment_in">Penambahan (+ Masuk)</option>
                  <option value="adjustment_out">Pengurangan (- Keluar)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Jumlah
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Satuan Input
                </label>
                <select
                  value={adjustUnit}
                  onChange={(e) => setAdjustUnit(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  {getAdjustmentUnitOptions(adjustingMaterialType).map((opt) => (
                    <option key={opt.unit} value={opt.unit}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {adjustQuantity > 0 && (
              <div className="p-2.5 rounded-lg bg-[#FDF6E7]/70 border border-[#E5D9C8] text-[11px] text-[#6B4A0E] tabular-nums">
                Konversi kanonis:{' '}
                <strong>
                  {adjustType === 'adjustment_in' ? '+' : '-'}
                  {formatQuantity(
                    adjustingConversion.canonicalQuantity,
                    adjustingConversion.canonicalUnit
                  )}
                </strong>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Catatan Penyesuaian (Wajib)
              </label>
              <input
                type="text"
                required
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Contoh: Koreksi stok opname / bahan rusak"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>

            <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustingIng(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isMutating}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
              >
                {isMutating ? 'Menyimpan...' : 'Simpan Penyesuaian'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Catat Pembelian Bahan */}
      <Modal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        title="Catat Pembelian Bahan Baku"
        subtitle="Mendukung input gram/kg, ml/liter, dan pcs dengan konversi otomatis via register_ingredient_purchase."
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

          <div className="space-y-2.5">
            <label className="block text-xs font-medium text-[#2B1B12]">
              Daftar Bahan yang Dibeli
            </label>
            {purchaseItems.map((item, idx) => {
              const ing = ingredientMap.get(item.ingredient_id);
              const mt = inferMaterialType(ing?.material_type, ing?.unit, ing?.name);
              const unitOptions = getPurchaseUnitOptions(mt);
              const conv = convertToCanonicalQuantity(
                item.input_quantity,
                item.input_unit,
                mt
              );
              const basePrice = roundPrecision(
                item.input_unit_price / conv.conversionFactor,
                6
              );
              const lineSubtotal = roundPrecision(
                item.input_quantity * item.input_unit_price,
                6
              );

              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#FAF6F0] border border-[#E5D9C8] space-y-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <select
                      value={item.ingredient_id}
                      onChange={(e) => {
                        const nextIng = ingredientMap.get(e.target.value);
                        const draft = buildDefaultPurchaseDraft(nextIng);
                        setPurchaseItems((prev) =>
                          prev.map((row, i) => (i === idx ? draft : row))
                        );
                      }}
                      className="sm:col-span-5 px-2.5 py-2 text-xs bg-white border border-[#E5D9C8] rounded-lg"
                    >
                      {db.ingredients.map((ingOpt) => (
                        <option key={ingOpt.id} value={ingOpt.id}>
                          {ingOpt.name} ({ingOpt.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      required
                      value={item.input_quantity}
                      onChange={(e) =>
                        setPurchaseItems((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, input_quantity: Number(e.target.value) }
                              : row
                          )
                        )
                      }
                      placeholder="Qty"
                      className="sm:col-span-2 px-2.5 py-2 text-xs bg-white border border-[#E5D9C8] rounded-lg tabular-nums"
                    />
                    <select
                      value={item.input_unit}
                      onChange={(e) => {
                        const nextUnit = e.target.value;
                        const oldFactor = conv.conversionFactor;
                        const newConv = convertToCanonicalQuantity(
                          item.input_quantity,
                          nextUnit,
                          mt
                        );
                        // Sesuaikan harga input agar tetap proporsional bila berpindah satuan
                        const adjustedUnitPrice = roundPrecision(
                          (item.input_unit_price / oldFactor) * newConv.conversionFactor,
                          6
                        );
                        setPurchaseItems((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? {
                                  ...row,
                                  input_unit: nextUnit,
                                  input_unit_price: adjustedUnitPrice,
                                }
                              : row
                          )
                        );
                      }}
                      className="sm:col-span-2 px-2 py-2 text-xs bg-white border border-[#E5D9C8] rounded-lg"
                    >
                      {unitOptions.map((u) => (
                        <option key={u.unit} value={u.unit}>
                          {u.unit}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      required
                      value={item.input_unit_price}
                      onChange={(e) =>
                        setPurchaseItems((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, input_unit_price: Number(e.target.value) }
                              : row
                          )
                        )
                      }
                      placeholder="Harga / satuan beli"
                      className="sm:col-span-2 px-2.5 py-2 text-xs bg-white border border-[#E5D9C8] rounded-lg tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPurchaseItems((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="sm:col-span-1 p-1.5 text-[#8A7163] hover:text-[#B4382A] justify-self-end"
                      aria-label="Hapus item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6F574A] tabular-nums">
                    <span>
                      Setara kanonis:{' '}
                      <strong className="text-[#2B1B12]">
                        {formatQuantity(conv.canonicalQuantity, conv.canonicalUnit)}
                      </strong>{' '}
                      · Harga dasar:{' '}
                      <strong className="text-[#2B1B12]">
                        {formatDecimalIDR(basePrice)}/{conv.canonicalUnit}
                      </strong>
                    </span>
                    <span>
                      Subtotal:{' '}
                      <strong className="text-[#362015]">
                        {formatDecimalIDR(lineSubtotal, 2)}
                      </strong>
                    </span>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setPurchaseItems((prev) => [
                  ...prev,
                  buildDefaultPurchaseDraft(db.ingredients[0]),
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
                {formatDecimalIDR(
                  purchaseItems.reduce(
                    (s, it) => s + Number(it.input_quantity) * Number(it.input_unit_price),
                    0
                  ),
                  2
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

      {/* Modal Edit Informasi Bahan Baku */}
      <Modal
        open={Boolean(editingIng)}
        onClose={() => setEditingIng(null)}
        title="Ubah Informasi Bahan Baku"
        subtitle="Untuk mengubah jumlah stok, gunakan tombol Sesuaikan Stok agar tercatat di riwayat mutasi."
      >
        {editingIng && (
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Jenis Bahan (Satuan: {getCanonicalUnit(editMaterialType)})
                </label>
                <select
                  value={editMaterialType}
                  onChange={(e) => setEditMaterialType(e.target.value as MaterialType)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  {MATERIAL_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Harga Rata-rata / {getCanonicalUnit(editMaterialType)} (IDR)
                </label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={editAvgCost}
                  onChange={(e) => setEditAvgCost(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA] flex items-center justify-between text-xs">
              <span className="text-[#6F574A]">Stok Saat Ini (Read-only):</span>
              <span className="font-semibold text-[#2B1B12] tabular-nums">
                {formatQuantity(Number(editingIng.current_stock), editingIng.unit)}
              </span>
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
        )}
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
