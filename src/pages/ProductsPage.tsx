import React, { useMemo, useState } from 'react';
import { BookOpen, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import { supabaseService } from '../services/supabaseService';
import { ProductSkuRow } from '../types/supabase';
import { formatIDR } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';

export const ProductsPage: React.FC = () => {
  const { db, isMutating, executeMutation, notifyError } = useBusinessData();

  // Add Variant Modal
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [newVariantName, setNewVariantName] = useState('Original');
  const [selectedProductId, setSelectedProductId] = useState('');

  // Add SKU Modal
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [skuCode, setSkuCode] = useState('');
  const [packageName, setPackageName] = useState('');
  const [weightGram, setWeightGram] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<number>(0);

  // Edit SKU Modal
  const [editingSku, setEditingSku] = useState<ProductSkuRow | null>(null);
  const [editSkuCode, setEditSkuCode] = useState('');
  const [editPackageName, setEditPackageName] = useState('');
  const [editWeightGram, setEditWeightGram] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState<number>(0);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // Recipe Modal
  const [recipeSkuId, setRecipeSkuId] = useState<string | null>(null);
  const [recipeNotes, setRecipeNotes] = useState('');
  const [recipeItems, setRecipeItems] = useState<
    { ingredient_id: string; quantity: number }[]
  >([]);

  const productMap = useMemo(
    () => new Map(db.products.map((p) => [p.id, p])),
    [db.products]
  );

  const variantMap = useMemo(
    () => new Map(db.productVariants.map((v) => [v.id, v])),
    [db.productVariants]
  );

  const activeRecipeTarget = useMemo(() => {
    if (!recipeSkuId) return null;
    const sku = db.productSkus.find((s) => s.id === recipeSkuId);
    if (!sku) return null;
    const variant = variantMap.get(sku.variant_id);
    const product = variant ? productMap.get(variant.product_id) : undefined;
    const recipeName = [
      product?.name || 'Keripik Bawang',
      variant?.variant_name,
      sku.package_name,
    ]
      .filter(Boolean)
      .join(' - ');
    return {
      sku,
      variant,
      product,
      recipeName,
    };
  }, [recipeSkuId, db.productSkus, variantMap, productMap]);

  const skusByVariant = useMemo(() => {
    const map = new Map<string, typeof db.productSkus>();
    db.productSkus.forEach((sku) => {
      const list = map.get(sku.variant_id) ?? [];
      list.push(sku);
      map.set(sku.variant_id, list);
    });
    return map;
  }, [db.productSkus]);

  const recipeBySku = useMemo(() => {
    const map = new Map<string, { recipeId: string; count: number }>();
    db.productRecipes.forEach((r) => {
      const count = db.productRecipeItems.filter((i) => i.recipe_id === r.id).length;
      map.set(r.sku_id, { recipeId: r.id, count });
    });
    return map;
  }, [db.productRecipes, db.productRecipeItems]);

  const handleOpenAddVariant = () => {
    setSelectedProductId(db.products[0]?.id ?? '');
    setVariantModalOpen(true);
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVariantName.trim()) {
      notifyError('Nama varian wajib diisi.');
      return;
    }

    const res = await executeMutation(async () => {
      let prodId = selectedProductId;
      if (!prodId) {
        const createdProd = await supabaseService.createProduct({
          name: 'Keripik Bawang',
          description: 'Keripik bawang buatan rumahan Made to Order',
        });
        prodId = createdProd.id;
      }
      return supabaseService.createProductVariant({
        product_id: prodId,
        variant_name: newVariantName.trim(),
      });
    }, `Varian "${newVariantName.trim()}" berhasil ditambahkan.`);

    if (res) {
      setVariantModalOpen(false);
    }
  };

  const handleCreateSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVariantId || !packageName.trim()) {
      notifyError('Nama ukuran kemasan wajib diisi.');
      return;
    }

    const parsedWeight = weightGram.trim() ? Number(weightGram) : null;
    const res = await executeMutation(
      () =>
        supabaseService.createProductSku({
          variant_id: activeVariantId,
          sku_code: skuCode.trim() || null,
          package_name: packageName.trim(),
          weight_gram: parsedWeight,
          selling_price: Math.max(0, sellingPrice),
        }),
      `Ukuran kemasan "${packageName.trim()}" berhasil disimpan.`
    );

    if (res) {
      setSkuCode('');
      setPackageName('');
      setWeightGram('');
      setSellingPrice(0);
      setActiveVariantId(null);
    }
  };

  const handleOpenEditSku = (sku: ProductSkuRow) => {
    setEditingSku(sku);
    setEditSkuCode(sku.sku_code ?? '');
    setEditPackageName(sku.package_name);
    setEditWeightGram(sku.weight_gram ? String(sku.weight_gram) : '');
    setEditSellingPrice(Number(sku.selling_price));
    setEditIsActive(sku.is_active);
  };

  const handleUpdateSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSku || !editPackageName.trim()) {
      notifyError('Nama ukuran kemasan wajib diisi.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.updateProductSku(editingSku.id, {
          sku_code: editSkuCode.trim() || null,
          package_name: editPackageName.trim(),
          weight_gram: editWeightGram.trim() ? Number(editWeightGram) : null,
          selling_price: Math.max(0, editSellingPrice),
          is_active: editIsActive,
        }),
      `SKU "${editPackageName.trim()}" berhasil diperbarui.`
    );

    if (res) {
      setEditingSku(null);
    }
  };

  const handleOpenRecipeModal = (skuId: string) => {
    const existing = db.productRecipes.find((r) => r.sku_id === skuId);
    const items = existing
      ? db.productRecipeItems
          .filter((i) => i.recipe_id === existing.id)
          .map((i) => ({ ingredient_id: i.ingredient_id, quantity: Number(i.quantity) }))
      : [];
    setRecipeNotes(existing?.notes ?? '');
    setRecipeItems(
      items.length > 0
        ? items
        : db.ingredients[0]
        ? [{ ingredient_id: db.ingredients[0].id, quantity: 1 }]
        : []
    );
    setRecipeSkuId(skuId);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeSkuId || !activeRecipeTarget) return;
    const validItems = recipeItems.filter((i) => i.ingredient_id && i.quantity > 0);

    const res = await executeMutation(
      () =>
        supabaseService.saveProductRecipe({
          sku_id: recipeSkuId,
          recipe_name: activeRecipeTarget.recipeName,
          notes: recipeNotes.trim() || null,
          items: validItems,
        }),
      `Resep "${activeRecipeTarget.recipeName}" berhasil disimpan.`
    );

    if (res !== null) {
      setRecipeSkuId(null);
    }
  };

  const activeVariant = db.productVariants.find((v) => v.id === activeVariantId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
            Manajemen Produk, Varian & SKU
          </h2>
          <p className="mt-0.5 text-sm text-[#6F574A]">
            Kelola varian produk (Original, Pedas, Balado), ukuran kemasan (SKU), harga jual, dan resep bahan baku.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddVariant}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Varian</span>
        </button>
      </div>

      <div className="bg-[#FDF6E7]/70 border border-[#E5D9C8] rounded-xl px-4 py-3 text-xs text-[#6B4A0E]">
        Ukuran kemasan dan harga jual disimpan fleksibel pada tabel <code>product_skus</code> dan tidak dikunci permanen.
      </div>

      {db.productVariants.length === 0 ? (
        <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs">
          <EmptyState
            icon={Package}
            title="Belum Ada Varian Produk di Database"
            description="Tambahkan varian seperti Original, Pedas, atau Balado untuk mulai mengatur ukuran kemasan dan harga jual."
            actionLabel="Tambah Varian Pertama"
            onAction={handleOpenAddVariant}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {db.productVariants.map((variant) => {
            const product = productMap.get(variant.product_id);
            const skus = skusByVariant.get(variant.id) ?? [];
            return (
              <div
                key={variant.id}
                className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EFE6DA]">
                    <div>
                      <div className="text-[11px] font-medium text-[#8A7163]">
                        {product?.name ?? 'Keripik Bawang'}
                      </div>
                      <h3 className="mt-0.5 text-lg font-display font-semibold text-[#2B1B12]">
                        Varian {variant.variant_name}
                      </h3>
                      {product?.description && (
                        <p className="mt-1 text-xs text-[#6F574A] leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-[#FAF6F0] border border-[#E5D9C8] flex items-center justify-center text-[#5E3A28] shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="py-4">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-xs font-semibold text-[#2B1B12]">
                        Daftar Ukuran & Harga (SKU)
                      </span>
                      <span className="text-[11px] text-[#8A7163] tabular-nums">
                        {skus.length} SKU
                      </span>
                    </div>

                    {skus.length === 0 ? (
                      <div className="py-6 px-4 rounded-lg bg-[#FAF6F0] border border-dashed border-[#D9CBB8] text-center">
                        <p className="text-xs text-[#7A6154]">
                          Belum ada ukuran kemasan yang ditetapkan untuk varian {variant.variant_name}.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#F5EFE6] border border-[#EFE6DA] rounded-lg overflow-hidden">
                        {skus.map((sku) => {
                          const recipeInfo = recipeBySku.get(sku.id);
                          return (
                            <div
                              key={sku.id}
                              className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-white hover:bg-[#FAF6F0]/60"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-[#2B1B12] truncate">
                                  {sku.package_name}
                                  {sku.weight_gram ? ` (${sku.weight_gram}g)` : ''}
                                </div>
                                <div className="text-[11px] text-[#8A7163] tabular-nums">
                                  Harga:{' '}
                                  <strong className="text-[#362015]">
                                    {formatIDR(Number(sku.selling_price))}
                                  </strong>
                                  {sku.sku_code ? ` · ${sku.sku_code}` : ''}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenRecipeModal(sku.id)}
                                  title="Atur resep bahan"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-[#E5D9C8] text-[#5E3A28] hover:bg-[#FAF6F0] cursor-pointer"
                                >
                                  <BookOpen className="w-3 h-3" />
                                  <span>{recipeInfo ? `${recipeInfo.count} bh` : 'Resep'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSku(sku)}
                                  aria-label={`Ubah SKU ${sku.package_name}`}
                                  title="Ubah ukuran & harga"
                                  className="p-1.5 rounded text-[#8A7163] hover:text-[#362015] hover:bg-[#FAF6F0] cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isMutating}
                                  onClick={() =>
                                    void executeMutation(
                                      () => supabaseService.deleteProductSku(sku.id),
                                      `SKU "${sku.package_name}" dihapus.`
                                    )
                                  }
                                  aria-label={`Hapus SKU ${sku.package_name}`}
                                  className="p-1.5 rounded text-[#8A7163] hover:text-[#B4382A] hover:bg-[#FDF2F0] cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveVariantId(variant.id)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-[#362015] text-[#362015] hover:bg-[#362015] hover:text-[#FDFBF7] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Ukuran & Harga</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tambah Varian */}
      <Modal
        open={variantModalOpen}
        onClose={() => setVariantModalOpen(false)}
        title="Tambah Varian Produk"
      >
        <form onSubmit={(e) => void handleCreateVariant(e)} className="space-y-4">
          {db.products.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Produk Induk
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              >
                {db.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Nama Varian
            </label>
            <input
              type="text"
              required
              value={newVariantName}
              onChange={(e) => setNewVariantName(e.target.value)}
              placeholder="Original / Pedas / Balado"
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setVariantModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
            >
              {isMutating ? 'Menyimpan...' : 'Simpan Varian'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Tambah SKU */}
      <Modal
        open={Boolean(activeVariantId)}
        onClose={() => setActiveVariantId(null)}
        title={`Tambah Ukuran — Varian ${activeVariant?.variant_name ?? ''}`}
      >
        <form onSubmit={(e) => void handleCreateSku(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Nama Kemasan
              </label>
              <input
                type="text"
                required
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="Contoh: Pouch 250g"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Kode SKU (Opsional)
              </label>
              <input
                type="text"
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value)}
                placeholder="Contoh: KB-ORG-250"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Berat Bersih (Gram, Opsional)
              </label>
              <input
                type="number"
                min={1}
                value={weightGram}
                onChange={(e) => setWeightGram(e.target.value)}
                placeholder="250"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Harga Jual (IDR)
              </label>
              <input
                type="number"
                min={0}
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveVariantId(null)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
            >
              {isMutating ? 'Menyimpan...' : 'Simpan Ukuran'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Resep Produk */}
      <Modal
        open={Boolean(recipeSkuId)}
        onClose={() => setRecipeSkuId(null)}
        title="Resep Bahan Baku per Kemasan"
        subtitle="Digunakan otomatis oleh register_production saat membuat batch."
      >
        {db.ingredients.length === 0 ? (
          <p className="text-xs text-[#6F574A]">
            Tambahkan bahan baku terlebih dahulu di halaman <strong>Bahan Baku</strong> sebelum menyusun resep.
          </p>
        ) : (
          <form onSubmit={(e) => void handleSaveRecipe(e)} className="space-y-4">
            {activeRecipeTarget && (
              <div className="p-3 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA] text-xs">
                <div className="text-[11px] text-[#7A6154]">
                  Nama Resep (Otomatis dari Produk, Varian &amp; SKU)
                </div>
                <div className="mt-0.5 font-semibold text-[#2B1B12]">
                  {activeRecipeTarget.recipeName}
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {recipeItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={item.ingredient_id}
                    onChange={(e) => {
                      const next = [...recipeItems];
                      next[idx].ingredient_id = e.target.value;
                      setRecipeItems(next);
                    }}
                    className="flex-1 px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
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
                      const next = [...recipeItems];
                      next[idx].quantity = Number(e.target.value);
                      setRecipeItems(next);
                    }}
                    className="w-24 px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRecipeItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-2 text-[#8A7163] hover:text-[#B4382A] cursor-pointer"
                    aria-label="Hapus baris resep"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setRecipeItems((prev) => [
                    ...prev,
                    { ingredient_id: db.ingredients[0].id, quantity: 1 },
                  ])
                }
                className="text-xs font-medium text-[#5E3A28] hover:text-[#2B1B12] underline cursor-pointer"
              >
                + Tambah Bahan
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Catatan Resep (Opsional)
              </label>
              <input
                type="text"
                value={recipeNotes}
                onChange={(e) => setRecipeNotes(e.target.value)}
                placeholder="Takaran per 1 kemasan"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>

            <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRecipeSkuId(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isMutating}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
              >
                {isMutating ? 'Menyimpan...' : 'Simpan Resep'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Edit SKU */}
      <Modal
        open={Boolean(editingSku)}
        onClose={() => setEditingSku(null)}
        title="Ubah Ukuran & Harga (SKU)"
      >
        <form onSubmit={(e) => void handleUpdateSku(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Nama Kemasan
              </label>
              <input
                type="text"
                required
                value={editPackageName}
                onChange={(e) => setEditPackageName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Kode SKU (Opsional)
              </label>
              <input
                type="text"
                value={editSkuCode}
                onChange={(e) => setEditSkuCode(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Berat Bersih (Gram, Opsional)
              </label>
              <input
                type="number"
                min={1}
                value={editWeightGram}
                onChange={(e) => setEditWeightGram(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Harga Jual (IDR)
              </label>
              <input
                type="number"
                min={0}
                required
                value={editSellingPrice}
                onChange={(e) => setEditSellingPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="edit-sku-active"
              type="checkbox"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.target.checked)}
              className="w-4 h-4 accent-[#362015]"
            />
            <label htmlFor="edit-sku-active" className="text-xs text-[#2B1B12]">
              SKU aktif dan tersedia untuk pesanan baru
            </label>
          </div>

          <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingSku(null)}
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
    </div>
  );
};
