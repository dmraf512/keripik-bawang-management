import { mapSupabaseDatabaseError, supabase } from '../lib/supabase';
import {
  BusinessProfileRow,
  CashAccountBalanceView,
  CashAccountRow,
  CashTransactionRow,
  CapitalTransactionRow,
  CustomerRow,
  DeleteExpenseRpcArgs,
  DeleteExpenseRpcReturn,
  ExpenseRow,
  FinishedGoodsMovementRow,
  FinishedGoodsStockView,
  IngredientAdjustmentType,
  IngredientPurchaseItemRow,
  IngredientPurchaseRow,
  IngredientRow,
  IngredientStockMovementRow,
  IngredientStockView,
  MaterialType,
  OrderItemRow,
  OrderPaymentRow,
  OrderPaymentStatusView,
  OrderRow,
  ProductRecipeItemRow,
  ProductRecipeRow,
  ProductRow,
  ProductSkuRow,
  ProductVariantRow,
  ProductionBatchCostView,
  ProductionBatchRow,
  ProductionCostItemRow,
  ProductionMaterialRow,
  PurchasePaymentRow,
  PurchasePaymentStatusView,
  SalesSummaryView,
  SkuRecipeHppView,
  SupabaseBusinessState,
} from '../types/supabase';
import {
  convertToCanonicalQuantity,
  getCanonicalUnit,
  roundPrecision,
} from '../utils/units';

function requireClient() {
  if (!supabase) {
    throw new Error(
      'Klien Supabase belum terkonfigurasi. Periksa VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

function unwrap<T>(result: { data: T | null; error: unknown }, context: string): T {
  if (result.error) {
    throw new Error(`${context}: ${mapSupabaseDatabaseError(result.error)}`);
  }
  return result.data as T;
}

export const EMPTY_SUPABASE_STATE: SupabaseBusinessState = {
  businessProfiles: [],
  customers: [],
  products: [],
  productVariants: [],
  productSkus: [],
  ingredients: [],
  orders: [],
  orderItems: [],
  orderPayments: [],
  ingredientPurchases: [],
  ingredientPurchaseItems: [],
  purchasePayments: [],
  productionBatches: [],
  productionMaterials: [],
  productionCostItems: [],
  productRecipes: [],
  productRecipeItems: [],
  ingredientStockMovements: [],
  finishedGoodsMovements: [],
  expenses: [],
  capitalTransactions: [],
  cashAccounts: [],
  cashTransactions: [],
  cashAccountBalances: [],
  finishedGoodsStock: [],
  ingredientStock: [],
  orderPaymentStatus: [],
  productionBatchCosts: [],
  purchasePaymentStatus: [],
  salesSummary: [],
  skuRecipeHpp: [],
};

export const supabaseService = {
  async fetchAllData(): Promise<SupabaseBusinessState> {
    const client = requireClient();

    const [
      businessProfilesRes,
      customersRes,
      productsRes,
      productVariantsRes,
      productSkusRes,
      ingredientsRes,
      ordersRes,
      orderItemsRes,
      orderPaymentsRes,
      ingredientPurchasesRes,
      ingredientPurchaseItemsRes,
      purchasePaymentsRes,
      productionBatchesRes,
      productionMaterialsRes,
      productionCostItemsRes,
      productRecipesRes,
      productRecipeItemsRes,
      ingredientStockMovementsRes,
      finishedGoodsMovementsRes,
      expensesRes,
      capitalTransactionsRes,
      cashAccountsRes,
      cashTransactionsRes,
      cashAccountBalancesRes,
      finishedGoodsStockRes,
      ingredientStockRes,
      orderPaymentStatusRes,
      productionBatchCostsRes,
      purchasePaymentStatusRes,
      salesSummaryRes,
      skuRecipeHppRes,
    ] = await Promise.all([
      client.from('business_profiles').select('*').order('created_at', { ascending: true }),
      client.from('customers').select('*').order('name', { ascending: true }),
      client.from('products').select('*').order('created_at', { ascending: true }),
      client.from('product_variants').select('*').order('created_at', { ascending: true }),
      client.from('product_skus').select('*').order('created_at', { ascending: true }),
      client.from('ingredients').select('*').order('name', { ascending: true }),
      client.from('orders').select('*').order('order_date', { ascending: false }).order('created_at', { ascending: false }),
      client.from('order_items').select('*').order('created_at', { ascending: true }),
      client.from('order_payments').select('*').order('payment_date', { ascending: false }),
      client.from('ingredient_purchases').select('*').order('purchase_date', { ascending: false }),
      client.from('ingredient_purchase_items').select('*'),
      client.from('purchase_payments').select('*').order('payment_date', { ascending: false }),
      client.from('production_batches').select('*').order('production_date', { ascending: false }).order('created_at', { ascending: false }),
      client.from('production_materials').select('*'),
      client.from('production_cost_items').select('*').order('created_at', { ascending: true }),
      client.from('product_recipes').select('*').order('created_at', { ascending: true }),
      client.from('product_recipe_items').select('*').order('created_at', { ascending: true }),
      client.from('ingredient_stock_movements').select('*').order('movement_date', { ascending: false }).order('created_at', { ascending: false }),
      client.from('finished_goods_movements').select('*').order('movement_date', { ascending: false }).order('created_at', { ascending: false }),
      client.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      client.from('capital_transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
      client.from('cash_accounts').select('*').order('created_at', { ascending: true }),
      client.from('cash_transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
      client.from('v_cash_account_balances').select('*'),
      client.from('v_finished_goods_stock').select('*'),
      client.from('v_ingredient_stock').select('*'),
      client.from('v_order_payment_status').select('*'),
      client.from('v_production_batch_costs').select('*'),
      client.from('v_purchase_payment_status').select('*'),
      client.from('v_sales_summary').select('*'),
      client.from('v_sku_recipe_hpp').select('*'),
    ]);

    return {
      businessProfiles: unwrap<BusinessProfileRow[]>(businessProfilesRes, 'business_profiles') ?? [],
      customers: unwrap<CustomerRow[]>(customersRes, 'customers') ?? [],
      products: unwrap<ProductRow[]>(productsRes, 'products') ?? [],
      productVariants: unwrap<ProductVariantRow[]>(productVariantsRes, 'product_variants') ?? [],
      productSkus: unwrap<ProductSkuRow[]>(productSkusRes, 'product_skus') ?? [],
      ingredients: unwrap<IngredientRow[]>(ingredientsRes, 'ingredients') ?? [],
      orders: unwrap<OrderRow[]>(ordersRes, 'orders') ?? [],
      orderItems: unwrap<OrderItemRow[]>(orderItemsRes, 'order_items') ?? [],
      orderPayments: unwrap<OrderPaymentRow[]>(orderPaymentsRes, 'order_payments') ?? [],
      ingredientPurchases: unwrap<IngredientPurchaseRow[]>(ingredientPurchasesRes, 'ingredient_purchases') ?? [],
      ingredientPurchaseItems: unwrap<IngredientPurchaseItemRow[]>(ingredientPurchaseItemsRes, 'ingredient_purchase_items') ?? [],
      purchasePayments: unwrap<PurchasePaymentRow[]>(purchasePaymentsRes, 'purchase_payments') ?? [],
      productionBatches: unwrap<ProductionBatchRow[]>(productionBatchesRes, 'production_batches') ?? [],
      productionMaterials: unwrap<ProductionMaterialRow[]>(productionMaterialsRes, 'production_materials') ?? [],
      productionCostItems: unwrap<ProductionCostItemRow[]>(productionCostItemsRes, 'production_cost_items') ?? [],
      productRecipes: unwrap<ProductRecipeRow[]>(productRecipesRes, 'product_recipes') ?? [],
      productRecipeItems: unwrap<ProductRecipeItemRow[]>(productRecipeItemsRes, 'product_recipe_items') ?? [],
      ingredientStockMovements: unwrap<IngredientStockMovementRow[]>(ingredientStockMovementsRes, 'ingredient_stock_movements') ?? [],
      finishedGoodsMovements: unwrap<FinishedGoodsMovementRow[]>(finishedGoodsMovementsRes, 'finished_goods_movements') ?? [],
      expenses: unwrap<ExpenseRow[]>(expensesRes, 'expenses') ?? [],
      capitalTransactions: unwrap<CapitalTransactionRow[]>(capitalTransactionsRes, 'capital_transactions') ?? [],
      cashAccounts: unwrap<CashAccountRow[]>(cashAccountsRes, 'cash_accounts') ?? [],
      cashTransactions: unwrap<CashTransactionRow[]>(cashTransactionsRes, 'cash_transactions') ?? [],
      cashAccountBalances: unwrap<CashAccountBalanceView[]>(cashAccountBalancesRes, 'v_cash_account_balances') ?? [],
      finishedGoodsStock: unwrap<FinishedGoodsStockView[]>(finishedGoodsStockRes, 'v_finished_goods_stock') ?? [],
      ingredientStock: unwrap<IngredientStockView[]>(ingredientStockRes, 'v_ingredient_stock') ?? [],
      orderPaymentStatus: unwrap<OrderPaymentStatusView[]>(orderPaymentStatusRes, 'v_order_payment_status') ?? [],
      productionBatchCosts: unwrap<ProductionBatchCostView[]>(productionBatchCostsRes, 'v_production_batch_costs') ?? [],
      purchasePaymentStatus: unwrap<PurchasePaymentStatusView[]>(purchasePaymentStatusRes, 'v_purchase_payment_status') ?? [],
      salesSummary: unwrap<SalesSummaryView[]>(salesSummaryRes, 'v_sales_summary') ?? [],
      skuRecipeHpp: unwrap<SkuRecipeHppView[]>(skuRecipeHppRes, 'v_sku_recipe_hpp') ?? [],
    };
  },

  // --- Business Profile ---
  async saveBusinessProfile(input: {
    id?: string;
    business_name: string;
    brand_name: string | null;
    currency: string;
  }): Promise<BusinessProfileRow> {
    const client = requireClient();
    if (input.id) {
      const res = await client
        .from('business_profiles')
        .update({
          business_name: input.business_name,
          brand_name: input.brand_name,
          currency: input.currency,
        })
        .eq('id', input.id)
        .select()
        .single();
      return unwrap<BusinessProfileRow>(res, 'Gagal memperbarui profil usaha');
    }
    const res = await client
      .from('business_profiles')
      .insert({
        business_name: input.business_name,
        brand_name: input.brand_name,
        currency: input.currency,
      })
      .select()
      .single();
    return unwrap<BusinessProfileRow>(res, 'Gagal menyimpan profil usaha');
  },

  // --- Customers ---
  async createCustomer(input: {
    name: string;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
  }): Promise<CustomerRow> {
    const client = requireClient();
    const res = await client
      .from('customers')
      .insert({
        name: input.name,
        phone: input.phone || null,
        address: input.address || null,
        notes: input.notes || null,
      })
      .select()
      .single();
    return unwrap<CustomerRow>(res, 'Gagal menambah pelanggan');
  },

  async updateCustomer(
    id: string,
    input: { name: string; phone?: string | null; address?: string | null; notes?: string | null }
  ): Promise<CustomerRow> {
    const client = requireClient();
    const res = await client
      .from('customers')
      .update({
        name: input.name,
        phone: input.phone || null,
        address: input.address || null,
        notes: input.notes || null,
      })
      .eq('id', id)
      .select()
      .single();
    return unwrap<CustomerRow>(res, 'Gagal memperbarui pelanggan');
  },

  async deleteCustomer(id: string): Promise<void> {
    const client = requireClient();
    const ordersRes = await client
      .from('orders')
      .select('id')
      .eq('customer_id', id)
      .limit(1);
    if (ordersRes.error) throw new Error(mapSupabaseDatabaseError(ordersRes.error));
    if ((ordersRes.data?.length ?? 0) > 0) {
      throw new Error(
        'Pelanggan tidak dapat dihapus karena masih memiliki riwayat pesanan di database.'
      );
    }

    const res = await client.from('customers').delete().eq('id', id);
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  // --- Products, Variants, SKUs, Recipes ---
  async createProduct(input: {
    name: string;
    description?: string | null;
  }): Promise<ProductRow> {
    const client = requireClient();
    const res = await client
      .from('products')
      .insert({
        name: input.name,
        description: input.description || null,
        is_active: true,
      })
      .select()
      .single();
    return unwrap<ProductRow>(res, 'Gagal menambah produk');
  },

  async createProductVariant(input: {
    product_id: string;
    variant_name: string;
  }): Promise<ProductVariantRow> {
    const client = requireClient();
    const res = await client
      .from('product_variants')
      .insert({
        product_id: input.product_id,
        variant_name: input.variant_name,
        is_active: true,
      })
      .select()
      .single();
    return unwrap<ProductVariantRow>(res, 'Gagal menambah varian produk');
  },

  async createVariantWithOptionalProduct(input: {
    product_id?: string;
    default_product_name: string;
    default_product_description?: string | null;
    variant_name: string;
  }): Promise<ProductVariantRow> {
    const client = requireClient();
    let prodId = input.product_id;
    let createdProdId: string | null = null;

    if (!prodId) {
      const createdProd = await this.createProduct({
        name: input.default_product_name,
        description: input.default_product_description ?? null,
      });
      prodId = createdProd.id;
      createdProdId = createdProd.id;
    }

    try {
      return await this.createProductVariant({
        product_id: prodId,
        variant_name: input.variant_name,
      });
    } catch (err) {
      const baseMsg = err instanceof Error ? err.message : mapSupabaseDatabaseError(err);
      if (createdProdId) {
        const rbRes = await client.from('products').delete().eq('id', createdProdId);
        if (rbRes.error) {
          throw new Error(
            `${baseMsg}. PERINGATAN ROLLBACK: Gagal menghapus produk induk baru (${mapSupabaseDatabaseError(
              rbRes.error
            )}).`
          );
        }
      }
      throw new Error(baseMsg);
    }
  },

  async createProductSku(input: {
    variant_id: string;
    sku_code?: string | null;
    package_name: string;
    weight_gram?: number | null;
    selling_price: number;
  }): Promise<ProductSkuRow> {
    const client = requireClient();
    const res = await client
      .from('product_skus')
      .insert({
        variant_id: input.variant_id,
        sku_code: input.sku_code || null,
        package_name: input.package_name,
        weight_gram: input.weight_gram ?? null,
        selling_price: input.selling_price,
        is_active: true,
      })
      .select()
      .single();
    return unwrap<ProductSkuRow>(res, 'Gagal menambah ukuran kemasan (SKU)');
  },

  async updateProductSku(
    id: string,
    input: {
      sku_code?: string | null;
      package_name: string;
      weight_gram?: number | null;
      selling_price: number;
      is_active: boolean;
    }
  ): Promise<ProductSkuRow> {
    const client = requireClient();
    const res = await client
      .from('product_skus')
      .update({
        sku_code: input.sku_code || null,
        package_name: input.package_name,
        weight_gram: input.weight_gram ?? null,
        selling_price: input.selling_price,
        is_active: input.is_active,
      })
      .eq('id', id)
      .select()
      .single();
    return unwrap<ProductSkuRow>(res, 'Gagal memperbarui SKU produk');
  },

  async deleteProductSku(id: string): Promise<void> {
    const client = requireClient();

    const [orderItemsRes, batchesRes, fgMovRes, recipeRes] = await Promise.all([
      client.from('order_items').select('id').eq('sku_id', id).limit(1),
      client.from('production_batches').select('id').eq('sku_id', id).limit(1),
      client.from('finished_goods_movements').select('id').eq('sku_id', id).limit(1),
      client.from('product_recipes').select('*').eq('sku_id', id).maybeSingle(),
    ]);

    if (orderItemsRes.error) throw new Error(mapSupabaseDatabaseError(orderItemsRes.error));
    if (batchesRes.error) throw new Error(mapSupabaseDatabaseError(batchesRes.error));
    if (fgMovRes.error) throw new Error(mapSupabaseDatabaseError(fgMovRes.error));
    if (recipeRes.error) throw new Error(mapSupabaseDatabaseError(recipeRes.error));

    if (
      (orderItemsRes.data?.length ?? 0) > 0 ||
      (batchesRes.data?.length ?? 0) > 0 ||
      (fgMovRes.data?.length ?? 0) > 0
    ) {
      throw new Error(
        'SKU tidak dapat dihapus karena sudah terhubung dengan pesanan, batch produksi, atau mutasi stok barang jadi. Nonaktifkan SKU melalui tombol Ubah.'
      );
    }

    const recipeSnapshot = recipeRes.data as ProductRecipeRow | null;
    let recipeItemsSnapshot: ProductRecipeItemRow[] = [];

    if (recipeSnapshot) {
      const itemsSnapRes = await client
        .from('product_recipe_items')
        .select('*')
        .eq('recipe_id', recipeSnapshot.id);
      if (itemsSnapRes.error) {
        throw new Error(mapSupabaseDatabaseError(itemsSnapRes.error));
      }
      recipeItemsSnapshot = (itemsSnapRes.data ?? []) as ProductRecipeItemRow[];

      const delRecItems = await client
        .from('product_recipe_items')
        .delete()
        .eq('recipe_id', recipeSnapshot.id);
      if (delRecItems.error) {
        throw new Error(mapSupabaseDatabaseError(delRecItems.error));
      }

      const delRec = await client
        .from('product_recipes')
        .delete()
        .eq('id', recipeSnapshot.id);
      if (delRec.error) {
        const rbErrors: string[] = [];
        if (recipeItemsSnapshot.length > 0) {
          const rbItems = await client.from('product_recipe_items').insert(
            recipeItemsSnapshot.map((prev) => ({
              id: prev.id,
              recipe_id: prev.recipe_id,
              ingredient_id: prev.ingredient_id,
              quantity: prev.quantity,
              input_quantity: prev.input_quantity ?? prev.quantity,
              input_unit: prev.input_unit ?? null,
              conversion_factor: prev.conversion_factor ?? 1,
              notes: prev.notes ?? null,
            }))
          );
          if (rbItems.error) rbErrors.push(mapSupabaseDatabaseError(rbItems.error));
        }
        const rbMsg =
          rbErrors.length > 0
            ? ` PERINGATAN ROLLBACK: Pemulihan item resep gagal (${rbErrors.join('; ')}).`
            : '';
        throw new Error(`${mapSupabaseDatabaseError(delRec.error)}${rbMsg}`);
      }
    }

    const res = await client.from('product_skus').delete().eq('id', id);
    if (res.error) {
      const rbErrors: string[] = [];
      if (recipeSnapshot) {
        const rbRec = await client.from('product_recipes').insert({
          id: recipeSnapshot.id,
          sku_id: recipeSnapshot.sku_id,
          recipe_name: recipeSnapshot.recipe_name,
          notes: recipeSnapshot.notes,
          is_active: recipeSnapshot.is_active,
        });
        if (rbRec.error) {
          rbErrors.push(`header resep: ${mapSupabaseDatabaseError(rbRec.error)}`);
        } else if (recipeItemsSnapshot.length > 0) {
          const rbItems = await client.from('product_recipe_items').insert(
            recipeItemsSnapshot.map((prev) => ({
              id: prev.id,
              recipe_id: prev.recipe_id,
              ingredient_id: prev.ingredient_id,
              quantity: prev.quantity,
              input_quantity: prev.input_quantity ?? prev.quantity,
              input_unit: prev.input_unit ?? null,
              conversion_factor: prev.conversion_factor ?? 1,
              notes: prev.notes ?? null,
            }))
          );
          if (rbItems.error) {
            rbErrors.push(`item resep: ${mapSupabaseDatabaseError(rbItems.error)}`);
          }
        }
      }
      const rbMsg =
        rbErrors.length > 0
          ? ` PERINGATAN ROLLBACK: Gagal memulihkan resep terkait (${rbErrors.join('; ')}).`
          : '';
      throw new Error(`${mapSupabaseDatabaseError(res.error)}${rbMsg}`);
    }
  },

  async saveProductRecipe(input: {
    sku_id: string;
    recipe_name?: string;
    notes?: string | null;
    items: {
      ingredient_id: string;
      quantity: number;
      input_quantity?: number;
      input_unit?: string;
      conversion_factor?: number;
      notes?: string | null;
    }[];
  }): Promise<void> {
    const client = requireClient();

    if (input.items.length === 0) {
      throw new Error('Resep harus memiliki minimal 1 bahan baku.');
    }

    const uniqueIds = new Set<string>();
    for (const item of input.items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error('Jumlah takaran bahan dalam resep harus bernilai lebih dari 0.');
      }
      if (uniqueIds.has(item.ingredient_id)) {
        throw new Error(
          'Bahan baku yang sama tidak boleh dimasukkan lebih dari satu kali dalam satu resep.'
        );
      }
      uniqueIds.add(item.ingredient_id);
    }

    let resolvedRecipeName = input.recipe_name?.trim() ?? '';
    if (!resolvedRecipeName) {
      const { data: skuData } = await client
        .from('product_skus')
        .select('package_name, product_variants(variant_name, products(name))')
        .eq('id', input.sku_id)
        .maybeSingle();

      if (skuData) {
        const variantObj = Array.isArray(skuData.product_variants)
          ? skuData.product_variants[0]
          : (skuData.product_variants as {
              variant_name?: string;
              products?: { name?: string } | { name?: string }[];
            } | null);
        const productObj = variantObj?.products
          ? Array.isArray(variantObj.products)
            ? variantObj.products[0]
            : variantObj.products
          : null;

        resolvedRecipeName = [
          productObj?.name || 'Keripik Bawang',
          variantObj?.variant_name,
          skuData.package_name,
        ]
          .filter(Boolean)
          .join(' - ');
      }
    }
    if (!resolvedRecipeName) {
      resolvedRecipeName = `Resep SKU ${input.sku_id.slice(0, 8)}`;
    }

    const existingRes = await client
      .from('product_recipes')
      .select('id, recipe_name, notes, is_active')
      .eq('sku_id', input.sku_id)
      .maybeSingle();

    if (existingRes.error) {
      throw new Error(mapSupabaseDatabaseError(existingRes.error));
    }

    const existingHeader = existingRes.data as
      | { id: string; recipe_name: string; notes: string | null; is_active: boolean }
      | null;
    let recipeId = existingHeader?.id;
    let previousItemsSnapshot: ProductRecipeItemRow[] = [];
    let isNewlyCreated = false;

    if (recipeId) {
      const snapRes = await client
        .from('product_recipe_items')
        .select('*')
        .eq('recipe_id', recipeId);
      if (snapRes.error) throw new Error(mapSupabaseDatabaseError(snapRes.error));
      previousItemsSnapshot = (snapRes.data ?? []) as ProductRecipeItemRow[];

      const updRes = await client
        .from('product_recipes')
        .update({
          recipe_name: resolvedRecipeName,
          notes: input.notes || null,
          is_active: true,
        })
        .eq('id', recipeId);
      if (updRes.error) throw new Error(mapSupabaseDatabaseError(updRes.error));

      const delItems = await client
        .from('product_recipe_items')
        .delete()
        .eq('recipe_id', recipeId);
      if (delItems.error) {
        const rbHeader = await client
          .from('product_recipes')
          .update({
            recipe_name: existingHeader!.recipe_name,
            notes: existingHeader!.notes,
            is_active: existingHeader!.is_active,
          })
          .eq('id', recipeId);
        const rbMsg = rbHeader.error
          ? ` PERINGATAN ROLLBACK: Gagal memulihkan header resep (${mapSupabaseDatabaseError(
              rbHeader.error
            )}).`
          : '';
        throw new Error(`${mapSupabaseDatabaseError(delItems.error)}${rbMsg}`);
      }
    } else {
      const insRes = await client
        .from('product_recipes')
        .insert({
          sku_id: input.sku_id,
          recipe_name: resolvedRecipeName,
          notes: input.notes || null,
          is_active: true,
        })
        .select('id')
        .single();
      const created = unwrap<{ id: string }>(insRes, 'Gagal membuat resep produk');
      recipeId = created.id;
      isNewlyCreated = true;
    }

    const insItems = await client.from('product_recipe_items').insert(
      input.items.map((item) => ({
        recipe_id: recipeId!,
        ingredient_id: item.ingredient_id,
        quantity: roundPrecision(item.quantity, 4),
        input_quantity: roundPrecision(item.input_quantity ?? item.quantity, 4),
        input_unit: item.input_unit ?? null,
        conversion_factor: item.conversion_factor ?? 1,
        notes: item.notes || null,
      }))
    );

    if (insItems.error) {
      const rollbackErrors: string[] = [];
      if (isNewlyCreated && recipeId) {
        const delRec = await client.from('product_recipes').delete().eq('id', recipeId);
        if (delRec.error) {
          rollbackErrors.push(
            `hapus header resep baru: ${mapSupabaseDatabaseError(delRec.error)}`
          );
        }
      } else if (recipeId && existingHeader) {
        const rbHeader = await client
          .from('product_recipes')
          .update({
            recipe_name: existingHeader.recipe_name,
            notes: existingHeader.notes,
            is_active: existingHeader.is_active,
          })
          .eq('id', recipeId);
        if (rbHeader.error) {
          rollbackErrors.push(
            `pulihkan header resep: ${mapSupabaseDatabaseError(rbHeader.error)}`
          );
        }
        if (previousItemsSnapshot.length > 0) {
          const rbItems = await client.from('product_recipe_items').insert(
            previousItemsSnapshot.map((prev) => ({
              recipe_id: prev.recipe_id,
              ingredient_id: prev.ingredient_id,
              quantity: prev.quantity,
              input_quantity: prev.input_quantity ?? prev.quantity,
              input_unit: prev.input_unit ?? null,
              conversion_factor: prev.conversion_factor ?? 1,
              notes: prev.notes ?? null,
            }))
          );
          if (rbItems.error) {
            rollbackErrors.push(
              `pulihkan item resep sebelumnya: ${mapSupabaseDatabaseError(rbItems.error)}`
            );
          }
        }
      }

      const rollbackSuffix =
        rollbackErrors.length > 0
          ? ` PERINGATAN ROLLBACK: Pemulihan resep gagal (${rollbackErrors.join(
              '; '
            )}). Harap periksa ulang resep SKU ini.`
          : '';
      throw new Error(`${mapSupabaseDatabaseError(insItems.error)}${rollbackSuffix}`);
    }
  },

  // --- Ingredients & Canonical Unit Conversions ---
  async convertIngredientQuantity(input: {
    quantity: number;
    input_unit: string;
    material_type: MaterialType;
  }): Promise<number> {
    const client = requireClient();
    const res = await client.rpc('convert_ingredient_quantity', {
      p_quantity: input.quantity,
      p_input_unit: input.input_unit,
      p_material_type: input.material_type,
    });
    if (res.error) {
      return convertToCanonicalQuantity(
        input.quantity,
        input.input_unit,
        input.material_type
      ).canonicalQuantity;
    }
    return Number(res.data ?? 0);
  },

  async adjustIngredientStock(input: {
    ingredient_id: string;
    adjustment_type: IngredientAdjustmentType;
    quantity: number;
    unit: string;
    notes?: string | null;
  }): Promise<void> {
    const client = requireClient();
    if (
      input.adjustment_type !== 'adjustment_in' &&
      input.adjustment_type !== 'adjustment_out'
    ) {
      throw new Error(
        'Jenis penyesuaian stok tidak valid. Gunakan adjustment_in atau adjustment_out.'
      );
    }
    const res = await client.rpc('adjust_ingredient_stock', {
      p_ingredient_id: input.ingredient_id,
      p_adjustment_type: input.adjustment_type,
      p_quantity: roundPrecision(input.quantity, 4),
      p_unit: input.unit,
      p_notes: input.notes ?? null,
    });
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  async createIngredient(input: {
    name: string;
    material_type: MaterialType;
    unit?: string;
    current_stock: number;
    average_unit_cost: number;
  }): Promise<IngredientRow> {
    const client = requireClient();
    const canonicalUnit = input.unit?.trim() || getCanonicalUnit(input.material_type);
    const initialStock = roundPrecision(
      Number.isFinite(input.current_stock) ? Math.max(0, input.current_stock) : 0,
      4
    );
    const avgUnitCost = roundPrecision(
      Number.isFinite(input.average_unit_cost) ? Math.max(0, input.average_unit_cost) : 0,
      6
    );

    // Masukkan bahan dengan stok 0 terlebih dahulu, lalu catat stok awal via adjust_ingredient_stock
    // agar setiap perubahan stok selalu memiliki jejak di ingredient_stock_movements.
    const res = await client
      .from('ingredients')
      .insert({
        name: input.name,
        material_type: input.material_type,
        unit: canonicalUnit,
        current_stock: 0,
        average_unit_cost: avgUnitCost,
        is_active: true,
      })
      .select()
      .single();
    const created = unwrap<IngredientRow>(res, 'Gagal menambah bahan baku');

    if (initialStock > 0) {
      const adjRes = await client.rpc('adjust_ingredient_stock', {
        p_ingredient_id: created.id,
        p_adjustment_type: 'adjustment_in' satisfies IngredientAdjustmentType,
        p_quantity: initialStock,
        p_unit: canonicalUnit,
        p_notes: 'Stok awal saat penambahan bahan baku',
      });
      if (adjRes.error) {
        const rbRes = await client.from('ingredients').delete().eq('id', created.id);
        const rbSuffix = rbRes.error
          ? ` PERINGATAN ROLLBACK: Bahan baru (${created.name}) gagal dihapus otomatis (${mapSupabaseDatabaseError(
              rbRes.error
            )}).`
          : '';
        throw new Error(
          `Gagal mencatat mutasi stok awal: ${mapSupabaseDatabaseError(
            adjRes.error
          )}${rbSuffix}`
        );
      }
      return { ...created, current_stock: initialStock };
    }

    return created;
  },

  async updateIngredient(
    id: string,
    input: {
      name: string;
      material_type: MaterialType;
      unit?: string;
      average_unit_cost: number;
      is_active: boolean;
    }
  ): Promise<IngredientRow> {
    const client = requireClient();
    const canonicalUnit = input.unit?.trim() || getCanonicalUnit(input.material_type);
    const res = await client
      .from('ingredients')
      .update({
        name: input.name,
        material_type: input.material_type,
        unit: canonicalUnit,
        average_unit_cost: roundPrecision(Math.max(0, input.average_unit_cost), 6),
        is_active: input.is_active,
      })
      .eq('id', id)
      .select()
      .single();
    return unwrap<IngredientRow>(res, 'Gagal memperbarui bahan baku');
  },

  async deleteIngredient(id: string): Promise<void> {
    const client = requireClient();

    const [ingRes, purchaseRes, movRes, prodMatRes, recipeRes] = await Promise.all([
      client.from('ingredients').select('id, current_stock').eq('id', id).maybeSingle(),
      client.from('ingredient_purchase_items').select('id').eq('ingredient_id', id).limit(1),
      client.from('ingredient_stock_movements').select('id').eq('ingredient_id', id).limit(1),
      client.from('production_materials').select('id').eq('ingredient_id', id).limit(1),
      client.from('product_recipe_items').select('id').eq('ingredient_id', id).limit(1),
    ]);

    if (ingRes.error) throw new Error(mapSupabaseDatabaseError(ingRes.error));
    if (purchaseRes.error) throw new Error(mapSupabaseDatabaseError(purchaseRes.error));
    if (movRes.error) throw new Error(mapSupabaseDatabaseError(movRes.error));
    if (prodMatRes.error) throw new Error(mapSupabaseDatabaseError(prodMatRes.error));
    if (recipeRes.error) throw new Error(mapSupabaseDatabaseError(recipeRes.error));

    if (
      Number(ingRes.data?.current_stock ?? 0) > 0 ||
      (purchaseRes.data?.length ?? 0) > 0 ||
      (movRes.data?.length ?? 0) > 0 ||
      (prodMatRes.data?.length ?? 0) > 0
    ) {
      throw new Error(
        'Bahan baku yang masih memiliki stok atau riwayat pembelian, mutasi stok, maupun produksi tidak dapat dihapus. Nonaktifkan bahan melalui tombol Ubah.'
      );
    }

    if ((recipeRes.data?.length ?? 0) > 0) {
      throw new Error(
        'Bahan baku tidak dapat dihapus karena masih digunakan dalam resep produk.'
      );
    }

    const res = await client.from('ingredients').delete().eq('id', id);
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  // --- Cash Accounts ---
  async createCashAccount(input: {
    account_name: string;
    account_type: string;
    account_number?: string | null;
    description?: string | null;
  }): Promise<CashAccountRow> {
    const client = requireClient();
    const res = await client
      .from('cash_accounts')
      .insert({
        account_name: input.account_name,
        account_type: input.account_type,
        account_number: input.account_number || null,
        description: input.description || null,
        is_active: true,
      })
      .select()
      .single();
    return unwrap<CashAccountRow>(res, 'Gagal menambah akun kas');
  },

  // --- Orders & Order Payments ---
  async createOrder(input: {
    order_number: string;
    customer_id: string | null;
    order_date: string;
    due_date: string | null;
    status: string;
    discount: number;
    notes: string | null;
    items: { sku_id: string; quantity: number; unit_price: number }[];
    initial_payment?: {
      amount: number;
      cash_account_id: string;
      payment_method: string;
      payment_date: string;
      notes?: string | null;
    };
  }): Promise<OrderRow> {
    const client = requireClient();
    const subtotal = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const totalAmount = Math.max(0, subtotal - input.discount);

    const orderRes = await client
      .from('orders')
      .insert({
        order_number: input.order_number,
        customer_id: input.customer_id,
        order_date: input.order_date,
        due_date: input.due_date,
        status: input.status,
        subtotal,
        discount: input.discount,
        total_amount: totalAmount,
        notes: input.notes,
      })
      .select()
      .single();

    const createdOrder = unwrap<OrderRow>(orderRes, 'Gagal membuat pesanan');

    if (input.items.length > 0) {
      const itemsRes = await client.from('order_items').insert(
        input.items.map((item) => ({
          order_id: createdOrder.id,
          sku_id: item.sku_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price,
        }))
      );
      if (itemsRes.error) {
        const rbOrder = await client.from('orders').delete().eq('id', createdOrder.id);
        const rbSuffix = rbOrder.error
          ? ` PERINGATAN ROLLBACK: Header pesanan gagal dibersihkan (${mapSupabaseDatabaseError(
              rbOrder.error
            )}).`
          : '';
        throw new Error(
          `Item pesanan gagal disimpan: ${mapSupabaseDatabaseError(
            itemsRes.error
          )}${rbSuffix}`
        );
      }
    }

    if (input.initial_payment && input.initial_payment.amount > 0) {
      const rpcRes = await client.rpc('register_order_payment', {
        p_order_id: createdOrder.id,
        p_cash_account_id: input.initial_payment.cash_account_id,
        p_payment_date: input.initial_payment.payment_date,
        p_amount: input.initial_payment.amount,
        p_payment_method: input.initial_payment.payment_method,
        p_notes: input.initial_payment.notes ?? null,
      });
      if (rpcRes.error) {
        const rbErrors: string[] = [];
        const rbItems = await client
          .from('order_items')
          .delete()
          .eq('order_id', createdOrder.id);
        if (rbItems.error) {
          rbErrors.push(`hapus item: ${mapSupabaseDatabaseError(rbItems.error)}`);
        }
        const rbOrder = await client
          .from('orders')
          .delete()
          .eq('id', createdOrder.id);
        if (rbOrder.error) {
          rbErrors.push(`hapus pesanan: ${mapSupabaseDatabaseError(rbOrder.error)}`);
        }
        const rbSuffix =
          rbErrors.length > 0
            ? ` PERINGATAN ROLLBACK: Pembersihan pesanan gagal (${rbErrors.join(
                '; '
              )}). Harap periksa pesanan ${createdOrder.order_number}.`
            : '';
        throw new Error(
          `Pembayaran awal gagal dicatat sehingga pesanan dibatalkan: ${mapSupabaseDatabaseError(
            rpcRes.error
          )}${rbSuffix}`
        );
      }
    }

    return createdOrder;
  },

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const client = requireClient();
    const res = await client
      .from('orders')
      .update({ status })
      .eq('id', orderId);
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  async deleteOrder(orderId: string): Promise<void> {
    const client = requireClient();
    const [paymentsRes, batchesRes, fgMovRes, cashTxRes] = await Promise.all([
      client.from('order_payments').select('id').eq('order_id', orderId).limit(1),
      client.from('production_batches').select('id').eq('order_id', orderId).limit(1),
      client.from('finished_goods_movements').select('id').eq('order_id', orderId).limit(1),
      client.from('cash_transactions').select('id').eq('reference_id', orderId).limit(1),
    ]);
    if (paymentsRes.error) throw new Error(mapSupabaseDatabaseError(paymentsRes.error));
    if (batchesRes.error) throw new Error(mapSupabaseDatabaseError(batchesRes.error));
    if (fgMovRes.error) throw new Error(mapSupabaseDatabaseError(fgMovRes.error));
    if (cashTxRes.error) throw new Error(mapSupabaseDatabaseError(cashTxRes.error));
    if (
      (paymentsRes.data?.length ?? 0) > 0 ||
      (batchesRes.data?.length ?? 0) > 0 ||
      (fgMovRes.data?.length ?? 0) > 0 ||
      (cashTxRes.data?.length ?? 0) > 0
    ) {
      throw new Error(
        'Pesanan yang sudah memiliki pembayaran, batch produksi, mutasi stok jadi, atau mutasi kas tidak dapat dihapus.'
      );
    }

    const itemsSnapRes = await client
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    if (itemsSnapRes.error) {
      throw new Error(mapSupabaseDatabaseError(itemsSnapRes.error));
    }
    const itemsSnapshot = (itemsSnapRes.data ?? []) as OrderItemRow[];

    const delItems = await client.from('order_items').delete().eq('order_id', orderId);
    if (delItems.error) throw new Error(mapSupabaseDatabaseError(delItems.error));

    const res = await client.from('orders').delete().eq('id', orderId);
    if (res.error) {
      let rbSuffix = '';
      if (itemsSnapshot.length > 0) {
        const rbItems = await client.from('order_items').insert(
          itemsSnapshot.map((it) => ({
            id: it.id,
            order_id: it.order_id,
            sku_id: it.sku_id,
            quantity: it.quantity,
            unit_price: it.unit_price,
            subtotal: it.subtotal,
          }))
        );
        if (rbItems.error) {
          rbSuffix = ` PERINGATAN ROLLBACK: Gagal memulihkan item pesanan (${mapSupabaseDatabaseError(
            rbItems.error
          )}).`;
        }
      }
      throw new Error(`${mapSupabaseDatabaseError(res.error)}${rbSuffix}`);
    }
  },

  async registerOrderPayment(input: {
    order_id: string;
    cash_account_id: string;
    payment_date: string;
    amount: number;
    payment_method: string;
    notes?: string | null;
  }): Promise<void> {
    const client = requireClient();
    const res = await client.rpc('register_order_payment', {
      p_order_id: input.order_id,
      p_cash_account_id: input.cash_account_id,
      p_payment_date: input.payment_date,
      p_amount: input.amount,
      p_payment_method: input.payment_method,
      p_notes: input.notes ?? null,
    });
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  // --- Ingredient Purchases & Payments (RPC) ---
  async registerIngredientPurchase(input: {
    supplier_name: string | null;
    purchase_date: string;
    notes?: string | null;
    items: {
      ingredient_id: string;
      input_quantity: number;
      input_unit: string;
      input_unit_price: number;
      conversion_factor: number;
      quantity: number;
      unit_price: number;
    }[];
  }): Promise<void> {
    const client = requireClient();
    const enrichedItems = input.items.map((item) => {
      const canonicalQty = roundPrecision(item.quantity, 4);
      const canonicalUnitPrice = roundPrecision(item.unit_price, 6);
      const subtotal = roundPrecision(item.input_quantity * item.input_unit_price, 6);
      return {
        ingredient_id: item.ingredient_id,
        quantity: canonicalQty,
        unit_price: canonicalUnitPrice,
        subtotal,
        input_quantity: roundPrecision(item.input_quantity, 4),
        input_unit: item.input_unit,
        input_unit_price: roundPrecision(item.input_unit_price, 6),
        conversion_factor: item.conversion_factor,
      };
    });
    const res = await client.rpc('register_ingredient_purchase', {
      p_supplier_name: input.supplier_name,
      p_purchase_date: input.purchase_date,
      p_items: enrichedItems,
      p_notes: input.notes ?? null,
    });
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  async registerPurchasePayment(input: {
    purchase_id: string;
    cash_account_id: string;
    payment_date: string;
    amount: number;
    payment_method: string;
    notes?: string | null;
  }): Promise<void> {
    const client = requireClient();
    const res = await client.rpc('register_purchase_payment', {
      p_purchase_id: input.purchase_id,
      p_cash_account_id: input.cash_account_id,
      p_payment_date: input.payment_date,
      p_amount: input.amount,
      p_payment_method: input.payment_method,
      p_notes: input.notes ?? null,
    });
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  // --- Production Batches (RPC) ---
  async registerProduction(input: {
    batch_number: string;
    order_id: string | null;
    sku_id: string;
    production_date: string;
    quantity: number;
    notes?: string | null;
  }): Promise<void> {
    const client = requireClient();
    const res = await client.rpc('register_production', {
      p_batch_number: input.batch_number,
      p_order_id: input.order_id,
      p_sku_id: input.sku_id,
      p_production_date: input.production_date,
      p_quantity: input.quantity,
      p_notes: input.notes ?? null,
    });
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  async completeProduction(input: {
    batch_id: string;
    actual_quantity: number;
    cost_items: {
      cost_type: string;
      description: string;
      amount: number;
      notes?: string | null;
    }[];
  }): Promise<void> {
    const client = requireClient();
    const res = await client.rpc('complete_production', {
      p_batch_id: input.batch_id,
      p_actual_quantity: input.actual_quantity,
      p_cost_items: input.cost_items,
    });
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  // --- Expenses & Capital Transactions (RPC) ---
  async registerExpense(input: {
    expense_date: string;
    category: string;
    description: string;
    amount: number;
    cash_account_id: string;
    notes?: string | null;
  }): Promise<void> {
    const client = requireClient();
    const res = await client.rpc('register_expense', {
      p_expense_date: input.expense_date,
      p_category: input.category,
      p_description: input.description,
      p_amount: input.amount,
      p_cash_account_id: input.cash_account_id,
      p_notes: input.notes ?? null,
    });
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  async deleteExpense(expenseId: string): Promise<DeleteExpenseRpcReturn> {
    const client = requireClient();
    const args: DeleteExpenseRpcArgs = {
      p_expense_id: expenseId,
    };
    const res = await client.rpc('delete_expense', args);
    if (res.error) {
      throw new Error(
        `Gagal menghapus pengeluaran: ${mapSupabaseDatabaseError(res.error)}`
      );
    }
    if (typeof res.data !== 'string' || !res.data.trim()) {
      throw new Error(
        'Fungsi delete_expense tidak mengembalikan UUID pengeluaran yang valid.'
      );
    }
    return res.data;
  },

  async registerCapitalTransaction(input: {
    transaction_date: string;
    transaction_type: string;
    amount: number;
    description: string;
    cash_account_id: string;
  }): Promise<void> {
    const client = requireClient();
    const res = await client.rpc('register_capital_transaction', {
      p_transaction_date: input.transaction_date,
      p_transaction_type: input.transaction_type,
      p_amount: input.amount,
      p_description: input.description,
      p_cash_account_id: input.cash_account_id,
    });
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },
};
