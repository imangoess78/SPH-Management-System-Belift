import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ImageIcon, RefreshCw, Upload, X, Search, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';

// ── Design Items ─────────────────────────────────────────────
const DESIGN_CATEGORIES = ['Cabin', 'Floor', 'Ceiling', 'Door', 'COP', 'LOP', 'Struktur', 'Add On'];

interface DesignItem {
  id: string;
  category: string;
  name: string;
  sku: string;
  image_url: string | null;
  created_at: string;
}

// ── Sales ────────────────────────────────────────────────────
export interface SalesItem {
  id: string;
  name: string;
  jabatan: string;
  signature_url: string | null;
  active: boolean;
  created_at: string;
}

type MainTab = 'design' | 'sales';

function toR2Url(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/\/storage\/v1\/object\/public\/(design-images|signatures)\/([^?]+)/);
  return match ? `/api/media?key=${encodeURIComponent(`recovery/2026-08-19/${match[1]}/${match[2]}`)}` : value;
}

// ── Shared image upload zone ─────────────────────────────────
function ImageUploadZone({
  fileInputRef, imagePreview, imageFile,
  onFileSelect, onDrop, dragOver, setDragOver, onRemove, label,
}: {
  fileInputRef: React.RefObject<HTMLInputElement>;
  imagePreview: string | null;
  imageFile: File | null;
  onFileSelect: (f: File) => void;
  onDrop: (e: React.DragEvent) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onRemove: (e: React.MouseEvent) => void;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
        className="hidden"
      />
      {imagePreview ? (
        <div className="relative rounded-lg overflow-hidden border bg-muted/20">
          <img src={imagePreview} alt="Preview" className="w-full h-40 object-contain" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
            <Button type="button" size="sm" variant="secondary" className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> Ganti
            </Button>
            <Button type="button" size="sm" variant="destructive" className="gap-1.5" onClick={onRemove}>
              <X className="w-3.5 h-3.5" /> Hapus
            </Button>
          </div>
          {imageFile && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-1.5">
              <p className="text-xs text-white truncate">{imageFile.name}</p>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-center px-4 ${
            dragOver
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/30 text-muted-foreground'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium">{dragOver ? 'Lepaskan untuk upload' : 'Klik atau seret gambar ke sini'}</p>
            <p className="text-xs mt-0.5 opacity-70">PNG, JPG, WebP · Maks. 5 MB</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MasterData() {
  const { role, user } = useAuth();
  const canManage = role === 'admin' || role === 'staff';

  const [mainTab, setMainTab] = useState<MainTab>('design');

  // ── Design state ─────────────────────────────────────────
  const [designItems, setDesignItems] = useState<DesignItem[]>([]);
  const [designLoading, setDesignLoading] = useState(true);
  const [designFetchError, setDesignFetchError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Cabin');
  const [searchQuery, setSearchQuery] = useState('');

  const [designDialogOpen, setDesignDialogOpen] = useState(false);
  const [editingDesign, setEditingDesign] = useState<DesignItem | null>(null);
  const [formDesignName, setFormDesignName] = useState('');
  const [formDesignSku, setFormDesignSku] = useState('');
  const [formDesignCategory, setFormDesignCategory] = useState('Cabin');
  const [designImageFile, setDesignImageFile] = useState<File | null>(null);
  const [designImagePreview, setDesignImagePreview] = useState<string | null>(null);
  const [designSaving, setDesignSaving] = useState(false);
  const [designDragOver, setDesignDragOver] = useState(false);
  const designFileInputRef = useRef<HTMLInputElement>(null);

  const [confirmDesignOpen, setConfirmDesignOpen] = useState(false);
  const [pendingDeleteDesign, setPendingDeleteDesign] = useState<DesignItem | null>(null);

  // ── Sales state ──────────────────────────────────────────
  const [salesItems, setSalesItems] = useState<SalesItem[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesFetchError, setSalesFetchError] = useState<string | null>(null);
  const [salesSearchQuery, setSalesSearchQuery] = useState('');

  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [editingSales, setEditingSales] = useState<SalesItem | null>(null);
  const [formSalesName, setFormSalesName] = useState('');
  const [formSalesJabatan, setFormSalesJabatan] = useState('Sales');
  const [formSalesActive, setFormSalesActive] = useState(true);
  const [sigImageFile, setSigImageFile] = useState<File | null>(null);
  const [sigImagePreview, setSigImagePreview] = useState<string | null>(null);
  const [salesSaving, setSalesSaving] = useState(false);
  const [sigDragOver, setSigDragOver] = useState(false);
  const sigFileInputRef = useRef<HTMLInputElement>(null);

  const [confirmSalesOpen, setConfirmSalesOpen] = useState(false);
  const [pendingDeleteSales, setPendingDeleteSales] = useState<SalesItem | null>(null);

  // ── Fetch design items ───────────────────────────────────
  const fetchDesignItems = async () => {
    setDesignLoading(true);
    setDesignFetchError(null);
    const response = await fetch('/api/data?table=design_items');
    const result = await response.json();
    if (!response.ok) setDesignFetchError(result.error || 'Gagal memuat data');
    else setDesignItems(((result.data || []) as DesignItem[]).map(item => ({ ...item, image_url: toR2Url(item.image_url) })));
    setDesignLoading(false);
  };

  // ── Fetch sales ──────────────────────────────────────────
  const fetchSalesItems = async () => {
    setSalesLoading(true);
    setSalesFetchError(null);
    const response = await fetch('/api/data?table=sales');
    const result = await response.json();
    if (!response.ok) setSalesFetchError(result.error || 'Gagal memuat data');
    else setSalesItems(((result.data || []) as SalesItem[]).map(item => ({ ...item, signature_url: toR2Url(item.signature_url) })));
    setSalesLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchDesignItems();
      fetchSalesItems();
    } else {
      setDesignLoading(false);
      setSalesLoading(false);
    }
  }, [user]);

  // ── Shared upload helper ─────────────────────────────────
  const uploadToStorage = async (bucket: string, file: File): Promise<string | null> => {
    const path = `${crypto.randomUUID()}.${file.name.split('.').pop()}`;
    const form = new FormData(); form.append('file', file); form.append('bucket', bucket); form.append('path', path);
    const response = await fetch('/api/media', { method: 'POST', body: form });
    if (!response.ok) return null;
    const result = await response.json();
    return result.url || null;
  };

  // ── Design handlers ──────────────────────────────────────
  const openAddDesign = () => {
    setEditingDesign(null);
    setFormDesignName('');
    setFormDesignSku('');
    setFormDesignCategory(activeCategory);
    setDesignImageFile(null);
    setDesignImagePreview(null);
    setDesignDialogOpen(true);
  };

  const openEditDesign = (item: DesignItem) => {
    setEditingDesign(item);
    setFormDesignName(item.name);
    setFormDesignSku(item.sku);
    setFormDesignCategory(item.category);
    setDesignImageFile(null);
    setDesignImagePreview(item.image_url);
    setDesignDialogOpen(true);
  };

  const handleDesignFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('File harus berupa gambar'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran file maksimal 5 MB'); return; }
    setDesignImageFile(file);
    setDesignImagePreview(URL.createObjectURL(file));
  };

  const handleDesignDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDesignDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleDesignFileSelect(file);
  };

  const removeDesignImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDesignImageFile(null);
    setDesignImagePreview(null);
    if (designFileInputRef.current) designFileInputRef.current.value = '';
  };

  const handleDesignSave = async () => {
    if (!formDesignName.trim()) { toast.error('Nama desain wajib diisi'); return; }
    setDesignSaving(true);
    let imageUrl = editingDesign?.image_url || null;
    if (designImageFile) {
      const uploaded = await uploadToStorage('design-images', designImageFile);
      if (uploaded) imageUrl = uploaded;
      else { toast.error('Gagal mengupload gambar'); setDesignSaving(false); return; }
    }
    if (editingDesign) {
      const { error } = await supabase
        .from('design_items')
        .update({ name: formDesignName, sku: formDesignSku, image_url: imageUrl } as any)
        .eq('id', editingDesign.id);
      if (error) toast.error('Gagal mengupdate desain: ' + error.message);
      else { toast.success('Desain berhasil diupdate'); setDesignDialogOpen(false); fetchDesignItems(); }
    } else {
      const { error } = await supabase
        .from('design_items')
        .insert({ category: formDesignCategory, name: formDesignName, sku: formDesignSku, image_url: imageUrl } as any);
      if (error) toast.error('Gagal menambahkan desain: ' + error.message);
      else { toast.success('Desain berhasil ditambahkan'); setDesignDialogOpen(false); fetchDesignItems(); }
    }
    setDesignSaving(false);
  };

  const handleDesignDelete = async () => {
    if (!pendingDeleteDesign) return;
    const item = pendingDeleteDesign;
    setPendingDeleteDesign(null);
    setConfirmDesignOpen(false);
    const { error } = await supabase.from('design_items').delete().eq('id', item.id);
    if (error) toast.error('Gagal menghapus desain: ' + error.message);
    else { toast.success('Desain berhasil dihapus'); fetchDesignItems(); }
  };

  const filteredDesignItems = designItems.filter(d => {
    const matchCategory = d.category === activeCategory;
    const matchSearch = !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const getDesignCountByCategory = (cat: string) => designItems.filter(d => d.category === cat).length;

  // ── Sales handlers ───────────────────────────────────────
  const openAddSales = () => {
    setEditingSales(null);
    setFormSalesName('');
    setFormSalesJabatan('Sales');
    setFormSalesActive(true);
    setSigImageFile(null);
    setSigImagePreview(null);
    setSalesDialogOpen(true);
  };

  const openEditSales = (item: SalesItem) => {
    setEditingSales(item);
    setFormSalesName(item.name);
    setFormSalesJabatan(item.jabatan);
    setFormSalesActive(item.active);
    setSigImageFile(null);
    setSigImagePreview(item.signature_url);
    setSalesDialogOpen(true);
  };

  const handleSigFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('File harus berupa gambar'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran file maksimal 5 MB'); return; }
    setSigImageFile(file);
    setSigImagePreview(URL.createObjectURL(file));
  };

  const handleSigDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setSigDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleSigFileSelect(file);
  };

  const removeSigImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSigImageFile(null);
    setSigImagePreview(null);
    if (sigFileInputRef.current) sigFileInputRef.current.value = '';
  };

  const handleSalesSave = async () => {
    if (!formSalesName.trim()) { toast.error('Nama sales wajib diisi'); return; }
    setSalesSaving(true);
    let signatureUrl = editingSales?.signature_url || null;
    if (sigImageFile) {
      const uploaded = await uploadToStorage('signatures', sigImageFile);
      if (uploaded) signatureUrl = uploaded;
      else { toast.error('Gagal mengupload tanda tangan'); setSalesSaving(false); return; }
    }
    const payload = {
      name: formSalesName.trim(),
      jabatan: formSalesJabatan.trim() || 'Sales',
      signature_url: signatureUrl,
      active: formSalesActive,
    };
    if (editingSales) {
      const { error } = await (supabase as any).from('sales').update(payload).eq('id', editingSales.id);
      if (error) toast.error('Gagal mengupdate sales: ' + error.message);
      else { toast.success('Data sales berhasil diupdate'); setSalesDialogOpen(false); fetchSalesItems(); }
    } else {
      const { error } = await (supabase as any).from('sales').insert(payload);
      if (error) toast.error('Gagal menambahkan sales: ' + error.message);
      else { toast.success('Sales berhasil ditambahkan'); setSalesDialogOpen(false); fetchSalesItems(); }
    }
    setSalesSaving(false);
  };

  const handleSalesDelete = async () => {
    if (!pendingDeleteSales) return;
    const item = pendingDeleteSales;
    setPendingDeleteSales(null);
    setConfirmSalesOpen(false);
    const { error } = await (supabase as any).from('sales').delete().eq('id', item.id);
    if (error) toast.error('Gagal menghapus sales: ' + error.message);
    else { toast.success('Sales berhasil dihapus'); fetchSalesItems(); }
  };

  const filteredSalesItems = salesItems.filter(s =>
    !salesSearchQuery ||
    s.name.toLowerCase().includes(salesSearchQuery.toLowerCase()) ||
    s.jabatan.toLowerCase().includes(salesSearchQuery.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Master Data</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola data desain dan sales untuk SPH/SPK</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="sm" className="gap-1.5"
            onClick={() => mainTab === 'design' ? fetchDesignItems() : fetchSalesItems()}
            disabled={mainTab === 'design' ? designLoading : salesLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(mainTab === 'design' ? designLoading : salesLoading) ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Refresh</span>
          </Button>
          {canManage && (
            <Button size="sm" className="gap-1.5" onClick={mainTab === 'design' ? openAddDesign : openAddSales}>
              <Plus className="w-3.5 h-3.5" />
              {mainTab === 'design' ? 'Tambah Desain' : 'Tambah Sales'}
            </Button>
          )}
        </div>
      </div>

      {/* Main tab switcher */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        <button
          onClick={() => setMainTab('design')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mainTab === 'design'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Database Desain
        </button>
        <button
          onClick={() => setMainTab('sales')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
            mainTab === 'sales'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Data Sales
        </button>
      </div>

      {/* ══ DESIGN TAB ══════════════════════════════════════ */}
      {mainTab === 'design' && (
        <>
          {designFetchError && (
            <p className="text-xs text-destructive">
              Error memuat data: {designFetchError}
              {!user && ' — Anda harus login terlebih dahulu.'}
            </p>
          )}

          {/* Category tabs */}
          <div className="flex gap-2 flex-wrap">
            {DESIGN_CATEGORIES.map(cat => {
              const count = getDesignCountByCategory(cat);
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  {cat}
                  {count > 0 && (
                    <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold ${
                      isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Design content card */}
          <div className="bg-card rounded-xl border shadow-sm">
            <div className="flex flex-col gap-2 p-4 border-b sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">{activeCategory}</h2>
                <Badge variant="secondary" className="text-xs">{filteredDesignItems.length} item</Badge>
              </div>
              <div className="relative w-full sm:w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari nama / SKU..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            <div className="p-4">
              {designLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="rounded-lg border bg-muted/20 overflow-hidden animate-pulse">
                      <div className="aspect-square bg-muted/40" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 bg-muted/60 rounded w-3/4" />
                        <div className="h-2.5 bg-muted/40 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredDesignItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                    <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    {searchQuery ? 'Tidak ada hasil' : `Belum ada desain ${activeCategory}`}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {searchQuery
                      ? `Tidak ditemukan hasil untuk "${searchQuery}"`
                      : 'Tambahkan item desain pertama untuk kategori ini'}
                  </p>
                  {canManage && !searchQuery && (
                    <Button size="sm" className="gap-1.5" onClick={openAddDesign}>
                      <Plus className="w-3.5 h-3.5" /> Tambah Desain {activeCategory}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredDesignItems.map(item => (
                    <div key={item.id} className="rounded-lg border bg-card overflow-hidden group relative hover:shadow-md transition-shadow">
                      {item.image_url ? (
                        <div className="aspect-square bg-muted/20 overflow-hidden">
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        </div>
                      ) : (
                        <div className="aspect-square bg-muted/20 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground/25" />
                        </div>
                      )}
                      <div className="p-2.5">
                        <p className="text-sm font-medium truncate leading-tight">{item.name}</p>
                        {item.sku && <p className="text-xs text-muted-foreground truncate mt-0.5">{item.sku}</p>}
                      </div>
                      {canManage && (
                        <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" onClick={() => openEditDesign(item)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="destructive" size="icon" className="h-7 w-7 shadow-sm"
                            onClick={() => { setPendingDeleteDesign(item); setConfirmDesignOpen(true); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Design confirm delete */}
          <ConfirmDialog
            open={confirmDesignOpen}
            onOpenChange={setConfirmDesignOpen}
            title="Hapus Desain?"
            description={
              pendingDeleteDesign
                ? `Desain "${pendingDeleteDesign.name}" akan dihapus permanen dan tidak bisa dikembalikan.`
                : 'Desain ini akan dihapus permanen dan tidak bisa dikembalikan.'
            }
            confirmLabel="Ya, Hapus"
            onConfirm={handleDesignDelete}
          />

          {/* Design add/edit dialog */}
          <Dialog open={designDialogOpen} onOpenChange={open => { if (!designSaving) setDesignDialogOpen(open); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base">
                  {editingDesign ? 'Edit Desain' : 'Tambah Desain Baru'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-1">
                {!editingDesign && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kategori</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {DESIGN_CATEGORIES.map(cat => (
                        <button key={cat} type="button" onClick={() => setFormDesignCategory(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            formDesignCategory === cat
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                          }`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="design-name" className="text-sm">
                      Nama Desain <span className="text-destructive">*</span>
                    </Label>
                    <Input id="design-name" value={formDesignName} onChange={e => setFormDesignName(e.target.value)}
                      placeholder="Contoh: Premium Stainless" className="h-9" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="design-sku" className="text-sm">SKU</Label>
                    <Input id="design-sku" value={formDesignSku} onChange={e => setFormDesignSku(e.target.value)}
                      placeholder="Contoh: CB-PSTL-001" className="h-9" />
                  </div>
                </div>
                <ImageUploadZone
                  fileInputRef={designFileInputRef}
                  imagePreview={designImagePreview}
                  imageFile={designImageFile}
                  onFileSelect={handleDesignFileSelect}
                  onDrop={handleDesignDrop}
                  dragOver={designDragOver}
                  setDragOver={setDesignDragOver}
                  onRemove={removeDesignImage}
                  label="Gambar Produk"
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t mt-2">
                {editingDesign && (
                  <p className="text-xs text-muted-foreground">
                    Kategori: <span className="font-medium">{editingDesign.category}</span>
                  </p>
                )}
                <div className={`flex gap-2 ${editingDesign ? '' : 'ml-auto'}`}>
                  <Button type="button" variant="outline" onClick={() => setDesignDialogOpen(false)} disabled={designSaving}>
                    Batal
                  </Button>
                  <Button type="button" onClick={handleDesignSave} disabled={designSaving || !formDesignName.trim()} className="min-w-24">
                    {designSaving
                      ? <span className="flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" />Menyimpan...</span>
                      : editingDesign ? 'Simpan Perubahan' : 'Tambah Desain'
                    }
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ══ SALES TAB ════════════════════════════════════════ */}
      {mainTab === 'sales' && (
        <>
          {salesFetchError && (
            <p className="text-xs text-destructive">Error memuat data: {salesFetchError}</p>
          )}

          <div className="bg-card rounded-xl border shadow-sm">
            {/* Toolbar */}
            <div className="flex flex-col gap-2 p-4 border-b sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">Daftar Sales</h2>
                <Badge variant="secondary" className="text-xs">{filteredSalesItems.length} orang</Badge>
              </div>
              <div className="relative w-full sm:w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari nama / jabatan..."
                  value={salesSearchQuery}
                  onChange={e => setSalesSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            <div className="p-4">
              {salesLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-lg border bg-muted/20 animate-pulse">
                      <div className="w-16 h-16 rounded-lg bg-muted/40 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted/60 rounded w-1/3" />
                        <div className="h-3 bg-muted/40 rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredSalesItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    {salesSearchQuery ? 'Tidak ada hasil' : 'Belum ada data sales'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {salesSearchQuery
                      ? `Tidak ditemukan hasil untuk "${salesSearchQuery}"`
                      : 'Tambahkan sales pertama'}
                  </p>
                  {canManage && !salesSearchQuery && (
                    <Button size="sm" className="gap-1.5" onClick={openAddSales}>
                      <Plus className="w-3.5 h-3.5" /> Tambah Sales
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredSalesItems.map(item => (
                    <div key={item.id}
                      className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow group relative">
                      {/* Signature thumbnail */}
                      <div className="w-16 h-16 rounded-lg border bg-muted/20 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.signature_url
                          ? <img src={item.signature_url} alt={`TTD ${item.name}`} className="w-full h-full object-contain p-1" />
                          : <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm leading-tight">{item.name}</p>
                          {!item.active && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">Nonaktif</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.jabatan}</p>
                        <p className="text-xs mt-1">
                          {item.signature_url
                            ? <span className="text-green-600 font-medium">✓ Tanda tangan tersedia</span>
                            : <span className="text-amber-600">Belum ada tanda tangan</span>
                          }
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                          <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" onClick={() => openEditSales(item)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="destructive" size="icon" className="h-7 w-7 shadow-sm"
                            onClick={() => { setPendingDeleteSales(item); setConfirmSalesOpen(true); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sales confirm delete */}
          <ConfirmDialog
            open={confirmSalesOpen}
            onOpenChange={setConfirmSalesOpen}
            title="Hapus Sales?"
            description={
              pendingDeleteSales
                ? `Data sales "${pendingDeleteSales.name}" akan dihapus permanen dan tidak bisa dikembalikan.`
                : 'Data sales ini akan dihapus permanen dan tidak bisa dikembalikan.'
            }
            confirmLabel="Ya, Hapus"
            onConfirm={handleSalesDelete}
          />

          {/* Sales add/edit dialog */}
          <Dialog open={salesDialogOpen} onOpenChange={open => { if (!salesSaving) setSalesDialogOpen(open); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base">
                  {editingSales ? 'Edit Data Sales' : 'Tambah Sales Baru'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-1">
                {/* Name & Jabatan */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sales-name" className="text-sm">
                      Nama <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="sales-name"
                      value={formSalesName}
                      onChange={e => setFormSalesName(e.target.value)}
                      placeholder="Contoh: Imam Solikhin"
                      className="h-9"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sales-jabatan" className="text-sm">Jabatan</Label>
                    <Input
                      id="sales-jabatan"
                      value={formSalesJabatan}
                      onChange={e => setFormSalesJabatan(e.target.value)}
                      placeholder="Contoh: Sales Manager"
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="sales-active"
                    checked={formSalesActive}
                    onChange={e => setFormSalesActive(e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <Label htmlFor="sales-active" className="text-sm cursor-pointer">
                    Sales aktif (muncul di dropdown form SPH/SPK)
                  </Label>
                </div>

                {/* Signature upload */}
                <ImageUploadZone
                  fileInputRef={sigFileInputRef}
                  imagePreview={sigImagePreview}
                  imageFile={sigImageFile}
                  onFileSelect={handleSigFileSelect}
                  onDrop={handleSigDrop}
                  dragOver={sigDragOver}
                  setDragOver={setSigDragOver}
                  onRemove={removeSigImage}
                  label="Gambar Tanda Tangan"
                />
                <p className="text-xs text-muted-foreground -mt-1">
                  Upload gambar tanda tangan (PNG transparan direkomendasikan).
                  Akan muncul otomatis di preview PDF ketika sales ini dipilih.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                <Button type="button" variant="outline" onClick={() => setSalesDialogOpen(false)} disabled={salesSaving}>
                  Batal
                </Button>
                <Button type="button" onClick={handleSalesSave} disabled={salesSaving || !formSalesName.trim()} className="min-w-24">
                  {salesSaving
                    ? <span className="flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" />Menyimpan...</span>
                    : editingSales ? 'Simpan Perubahan' : 'Tambah Sales'
                  }
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
