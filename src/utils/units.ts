export type MaterialType = 'solid' | 'liquid' | 'unit' | 'egg';

export interface MaterialTypeOption {
  value: MaterialType;
  label: string;
  baseUnit: 'gram' | 'ml' | 'pcs';
  helper: string;
}

export interface UnitConversionOption {
  unit: string;
  label: string;
  factor: number;
}

export const MATERIAL_TYPE_OPTIONS: MaterialTypeOption[] = [
  {
    value: 'solid',
    label: 'Padat (gram)',
    baseUnit: 'gram',
    helper: 'Disimpan dalam gram; pembelian mendukung gram & kg.',
  },
  {
    value: 'liquid',
    label: 'Cair (ml)',
    baseUnit: 'ml',
    helper: 'Disimpan dalam ml; pembelian mendukung ml & liter.',
  },
  {
    value: 'unit',
    label: 'Satuan (pcs)',
    baseUnit: 'pcs',
    helper: 'Disimpan dan dibeli dalam pcs.',
  },
  {
    value: 'egg',
    label: 'Telur (gram, resep butir)',
    baseUnit: 'gram',
    helper: 'Stok disimpan dalam gram; resep mendukung butir (1 butir = 60 gram).',
  },
];

export const EGG_GRAM_PER_BUTIR = 60;

export function roundPrecision(value: number, decimals = 6): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function inferMaterialType(
  materialType?: string | null,
  unit?: string | null,
  name?: string | null
): MaterialType {
  const mt = (materialType ?? '').trim().toLowerCase();
  if (mt === 'solid' || mt === 'liquid' || mt === 'unit' || mt === 'egg') {
    return mt;
  }

  const lowerName = (name ?? '').trim().toLowerCase();
  if (lowerName.includes('telur')) {
    return 'egg';
  }

  const lowerUnit = (unit ?? '').trim().toLowerCase();
  if (lowerUnit === 'ml' || lowerUnit === 'liter' || lowerUnit === 'l') {
    return 'liquid';
  }
  if (
    lowerUnit === 'pcs' ||
    lowerUnit === 'buah' ||
    lowerUnit === 'bungkus' ||
    lowerUnit === 'lembar'
  ) {
    return 'unit';
  }
  if (lowerUnit === 'butir') {
    return 'egg';
  }
  return 'solid';
}

export function getCanonicalUnit(materialType: MaterialType): 'gram' | 'ml' | 'pcs' {
  switch (materialType) {
    case 'liquid':
      return 'ml';
    case 'unit':
      return 'pcs';
    case 'egg':
    case 'solid':
    default:
      return 'gram';
  }
}

export function getMaterialTypeLabel(materialType: MaterialType): string {
  switch (materialType) {
    case 'solid':
      return 'Padat';
    case 'liquid':
      return 'Cair';
    case 'unit':
      return 'Satuan';
    case 'egg':
      return 'Telur';
  }
}

export function getPurchaseUnitOptions(materialType: MaterialType): UnitConversionOption[] {
  switch (materialType) {
    case 'liquid':
      return [
        { unit: 'ml', label: 'ml', factor: 1 },
        { unit: 'liter', label: 'liter (1.000 ml)', factor: 1000 },
      ];
    case 'unit':
      return [{ unit: 'pcs', label: 'pcs', factor: 1 }];
    case 'egg':
    case 'solid':
    default:
      return [
        { unit: 'gram', label: 'gram', factor: 1 },
        { unit: 'kg', label: 'kg (1.000 gram)', factor: 1000 },
      ];
  }
}

export function getRecipeUnitOptions(materialType: MaterialType): UnitConversionOption[] {
  switch (materialType) {
    case 'egg':
      return [
        { unit: 'butir', label: 'butir (60 gram)', factor: EGG_GRAM_PER_BUTIR },
        { unit: 'gram', label: 'gram', factor: 1 },
      ];
    case 'liquid':
      return [
        { unit: 'ml', label: 'ml', factor: 1 },
        { unit: 'liter', label: 'liter (1.000 ml)', factor: 1000 },
      ];
    case 'unit':
      return [{ unit: 'pcs', label: 'pcs', factor: 1 }];
    case 'solid':
    default:
      return [
        { unit: 'gram', label: 'gram', factor: 1 },
        { unit: 'kg', label: 'kg (1.000 gram)', factor: 1000 },
      ];
  }
}

export function getAdjustmentUnitOptions(materialType: MaterialType): UnitConversionOption[] {
  switch (materialType) {
    case 'egg':
      return [
        { unit: 'gram', label: 'gram', factor: 1 },
        { unit: 'kg', label: 'kg (1.000 gram)', factor: 1000 },
        { unit: 'butir', label: 'butir (60 gram)', factor: EGG_GRAM_PER_BUTIR },
      ];
    case 'liquid':
      return [
        { unit: 'ml', label: 'ml', factor: 1 },
        { unit: 'liter', label: 'liter (1.000 ml)', factor: 1000 },
      ];
    case 'unit':
      return [{ unit: 'pcs', label: 'pcs', factor: 1 }];
    case 'solid':
    default:
      return [
        { unit: 'gram', label: 'gram', factor: 1 },
        { unit: 'kg', label: 'kg (1.000 gram)', factor: 1000 },
      ];
  }
}

export function getConversionFactor(inputUnit: string, materialType: MaterialType): number {
  const normalized = inputUnit.trim().toLowerCase();
  if (normalized === 'kg') return 1000;
  if (normalized === 'liter' || normalized === 'l') return 1000;
  if (normalized === 'butir') return materialType === 'egg' ? EGG_GRAM_PER_BUTIR : EGG_GRAM_PER_BUTIR;
  return 1;
}

export function convertToCanonicalQuantity(
  inputQuantity: number,
  inputUnit: string,
  materialType: MaterialType
): {
  canonicalQuantity: number;
  conversionFactor: number;
  canonicalUnit: 'gram' | 'ml' | 'pcs';
} {
  const conversionFactor = getConversionFactor(inputUnit, materialType);
  const canonicalUnit = getCanonicalUnit(materialType);
  const safeInput = Number.isFinite(inputQuantity) ? Math.max(0, inputQuantity) : 0;
  const canonicalQuantity = roundPrecision(safeInput * conversionFactor, 4);
  return {
    canonicalQuantity,
    conversionFactor,
    canonicalUnit,
  };
}
