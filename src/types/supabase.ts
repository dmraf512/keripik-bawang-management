export type PageId =
  | 'dashboard'
  | 'pesanan'
  | 'penjualan'
  | 'produksi'
  | 'produk'
  | 'bahan-baku'
  | 'pengeluaran'
  | 'keuangan'
  | 'laporan'
  | 'pengaturan';

export type DateFilterPeriod = 'today' | '7d' | 'month' | 'year';

export interface BusinessProfileRow {
  id: string;
  business_name: string;
  brand_name: string | null;
  currency: string;
  created_at: string;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductVariantRow {
  id: string;
  product_id: string;
  variant_name: string;
  is_active: boolean;
  created_at: string;
}

export interface ProductSkuRow {
  id: string;
  variant_id: string;
  sku_code: string | null;
  package_name: string;
  weight_gram: number | null;
  selling_price: number;
  is_active: boolean;
  created_at: string;
}

export interface IngredientRow {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  average_unit_cost: number;
  is_active: boolean;
  created_at: string;
}

export interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  order_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  sku_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface OrderPaymentRow {
  id: string;
  order_id: string;
  cash_account_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

export interface IngredientPurchaseRow {
  id: string;
  supplier_name: string | null;
  purchase_date: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
}

export interface IngredientPurchaseItemRow {
  id: string;
  purchase_id: string;
  ingredient_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface PurchasePaymentRow {
  id: string;
  purchase_id: string;
  cash_account_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

export interface ProductionBatchRow {
  id: string;
  batch_number: string;
  order_id: string | null;
  sku_id: string;
  production_date: string;
  planned_quantity: number;
  actual_quantity: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface ProductionMaterialRow {
  id: string;
  batch_id: string;
  ingredient_id: string;
  quantity_used: number;
  unit_cost: number;
  total_cost: number;
}

export interface ProductionCostItemRow {
  id: string;
  batch_id: string;
  cost_type: string;
  description: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface ProductRecipeRow {
  id: string;
  sku_id: string;
  recipe_name: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ProductRecipeItemRow {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export interface IngredientStockMovementRow {
  id: string;
  ingredient_id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  reference_id: string | null;
  movement_date: string;
  notes: string | null;
  created_at: string;
}

export interface FinishedGoodsMovementRow {
  id: string;
  sku_id: string;
  movement_type: string;
  quantity: number;
  batch_id: string | null;
  order_id: string | null;
  movement_date: string;
  notes: string | null;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  cash_account_id: string;
  notes: string | null;
  created_at: string;
}

export interface CapitalTransactionRow {
  id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  cash_account_id: string;
  created_at: string;
}

export interface CashAccountRow {
  id: string;
  account_name: string;
  account_type: string;
  account_number: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashTransactionRow {
  id: string;
  cash_account_id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
}

export interface SupabaseBusinessState {
  businessProfiles: BusinessProfileRow[];
  customers: CustomerRow[];
  products: ProductRow[];
  productVariants: ProductVariantRow[];
  productSkus: ProductSkuRow[];
  ingredients: IngredientRow[];
  orders: OrderRow[];
  orderItems: OrderItemRow[];
  orderPayments: OrderPaymentRow[];
  ingredientPurchases: IngredientPurchaseRow[];
  ingredientPurchaseItems: IngredientPurchaseItemRow[];
  purchasePayments: PurchasePaymentRow[];
  productionBatches: ProductionBatchRow[];
  productionMaterials: ProductionMaterialRow[];
  productionCostItems: ProductionCostItemRow[];
  productRecipes: ProductRecipeRow[];
  productRecipeItems: ProductRecipeItemRow[];
  ingredientStockMovements: IngredientStockMovementRow[];
  finishedGoodsMovements: FinishedGoodsMovementRow[];
  expenses: ExpenseRow[];
  capitalTransactions: CapitalTransactionRow[];
  cashAccounts: CashAccountRow[];
  cashTransactions: CashTransactionRow[];
}
