import React, { useMemo, useState } from 'react';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { useBusinessData } from '../context/DataContext';
import { supabaseService } from '../services/supabaseService';
import { formatDateID, formatIDR, getTodayISO } from '../utils/formatters';
import { StatCard } from '../components/common/StatCard';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';

const EXPENSE_CATEGORIES = [
  'Bahan Baku',
  'Kemasan',
  'Gas & Operasional',
  'Tenaga Kerja',
  'Lainnya',
] as const;

export const ExpensesPage: React.FC = () => {
  const { db, isMutating, executeMutation, notifyError } = useBusinessData();
  const [filterCategory, setFilterCategory] = useState<string>('Semua');
  const [modalOpen, setModalOpen] = useState(false);

  const [expenseDate, setExpenseDate] = useState(getTodayISO());
  const [category, setCategory] = useState<string>('Bahan Baku');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [cashAccountId, setCashAccountId] = useState('');
  const [notes, setNotes] = useState('');

  const activeCashAccounts = useMemo(
    () => db.cashAccounts.filter((a) => a.is_active),
    [db.cashAccounts]
  );

  const cashAccountMap = useMemo(
    () => new Map(db.cashAccounts.map((a) => [a.id, a])),
    [db.cashAccounts]
  );

  const totals = useMemo(() => {
    const totalAll = db.expenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalBahan = db.expenses
      .filter((e) => e.category.toLowerCase().includes('bahan'))
      .reduce((s, e) => s + Number(e.amount), 0);
    const totalOperasional = totalAll - totalBahan;
    return { totalAll, totalBahan, totalOperasional };
  }, [db.expenses]);

  const allCategories = useMemo(() => {
    const set = new Set<string>(EXPENSE_CATEGORIES);
    db.expenses.forEach((e) => set.add(e.category));
    return ['Semua', ...Array.from(set)];
  }, [db.expenses]);

  const filteredExpenses = useMemo(() => {
    return db.expenses.filter(
      (e) => filterCategory === 'Semua' || e.category === filterCategory
    );
  }, [db.expenses, filterCategory]);

  const handleOpenModal = () => {
    setCashAccountId(activeCashAccounts[0]?.id ?? '');
    setExpenseDate(getTodayISO());
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      notifyError('Keterangan pengeluaran wajib diisi.');
      return;
    }
    if (amount <= 0) {
      notifyError('Nominal pengeluaran harus lebih dari 0.');
      return;
    }
    const cashId = cashAccountId || activeCashAccounts[0]?.id;
    if (!cashId) {
      notifyError(
        'Pilih akun kas sumber terlebih dahulu (tambahkan Akun Kas di menu Keuangan jika belum ada).'
      );
      return;
    }

    const res = await executeMutation(
      () =>
        supabaseService.registerExpense({
          expense_date: expenseDate,
          category,
          description: description.trim(),
          amount,
          cash_account_id: cashId,
          notes: notes.trim() || null,
        }),
      'Pengeluaran berhasil dicatat ke database.'
    );

    if (res !== null) {
      setDescription('');
      setAmount(0);
      setNotes('');
      setModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-[#2B1B12]">
            Catatan Pengeluaran
          </h2>
          <p className="mt-0.5 text-sm text-[#6F574A]">
            Catat pengeluaran usaha melalui fungsi register_expense Supabase.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Pengeluaran</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Pengeluaran"
          value={formatIDR(totals.totalAll)}
          helperText={`${db.expenses.length} transaksi keluar`}
          emphasis="negative"
        />
        <StatCard
          label="Belanja Bahan Baku"
          value={formatIDR(totals.totalBahan)}
        />
        <StatCard
          label="Kemasan & Operasional"
          value={formatIDR(totals.totalOperasional)}
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {allCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              filterCategory === cat
                ? 'bg-[#362015] text-[#FDFBF7]'
                : 'bg-white border border-[#E5D9C8] text-[#5E3A28] hover:bg-[#FAF6F0]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#E5D9C8] rounded-xl shadow-2xs overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Belum Ada Pengeluaran Tercatat"
            description="Catat setiap pengeluaran operasional, kemasan, dan bahan agar laporan laba bersih akurat."
            actionLabel="Catat Pengeluaran"
            onAction={handleOpenModal}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0]/60 text-[11px] font-medium text-[#7A6154]">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4">Akun Kas</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5EFE6] text-xs">
                {filteredExpenses.map((exp) => {
                  const acc = cashAccountMap.get(exp.cash_account_id);
                  return (
                    <tr key={exp.id} className="hover:bg-[#FAF6F0]/50">
                      <td className="py-3 px-4 tabular-nums text-[#5E3A28] whitespace-nowrap">
                        {formatDateID(exp.expense_date)}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#2B1B12]">
                        {exp.category}
                      </td>
                      <td className="py-3 px-4 text-[#2B1B12]">
                        <div>{exp.description}</div>
                        {exp.notes && (
                          <div className="text-[11px] text-[#8A7163]">{exp.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#6F574A]">
                        {acc?.account_name ?? '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-[#B4382A] tabular-nums whitespace-nowrap">
                        {formatIDR(Number(exp.amount))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() =>
                            void executeMutation(
                              () => supabaseService.deleteExpense(exp.id),
                              'Catatan pengeluaran dihapus.'
                            )
                          }
                          aria-label="Hapus pengeluaran"
                          className="p-1.5 rounded text-[#8A7163] hover:text-[#B4382A] hover:bg-[#FDF2F0] cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Catat Pengeluaran Baru"
        subtitle="Diproses melalui fungsi register_expense di Supabase."
      >
        {activeCashAccounts.length === 0 ? (
          <p className="text-xs text-[#5E3A28]">
            Belum ada Akun Kas yang tersedia. Silakan buat Akun Kas terlebih dahulu di halaman <strong>Keuangan</strong>.
          </p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Keterangan Pengeluaran
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Belanja bawang merah & minyak goreng"
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Nominal (IDR)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                  Akun Kas Sumber
                </label>
                <select
                  required
                  value={cashAccountId}
                  onChange={(e) => setCashAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
                >
                  {activeCashAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2B1B12] mb-1">
                Catatan (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg"
              />
            </div>

            <div className="pt-3 border-t border-[#EFE6DA] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E5D9C8] text-[#5E3A28]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isMutating}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#362015] text-[#FDFBF7] disabled:opacity-60 cursor-pointer"
              >
                {isMutating ? 'Menyimpan...' : 'Simpan Pengeluaran'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
