import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChefHat, Plus, Trash2 } from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import { supabaseService } from '../services/supabaseService';
import { formatDateID, formatIDR, getTodayISO } from '../utils/formatters';
import { EmptyState } from '../components/common/EmptyState';
import {
  BatchStatusLabel,
  normalizeBatchStatusLabel,
} from '../components/common/StatusLabel';
import { Modal } from '../components/common/Modal';

type ProductionTab = 'batches' | 'usage' | 'costs' | 'inventory';

export const ProductionPage: React.FC = () => {
  const { db, isMutating, executeMutation, notifyError } = useBusinessData();
  const [activeTab, setActiveTab] = useState<ProductionTab>('batches');
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  // Register production form
  const [skuId, setSkuId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [productionDate, setProductionDate] = useState(getTodayISO());
  const [plannedQty, setPlannedQty] = useState<number>(1);
  const [notes, setNotes] = useState('');

  // Complete production modal
  const [completeBatchId, setCompleteBatchId] = useState<string | null>(null);
  const [actualQty, setActualQty] = useState<number>(0);
  const [costItemsDraft, setCostItemsDraft] = useState<
    { cost_type: string; description: string; amount: number; notes: string }[]
  >([]);

  const activeSkus = useMemo(
    () => db.productSkus.filter((s) => s.is_active),
    [db.productSkus]
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

  const orderMap = useMemo(
    () => new Map(db.orders.map((o) => [o.id, o])),
    [db.orders]
  );

  const ingredientMap = useMemo(
    () => new Map(db.ingredients.map((i) => [i.id, i])),
    [db.ingredients]
  );

  const batchMap = useMemo(
    () => new Map(db.productionBatches.map((b) => [b.id, b])),
    [db.productionBatches]
  );

  const batchCostsSummary = useMemo(() => {
    return db.productionBatches.map((b) => {
      const matCost = db.productionMaterials
        .filter((m) => m.batch_id === b.id)
        .reduce((s, m) => s + Number(m.total_cost), 0);
      const otherCost = db.productionCostItems
        .filter((c) => c.batch_id === b.id)
        .reduce((s, c) => s + Number(c.amount), 0);
      const total = matCost + otherCost;
      const qty = Number(b.actual_quantity ?? b.planned_quantity) || 1;
      return {
        batch: b,
        matCost,
        otherCost,
        total,
        perUnit: Math.round(total / qty),
      };
    });
  }, [db.productionBatches, db.productionMaterials, db.productionCostItems]);

  const finishedInventory = useMemo(() => {
    const stockBySku = new Map<string, number>();
    db.finishedGoodsMovements.forEach((mov) => {
      const t = mov.movement_type.toLowerCase();
      const isOut =
        t.includes('out') || t.includes('keluar') || t.includes('sale') || t.includes('order');
      const cur = stockBySku.get(mov.sku_id) ?? 0;
      stockBySku.set(
        mov.sku_id,
        isOut ? cur - Number(mov.quantity) : cur + Number(mov.quantity)
      );
    });
    return Array.from(stockBySku.entries()).map(([id, qty]) => ({
      skuId: id,
      label: skuLabelMap.get(id) ?? 'SKU Produk',
      qty,
    }));
  }, [db.finishedGoodsMovements, skuLabelMap]);

  const handleOpenCreateBatch = () => {
    setSkuId(activeSkus[0]?.id ?? '');
    setOrderId('');
    setProductionDate(getTodayISO());
    setPlannedQty(1);
    setNotes('');
    setBatchModalOpen(true);
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuId) {
      notifyError('Pilih varian & kemasan produk (SKU) terlebih dahulu.');
      return;
    }
    if (plannedQty < 1) {
      notifyError('Target jumlah produksi minimal 1.');
      return;
    }

    const batchNumber = `BATCH-${new Date()
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, '')}-${String(db.productionBatches.length + 1).padStart(2, '0')}`;

    const res = await executeMutation(
      () =>
        supabaseService.registerProduction({
          batch_number: batchNumber,
          order_id: orderId || null,
          sku_id: skuId,
          production_date: productionDate,
          quantity: plannedQty,
          notes: notes.trim() || null,
        }),
      `Batch produksi ${batchNumber} berhasil didaftarkan.`
    );

    if (res !== null) {
      setBatchModalOpen(false);
    }
  };

  const handleOpenCompleteBatch = (batchId: string, planned: number) => {
    setCompleteBatchId(batchId);
    setActualQty(planned);
    setCostItemsDraft([]);
  };

  const handleAddCostItemRow = () => {
    setCostItemsDraft((prev) => [
      ...prev,
      { cost_type: 'Gas & Listrik', description: '', amount: 0, notes: '' },
    ]);
  };

  const handleUpdateCostItemRow = (
    idx: number,
    patch: Partial<{ cost_type: string; description: string; amount: number; notes: string }>
  ) => {
    setCostItemsDraft((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  };

  const handleRemoveCostItemRow = (idx: number) => {
    setCostItemsDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCompleteBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeBatchId) return;
    if (actualQty < 0) {
      notifyError('Jumlah hasil aktual tidak boleh negatif.');
      return;
    }

    const costItems = costItemsDraft
      .filter((item) => item.amount > 0)
      .map((item) => ({
        cost_type: item.cost_type.trim() || 'Operasional',
        description: item.description.trim() || item.cost_type.trim() || 'Biaya produksi',
        amount: item.amount,
        notes: item.notes.trim() || null,
      }));

    const res = await executeMutation(
      () =>
        supabaseService.completeProduction({
          batch_id: completeBatchId,
          actual_quantity: actualQty,
          cost_items: costItems,
        }),
      'Batch produksi berhasil diselesaikan.'
    );

    if (res !== null) {
      setCompleteBatchId(null);
    }
  };

  const TABS: { id: ProductionTab; label: string }[] = [
    { id: 'batches', label: 'Batch Produksi' },
    { id: 'usage', label: 'Penggunaan Bahan' },
    { id: 'costs', label: 'Biaya Produksi' },
    { id: 'inventory', label: 'Stok Produk Jadi' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
            Manajemen Produksi (MTO)
          </h2>
          <p className="mt-0.5 text-sm text-[#6F574A]">
            Daftarkan batch produksi dan selesaikan hasil produksi melalui fungsi database Supabase.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateBatch}
          disabled={activeSkus.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Batch Produksi</span>
        </button>
      </div>

      <div className="inline-flex items-center gap-1 p-1 bg-[#EFE6DA] border border-[#E5D9C8] rounded-lg flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#362015] text-[#FDFBF7]'
                : 'text-[#5E3A28] hover:text-[#2B1B12]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Batch Produksi */}
      {activeTab === 'batches' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
          {db.productionBatches.length === 0 ? (
            <EmptyState
              icon={ChefHat}
              title="Belum Ada Batch Produksi"
              description={
                activeSkus.length === 0
                  ? 'Tambahkan ukuran kemasan (SKU) aktif di halaman Produk terlebih dahulu sebelum membuat batch produksi.'
                  : 'Buat batch produksi baru untuk memulai pemrosesan pesanan pelanggan.'
              }
              actionLabel={activeSkus.length > 0 ? 'Buat Batch Pertama' : undefined}
              onAction={activeSkus.length > 0 ? handleOpenCreateBatch : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                    <th className="py-3 px-4">Kode Batch</th>
                    <th className="py-3 px-4">Ref. Pesanan</th>
                    <th className="py-3 px-4">Varian & Kemasan</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4 text-right">Target / Aktual</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {db.productionBatches.map((batch) => {
                    const ord = batch.order_id ? orderMap.get(batch.order_id) : undefined;
                    const isCompleted =
                      normalizeBatchStatusLabel(batch.status) === 'Selesai';
                    return (
                      <tr key={batch.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="py-3 px-4 font-mono font-medium text-[#2B1B12] whitespace-nowrap">
                          {batch.batch_number}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#6F574A] whitespace-nowrap">
                          {ord?.order_number ?? '-'}
                        </td>
                        <td className="py-3 px-4 text-[#2B1B12]">
                          {skuLabelMap.get(batch.sku_id) ?? 'SKU'}
                        </td>
                        <td className="py-3 px-4 tabular-nums text-[#5E3A28] whitespace-nowrap">
                          {formatDateID(batch.production_date)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#2B1B12]">
                          {batch.actual_quantity ?? 0} / {batch.planned_quantity}
                        </td>
                        <td className="py-3 px-4">
                          <BatchStatusLabel status={batch.status} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenCompleteBatch(batch.id, batch.planned_quantity)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#FAF6F0] border border-[#D9CBB8] text-[#362015] hover:bg-[#EFE6DA] cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#1E6B43]" />
                              <span>Selesaikan</span>
                            </button>
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

      {/* Tab 2: Penggunaan Bahan */}
      {activeTab === 'usage' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
          {db.productionMaterials.length === 0 ? (
            <EmptyState
              icon={ChefHat}
              title="Belum Ada Catatan Pemakaian Bahan"
              description="Pemakaian bahan baku tercatat otomatis saat batch produksi didaftarkan berdasarkan resep SKU."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Bahan Baku</th>
                    <th className="py-3 px-4 text-right">Jumlah Dipakai</th>
                    <th className="py-3 px-4 text-right">Biaya Satuan</th>
                    <th className="py-3 px-4 text-right">Total Biaya</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {db.productionMaterials.map((m) => {
                    const batch = batchMap.get(m.batch_id);
                    const ing = ingredientMap.get(m.ingredient_id);
                    return (
                      <tr key={m.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="py-3 px-4 font-mono text-[#6F574A]">
                          {batch?.batch_number ?? m.batch_id}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#2B1B12]">
                          {ing?.name ?? 'Bahan'}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {m.quantity_used} {ing?.unit ?? ''}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#5E3A28]">
                          {formatIDR(Number(m.unit_cost))}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium text-[#2B1B12]">
                          {formatIDR(Number(m.total_cost))}
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

      {/* Tab 3: Biaya Produksi */}
      {activeTab === 'costs' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs">
          <h3 className="text-sm font-display font-semibold text-[#2B1B12] mb-1">
            Rekap Biaya Produksi per Batch
          </h3>
          <p className="text-xs text-[#7A6154] mb-4">
            Akumulasi biaya bahan baku dan biaya tambahan produksi (production_cost_items).
          </p>
          {batchCostsSummary.length === 0 ? (
            <p className="text-xs text-[#8A7163] py-6 text-center">
              Belum ada data biaya batch produksi.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] text-[11px] font-medium text-[#7A6154]">
                    <th className="py-2.5 px-3">Batch</th>
                    <th className="py-2.5 px-3">Produk</th>
                    <th className="py-2.5 px-3 text-right">Biaya Bahan</th>
                    <th className="py-2.5 px-3 text-right">Biaya Lain</th>
                    <th className="py-2.5 px-3 text-right">Total Biaya</th>
                    <th className="py-2.5 px-3 text-right">Biaya / Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {batchCostsSummary.map(({ batch, matCost, otherCost, total, perUnit }) => (
                    <tr key={batch.id}>
                      <td className="py-2.5 px-3 font-mono font-medium text-[#2B1B12]">
                        {batch.batch_number}
                      </td>
                      <td className="py-2.5 px-3 text-[#2B1B12]">
                        {skuLabelMap.get(batch.sku_id) ?? '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatIDR(matCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatIDR(otherCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                        {formatIDR(total)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#5E3A28]">
                        {formatIDR(perUnit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Stok Produk Jadi */}
      {activeTab === 'inventory' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs">
          <h3 className="text-sm font-display font-semibold text-[#2B1B12] mb-1">
            Stok Produk Jadi (Finished Goods Movements)
          </h3>
          <p className="text-xs text-[#7A6154] mb-4">
            Dihitung dari pergerakan barang jadi pada tabel finished_goods_movements.
          </p>
          {finishedInventory.length === 0 ? (
            <p className="text-xs text-[#8A7163] py-6 text-center">
              Belum ada pergerakan stok produk jadi tercatat.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {finishedInventory.map((item) => (
                <div
                  key={item.skuId}
                  className="p-4 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA]"
                >
                  <div className="text-xs font-medium text-[#2B1B12]">
                    {item.label}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-[#1E6B43] tabular-nums">
                    {item.qty} kemasan
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Register Production */}
      <Modal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title="Buat Batch Produksi"
        subtitle="Diproses melalui fungsi register_production di Supabase."
      >
        <form onSubmit={(e) => void handleCreateBatch(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Produk & Kemasan (SKU)
            </label>
            <select
              required
              value={skuId}
              onChange={(e) => setSkuId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            >
              {activeSkus.map((sku) => (
                <option key={sku.id} value={sku.id}>
                  {skuLabelMap.get(sku.id) ?? sku.package_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Tanggal Produksi
              </label>
              <input
                type="date"
                required
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Target Jumlah Unit
              </label>
              <input
                type="number"
                min={1}
                required
                value={plannedQty}
                onChange={(e) => setPlannedQty(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Tautkan ke Pesanan (Opsional)
            </label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            >
              <option value="">-- Tidak ditautkan --</option>
              {db.orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} ({formatDateID(o.order_date)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan produksi..."
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBatchModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
            >
              {isMutating ? 'Menyimpan...' : 'Mulai Batch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Complete Production */}
      <Modal
        open={Boolean(completeBatchId)}
        onClose={() => setCompleteBatchId(null)}
        title="Selesaikan Batch Produksi"
        subtitle="Diproses melalui fungsi complete_production di Supabase."
      >
        <form onSubmit={(e) => void handleCompleteBatch(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Jumlah Hasil Aktual (Kemasan)
            </label>
            <input
              type="number"
              min={0}
              required
              value={actualQty}
              onChange={(e) => setActualQty(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
            />
          </div>

          <div className="p-3.5 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-[#2B1B12]">
                Biaya Tambahan Produksi (Opsional)
              </div>
              <button
                type="button"
                onClick={handleAddCostItemRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white border border-[#D9CBB8] text-[#362015] hover:bg-[#EFE6DA] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah Biaya</span>
              </button>
            </div>

            {costItemsDraft.length === 0 ? (
              <p className="text-[11px] text-[#8A7163]">
                Tidak ada biaya tambahan (seperti gas, listrik, kemasan, atau tenaga kerja) yang ditambahkan.
              </p>
            ) : (
              <div className="space-y-2.5">
                {costItemsDraft.map((row, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-md bg-white border border-[#E5D9C8] space-y-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                      <div className="sm:col-span-5">
                        <label className="block text-[11px] text-[#6F574A] mb-1">
                          Jenis Biaya
                        </label>
                        <input
                          type="text"
                          value={row.cost_type}
                          onChange={(e) =>
                            handleUpdateCostItemRow(idx, { cost_type: e.target.value })
                          }
                          placeholder="Gas / Listrik / Tenaga"
                          className="w-full px-2.5 py-1.5 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-md"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <label className="block text-[11px] text-[#6F574A] mb-1">
                          Nominal (IDR)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={row.amount}
                          onChange={(e) =>
                            handleUpdateCostItemRow(idx, {
                              amount: Number(e.target.value),
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-md tabular-nums"
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveCostItemRow(idx)}
                          aria-label="Hapus item biaya"
                          className="p-1.5 rounded text-[#8A7163] hover:text-[#B4382A] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) =>
                        handleUpdateCostItemRow(idx, { description: e.target.value })
                      }
                      placeholder="Keterangan biaya tambahan (opsional)"
                      className="w-full px-2.5 py-1.5 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-md"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCompleteBatchId(null)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
            >
              {isMutating ? 'Menyimpan...' : 'Selesaikan Batch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
