import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ImageIcon, RefreshCw, Upload, X, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const DESIGN_CATEGORIES = ['Cabin', 'Floor', 'Ceiling', 'Door', 'COP', 'LOP', 'Struktur', 'Add On'];

interface DesignItem {
  id: string;
  category: string;
  name: string;
  sku: string;
  image_url: string | null;
  created_at: string;
}

export default function MasterData() {
  const { role, user } = useAuth();
  const canManageDesign = role === 'admin' || role === 'staff';

  const [designItems, setDesignItems] = useState<DesignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Cabin');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DesignItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategory, setFormCategory] = useState('Cabin');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirm delete dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<DesignItem | null>(null);

  const fetchDesignItems = async () => {
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from('design_items')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[MasterData] fetch design_items error:', error);
      setFetchError(error.message);
    } else if (data) {
      setDesignItems(data as DesignItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchDesignItems();
    else setLoading(false);
  }, [user]);

  const openAdd = () => {
    setEditingItem(null);
    setFormName('');
    setFormSku('');
    setFormCategory(activeCategory);
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(true);
  };

  const openEdit = (item: DesignItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormSku(item.sku);
    setFormCategory(item.category);
    setImageFile(null);
    setImagePreview(item.image_url);
    setDialogOpen(true);
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5 MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('design-images').upload(path, file);
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    const { data } = supabase.storage.from('design-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Nama desain wajib diisi');
      return;
    }
    setSaving(true);

    let imageUrl = editingItem?.image_url || null;
    if (imageFile) {
      const uploaded = await uploadImage(imageFile);
      if (uploaded) imageUrl = uploaded;
      else {
        toast.error('Gagal mengupload gambar');
        setSaving(false);
        return;
      }
    }

    if (editingItem) {
      const { error } = await supabase
        .from('design_items')
        .update({ name: formName, sku: formSku, image_url: imageUrl } as any)
        .eq('id', editingItem.id);
      if (error) {
        toast.error('Gagal mengupdate desain: ' + error.message);
      } else {
        toast.success('Desain berhasil diupdate');
        setDialogOpen(false);
        fetchDesignItems();
      }
    } else {
      const { error } = await supabase
        .from('design_items')
        .insert({ category: formCategory, name: formName, sku: formSku, image_url: imageUrl } as any);
      if (error) {
        toast.error('Gagal menambahkan desain: ' + error.message);
      } else {
        toast.success('Desain berhasil ditambahkan');
        setDialogOpen(false);
        fetchDesignItems();
      }
    }

    setSaving(false);
  };

  const requestDelete = (item: DesignItem) => {
    setPendingDeleteItem(item);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!pendingDeleteItem) return;
    const item = pendingDeleteItem;
    setPendingDeleteItem(null);
    setConfirmOpen(false);
    const { error } = await supabase.from('design_items').delete().eq('id', item.id);
    if (error) {
      toast.error('Gagal menghapus desain: ' + error.message);
    } else {
      toast.success('Desain berhasil dihapus');
      fetchDesignItems();
    }
  };

  const filteredItems = designItems.filter(d => {
    const matchCategory = d.category === activeCategory;
    const matchSearch = !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const getCountByCategory = (cat: string) => designItems.filter(d => d.category === cat).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Database Desain</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola katalog desain kabin lift untuk SPH
          </p>
          {fetchError && (
            <p className="text-xs text-destructive mt-1">
              Error memuat data: {fetchError}
              {!user && ' — Anda harus login terlebih dahulu.'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchDesignItems} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canManageDesign && (
            <Button size="sm" className="gap-1.5" onClick={openAdd}>
              <Plus className="w-3.5 h-3.5" />
              Tambah Desain
            </Button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {DESIGN_CATEGORIES.map(cat => {
          const count = getCountByCategory(cat);
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                transition-colors border
                ${isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground'
                }
              `}
            >
              {cat}
              {count > 0 && (
                <span className={`
                  text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold
                  ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}
                `}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="bg-card rounded-xl border shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 p-4 border-b">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground">{activeCategory}</h2>
            <Badge variant="secondary" className="text-xs">{filteredItems.length} item</Badge>
          </div>
          <div className="relative w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari nama / SKU..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="p-4">
          {loading ? (
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
          ) : filteredItems.length === 0 ? (
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
              {canManageDesign && !searchQuery && (
                <Button size="sm" className="gap-1.5" onClick={openAdd}>
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Desain {activeCategory}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className="rounded-lg border bg-card overflow-hidden group relative hover:shadow-md transition-shadow"
                >
                  {/* Image */}
                  {item.image_url ? (
                    <div className="aspect-square bg-muted/20 overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-muted/20 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/25" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-sm font-medium truncate leading-tight">{item.name}</p>
                    {item.sku && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{item.sku}</p>
                    )}
                  </div>

                  {/* Action buttons — visible on hover */}
                  {canManageDesign && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 shadow-sm"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-7 w-7 shadow-sm"
                        onClick={() => requestDelete(item)}
                      >
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

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Hapus Desain?"
        description={
          pendingDeleteItem
            ? `Desain "${pendingDeleteItem.name}" akan dihapus permanen dan tidak bisa dikembalikan.`
            : 'Desain ini akan dihapus permanen dan tidak bisa dikembalikan.'
        }
        confirmLabel="Ya, Hapus"
        onConfirm={handleDelete}
      />

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!saving) setDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingItem ? 'Edit Desain' : 'Tambah Desain Baru'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {/* Category selector (add mode only) */}
            {!editingItem && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Kategori
                </Label>
                <div className="flex gap-1.5 flex-wrap">
                  {DESIGN_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                        ${formCategory === cat
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                        }
                      `}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Name & SKU side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="design-name" className="text-sm">
                  Nama Desain <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="design-name"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Contoh: Premium Stainless"
                  className="h-9"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="design-sku" className="text-sm">SKU</Label>
                <Input
                  id="design-sku"
                  value={formSku}
                  onChange={e => setFormSku(e.target.value)}
                  placeholder="Contoh: CB-PSTL-001"
                  className="h-9"
                />
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-1.5">
              <Label className="text-sm">Gambar Produk</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {imagePreview ? (
                /* Preview state */
                <div className="relative rounded-lg overflow-hidden border bg-muted/20">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-contain"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Ganti
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      onClick={removeImage}
                    >
                      <X className="w-3.5 h-3.5" />
                      Hapus
                    </Button>
                  </div>
                  {imageFile && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-1.5">
                      <p className="text-xs text-white truncate">{imageFile.name}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Drop zone */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`
                    flex flex-col items-center justify-center gap-2 h-36 rounded-lg border-2 border-dashed
                    cursor-pointer transition-colors text-center px-4
                    ${dragOver
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/30 text-muted-foreground'
                    }
                  `}
                >
                  <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {dragOver ? 'Lepaskan untuk upload' : 'Klik atau seret gambar ke sini'}
                    </p>
                    <p className="text-xs mt-0.5 opacity-70">PNG, JPG, WebP · Maks. 5 MB</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t mt-2">
            {editingItem && (
              <p className="text-xs text-muted-foreground">
                Kategori: <span className="font-medium">{editingItem.category}</span>
              </p>
            )}
            <div className={`flex gap-2 ${editingItem ? '' : 'ml-auto'}`}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="min-w-24"
              >
                {saving ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Menyimpan...
                  </span>
                ) : (
                  editingItem ? 'Simpan Perubahan' : 'Tambah Desain'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
