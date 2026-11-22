import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  PackageCheck,
  Truck,
} from 'lucide-react';

export function normalizeOrderStatusLabel(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === 'menunggu' || s === 'pending' || s === 'draft') return 'Menunggu';
  if (s === 'diproses' || s === 'processing' || s === 'in_production') return 'Diproses';
  if (s === 'selesai diproduksi' || s === 'produced') return 'Selesai Diproduksi';
  if (s === 'siap diambil/dikirim' || s === 'ready') return 'Siap Diambil/Dikirim';
  if (s === 'selesai' || s === 'completed' || s === 'done') return 'Selesai';
  return status;
}

export function normalizeBatchStatusLabel(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === 'terjadwal' || s === 'planned' || s === 'scheduled') return 'Terjadwal';
  if (s === 'sedang diproduksi' || s === 'in_progress' || s === 'processing') {
    return 'Sedang Diproduksi';
  }
  if (s === 'selesai' || s === 'completed' || s === 'done') return 'Selesai';
  return status;
}

export const OrderStatusLabel: React.FC<{ status: string }> = ({ status }) => {
  const label = normalizeOrderStatusLabel(status);
  switch (label) {
    case 'Menunggu':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8C6518] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Menunggu</span>
        </span>
      );
    case 'Diproses':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A14B1A] whitespace-nowrap">
          <Flame className="w-3.5 h-3.5 shrink-0" />
          <span>Diproses</span>
        </span>
      );
    case 'Selesai Diproduksi':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#285E8A] whitespace-nowrap">
          <PackageCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Selesai Diproduksi</span>
        </span>
      );
    case 'Siap Diambil/Dikirim':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5E3A28] whitespace-nowrap">
          <Truck className="w-3.5 h-3.5 shrink-0" />
          <span>Siap Diambil/Dikirim</span>
        </span>
      );
    case 'Selesai':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E6B43] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Selesai</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5E3A28] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
  }
};

export function normalizePaymentStatusLabel(
  status: string
): 'Belum Bayar' | 'DP / Sebagian' | 'Lunas' {
  const s = status.trim().toLowerCase();
  if (s === 'lunas' || s === 'paid' || s === 'settled' || s === 'full') {
    return 'Lunas';
  }
  if (
    s === 'dp / sebagian' ||
    s === 'dp' ||
    s === 'sebagian' ||
    s === 'partial' ||
    s === 'partially_paid'
  ) {
    return 'DP / Sebagian';
  }
  return 'Belum Bayar';
}

export const PaymentStatusLabel: React.FC<{
  status: string;
}> = ({ status }) => {
  const normalized = normalizePaymentStatusLabel(status);
  switch (normalized) {
    case 'Lunas':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E6B43] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Lunas</span>
        </span>
      );
    case 'DP / Sebagian':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8C6518] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>DP / Sebagian</span>
        </span>
      );
    case 'Belum Bayar':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B4382A] whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Belum Bayar</span>
        </span>
      );
  }
};

export const BatchStatusLabel: React.FC<{ status: string }> = ({ status }) => {
  const label = normalizeBatchStatusLabel(status);
  switch (label) {
    case 'Terjadwal':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8C6518] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Terjadwal</span>
        </span>
      );
    case 'Sedang Diproduksi':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A14B1A] whitespace-nowrap">
          <Flame className="w-3.5 h-3.5 shrink-0" />
          <span>Sedang Diproduksi</span>
        </span>
      );
    case 'Selesai':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E6B43] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Selesai</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5E3A28] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
  }
};
