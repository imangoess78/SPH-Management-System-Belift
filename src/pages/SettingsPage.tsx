import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">Konfigurasi sistem SPH</p>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-6 max-w-2xl space-y-6">
        <div>
          <h2 className="section-title mb-4">Informasi Perusahaan</h2>
          <div className="space-y-4">
            <div>
              <Label>Nama Perusahaan</Label>
              <Input defaultValue="PT. Belift Amanah Indonesia" />
            </div>
            <div>
              <Label>Alamat</Label>
              <Input defaultValue="" placeholder="Alamat kantor" />
            </div>
            <div>
              <Label>Telepon</Label>
              <Input defaultValue="" placeholder="Nomor telepon" />
            </div>
            <div>
              <Label>Email</Label>
              <Input defaultValue="" placeholder="Email perusahaan" />
            </div>
          </div>
        </div>

        <div>
          <h2 className="section-title mb-4">PPN</h2>
          <div>
            <Label>Persentase PPN (%)</Label>
            <Input type="number" defaultValue={11} className="w-32" />
          </div>
        </div>

        <Button>Simpan Pengaturan</Button>
      </div>
    </div>
  );
}
