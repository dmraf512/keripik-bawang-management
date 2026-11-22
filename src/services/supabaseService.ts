import { mapSupabaseDatabaseError, supabase } from '../lib/supabase';
import {
  BusinessProfileRow,
  CashAccountRow,
  CashTransactionRow,
  CapitalTransactionRow,
  CustomerRow,
  ExpenseRow,
  FinishedGoodsMovementRow,
  IngredientPurchaseItemRow,
  IngredientPurchaseRow,
  IngredientRow,
  IngredientStockMovementRow,
  OrderItemRow,
  OrderPaymentRow,
  OrderRow,
  ProductRecipeItemRow,
  ProductRecipeRow,
  ProductRow,
  ProductSkuRow,
  ProductVariantRow,
  ProductionBatchRow,
  ProductionCostItemRow,
  ProductionMaterialRow,
  PurchasePaymentRow,
  SupabaseBusinessState,
} from '../types/supabase';

function requireClient() {
  if (!supabase) {
    throw new Error(
      'Klien Supabase belum terkonfigurasi. Periksa VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY.'
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
    const res = await client.from('product_skus').delete().eq('id', id);
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
  },

  async saveProductRecipe(input: {
    sku_id: string;
    recipe_name?: string;
    notes?: string | null;
    items: { ingredient_id: string; quantity: number; notes?: string | null }[];
  }): Promise<void> {
    const client = requireClient();

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
      .select('id')
      .eq('sku_id', input.sku_id)
      .maybeSingle();

    if (existingRes.error) {
      throw new Error(mapSupabaseDatabaseError(existingRes.error));
    }

    let recipeId = existingRes.data?.id as string | undefined;
    let isNewlyCreated = false;

    if (recipeId) {
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
      if (delItems.error) throw new Error(mapSupabaseDatabaseError(delItems.error));
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

    if (input.items.length > 0) {
      const insItems = await client.from('product_recipe_items').insert(
        input.items.map((item) => ({
          recipe_id: recipeId!,
          ingredient_id: item.ingredient_id,
          quantity: item.quantity,
          notes: item.notes || null,
        }))
      );
      if (insItems.error) {
        if (isNewlyCreated && recipeId) {
          await client.from('product_recipes').delete().eq('id', recipeId);
        }
        throw new Error(mapSupabaseDatabaseError(insItems.error));
      }
    }
  },

  // --- Ingredients ---
  async createIngredient(input: {
    name: string;
    unit: string;
    current_stock: number;
    average_unit_cost: number;
  }): Promise<IngredientRow> {
    const client = requireClient();
    const res = await client
      .from('ingredients')
      .insert({
        name: input.name,
        unit: input.unit,
        current_stock: input.current_stock,
        average_unit_cost: input.average_unit_cost,
        is_active: true,
      })
      .select()
      .single();
    return unwrap<IngredientRow>(res, 'Gagal menambah bahan baku');
  },

  async updateIngredient(
    id: string,
    input: {
      name: string;
      unit: string;
      current_stock: number;
      average_unit_cost: number;
      is_active: boolean;
    }
  ): Promise<IngredientRow> {
    const client = requireClient();
    const res = await client
      .from('ingredients')
      .update({
        name: input.name,
        unit: input.unit,
        current_stock: input.current_stock,
        average_unit_cost: input.average_unit_cost,
        is_active: input.is_active,
      })
      .eq('id', id)
      .select()
      .single();
    return unwrap<IngredientRow>(res, 'Gagal memperbarui bahan baku');
  },

  async deleteIngredient(id: string): Promise<void> {
    const client = requireClient();
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
        // Bersihkan header order yang baru dibuat agar tidak meninggalkan data yatim
        await client.from('orders').delete().eq('id', createdOrder.id);
        throw new Error(
          `Item pesanan gagal disimpan: ${mapSupabaseDatabaseError(
            itemsRes.error
          )}`
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
        throw new Error(
          `Pesanan tersimpan, tetapi pembayaran gagal dicatat: ${mapSupabaseDatabaseError(
            rpcRes.error
          )}`
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
    const [paymentsRes, batchesRes] = await Promise.all([
      client.from('order_payments').select('id').eq('order_id', orderId).limit(1),
      client.from('production_batches').select('id').eq('order_id', orderId).limit(1),
    ]);
    if (paymentsRes.error) throw new Error(mapSupabaseDatabaseError(paymentsRes.error));
    if (batchesRes.error) throw new Error(mapSupabaseDatabaseError(batchesRes.error));
    if ((paymentsRes.data?.length ?? 0) > 0 || (batchesRes.data?.length ?? 0) > 0) {
      throw new Error(
        'Pesanan yang sudah memiliki pembayaran atau batch produksi tidak dapat dihapus.'
      );
    }

    const delItems = await client.from('order_items').delete().eq('order_id', orderId);
    if (delItems.error) throw new Error(mapSupabaseDatabaseError(delItems.error));

    const res = await client.from('orders').delete().eq('id', orderId);
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
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
    items: { ingredient_id: string; quantity: number; unit_price: number }[];
  }): Promise<void> {
    const client = requireClient();
    const enrichedItems = input.items.map((item) => ({
      ingredient_id: item.ingredient_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: Number((item.quantity * item.unit_price).toFixed(2)),
    }));
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

  async deleteExpense(expenseId: string): Promise<void> {
    const client = requireClient();
    const res = await client.from('expenses').delete().eq('id', expenseId);
    if (res.error) throw new Error(mapSupabaseDatabaseError(res.error));
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
