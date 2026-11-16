/* Kalkulator Dinamis (dashboard) — Belift
 * ============================================================
 * Bedanya dengan /kalkulator lama: semua angka — kurs, PPN, harga per opsi,
 * margin, biaya tetap — dibaca dari server dan bisa diubah admin di halaman
 * ini juga. Tidak perlu deploy untuk menyesuaikan harga.
 *
 * Halaman ini sengaja DIBUAT TERPISAH. Kalkulator lama tetap hidup apa adanya
 * karena masih dipakai; keduanya dijamin menghasilkan angka yang sama lewat
 * src/test/kalkulator-paritas.test.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calculator, Save, RotateCcw, ShieldAlert, History, Info, Plus, Trash2,
} from 'lucide-react';
import { boleh } from '../../shared/akses';
import {
  KONFIG_BAWAAN, gabungKonfig, hitungKalkulator, hargaUnitDasar, masukanBawaan, rp,
  type KonfigKalkulator, type MasukanKalkulator, type OpsiHarga,
} from '../../shared/kalkulator-konfigurasi';

// ── Kelompok pengaturan harga ───────────────────────────────
/** Satu baris isian di panel admin: satu angka yang kuncinya bisa ditunjuk. */
interface IsianAngka {
  label: string;
  /** Jalur di dalam konfigurasi, mis. 'kurs.usd_idr'. */
  kunci: string;
  satuan?: string;
  petunjuk?: string;
}

const KELOMPOK: { judul: string; keterangan: string; isian: IsianAngka[] }[] = [
  {
    judul: 'Kurs & pajak',
    keterangan: 'Angka USD dikali kurs ini, lalu dikali faktor biaya masuk (bea, ongkos kirim, dll).',
    isian: [
      { label: 'Kurs USD → IDR', kunci: 'kurs.usd_idr', satuan: 'Rp per USD' },
      { label: 'Faktor biaya masuk', kunci: 'kurs.faktor_biaya_masuk', satuan: '×', petunjuk: '1,145 = biaya masuk 14,5% di atas kurs.' },
      { label: 'PPN', kunci: 'ppn_persen', satuan: '%' },
    ],
  },
  {
    judul: 'Harga dasar unit',
    keterangan: 'Harga mesin + kabin dasar dalam USD, sebelum opsi apa pun.',
    isian: [
      { label: 'Tambahan per lantai', kunci: 'usd_per_lantai_tambahan', satuan: 'USD' },
      { label: 'Biaya tetap proyek', kunci: 'biaya_tetap_idr', satuan: 'Rp', petunjuk: 'Dulu 7.000.000 + 25.000.000.' },
    ],
  },
  {
    judul: 'Instalasi',
    keterangan: 'Biaya tenaga kerja pemasangan di Indonesia (IDR).',
    isian: [
      { label: 'Per lantai', kunci: 'instalasi.idr_per_lantai', satuan: 'Rp', petunjuk: 'Ditagih sesuai jumlah lantai sebenarnya.' },
      { label: 'Per lantai (shaft dikerjakan Belift)', kunci: 'instalasi.idr_per_lantai_shaft', satuan: 'Rp' },
      { label: 'Per lantai (dinding kaca)', kunci: 'instalasi.idr_per_lantai_kaca', satuan: 'Rp' },
    ],
  },
  {
    judul: 'Outdoor & dinding kaca',
    keterangan: 'Biaya tambahan bila unit dipasang di luar ruangan.',
    isian: [
      { label: 'Outdoor per lantai', kunci: 'outdoor.usd_per_lantai', satuan: 'USD' },
      { label: 'Finishing outdoor per lantai', kunci: 'outdoor.idr_finishing_per_lantai', satuan: 'Rp' },
      { label: 'Dinding kaca per meter', kunci: 'dinding_kaca.usd_per_meter', satuan: 'USD', petunjuk: 'Sudah termasuk rangka shaft. Bila dinding = Include, admin ditagih selisihnya terhadap shaft yang dipilih.' },
    ],
  },
  {
    judul: 'Margin',
    keterangan: 'Harga jual = biaya ÷ pembagi. Pembagi 0,8 berarti margin 20%.',
    isian: [
      { label: 'Pembagi — shaft dikerjakan Belift', kunci: 'margin.pembagi_shaft_belift', satuan: '×' },
      { label: 'Pembagi — shaft oleh pelanggan', kunci: 'margin.pembagi_shaft_pelanggan', satuan: '×' },
    ],
  },
];

/** Ambil/tulis nilai bertingkat lewat jalur 'a.b.c'. */
function ambilJalur(obj: unknown, jalur: string): number {
  const v = jalur.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], obj);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function tulisJalur<T>(asal: T, jalur: string, nilai: number): T {
  const hasil = structuredClone(asal) as Record<string, unknown>;
  const bagian = jalur.split('.');
  let kursor = hasil;
  for (const k of bagian.slice(0, -1)) {
    if (typeof kursor[k] !== 'object' || kursor[k] === null) kursor[k] = {};
    kursor = kursor[k] as Record<string, unknown>;
  }
  kursor[bagian[bagian.length - 1]] = nilai;
  return hasil as T;
}

export default function KalkulatorDinamis() {
  const { izin, user } = useAuth();
  const { toast } = useToast();
  const bolehUbah = boleh(izin, 'master');

  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [versi, setVersi] = useState(0);
  const [meta, setMeta] = useState<{ pada: string | null; oleh: string | null }>({ pada: null, oleh: null });
  const [tersimpan, setTersimpan] = useState(false);

  /** Angka yang berlaku di server (dipakai untuk menghitung). */
  const [berlaku, setBerlaku] = useState<KonfigKalkulator>(KONFIG_BAWAAN);
  /** Draf suntingan admin — belum berpengaruh sebelum disimpan. */
  const [draf, setDraf] = useState<KonfigKalkulator>(KONFIG_BAWAAN);
  const [masukan, setMasukan] = useState<MasukanKalkulator>(() => masukanBawaan(KONFIG_BAWAAN));

  const adaPerubahan = useMemo(
    () => JSON.stringify(draf) !== JSON.stringify(berlaku),
    [draf, berlaku],
  );

  async function muat() {
    setMemuat(true);
    try {
      const res = await fetch('/api/kalkulator');
      const isi = await res.json();
      if (!res.ok) throw new Error(isi.error || 'Gagal memuat harga');
      const cfg = gabungKonfig(isi.konfigurasi);
      setBerlaku(cfg);
      setDraf(cfg);
      setVersi(Number(isi.versi) || 0);
      setMeta({ pada: isi.diperbarui_pada ?? null, oleh: isi.diperbarui_oleh ?? null });
      setTersimpan(Boolean(isi.tersimpan));
      setMasukan((lama) => ({ ...lama, ...masukanBawaan(cfg) }));
    } catch (e) {
      toast({
        title: 'Gagal memuat konfigurasi',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => { void muat(); }, []);

  // Kalkulasi memakai `berlaku`, bukan `draf`: yang tampil sebagai harga
  // resmi harus angka yang benar-benar tersimpan.
  const hasil = useMemo(() => hitungKalkulator(berlaku, masukan), [berlaku, masukan]);

  async function simpan() {
    setMenyimpan(true);
    try {
      const res = await fetch('/api/kalkulator', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ konfigurasi: draf, versi }),
      });
      const isi = await res.json();

      if (res.status === 409) {
        toast({
          title: 'Harga sudah diubah orang lain',
          description: isi.error,
          variant: 'destructive',
        });
        await muat();
        return;
      }
      if (!res.ok) throw new Error(isi.error || 'Gagal menyimpan');

      setVersi(Number(isi.versi));
      setBerlaku(draf);
      setTersimpan(true);
      toast({
        title: isi.perubahan ? 'Harga tersimpan' : 'Tidak ada perubahan',
        description: isi.perubahan
          ? `${isi.perubahan} angka diperbarui. Kalkulator langsung memakai angka baru.`
          : 'Angka yang dikirim sama dengan yang sudah tersimpan.',
      });
      await muat();
    } catch (e) {
      toast({
        title: 'Gagal menyimpan',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setMenyimpan(false);
    }
  }

  function ubahAngka(kunci: string, teks: string) {
    // String kosong ditahan sebagai 0, bukan NaN: input yang sedang dihapus
    // admin jangan sampai membuat seluruh hitungan jadi NaN.
    const n = teks.trim() === '' ? 0 : Number(teks.replace(/\./g, '').replace(',', '.'));
    setDraf((d) => tulisJalur(d, kunci, Number.isFinite(n) ? n : 0));
  }

  if (memuat) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const pilihanKapasitas = [...new Set(berlaku.unit_dasar.map((u) => u.kapasitas))].sort((a, b) => a - b);
  const pilihanKecepatan = [...new Set(
    berlaku.unit_dasar.filter((u) => u.kapasitas === masukan.kapasitas).map((u) => u.kecepatan),
  )].sort((a, b) => a - b);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="w-6 h-6" /> Kalkulator Dinamis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hitung harga penawaran dengan angka yang diatur admin. Perubahan harga langsung berlaku tanpa deploy.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {tersimpan ? (
            <Badge variant="secondary">Harga dari server · versi {versi}</Badge>
          ) : (
            <Badge variant="outline">Belum pernah diubah · memakai angka bawaan</Badge>
          )}
          {meta.pada && (
            <div className="mt-1">
              Terakhir diubah {new Date(meta.pada).toLocaleString('id-ID')}
              {meta.oleh ? ` oleh ${meta.oleh}` : ''}
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="hitung">
        <TabsList>
          <TabsTrigger value="hitung">Hitung harga</TabsTrigger>
          <TabsTrigger value="harga">Atur harga</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
        </TabsList>

        {/* ═══════════════ HITUNG ═══════════════ */}
        <TabsContent value="hitung" className="mt-4">
          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-card rounded-xl border shadow-sm p-5 space-y-4">
              <h2 className="section-title">Spesifikasi</h2>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Kapasitas</Label>
                  <Select
                    value={String(masukan.kapasitas)}
                    onValueChange={(v) => {
                      const kap = Number(v);
                      const kec = berlaku.unit_dasar.find((u) => u.kapasitas === kap)?.kecepatan ?? masukan.kecepatan;
                      setMasukan((m) => ({ ...m, kapasitas: kap, kecepatan: kec }));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {pilihanKapasitas.map((k) => <SelectItem key={k} value={String(k)}>{k} kg</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Kecepatan</Label>
                  <Select
                    value={String(masukan.kecepatan)}
                    onValueChange={(v) => setMasukan((m) => ({ ...m, kecepatan: Number(v) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {pilihanKecepatan.map((k) => <SelectItem key={k} value={String(k)}>{k} m/s</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Jumlah lantai</Label>
                  <Input
                    type="number" min={2}
                    value={masukan.lantai}
                    onChange={(e) => setMasukan((m) => ({ ...m, lantai: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <Label>Tinggi shaft (mm)</Label>
                  <Input
                    type="number" step={100}
                    value={masukan.tinggi_mm}
                    onChange={(e) => setMasukan((m) => ({ ...m, tinggi_mm: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Pilihan label="Kabin" nilai={masukan.kabin} opsi={berlaku.kabin}
                  onChange={(v) => setMasukan((m) => ({ ...m, kabin: v }))} />
                <Pilihan label="Pintu" nilai={masukan.pintu} opsi={berlaku.pintu}
                  onChange={(v) => setMasukan((m) => ({ ...m, pintu: v }))} />
                <Pilihan label="Bukaan pintu" nilai={masukan.bukaan}
                  opsi={berlaku.bukaan.map((b) => ({ nama: b.nama, harga: b.usd_dasar }))}
                  onChange={(v) => setMasukan((m) => ({ ...m, bukaan: v }))} />
                <Pilihan label="Lantai kabin" nilai={masukan.lantai_kabin}
                  opsi={berlaku.lantai_kabin.map((b) => ({ nama: b.nama, harga: b.usd }))}
                  onChange={(v) => setMasukan((m) => ({ ...m, lantai_kabin: v }))} />
                <Pilihan label="Shaft" nilai={masukan.shaft}
                  opsi={berlaku.shaft.map((b) => ({ nama: b.nama, harga: b.usd_per_meter }))}
                  onChange={(v) => setMasukan((m) => ({ ...m, shaft: v }))} />
                <Pilihan label="Dinding" nilai={masukan.dinding}
                  opsi={[
                    { nama: berlaku.shaft_oleh_pelanggan, harga: 0 },
                    { nama: berlaku.dinding_kaca.nama_include, harga: 0 },
                  ]}
                  onChange={(v) => setMasukan((m) => ({ ...m, dinding: v }))} />
                <Pilihan label="COP" nilai={masukan.cop}
                  opsi={berlaku.panel_cop_lop.map((b) => ({ nama: b.nama, harga: b.usd_cop }))}
                  onChange={(v) => setMasukan((m) => ({ ...m, cop: v }))} />
                <Pilihan label="LOP" nilai={masukan.lop}
                  opsi={berlaku.panel_cop_lop.map((b) => ({ nama: b.nama, harga: b.usd_lop_per_lantai }))}
                  onChange={(v) => setMasukan((m) => ({ ...m, lop: v }))} />
                <Pilihan label="Lokasi proyek" nilai={masukan.lokasi} opsi={berlaku.lokasi}
                  onChange={(v) => setMasukan((m) => ({ ...m, lokasi: v }))} />
              </div>

              <div>
                <Label className="mb-2 block">Tambahan</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {([
                    ['outdoor', 'Outdoor'],
                    ['handrail', 'Handrail'],
                    ['ic_card', 'IC Card'],
                    ['ac', 'AC'],
                    ['knob', 'Knob'],
                    ['stabilizer', 'Stabilizer'],
                  ] as const).map(([kunci, label]) => {
                    const menyala = (masukan[kunci] as string) === 'YES';
                    return (
                      <button
                        key={kunci} type="button"
                        onClick={() => setMasukan((m) => ({ ...m, [kunci]: menyala ? 'NO' : 'YES' }))}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                          menyala ? 'bg-primary/10 border-primary text-foreground' : 'bg-background text-muted-foreground'
                        }`}
                      >
                        <span>{label}</span>
                        <span className="text-xs font-medium">{menyala ? 'Ya' : 'Tidak'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Ringkasan harga */}
            <div className="lg:col-span-2 bg-card rounded-xl border shadow-sm p-5 space-y-3 h-fit lg:sticky lg:top-4">
              <h2 className="section-title">Rincian harga</h2>

              <div className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2 space-y-1">
                <div className="flex justify-between"><span>Kurs</span><span>Rp {rp(berlaku.kurs.usd_idr)} / USD</span></div>
                <div className="flex justify-between"><span>Kurs efektif (+ biaya masuk)</span><span>Rp {rp(hasil.kursEfektif)}</span></div>
                <div className="flex justify-between"><span>PPN</span><span>{berlaku.ppn_persen}%</span></div>
                <div className="flex justify-between">
                  <span>Harga dasar unit</span>
                  <span>USD {rp(hargaUnitDasar(berlaku, masukan.kapasitas, masukan.kecepatan))}</span>
                </div>
              </div>

              <div className="divide-y">
                {hasil.komponen.map((k) => (
                  <div key={k.nama} className="py-2">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium">{k.nama}</span>
                      <span className="tabular-nums whitespace-nowrap">Rp {rp(k.nilai)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{k.rincian}</div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>Harga jual</span>
                  <span className="tabular-nums">Rp {rp(hasil.hargaJual)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>PPN {berlaku.ppn_persen}%</span>
                  <span className="tabular-nums">Rp {rp(hasil.ppn)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t">
                  <span className="font-semibold">Grand total</span>
                  <span className="text-xl font-bold tabular-nums">Rp {rp(hasil.grandTotal)}</span>
                </div>
                {!hasil.adaShaft && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Shaft dikerjakan pelanggan — biaya struktur & pemasangan shaft tidak dihitung.
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════ ATUR HARGA ═══════════════ */}
        <TabsContent value="harga" className="mt-4 space-y-4">
          {!bolehUbah ? (
            <div className="bg-card rounded-xl border shadow-sm p-6 flex gap-3 items-start">
              <ShieldAlert className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold">Hanya bisa dilihat</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Peran Anda boleh memakai kalkulator, tetapi tidak boleh mengubah harga.
                  Hubungi admin bila ada harga yang perlu diperbarui.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-xl border shadow-sm p-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4" />
                {adaPerubahan
                  ? 'Ada perubahan yang belum disimpan. Kalkulator masih memakai angka lama.'
                  : 'Tidak ada perubahan.'}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setDraf(berlaku)} disabled={!adaPerubahan || menyimpan}>
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Batalkan
                </Button>
                <Button size="sm" onClick={() => void simpan()} disabled={!adaPerubahan || menyimpan}>
                  <Save className="w-4 h-4 mr-1.5" /> {menyimpan ? 'Menyimpan…' : 'Simpan perubahan'}
                </Button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {KELOMPOK.map((kel) => (
              <div key={kel.judul} className="bg-card rounded-xl border shadow-sm p-5 space-y-3">
                <div>
                  <h2 className="section-title">{kel.judul}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{kel.keterangan}</p>
                </div>
                {kel.isian.map((isian) => (
                  <div key={isian.kunci}>
                    <Label className="flex justify-between gap-2">
                      <span>{isian.label}</span>
                      {isian.satuan && <span className="text-xs font-normal text-muted-foreground">{isian.satuan}</span>}
                    </Label>
                    <Input
                      className="mt-1 tabular-nums"
                      inputMode="decimal"
                      disabled={!bolehUbah}
                      value={String(ambilJalur(draf, isian.kunci))}
                      onChange={(e) => ubahAngka(isian.kunci, e.target.value)}
                    />
                    {isian.petunjuk && <p className="text-xs text-muted-foreground mt-1">{isian.petunjuk}</p>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <DaftarHarga
            judul="Harga kabin"
            keterangan="Selisih harga kabin dalam USD, di atas kabin standar."
            opsi={draf.kabin}
            satuan="USD"
            nonaktif={!bolehUbah}
            onChange={(kabin) => setDraf((d) => ({ ...d, kabin }))}
          />
          <DaftarHarga
            judul="Harga pintu"
            keterangan="Harga per pintu, dikalikan jumlah lantai + 1."
            opsi={draf.pintu}
            satuan="USD"
            nonaktif={!bolehUbah}
            onChange={(pintu) => setDraf((d) => ({ ...d, pintu }))}
          />
          <DaftarAngkaBertingkat
            judul="Harga shaft"
            keterangan="Harga per meter tinggi shaft dalam USD."
            opsi={draf.shaft}
            field="usd_per_meter"
            satuan="USD/m"
            nonaktif={!bolehUbah}
            onChange={(shaft) => setDraf((d) => ({ ...d, shaft }))}
          />
          <DaftarHarga
            judul="Harga lokasi / pengiriman"
            keterangan="Biaya kirim & akomodasi ke lokasi proyek (IDR)."
            opsi={draf.lokasi}
            satuan="Rp"
            nonaktif={!bolehUbah}
            onChange={(lokasi) => setDraf((d) => ({ ...d, lokasi }))}
          />
          <DaftarHarga
            judul="Add-on"
            keterangan="Harga tiap tambahan dalam USD."
            opsi={draf.addon}
            satuan="USD"
            nonaktif={!bolehUbah}
            onChange={(addon) => setDraf((d) => ({ ...d, addon }))}
          />
          <DaftarHarga
            judul="Harga dasar unit (kapasitas × kecepatan)"
            keterangan="Harga mesin dasar per kombinasi, dalam USD."
            opsi={draf.unit_dasar.map((u) => ({ nama: `${u.kapasitas} kg · ${u.kecepatan} m/s`, harga: u.usd }))}
            satuan="USD"
            nonaktif={!bolehUbah}
            tanpaTambah
            onChange={(baru) => setDraf((d) => ({
              ...d,
              unit_dasar: d.unit_dasar.map((u, i) => ({ ...u, usd: baru[i]?.harga ?? u.usd })),
            }))}
          />
          <DaftarHarga
            judul="Isian bawaan saat dibuka"
            keterangan="Tidak mengubah harga. Menentukan pilihan yang sudah terisi saat kalkulator dibuka. Isi nama opsi persis seperti di daftar atas."
            opsi={[
              { nama: 'Kabin', harga: 0, teks: draf.bawaan.kabin },
              { nama: 'Pintu', harga: 0, teks: draf.bawaan.pintu },
              { nama: 'Shaft', harga: 0, teks: draf.bawaan.shaft },
              { nama: 'Lokasi', harga: 0, teks: draf.bawaan.lokasi },
            ]}
            satuan=""
            nonaktif={!bolehUbah}
            tanpaTambah
            modeTeks
            onChange={(baru) => setDraf((d) => ({
              ...d,
              bawaan: {
                ...d.bawaan,
                ...(baru[0]?.teks !== undefined ? { kabin: baru[0].teks } : {}),
                ...(baru[1]?.teks !== undefined ? { pintu: baru[1].teks } : {}),
                ...(baru[2]?.teks !== undefined ? { shaft: baru[2].teks } : {}),
                ...(baru[3]?.teks !== undefined ? { lokasi: baru[3].teks } : {}),
              },
            }))}
          />
        </TabsContent>

        {/* ═══════════════ RIWAYAT ═══════════════ */}
        <TabsContent value="riwayat" className="mt-4">
          <Riwayat aktif={bolehUbah} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Potongan tampilan ───────────────────────────────────────

function Pilihan({
  label, nilai, opsi, onChange,
}: { label: string; nilai: string; opsi: OpsiHarga[]; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={nilai} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {opsi.map((o) => (
            <SelectItem key={o.nama} value={o.nama}>
              {o.nama}{o.harga ? ` (+${rp(o.harga)})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface BarisHarga extends OpsiHarga { teks?: string }

function DaftarHarga({
  judul, keterangan, opsi, satuan, nonaktif, onChange, tanpaTambah, modeTeks,
}: {
  judul: string;
  keterangan: string;
  opsi: BarisHarga[];
  satuan: string;
  nonaktif: boolean;
  onChange: (baru: BarisHarga[]) => void;
  tanpaTambah?: boolean;
  modeTeks?: boolean;
}) {
  const ubah = (i: number, bagian: Partial<BarisHarga>) =>
    onChange(opsi.map((o, idx) => (idx === i ? { ...o, ...bagian } : o)));
  const hapus = (i: number) => onChange(opsi.filter((_, idx) => idx !== i));
  const tambah = () => onChange([...opsi, { nama: 'Opsi baru', harga: 0 }]);

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-3">
      <div>
        <h2 className="section-title">{judul}</h2>
        <p className="text-xs text-muted-foreground mt-1">{keterangan}</p>
      </div>

      <div className="space-y-2">
        {opsi.map((o, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input
              className="flex-1 min-w-[12rem]"
              value={modeTeks ? (o.teks ?? '') : o.nama}
              disabled={nonaktif}
              onChange={(e) => ubah(i, modeTeks ? { teks: e.target.value } : { nama: e.target.value })}
            />
            {!modeTeks && (
              <>
                <Input
                  className="w-40 tabular-nums"
                  inputMode="numeric"
                  disabled={nonaktif}
                  value={String(o.harga)}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\./g, '').replace(',', '.'));
                    ubah(i, { harga: Number.isFinite(n) ? n : 0 });
                  }}
                />
                <span className="text-xs text-muted-foreground w-12">{satuan}</span>
              </>
            )}
            {!tanpaTambah && (
              <Button variant="ghost" size="icon" disabled={nonaktif || opsi.length <= 1}
                onClick={() => hapus(i)} title="Hapus opsi">
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!tanpaTambah && (
        <Button variant="outline" size="sm" disabled={nonaktif} onClick={tambah}>
          <Plus className="w-4 h-4 mr-1.5" /> Tambah opsi
        </Button>
      )}
    </div>
  );
}

function DaftarAngkaBertingkat<T extends { nama: string }>({
  judul, keterangan, opsi, field, satuan, nonaktif, onChange,
}: {
  judul: string;
  keterangan: string;
  opsi: T[];
  /** Nama kolom angka yang disunting, mis. 'usd_per_meter'. */
  field: Extract<keyof T, string>;
  satuan: string;
  nonaktif: boolean;
  onChange: (baru: T[]) => void;
}) {
  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-3">
      <div>
        <h2 className="section-title">{judul}</h2>
        <p className="text-xs text-muted-foreground mt-1">{keterangan}</p>
      </div>
      {opsi.map((o, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            className="flex-1 min-w-[12rem]"
            value={o.nama}
            disabled={nonaktif}
            onChange={(e) => onChange(opsi.map((x, idx) => (idx === i ? { ...x, nama: e.target.value } : x)))}
          />
          <Input
            className="w-40 tabular-nums"
            inputMode="numeric"
            disabled={nonaktif}
            value={String(o[field] ?? 0)}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\./g, '').replace(',', '.'));
              const nilai = (Number.isFinite(n) ? n : 0) as T[Extract<keyof T, string>];
              onChange(opsi.map((x, idx) => (idx === i ? { ...x, [field]: nilai } : x)));
            }}
          />
          <span className="text-xs text-muted-foreground w-16">{satuan}</span>
        </div>
      ))}
    </div>
  );
}

function Riwayat({ aktif }: { aktif: boolean }) {
  const [data, setData] = useState<{ waktu: string; oleh: string | null; versi: number; ringkasan: { jalur: string; dari: unknown; ke: unknown }[] }[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (!aktif) return;
    fetch('/api/kalkulator?riwayat=1')
      .then(async (r) => {
        const isi = await r.json();
        if (!r.ok) throw new Error(isi.error || 'Gagal memuat riwayat');
        setData(isi.data || []);
      })
      .catch((e) => setGalat(e instanceof Error ? e.message : String(e)));
  }, [aktif]);

  if (!aktif) {
    return (
      <div className="bg-card rounded-xl border shadow-sm p-6 flex gap-3 items-start">
        <History className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">Riwayat harga hanya bisa dilihat admin.</p>
      </div>
    );
  }
  if (galat) return <div className="text-sm text-destructive">{galat}</div>;
  if (!data) return <Skeleton className="h-40 w-full" />;
  if (!data.length) {
    return (
      <div className="bg-card rounded-xl border shadow-sm p-6 text-sm text-muted-foreground">
        Belum ada perubahan harga. Riwayat terisi otomatis setiap kali admin menyimpan
        perubahan dari tab <strong>Atur harga</strong>.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((r, i) => (
        <div key={i} className="bg-card rounded-xl border shadow-sm p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-sm">{new Date(r.waktu).toLocaleString('id-ID')}</span>
            <span className="text-xs text-muted-foreground">
              versi {r.versi}{r.oleh ? ` · ${r.oleh}` : ''} · {r.ringkasan.length} angka
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {r.ringkasan.slice(0, 40).map((p, j) => (
              <div key={j} className="text-xs flex flex-wrap gap-x-2">
                <span className="font-mono text-muted-foreground">{p.jalur}</span>
                <span className="text-muted-foreground line-through">{String(p.dari)}</span>
                <span>→</span>
                <span className="font-medium">{String(p.ke)}</span>
              </div>
            ))}
            {r.ringkasan.length > 40 && (
              <div className="text-xs text-muted-foreground">… dan {r.ringkasan.length - 40} angka lainnya</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
