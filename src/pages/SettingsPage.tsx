import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBusinessData } from '../context/DataContext';
import { supabaseService } from '../services/supabaseService';
import { CustomerRow } from '../types/supabase';
import { Modal } from '../components/common/Modal';

export const SettingsPage: React.FC = () => {
  const { user, dbStatus, isCheckingDb, checkDbConnection, configError } = useAuth();
  const { db, isMutating, executeMutation, notifyError } = useBusinessData();

  const existingProfile = db.businessProfiles[0];

  const [businessName, setBusinessName] = useState(
    existingProfile?.business_name ?? ''
  );
  const [brandName, setBrandName] = useState(existingProfile?.brand_name ?? '');
  const [currency, setCurrency] = useState(existingProfile?.currency ?? 'IDR');

  // Quick customer form
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');

  // Edit customer modal
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [editCustNotes, setEditCustNotes] = useState('');

  useEffect(() => {
    if (existingProfile) {
      setBusinessName(existingProfile.business_name);
      setBrandName(existingProfile.brand_name ?? '');
      setCurrency(existingProfile.currency || 'IDR');
    }
  }, [existingProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      notifyError('Nama usaha wajib diisi.');
      return;
    }

    await executeMutation(
      () =>
        supabaseService.saveBusinessProfile({
          id: existingProfile?.id,
          business_name: businessName.trim(),
          brand_name: brandName.trim() || null,
          currency: currency.trim() || 'IDR',
        }),
      'Profil usaha berhasil disimpan ke Supabase.'
    );
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) {
      notifyError('Nama pelanggan wajib diisi.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.createCustomer({
          name: custName.trim(),
          phone: custPhone.trim() || null,
          address: custAddress.trim() || null,
        }),
      `Pelanggan "${custName.trim()}" berhasil ditambahkan.`
    );

    if (res) {
      setCustName('');
      setCustPhone('');
      setCustAddress('');
    }
  };

  const handleOpenEditCustomer = (c: CustomerRow) => {
    setEditingCustomer(c);
    setEditCustName(c.name);
    setEditCustPhone(c.phone ?? '');
    setEditCustAddress(c.address ?? '');
    setEditCustNotes(c.notes ?? '');
  };

  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!editCustName.trim()) {
      notifyError('Nama pelanggan wajib diisi.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.updateCustomer(editingCustomer.id, {
          name: editCustName.trim(),
          phone: editCustPhone.trim() || null,
          address: editCustAddress.trim() || null,
          notes: editCustNotes.trim() || null,
        }),
      `Data pelanggan "${editCustName.trim()}" berhasil diperbarui.`
    );

    if (res) {
      setEditingCustomer(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
          Pengaturan Usaha & Basis Data
        </h2>
        <p className="mt-0.5 text-sm text-[#6F574A]">
          Kelola profil usaha (business_profiles), direktori pelanggan (customers), dan status koneksi Supabase.
        </p>
      </div>

      {/* Profil Usaha */}
      <form
        onSubmit={(e) => void handleSaveProfile(e)}
        className="bg-white border border-[#E5D9C8] rounded-xl p-6 shadow-2xs space-y-4"
      >
        <h3 className="text-sm font-display font-semibold text-[#2B1B12] pb-3 border-b border-[#EFE6DA]">
          Profil Usaha & Identitas Merek
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Nama Usaha
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Contoh: Usaha Keluarga Keripik Bawang"
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Nama Merek (Brand Name)
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Belum difinalisasi"
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Mata Uang Utama
            </label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Model Bisnis
            </label>
            <input
              type="text"
              disabled
              value="Made to Order (MTO)"
              className="w-full px-3 py-2 text-xs bg-[#EFE6DA] border border-[#E5D9C8] rounded-lg text-[#5E3A28]"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-[#EFE6DA] flex justify-end">
          <button
            type="submit"
            disabled={isMutating}
            className="px-5 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] disabled:opacity-60 cursor-pointer"
          >
            {isMutating ? 'Menyimpan...' : 'Simpan Profil Usaha'}
          </button>
        </div>
      </form>

      {/* Direktori Pelanggan */}
      <div className="bg-white border border-[#E5D9C8] rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#EFE6DA]">
          <Users className="w-4 h-4 text-[#5E3A28]" />
          <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
            Daftar Pelanggan ({db.customers.length})
          </h3>
        </div>

        <form
          onSubmit={(e) => void handleAddCustomer(e)}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5"
        >
          <input
            type="text"
            required
            value={custName}
            onChange={(e) => setCustName(e.target.value)}
            placeholder="Nama pelanggan baru..."
            className="sm:col-span-4 px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
          />
          <input
            type="text"
            value={custPhone}
            onChange={(e) => setCustPhone(e.target.value)}
            placeholder="No. HP / WhatsApp (opsional)"
            className="sm:col-span-3 px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
          />
          <input
            type="text"
            value={custAddress}
            onChange={(e) => setCustAddress(e.target.value)}
            placeholder="Alamat (opsional)"
            className="sm:col-span-3 px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
          />
          <button
            type="submit"
            disabled={isMutating}
            className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </form>

        {db.customers.length > 0 && (
          <div className="divide-y divide-[#F5EFE6] border border-[#EFE6DA] rounded-lg overflow-hidden">
            {db.customers.map((c) => (
              <div
                key={c.id}
                className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div>
                    <span className="font-medium text-[#2B1B12]">{c.name}</span>
                    {c.phone && (
                      <span className="ml-2 text-[#6F574A] tabular-nums">
                        · {c.phone}
                      </span>
                    )}
                  </div>
                  {(c.address || c.notes) && (
                    <div className="text-[11px] text-[#8A7163] truncate">
                      {[c.address, c.notes].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => handleOpenEditCustomer(c)}
                    aria-label={`Ubah ${c.name}`}
                    className="p-1.5 rounded text-[#8A7163] hover:text-[#362015] cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() =>
                      void executeMutation(
                        () => supabaseService.deleteCustomer(c.id),
                        `Pelanggan "${c.name}" dihapus.`
                      )
                    }
                    aria-label={`Hapus ${c.name}`}
                    className="p-1.5 rounded text-[#8A7163] hover:text-[#B4382A] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Koneksi Supabase */}
      <div className="bg-white border border-[#E5D9C8] rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFE6DA]">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#5E3A28]" />
            <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
              Status Koneksi Supabase PostgreSQL
            </h3>
          </div>
          <button
            type="button"
            onClick={() => void checkDbConnection()}
            disabled={isCheckingDb}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E5D9C8] bg-[#FAF6F0] text-[#362015] hover:bg-[#EFE6DA] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingDb ? 'animate-spin' : ''}`} />
            <span>{isCheckingDb ? 'Memeriksa...' : 'Uji Koneksi Database'}</span>
          </button>
        </div>

        <div className="p-3.5 rounded-lg bg-[#FAF6F0] border border-[#EFE6DA] text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#6F574A]">Akun Administrator Terautentikasi:</span>
            <span className="font-medium text-[#2B1B12]">{user?.email ?? '-'}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="text-[#6F574A] shrink-0">Status Koneksi Database:</span>
            {configError ? (
              <span className="inline-flex items-center gap-1.5 text-[#B4382A] text-right">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{configError}</span>
              </span>
            ) : dbStatus ? (
              <span
                className={`inline-flex items-center gap-1.5 text-right ${
                  dbStatus.connected ? 'text-[#1E6B43]' : 'text-[#B4382A]'
                }`}
              >
                {dbStatus.connected ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{dbStatus.message}</span>
              </span>
            ) : (
              <span className="text-[#7A6154]">Belum diperiksa</span>
            )}
          </div>
        </div>
      </div>

      {/* Modal Edit Pelanggan */}
      <Modal
        open={Boolean(editingCustomer)}
        onClose={() => setEditingCustomer(null)}
        title="Ubah Data Pelanggan"
      >
        <form onSubmit={(e) => void handleSaveEditCustomer(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Nama Pelanggan
            </label>
            <input
              type="text"
              required
              value={editCustName}
              onChange={(e) => setEditCustName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              No. HP / WhatsApp (Opsional)
            </label>
            <input
              type="text"
              value={editCustPhone}
              onChange={(e) => setEditCustPhone(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Alamat (Opsional)
            </label>
            <input
              type="text"
              value={editCustAddress}
              onChange={(e) => setEditCustAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              value={editCustNotes}
              onChange={(e) => setEditCustNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>
          <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingCustomer(null)}
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
