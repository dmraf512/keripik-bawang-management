import { useCallback, useMemo } from 'react';
import { useBusinessData } from '../context/DataContext';
import {
  CashAccountBalanceView,
  DateFilterPeriod,
  FinishedGoodsStockView,
  IngredientStockView,
  OrderPaymentStatusView,
  ProductionBatchCostView,
  PurchasePaymentStatusView,
  SalesSummaryView,
  SkuRecipeHppView,
} from '../types/supabase';
import {
  isCapitalWithdrawalType,
  isCashOutflowType,
  isWithinDateFilter,
} from '../utils/formatters';

export interface PeriodFinancialSummary {
  salesOrderTotal: number;
  collectedRevenue: number;
  productionHpp: number;
  operatingExpenses: number;
  purchaseCashOutflow: number;
  totalCashOutflow: number;
  grossProfit: number;
  netProfit: number;
  totalModal: number;
  ordersCount: number;
  orderPaymentsCount: number;
  expensesCount: number;
  purchasePaymentsCount: number;
  batchesCount: number;
}

export function useBusinessMetrics() {
  const { db } = useBusinessData();

  const cashAccountBalanceMap = useMemo(() => {
    const map = new Map<string, CashAccountBalanceView>();
    if (db.cashAccountBalances.length > 0) {
      db.cashAccountBalances.forEach((row) => map.set(row.cash_account_id, row));
      return map;
    }

    const fallback = new Map<string, number>();
    db.cashTransactions.forEach((tx) => {
      const cur = fallback.get(tx.cash_account_id) ?? 0;
      const amt = Number(tx.amount);
      fallback.set(
        tx.cash_account_id,
        isCashOutflowType(tx.transaction_type) ? cur - amt : cur + amt
      );
    });
    db.cashAccounts.forEach((acc) => {
      map.set(acc.id, {
        cash_account_id: acc.id,
        account_name: acc.account_name,
        account_type: acc.account_type,
        is_active: acc.is_active,
        current_balance: fallback.get(acc.id) ?? 0,
      });
    });
    return map;
  }, [db.cashAccountBalances, db.cashAccounts, db.cashTransactions]);

  const totalCashBalance = useMemo(() => {
    let total = 0;
    cashAccountBalanceMap.forEach((row) => {
      total += Number(row.current_balance);
    });
    return total;
  }, [cashAccountBalanceMap]);

  const ingredientStockMap = useMemo(() => {
    const map = new Map<string, IngredientStockView>();
    if (db.ingredientStock.length > 0) {
      db.ingredientStock.forEach((row) => map.set(row.ingredient_id, row));
      return map;
    }
    db.ingredients.forEach((ing) => {
      const stock = Number(ing.current_stock);
      const cost = Number(ing.average_unit_cost);
      map.set(ing.id, {
        ingredient_id: ing.id,
        ingredient_name: ing.name,
        unit: ing.unit,
        current_stock: stock,
        average_unit_cost: cost,
        stock_value: stock * cost,
        is_active: ing.is_active,
      });
    });
    return map;
  }, [db.ingredientStock, db.ingredients]);

  const totalIngredientAssetValue = useMemo(() => {
    let total = 0;
    ingredientStockMap.forEach((row) => {
      total += Number(row.stock_value);
    });
    return total;
  }, [ingredientStockMap]);

  const finishedGoodsStockList = useMemo<FinishedGoodsStockView[]>(() => {
    if (db.finishedGoodsStock.length > 0) {
      return db.finishedGoodsStock;
    }
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
    return db.productSkus.map((sku) => ({
      sku_id: sku.id,
      sku_code: sku.sku_code,
      package_name: sku.package_name,
      weight_gram: sku.weight_gram,
      selling_price: Number(sku.selling_price),
      current_stock: stockBySku.get(sku.id) ?? 0,
    }));
  }, [db.finishedGoodsStock, db.finishedGoodsMovements, db.productSkus]);

  const finishedGoodsStockMap = useMemo(
    () => new Map(finishedGoodsStockList.map((row) => [row.sku_id, row])),
    [finishedGoodsStockList]
  );

  const orderPaymentStatusMap = useMemo(() => {
    const map = new Map<string, OrderPaymentStatusView>();
    if (db.orderPaymentStatus.length > 0) {
      db.orderPaymentStatus.forEach((row) => map.set(row.order_id, row));
      return map;
    }
    const paidPerOrder = new Map<string, number>();
    db.orderPayments.forEach((p) => {
      paidPerOrder.set(p.order_id, (paidPerOrder.get(p.order_id) ?? 0) + Number(p.amount));
    });
    db.orders.forEach((o) => {
      const total = Number(o.total_amount);
      const paid = paidPerOrder.get(o.id) ?? 0;
      const remaining = Math.max(0, total - paid);
      const payment_status =
        paid >= total && total > 0 ? 'Lunas' : paid > 0 ? 'DP / Sebagian' : 'Belum Bayar';
      map.set(o.id, {
        order_id: o.id,
        order_number: o.order_number,
        total_amount: total,
        total_paid: paid,
        remaining_payment: remaining,
        payment_status,
      });
    });
    return map;
  }, [db.orderPaymentStatus, db.orders, db.orderPayments]);

  const purchasePaymentStatusMap = useMemo(() => {
    const map = new Map<string, PurchasePaymentStatusView>();
    if (db.purchasePaymentStatus.length > 0) {
      db.purchasePaymentStatus.forEach((row) => map.set(row.purchase_id, row));
      return map;
    }
    const paidPerPurchase = new Map<string, number>();
    db.purchasePayments.forEach((p) => {
      paidPerPurchase.set(
        p.purchase_id,
        (paidPerPurchase.get(p.purchase_id) ?? 0) + Number(p.amount)
      );
    });
    db.ingredientPurchases.forEach((pur) => {
      const total = Number(pur.total_amount);
      const paid = paidPerPurchase.get(pur.id) ?? 0;
      map.set(pur.id, {
        purchase_id: pur.id,
        supplier_name: pur.supplier_name,
        purchase_date: pur.purchase_date,
        total_amount: total,
        total_paid: paid,
        remaining_payment: Math.max(0, total - paid),
      });
    });
    return map;
  }, [db.purchasePaymentStatus, db.ingredientPurchases, db.purchasePayments]);

  const productionBatchCostMap = useMemo(() => {
    const map = new Map<string, ProductionBatchCostView>();
    if (db.productionBatchCosts.length > 0) {
      db.productionBatchCosts.forEach((row) => map.set(row.batch_id, row));
      return map;
    }
    db.productionBatches.forEach((b) => {
      const matCost = db.productionMaterials
        .filter((m) => m.batch_id === b.id)
        .reduce((s, m) => s + Number(m.total_cost), 0);
      const addCost = db.productionCostItems
        .filter((c) => c.batch_id === b.id)
        .reduce((s, c) => s + Number(c.amount), 0);
      map.set(b.id, {
        batch_id: b.id,
        batch_number: b.batch_number,
        sku_id: b.sku_id,
        planned_quantity: Number(b.planned_quantity),
        actual_quantity: b.actual_quantity !== null ? Number(b.actual_quantity) : null,
        status: b.status,
        material_cost: matCost,
        additional_cost: addCost,
        total_production_cost: matCost + addCost,
      });
    });
    return map;
  }, [
    db.productionBatchCosts,
    db.productionBatches,
    db.productionMaterials,
    db.productionCostItems,
  ]);

  const skuRecipeHppMap = useMemo(() => {
    const map = new Map<string, SkuRecipeHppView>();
    if (db.skuRecipeHpp.length > 0) {
      db.skuRecipeHpp.forEach((row) => map.set(row.sku_id, row));
      return map;
    }
    const ingMap = new Map(db.ingredients.map((i) => [i.id, i]));
    const skuMap = new Map(db.productSkus.map((s) => [s.id, s]));
    db.productRecipes.forEach((rec) => {
      const sku = skuMap.get(rec.sku_id);
      const estHpp = db.productRecipeItems
        .filter((item) => item.recipe_id === rec.id)
        .reduce((sum, item) => {
          const ing = ingMap.get(item.ingredient_id);
          return sum + Number(item.quantity) * Number(ing?.average_unit_cost ?? 0);
        }, 0);
      map.set(rec.sku_id, {
        recipe_id: rec.id,
        sku_id: rec.sku_id,
        recipe_name: rec.recipe_name,
        sku_code: sku?.sku_code ?? null,
        package_name: sku?.package_name ?? '',
        estimated_material_hpp: estHpp,
      });
    });
    return map;
  }, [
    db.skuRecipeHpp,
    db.ingredients,
    db.productSkus,
    db.productRecipes,
    db.productRecipeItems,
  ]);

  const salesSummaryList = useMemo<SalesSummaryView[]>(() => {
    if (db.salesSummary.length > 0) {
      return db.salesSummary;
    }
    return db.orders.map((o) => {
      const pay = orderPaymentStatusMap.get(o.id);
      return {
        order_id: o.id,
        order_number: o.order_number,
        order_date: o.order_date,
        status: o.status,
        subtotal: Number(o.subtotal),
        discount: Number(o.discount),
        total_amount: Number(o.total_amount),
        total_paid: pay?.total_paid ?? 0,
        remaining_payment: pay?.remaining_payment ?? Number(o.total_amount),
      };
    });
  }, [db.salesSummary, db.orders, orderPaymentStatusMap]);

  const totalModal = useMemo(
    () =>
      db.capitalTransactions.reduce((sum, c) => {
        return isCapitalWithdrawalType(c.transaction_type)
          ? sum - Number(c.amount)
          : sum + Number(c.amount);
      }, 0),
    [db.capitalTransactions]
  );

  const getPeriodFinancials = useCallback(
    (period: DateFilterPeriod): PeriodFinancialSummary => {
      const orders = salesSummaryList.filter((o) =>
        isWithinDateFilter(o.order_date, period)
      );
      const payments = db.orderPayments.filter((p) =>
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

      const salesOrderTotal = orders.reduce((s, o) => s + Number(o.total_amount), 0);
      const collectedRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
      const operatingExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
      const purchaseCashOutflow = purchasePayments.reduce(
        (s, pp) => s + Number(pp.amount),
        0
      );

      const productionHpp = batches.reduce((sum, b) => {
        const costRow = productionBatchCostMap.get(b.id);
        return sum + Number(costRow?.total_production_cost ?? 0);
      }, 0);

      // Laba kotor = Pendapatan diterima - HPP produksi aktual (bukan belanja stok bahan mentah)
      const grossProfit = collectedRevenue - productionHpp;
      // Laba bersih = Pendapatan - HPP produksi aktual - Beban operasional
      const netProfit = collectedRevenue - productionHpp - operatingExpenses;

      return {
        salesOrderTotal,
        collectedRevenue,
        productionHpp,
        operatingExpenses,
        purchaseCashOutflow,
        totalCashOutflow: operatingExpenses + purchaseCashOutflow,
        grossProfit,
        netProfit,
        totalModal,
        ordersCount: orders.length,
        orderPaymentsCount: payments.length,
        expensesCount: expenses.length,
        purchasePaymentsCount: purchasePayments.length,
        batchesCount: batches.length,
      };
    },
    [
      salesSummaryList,
      db.orderPayments,
      db.expenses,
      db.purchasePayments,
      db.productionBatches,
      productionBatchCostMap,
      totalModal,
    ]
  );

  return {
    cashAccountBalanceMap,
    totalCashBalance,
    ingredientStockMap,
    totalIngredientAssetValue,
    finishedGoodsStockList,
    finishedGoodsStockMap,
    orderPaymentStatusMap,
    purchasePaymentStatusMap,
    productionBatchCostMap,
    skuRecipeHppMap,
    salesSummaryList,
    totalModal,
    getPeriodFinancials,
  };
}
