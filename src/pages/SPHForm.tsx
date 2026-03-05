import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Save, FileDown, Plus, Trash2, Eye, ImageIcon, X } from 'lucide-react';
import { SPH, SPHItem, SPHPaymentTerm, SPHDesignSelection, JENIS_LIFT, KAPASITAS_LIFT, PAYMENT_CONDITIONS, DEFAULT_ITEMS, DEFAULT_SPECS } from '@/lib/sph-types';
import { generateNomorSPH, getNextIncrement, formatCurrency, calculateItemTotal, saveSPH, loadSPHById, generateId } from '@/lib/sph-utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DESIGN_CATEGORIES = ['Cabin', 'Floor', 'Ceiling', 'Door', 'COP', 'LOP', 'Struktur', 'Add On'];

function createDefaultSPH(nomorSPH: string): SPH {
  return {
    id: generateId(),
    nomorSPH,
    tanggal: new Date().toISOString().split('T')[0],
    kepada: '',
    namaPIC: '',
    namaSales: '',
    alamatProyek: '',
    perihal: 'Penawaran Harga Pengadaan & Pemasangan Lift',
    jenisLift: 'Passenger Lift',
    kapasitas: 630,
    floors: 5,
    stops: 5,
    doors: 5,
    waktuPelaksanaan: '90 Hari Kerja',
    priceMode: 'harga_satuan',
    lumpSumTotal: 0,
    items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
    specs: JSON.parse(JSON.stringify(DEFAULT_SPECS)),
    terms: {
      masaBerlaku: '3 Minggu',
      garansiSparepart: '2 Tahun',
      garansiMesin: '5 Tahun',
      maintenance: '6 Bulan',
      excludes: ['Pekerjaan sipil di luar ruang lingkup penawaran'],
    },
    payments: [
      { id: '1', percentage: 50, condition: 'Setelah Kontrak Ditandatangani' },
      { id: '2', percentage: 40, condition: 'Setelah Barang Sampai Gudang' },
      { id: '3', percentage: 10, condition: 'Setelah BAST' },
    ],
    designs: {},
    includePPN: true,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function SPHForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { user } = useAuth();

  const [form, setForm] = useState<SPH | null>(null);
  const [loading, setLoading] = useState(true);
  const [designItems, setDesignItems] = useState<{id: string; category: string; name: string; sku: string; image_url: string | null}[]>([]);

  useEffect(() => {
    const init = async () => {
      // Load design items
      const { data: diData } = await supabase.from('design_items').select('*').order('created_at');
      if (diData) setDesignItems(diData as any);

      if (isEdit && id) {
        const found = await loadSPHById(id);
        if (found) {
          setForm(found);
        } else {
          toast.error('SPH tidak ditemukan');
          navigate('/sph');
          return;
        }
      } else {
        const increment = await getNextIncrement();
        setForm(createDefaultSPH(generateNomorSPH(increment)));
      }
      setLoading(false);
    };
    init();
  }, [id, isEdit, navigate]);

  if (loading || !form) {
    return <div className="text-center py-20 text-muted-foreground text-sm">Memuat...</div>;
  }

  const totals = calculateItemTotal({
    items: form.items,
    includePPN: form.includePPN,
    priceMode: form.priceMode,
    lumpSumTotal: form.lumpSumTotal,
  });

  const updateField = (key: keyof SPH, value: any) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const updateItem = (itemId: string, field: keyof SPHItem, value: any, parentId?: string) => {
    setForm(prev => {
      if (!prev) return prev;
      const items = JSON.parse(JSON.stringify(prev.items));
      if (parentId) {
        const parent = items.find((i: SPHItem) => i.id === parentId);
        if (parent?.children) {
          const child = parent.children.find((c: SPHItem) => c.id === itemId);
          if (child) (child as any)[field] = value;
        }
      } else {
        const item = items.find((i: SPHItem) => i.id === itemId);
        if (item) (item as any)[field] = value;
      }
      return { ...prev, items };
    });
  };

  const updateSpec = (key: string, value: string) => {
    setForm(prev => prev ? {
      ...prev,
      specs: prev.specs.map(s => s.key === key ? { ...s, value } : s),
    } : prev);
  };

  const addPaymentTerm = () => {
    setForm(prev => prev ? {
      ...prev,
      payments: [...prev.payments, { id: generateId(), percentage: 0, condition: '' }],
    } : prev);
  };

  const removePaymentTerm = (termId: string) => {
    setForm(prev => prev ? {
      ...prev,
      payments: prev.payments.filter(p => p.id !== termId),
    } : prev);
  };

  const updatePayment = (termId: string, field: keyof SPHPaymentTerm, value: any) => {
    setForm(prev => prev ? {
      ...prev,
      payments: prev.payments.map(p => p.id === termId ? { ...p, [field]: value } : p),
    } : prev);
  };

  const handleSave = async (status: 'draft' | 'final') => {
    if (!user) {
      toast.error('Anda harus login');
      return;
    }
    if (!form.kepada.trim()) {
      toast.error('Nama perusahaan wajib diisi');
      return;
    }
    const updated = { ...form, status, updatedAt: new Date().toISOString() };
    const ok = await saveSPH(updated, user.id);
    if (ok) {
      toast.success(`SPH berhasil disimpan sebagai ${status === 'draft' ? 'Draft' : 'Final'}`);
      navigate('/sph');
    } else {
      toast.error('Gagal menyimpan SPH');
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isEdit ? 'Edit SPH' : 'Buat SPH Baru'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{form.nomorSPH}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={() => handleSave('draft')} className="gap-2 w-full sm:w-auto">
            <Save className="w-4 h-4" /> Simpan Draft
          </Button>
          <Button onClick={() => handleSave('final')} className="gap-2 w-full sm:w-auto">
            <FileDown className="w-4 h-4" /> Simpan & Finalisasi
          </Button>
          {isEdit && (
            <Button variant="outline" onClick={() => navigate(`/sph/${form.id}/preview`)} className="gap-2 w-full sm:w-auto">
              <Eye className="w-4 h-4" /> Preview PDF
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Informasi Umum */}
        <section className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="section-title mb-4">Informasi Umum</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nomor SPH</Label>
              <Input value={form.nomorSPH} onChange={e => updateField('nomorSPH', e.target.value)} />
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input type="date" value={form.tanggal} onChange={e => updateField('tanggal', e.target.value)} />
            </div>
            <div>
              <Label>Kepada (Perusahaan) *</Label>
              <Input value={form.kepada} onChange={e => updateField('kepada', e.target.value)} placeholder="Nama perusahaan klien" />
            </div>
            <div>
              <Label>Nama PIC</Label>
              <Input value={form.namaPIC} onChange={e => updateField('namaPIC', e.target.value)} placeholder="Nama person in charge" />
            </div>
            <div className="md:col-span-2">
              <Label>Alamat Proyek</Label>
              <Input value={form.alamatProyek} onChange={e => updateField('alamatProyek', e.target.value)} placeholder="Alamat lengkap proyek" />
            </div>
            <div className="md:col-span-2">
              <Label>Perihal</Label>
              <Input value={form.perihal} onChange={e => updateField('perihal', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Nama Sales</Label>
              <Input value={form.namaSales} onChange={e => updateField('namaSales', e.target.value)} placeholder="Nama sales yang menangani" />
            </div>
          </div>
        </section>

        {/* Detail Lift */}
        <section className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="section-title mb-4">Detail Lift</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Jenis Lift</Label>
              <Select value={form.jenisLift} onValueChange={v => updateField('jenisLift', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JENIS_LIFT.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kapasitas (Kg)</Label>
              <Select value={String(form.kapasitas)} onValueChange={v => updateField('kapasitas', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KAPASITAS_LIFT.map(k => <SelectItem key={k} value={String(k)}>{k} Kg</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Floors</Label>
              <Input type="number" value={form.floors} onChange={e => updateField('floors', Number(e.target.value))} />
            </div>
            <div>
              <Label>Stops</Label>
              <Input type="number" value={form.stops} onChange={e => updateField('stops', Number(e.target.value))} />
            </div>
            <div>
              <Label>Doors</Label>
              <Input type="number" value={form.doors} onChange={e => updateField('doors', Number(e.target.value))} />
            </div>
            <div>
              <Label>Waktu Pelaksanaan</Label>
              <Input value={form.waktuPelaksanaan} onChange={e => updateField('waktuPelaksanaan', e.target.value)} />
            </div>
          </div>
        </section>

        {/* Tabel Harga */}
        <section className="bg-card rounded-xl border shadow-sm p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="section-title">Tabel Harga</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Mode Harga:</span>
              <Select value={form.priceMode} onValueChange={v => updateField('priceMode', v as SPH['priceMode'])}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Pilih mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lump_sum">Lump Sum</SelectItem>
                  <SelectItem value="harga_satuan">Harga Satuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto mt-2">
            {form.priceMode === 'harga_satuan' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left w-8"></th>
                    <th className="p-3 text-left">Item Pekerjaan</th>
                    <th className="p-3 text-center w-16">Qty</th>
                    <th className="p-3 text-right w-40">Harga Pengadaan</th>
                    <th className="p-3 text-right w-40">Harga Pemasangan</th>
                    <th className="p-3 text-center w-20">Include</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {form.items.map(item => (
                    <Fragment key={item.id}>
                      <tr className="hover:bg-muted/30">
                        <td className="p-3">
                          <Checkbox checked={item.checked} onCheckedChange={v => updateItem(item.id, 'checked', v)} />
                        </td>
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3"><Input type="number" className="w-16 text-center h-8" value={item.qty} onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} /></td>
                        <td className="p-3"><Input type="number" className="text-right h-8" value={item.hargaPengadaan} onChange={e => updateItem(item.id, 'hargaPengadaan', Number(e.target.value))} disabled={item.isInclude} /></td>
                        <td className="p-3"><Input type="number" className="text-right h-8" value={item.hargaPemasangan} onChange={e => updateItem(item.id, 'hargaPemasangan', Number(e.target.value))} disabled={item.isInclude} /></td>
                        <td className="p-3 text-center">
                          <Checkbox checked={item.isInclude} onCheckedChange={v => updateItem(item.id, 'isInclude', v)} />
                        </td>
                      </tr>
                      {item.children?.map(child => (
                        <tr key={child.id} className="hover:bg-muted/30 bg-muted/20">
                          <td className="p-3 pl-8">
                            <Checkbox checked={child.checked} onCheckedChange={v => updateItem(child.id, 'checked', v, item.id)} />
                          </td>
                          <td className="p-3 pl-8 text-muted-foreground">↳ {child.name}</td>
                          <td className="p-3"><Input type="number" className="w-16 text-center h-8" value={child.qty} onChange={e => updateItem(child.id, 'qty', Number(e.target.value), item.id)} /></td>
                          <td className="p-3"><Input type="number" className="text-right h-8" value={child.hargaPengadaan} onChange={e => updateItem(child.id, 'hargaPengadaan', Number(e.target.value), item.id)} disabled={child.isInclude} /></td>
                          <td className="p-3"><Input type="number" className="text-right h-8" value={child.hargaPemasangan} onChange={e => updateItem(child.id, 'hargaPemasangan', Number(e.target.value), item.id)} disabled={child.isInclude} /></td>
                          <td className="p-3 text-center">
                            <Checkbox checked={child.isInclude} onCheckedChange={v => updateItem(child.id, 'isInclude', v, item.id)} />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left w-8"></th>
                    <th className="p-3 text-left">Item Pekerjaan</th>
                    <th className="p-3 text-center w-16">Qty</th>
                    <th className="p-3 text-center w-20">Include</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {form.items.map(item => (
                    <Fragment key={item.id}>
                      <tr className="hover:bg-muted/30">
                        <td className="p-3">
                          <Checkbox checked={item.checked} onCheckedChange={v => updateItem(item.id, 'checked', v)} />
                        </td>
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3"><Input type="number" className="w-16 text-center h-8" value={item.qty} onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} /></td>
                        <td className="p-3 text-center">
                          <Checkbox checked={item.isInclude} onCheckedChange={v => updateItem(item.id, 'isInclude', v)} />
                        </td>
                      </tr>
                      {item.children?.map(child => (
                        <tr key={child.id} className="hover:bg-muted/30 bg-muted/20">
                          <td className="p-3 pl-8">
                            <Checkbox checked={child.checked} onCheckedChange={v => updateItem(child.id, 'checked', v, item.id)} />
                          </td>
                          <td className="p-3 pl-8 text-muted-foreground">↳ {child.name}</td>
                          <td className="p-3"><Input type="number" className="w-16 text-center h-8" value={child.qty} onChange={e => updateItem(child.id, 'qty', Number(e.target.value), item.id)} /></td>
                          <td className="p-3 text-center">
                            <Checkbox checked={child.isInclude} onCheckedChange={v => updateItem(child.id, 'isInclude', v, item.id)} />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Separator className="my-4" />

          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              {form.priceMode === 'lump_sum' && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Total Lump Sum</Label>
                  <Input
                    type="number"
                    className="h-9 text-right"
                    value={form.lumpSumTotal}
                    onChange={e => updateField('lumpSumTotal', Number(e.target.value))}
                  />
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(totals.subtotal)}</span></div>
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                  <Checkbox checked={form.includePPN} onCheckedChange={v => updateField('includePPN', v)} />
                  PPN 11%
                </label>
                <span className="font-medium">{formatCurrency(totals.ppn)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base"><span className="font-semibold">Grand Total</span><span className="font-bold text-primary">{formatCurrency(totals.grandTotal)}</span></div>
            </div>
          </div>
        </section>

        {/* Spesifikasi */}
        <section className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="section-title mb-4">Spesifikasi Teknis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {form.specs.map(spec => (
              <div key={spec.key} className="flex items-center gap-3">
                <Label className="w-40 text-xs text-muted-foreground shrink-0">{spec.label}</Label>
                <Input className="h-8 text-sm" value={spec.value} onChange={e => updateSpec(spec.key, e.target.value)} />
              </div>
            ))}
          </div>
        </section>

        {/* Opsi Desain */}
        <section className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="section-title mb-4">Opsi Desain</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DESIGN_CATEGORIES.map(category => {
              const options = designItems.filter(d => d.category === category);
              const selected = form.designs[category];
              return (
                <div key={category} className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{category}</Label>
                  {options.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Belum ada data desain</p>
                  ) : (
                    <Select
                      value={selected?.designItemId || ''}
                      onValueChange={v => {
                        const item = options.find(o => o.id === v);
                        if (item) {
                          setForm(prev => prev ? {
                            ...prev,
                            designs: {
                              ...prev.designs,
                              [category]: {
                                category,
                                designItemId: item.id,
                                designName: item.name,
                                designSku: item.sku,
                                designImageUrl: item.image_url,
                              },
                            },
                          } : prev);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder="Pilih desain..." /></SelectTrigger>
                      <SelectContent>
                        {options.map(o => (
                          <SelectItem key={o.id} value={o.id}>
                            <span className="flex items-center gap-2">
                              {o.image_url && <img src={o.image_url} alt="" className="w-5 h-5 rounded object-cover" />}
                              {o.name} {o.sku && <span className="text-muted-foreground text-xs">({o.sku})</span>}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selected && (
                    <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
                      {selected.designImageUrl ? (
                        <img src={selected.designImageUrl} alt={selected.designName} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted/30 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selected.designName}</p>
                        {selected.designSku && <p className="text-xs text-muted-foreground">SKU: {selected.designSku}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => {
                          setForm(prev => {
                            if (!prev) return prev;
                            const designs = { ...prev.designs };
                            delete designs[category];
                            return { ...prev, designs };
                          });
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="section-title mb-4">Syarat & Kondisi</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Masa Berlaku</Label>
              <Input className="h-8" value={form.terms.masaBerlaku} onChange={e => setForm(prev => prev ? { ...prev, terms: { ...prev.terms, masaBerlaku: e.target.value } } : prev)} />
            </div>
            <div>
              <Label className="text-xs">Garansi Sparepart</Label>
              <Input className="h-8" value={form.terms.garansiSparepart} onChange={e => setForm(prev => prev ? { ...prev, terms: { ...prev.terms, garansiSparepart: e.target.value } } : prev)} />
            </div>
            <div>
              <Label className="text-xs">Garansi Mesin</Label>
              <Input className="h-8" value={form.terms.garansiMesin} onChange={e => setForm(prev => prev ? { ...prev, terms: { ...prev.terms, garansiMesin: e.target.value } } : prev)} />
            </div>
            <div>
              <Label className="text-xs">Maintenance</Label>
              <Input className="h-8" value={form.terms.maintenance} onChange={e => setForm(prev => prev ? { ...prev, terms: { ...prev.terms, maintenance: e.target.value } } : prev)} />
            </div>
          </div>
        </section>

        {/* Pembayaran */}
        <section className="bg-card rounded-xl border shadow-sm p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="section-title">Sistem Pembayaran</h2>
            <Button variant="outline" size="sm" onClick={addPaymentTerm} className="gap-1 w-full sm:w-auto justify-center">
              <Plus className="w-3.5 h-3.5" /> Tambah Termin
            </Button>
          </div>
          <div className="space-y-3">
            {form.payments.map((term, idx) => (
              <div key={term.id} className="grid grid-cols-1 sm:grid-cols-[90px_1fr_auto] md:grid-cols-[120px_120px_1fr_auto] gap-2 sm:items-center">
                <span className="text-xs text-muted-foreground">Termin {idx + 1}</span>
                <div className="flex items-center gap-2">
                  <Input type="number" className="h-9 w-24 text-center" value={term.percentage} onChange={e => updatePayment(term.id, 'percentage', Number(e.target.value))} />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <Select value={term.condition} onValueChange={v => updatePayment(term.id, 'condition', v)}>
                  <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Pilih kondisi" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.payments.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive justify-self-end" onClick={() => removePaymentTerm(term.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Total: {form.payments.reduce((sum, p) => sum + p.percentage, 0)}%</p>
          </div>
        </section>
      </div>
    </div>
  );
}
