import React, { useMemo, useState } from 'react';
import { ArrowRight, Landmark, Plus, Wallet } from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import { supabaseService } from '../services/supabaseService';
import { PageId } from '../types/supabase';
import {
  formatDateID,
  formatIDR,
  getTodayISO,
  isCapitalWithdrawalType,
  isCashOutflowType,
} from '../utils/formatters';
import { StatCard } from '../components/common/StatCard';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';

interface FinancePageProps {
  onNavigate: (page: PageId) => void;
}

type FinanceTab = 'modal' | 'akun-kas' | 'pemasukan' | 'pengeluaran' | 'arus-kas';

export const FinancePage: React.FC<FinancePageProps> = ({ onNavigate }) => {
  const { db, isMutating, executeMutation, notifyError } = useBusinessData();
  const [activeTab, setActiveTab] = useState<FinanceTab>('modal');

  // Capital Modal
  const [capitalModalOpen, setCapitalModalOpen] = useState(false);
  const [capDate, setCapDate] = useState(getTodayISO());
  const [capType, setCapType] = useState('Modal Awal');
  const [capDesc, setCapDesc] = useState('');
  const [capAmount, setCapAmount] = useState<number>(0);
  const [capCashAccountId, setCapCashAccountId] = useState('');

  // Cash Account Modal
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('cash');
  const [accNumber, setAccNumber] = useState('');
  const [accDesc, setAccDesc] = useState('');

  const activeCashAccounts = useMemo(
    () => db.cashAccounts.filter((a) => a.is_active),
    [db.cashAccounts]
  );

  const cashAccountMap = useMemo(
    () => new Map(db.cashAccounts.map((a) => [a.id, a])),
    [db.cashAccounts]
  );

  const metrics = useMemo(() => {
    const totalModal = db.capitalTransactions.reduce((s, c) => {
      return isCapitalWithdrawalType(c.transaction_type)
        ? s - Number(c.amount)
        : s + Number(c.amount);
    }, 0);
    const totalPemasukan = db.orderPayments.reduce(
      (s, p) => s + Number(p.amount),
      0
    );
    const totalPengeluaran =
      db.expenses.reduce((s, e) => s + Number(e.amount), 0) +
      db.purchasePayments.reduce((s, p) => s + Number(p.amount), 0);

    const saldoPerAccount = new Map<string, number>();
    db.cashTransactions.forEach((tx) => {
      const isOut = isCashOutflowType(tx.transaction_type);
      const cur = saldoPerAccount.get(tx.cash_account_id) ?? 0;
      saldoPerAccount.set(
        tx.cash_account_id,
        isOut ? cur - Number(tx.amount) : cur + Number(tx.amount)
      );
    });

    const totalSaldoKas =
      db.cashTransactions.length > 0
        ? Array.from(saldoPerAccount.values()).reduce((a, b) => a + b, 0)
        : totalModal + totalPemasukan - totalPengeluaran;

    return {
      totalModal,
      totalPemasukan,
      totalPengeluaran,
      totalSaldoKas,
      saldoPerAccount,
    };
  }, [
    db.capitalTransactions,
    db.orderPayments,
    db.expenses,
    db.purchasePayments,
    db.cashTransactions,
  ]);

  const handleOpenCapitalModal = () => {
    setCapCashAccountId(activeCashAccounts[0]?.id ?? '');
    setCapDate(getTodayISO());
    setCapitalModalOpen(true);
  };

  const handleAddCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capDesc.trim() || capAmount <= 0) {
      notifyError('Keterangan dan nominal modal wajib diisi.');
      return;
    }
    const cashId = capCashAccountId || activeCashAccounts[0]?.id;
    if (!cashId) {
      notifyError('Tambahkan Akun Kas terlebih dahulu di tab Akun Kas.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.registerCapitalTransaction({
          transaction_date: capDate,
          transaction_type: capType,
          amount: capAmount,
          description: capDesc.trim(),
          cash_account_id: cashId,
        }),
      'Transaksi modal berhasil dicatat.'
    );

    if (res !== null) {
      setCapDesc('');
      setCapAmount(0);
      setCapitalModalOpen(false);
    }
  };

  const handleAddCashAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      notifyError('Nama akun kas wajib diisi.');
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.createCashAccount({
          account_name: accName.trim(),
          account_type: accType,
          account_number: accNumber.trim() || null,
          description: accDesc.trim() || null,
        }),
      `Akun kas "${accName.trim()}" berhasil ditambahkan.`
    );

    if (res) {
      setAccName('');
      setAccNumber('');
      setAccDesc('');
      setAccountModalOpen(false);
    }
  };

  const TABS: { id: FinanceTab; label: string }[] = [
    { id: 'modal', label: 'Manajemen Modal' },
    { id: 'akun-kas', label: 'Akun Kas' },
    { id: 'pemasukan', label: 'Pemasukan' },
    { id: 'pengeluaran', label: 'Pengeluaran' },
    { id: 'arus-kas', label: 'Arus Kas' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
            Manajemen Keuangan
          </h2>
          <p className="mt-0.5 text-sm text-[#6F574A]">
            Pengelolaan modal usaha, akun kas, pemasukan, pengeluaran, dan buku arus kas Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setAccountModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[#362015] text-[#362015] hover:bg-[#FAF6F0] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Tambah Akun Kas</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCapitalModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Modal</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Modal Bersih"
          value={formatIDR(metrics.totalModal)}
          emphasis="accent"
        />
        <StatCard
          label="Total Pemasukan"
          value={formatIDR(metrics.totalPemasukan)}
          emphasis="positive"
        />
        <StatCard
          label="Total Pengeluaran & Belanja"
          value={formatIDR(metrics.totalPengeluaran)}
          emphasis="negative"
        />
        <StatCard
          label="Total Saldo Kas"
          value={formatIDR(metrics.totalSaldoKas)}
          helperText={`${db.cashAccounts.length} akun kas terdaftar`}
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

      {activeTab === 'modal' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
          {db.capitalTransactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Belum Ada Catatan Modal"
              description="Catat modal awal usaha keluarga atau penambahan modal melalui fungsi register_capital_transaction."
              actionLabel="Catat Modal Pertama"
              onAction={handleOpenCapitalModal}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Jenis</th>
                    <th className="py-3 px-4">Akun Kas</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {db.capitalTransactions.map((c) => {
                    const isOut = isCapitalWithdrawalType(c.transaction_type);
                    return (
                      <tr key={c.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="py-3 px-4 tabular-nums text-[#5E3A28]">
                          {formatDateID(c.transaction_date)}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#2B1B12]">
                          {c.transaction_type}
                        </td>
                        <td className="py-3 px-4 text-[#6F574A]">
                          {cashAccountMap.get(c.cash_account_id)?.account_name ?? '-'}
                        </td>
                        <td className="py-3 px-4 text-[#2B1B12]">
                          {c.description || '-'}
                        </td>
                        <td
                          className={`py-3 px-4 text-right tabular-nums font-semibold ${
                            isOut ? 'text-[#B4382A]' : 'text-[#8C6518]'
                          }`}
                        >
                          {isOut ? '-' : '+'} {formatIDR(Number(c.amount))}
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

      {activeTab === 'akun-kas' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
          {db.cashAccounts.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="Belum Ada Akun Kas Terdaftar"
              description="Tambahkan akun seperti Kas Tunai atau Rekening Bank agar transaksi pembayaran, pengeluaran, dan modal dapat dicatat."
              actionLabel="Tambah Akun Kas"
              onAction={() => setAccountModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {db.cashAccounts.map((acc) => {
                const bal = metrics.saldoPerAccount.get(acc.id) ?? 0;
                return (
                  <div
                    key={acc.id}
                    className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E5D9C8]"
                  >
                    <div className="text-[11px] font-medium text-[#8A7163]">
                      {acc.account_type}
                      {acc.account_number ? ` · ${acc.account_number}` : ''}
                    </div>
                    <div className="mt-0.5 text-sm font-display font-semibold text-[#2B1B12]">
                      {acc.account_name}
                    </div>
                    {acc.description && (
                      <div className="mt-1 text-xs text-[#6F574A]">
                        {acc.description}
                      </div>
                    )}
                    <div className="mt-3 text-lg font-semibold text-[#362015] tabular-nums">
                      {formatIDR(bal)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'pemasukan' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
              Ringkasan Pemasukan Penjualan
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('penjualan')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#5E3A28] hover:text-[#2B1B12] cursor-pointer"
            >
              <span>Kelola di Halaman Penjualan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {db.orderPayments.length === 0 ? (
            <p className="text-xs text-[#8A7163] py-6 text-center">
              Belum ada pembayaran penjualan tercatat.
            </p>
          ) : (
            <div className="divide-y divide-[#F5EFE6]">
              {db.orderPayments.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-[#2B1B12]">
                      Pembayaran ({p.payment_method})
                    </div>
                    <div className="text-[11px] text-[#8A7163]">
                      {formatDateID(p.payment_date)} · {p.notes || 'Penerimaan penjualan'}
                    </div>
                  </div>
                  <div className="font-semibold text-[#1E6B43] tabular-nums">
                    + {formatIDR(Number(p.amount))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'pengeluaran' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-display font-semibold text-[#2B1B12]">
              Ringkasan Pengeluaran & Pembayaran Pemasok
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('pengeluaran')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#5E3A28] hover:text-[#2B1B12] cursor-pointer"
            >
              <span>Kelola di Halaman Pengeluaran</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {db.expenses.length + db.purchasePayments.length === 0 ? (
            <p className="text-xs text-[#8A7163] py-6 text-center">
              Belum ada catatan pengeluaran atau pembayaran pembelian bahan.
            </p>
          ) : (
            <div className="divide-y divide-[#F5EFE6]">
              {db.expenses.map((e) => (
                <div key={e.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-[#2B1B12]">{e.category}</div>
                    <div className="text-[11px] text-[#8A7163]">
                      {formatDateID(e.expense_date)} · {e.description}
                    </div>
                  </div>
                  <div className="font-semibold text-[#B4382A] tabular-nums">
                    - {formatIDR(Number(e.amount))}
                  </div>
                </div>
              ))}
              {db.purchasePayments.map((pp) => (
                <div key={pp.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-[#2B1B12]">
                      Pembayaran Bahan Baku ({pp.payment_method})
                    </div>
                    <div className="text-[11px] text-[#8A7163]">
                      {formatDateID(pp.payment_date)} · {pp.notes || 'Pembayaran pemasok'}
                    </div>
                  </div>
                  <div className="font-semibold text-[#B4382A] tabular-nums">
                    - {formatIDR(Number(pp.amount))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'arus-kas' && (
        <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
          {db.cashTransactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Buku Arus Kas Masih Kosong"
              description="Setiap transaksi melalui modal, penjualan, pengeluaran, dan pembayaran bahan tercatat di tabel cash_transactions."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Akun Kas</th>
                    <th className="py-3 px-4">Jenis Transaksi</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE6] text-xs">
                  {db.cashTransactions.map((tx) => {
                    const isOut = isCashOutflowType(tx.transaction_type);
                    return (
                      <tr key={tx.id} className="hover:bg-[#FAF6F0]/50">
                        <td className="py-3 px-4 tabular-nums text-[#5E3A28] whitespace-nowrap">
                          {formatDateID(tx.transaction_date)}
                        </td>
                        <td className="py-3 px-4 text-[#2B1B12]">
                          {cashAccountMap.get(tx.cash_account_id)?.account_name ?? '-'}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#2B1B12]">
                          {tx.transaction_type}
                        </td>
                        <td className="py-3 px-4 text-[#6F574A]">
                          {tx.description || tx.notes || '-'}
                        </td>
                        <td
                          className={`py-3 px-4 text-right tabular-nums font-semibold ${
                            isOut ? 'text-[#B4382A]' : 'text-[#1E6B43]'
                          }`}
                        >
                          {isOut ? '-' : '+'} {formatIDR(Number(tx.amount))}
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

      {/* Modal Catat Modal */}
      <Modal
        open={capitalModalOpen}
        onClose={() => setCapitalModalOpen(false)}
        title="Catat Transaksi Modal"
        subtitle="Diproses melalui fungsi register_capital_transaction di Supabase."
      >
        {activeCashAccounts.length === 0 ? (
          <p className="text-xs text-[#5E3A28]">
            Tambahkan Akun Kas terlebih dahulu sebelum mencatat transaksi modal.
          </p>
        ) : (
          <form onSubmit={(e) => void handleAddCapital(e)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={capDate}
                  onChange={(e) => setCapDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Jenis Transaksi
                </label>
                <select
                  value={capType}
                  onChange={(e) => setCapType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  <option value="Modal Awal">Modal Awal</option>
                  <option value="Tambah Modal">Tambah Modal</option>
                  <option value="Penarikan">Penarikan (Prive)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Akun Kas
              </label>
              <select
                required
                value={capCashAccountId}
                onChange={(e) => setCapCashAccountId(e.target.value)}
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
                Keterangan
              </label>
              <input
                type="text"
                required
                value={capDesc}
                onChange={(e) => setCapDesc(e.target.value)}
                placeholder="Contoh: Setoran modal awal usaha"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Nominal (IDR)
              </label>
              <input
                type="number"
                min={1}
                required
                value={capAmount}
                onChange={(e) => setCapAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
              />
            </div>

            <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCapitalModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isMutating}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
              >
                {isMutating ? 'Menyimpan...' : 'Simpan Modal'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Tambah Akun Kas */}
      <Modal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        title="Tambah Akun Kas / Rekening"
      >
        <form onSubmit={(e) => void handleAddCashAccount(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Nama Akun Kas
            </label>
            <input
              type="text"
              required
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              placeholder="Contoh: Kas Tunai Utama / Rekening BCA"
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Jenis Akun
              </label>
              <select
                value={accType}
                onChange={(e) => setAccType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              >
                <option value="cash">Kas Tunai</option>
                <option value="bank">Rekening Bank</option>
                <option value="ewallet">Dompet Digital (QRIS)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                No. Rekening (Opsional)
              </label>
              <input
                type="text"
                value={accNumber}
                onChange={(e) => setAccNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#2B1B12] mb-1">
              Deskripsi (Opsional)
            </label>
            <input
              type="text"
              value={accDesc}
              onChange={(e) => setAccDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
            />
          </div>
          <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAccountModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
            >
              {isMutating ? 'Menyimpan...' : 'Simpan Akun'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
