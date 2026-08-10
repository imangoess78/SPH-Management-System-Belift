import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ImageIcon, RefreshCw } from 'lucide-react';
import { JENIS_LIFT, KAPASITAS_LIFT } from '@/lib/sph-types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DesignItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategory, setFormCategory] = useState('Cabin');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch setelah user auth siap — bukan saat mount (user bisa belum login)
  useEffect(() => {
    if (user) fetchDesignItems();
    else setLoading(false);
  }, [user]);

  const openAdd = (category: string) => {
    setEditingItem(null);
    setFormName('');
    setFormSku('');
    setFormCategory(category);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
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
    }

    if (editingItem) {
      const { error } = await supabase
        .from('design_items')
        .update({ name: formName, sku: formSku, image_url: imageUrl } as any)
        .eq('id', editingItem.id);
      if (error) {
        console.error('[MasterData] update error:', error);
        toast.error('Gagal mengupdate desain: ' + error.message);
      } else {
        toast.success('Desain berhasil diupdate');
      }
    } else {
      const { error } = await supabase
        .from('design_items')
        .insert({ category: formCategory, name: formName, sku: formSku, image_url: imageUrl } as any);
      if (error) {
        console.error('[MasterData] insert error:', error);
        toast.error('Gagal menambahkan desain: ' + error.message);
      } else {
        toast.success('Desain berhasil ditambahkan');
      }
    }

    setSaving(false);
    setDialogOpen(false);
    fetchDesignItems();
  };

  const handleDelete = async (item: DesignItem) => {
    if (!confirm(`Hapus desain "${item.name}"?`)) return;
    const { error } = await supabase.from('design_items').delete().eq('id', item.id);
    if (error) {
      console.error('[MasterData] delete error:', error);
      toast.error('Gagal menghapus desain: ' + error.message);
    } else {
      toast.success('Desain berhasil dihapus');
      fetchDesignItems();
    }
  };

  const getItemsByCategory = (category: string) => designItems.filter(d => d.category === category);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Master Data</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola data referensi untuk SPH</p>
          {fetchError && (
            <p className="text-xs text-destructive mt-1">
              Error memuat data: {fetchError}
              {!user && ' — Anda harus login terlebih dahulu.'}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={fetchDesignItems} disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="lift" className="space-y-4">
        <TabsList className="w-full overflow-x-auto px-1 pb-1 flex-nowrap">
          <TabsTrigger value="lift">Jenis Lift</TabsTrigger>
          <TabsTrigger value="kapasitas">Kapasitas</TabsTrigger>
          <TabsTrigger value="desain">Desain</TabsTrigger>
          <TabsTrigger value="items">Item Pekerjaan</TabsTrigger>
        </TabsList>

        <TabsContent value="lift" className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="section-title mb-4">Jenis Lift</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {JENIS_LIFT.map(j => (
              <div key={j} className="p-3 rounded-lg border bg-muted/30 text-sm font-medium">{j}</div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="kapasitas" className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="section-title mb-4">Kapasitas Lift</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {KAPASITAS_LIFT.map(k => (
              <div key={k} className="p-3 rounded-lg border bg-muted/30 text-sm font-medium text-center">{k} Kg</div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="desain" className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="section-title mb-4">Database Desain</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat data...</p>
          ) : (
            <div className="space-y-6">
              {DESIGN_CATEGORIES.map(category => {
                const items = getItemsByCategory(category);
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                      {canManageDesign && (
                        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => openAdd(category)}>
                          <Plus className="w-3 h-3" /> Tambah
                        </Button>
                      )}
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Belum ada data desain untuk {category}.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {items.map(item => (
                          <div key={item.id} className="rounded-lg border bg-muted/20 overflow-hidden group relative">
                            {item.image_url ? (
                              <div className="aspect-square bg-muted/30">
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="aspect-square bg-muted/30 flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                              </div>
                            )}
                            <div className="p-3">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              {item.sku && <p className="text-xs text-muted-foreground truncate">SKU: {item.sku}</p>}
                            </div>
                            {canManageDesign && (
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDelete(item)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="items" className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="section-title mb-4">Item Pekerjaan</h2>
          <div className="space-y-2 text-sm">
            <div className="p-3 rounded-lg border bg-muted/30 font-medium">A. Pengadaan Lift</div>
            <div className="p-3 rounded-lg border bg-muted/30 font-medium">B. Pengiriman Lift</div>
            <div className="p-3 rounded-lg border bg-muted/30 font-medium">C. Instalasi</div>
            <div className="p-3 rounded-lg border bg-muted/30 font-medium">D. Pekerjaan Sipil</div>
            <div className="ml-6 space-y-2">
              {['Pembuatan Pit', 'Struktur Beton/Baja', 'Arsitektural Opening Pintu', 'Control Panel / Jamb Pintu', 'Sirkulasi Udara', 'Finishing Sill'].map(s => (
                <div key={s} className="p-2 rounded border bg-muted/20 text-muted-foreground">↳ {s}</div>
              ))}
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 font-medium">E. Elektrikal/Kelistrikan</div>
            <div className="ml-6 space-y-2">
              <div className="p-2 rounded border bg-muted/20 text-muted-foreground">↳ Daya Listrik & Sub Panel</div>
              <div className="p-2 rounded border bg-muted/20 text-muted-foreground">↳ Grounding</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 font-medium">F. Gudang Peralatan Lift</div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Desain' : `Tambah Desain - ${formCategory}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama Desain *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Contoh: Desain A" />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={formSku} onChange={e => setFormSku(e.target.value)} placeholder="Contoh: SKU3043893" />
            </div>
            <div>
              <Label>Gambar</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover mx-auto rounded" />
                ) : (
                  <div className="text-muted-foreground">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Klik untuk upload gambar</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
