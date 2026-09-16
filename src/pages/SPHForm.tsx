// ============================================================
//  GENERATOR SPH & SPK — BELIFT
//  Split-panel: form (left) + live A4 preview (right)
// ============================================================
import { useState, useCallback, useEffect, Fragment } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  KatalogItem, TerminItem, DesainPilihan, DesainOption,
  OPT, KEL_LABEL, SYARAT, TERMIN_AWAL, DESAIN, DESAIN_LABEL, KET_LABEL, ASET, HARI_ID,
  makeDefaultItems, normalizeStrukturItems,
} from '@/lib/sph-types';
import {
  num, rupiah, ribu, terbilangRp, terbilang, capWords, fmtID,
  parseDate, pad3, noSuratSPH, noSuratSPK,
  totalKel, grandTotal, kelAktif, sumTermin,
  saveDocument, generateId, getNextNoUrut, updateDocumentStatus,
  loadDocumentById,
} from '@/lib/sph-utils';
// Generator dokumen TUNGGAL. Sebelumnya SPHForm punya salinan lokal sendiri
// (1/3 file) yang sudah divergen dari versi lib: Pasal DEFINISI kehilangan Handover
// & Progress, Pasal LINGKUP kehilangan sub-poin A–D PIHAK PERTAMA, Pasal 8
// kehilangan klausul ahli waris, dan tanda tangan sales dari DB tidak terpakai.
// Semua jalur (preview form, tombol cetak, halaman /preview) kini memakai fungsi
// yang sama supaya isi dokumen cetak tidak lagi berbeda antar tombol.
import {
  pageSPH, pageSPK, esc as escGen, injectDeco as injectDecoGen,
} from '@/lib/sph-generator';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────
type Mode = 'SPH' | 'SPK';
type ModeHarga = 'satuan' | 'lumpsum';

interface S {
  noUrut: string; tanggal: string; kota: string; alamatKantor: string; formatNoSPK: 'standar' | 'lama';
  sapaan: string; namaCustomer: string; namaPerusahaan: string; nikCustomer: string; alamatCustomer: string; kotaProyek: string;
  jenisLift: string; tipeKabin: string; kapasitas: string; penumpang: string; kecepatan: string; mpm: string; sfd: string;
  tipeMesin: string; traksi: string; dayaMesin: string; power: string; pintu: string; bukaanPintu: string;
  tinggiKabin: string; shaftSize: string; cabinSize: string; pitDepth: string; namaLantai: string; baseFloor: string;
  ppn: 'exclude' | 'include'; masaBerlaku: string; freeMtn: string; garSpare: string; garMesin: string;
  waktuPengadaan: string; waktuInstalasi: string;
  tampilTtd: boolean; tampilDesain: boolean;
  finishingStruktur: string;
  // Keterangan modifikasi bebas per kategori desain (opsional).
  // Hanya dicetak di halaman Opsi Desain bila diisi.
  catatanDesain: Record<string, string>;
  sales: string; jabatanTtd: string; direktur: string; rekening: string;
}

const DEFAULT_S: S = {
  noUrut:'438', tanggal:new Date().toISOString().slice(0,10), kota:'Depok',
  alamatKantor:OPT.alamatKantor[1], formatNoSPK:'standar',
  sapaan:'Bapak', namaCustomer:'', namaPerusahaan:'', nikCustomer:'', alamatCustomer:'', kotaProyek:'Bandung',
  jenisLift:'Home Lift', tipeKabin:'Full Panoramic', kapasitas:'400 Kg', penumpang:'3-4 orang',
  kecepatan:'0,4 m/s', mpm:'24 mpm', sfd:'4/4/4', tipeMesin:'MRL Lift', traksi:'2:1', dayaMesin:'1,2 kw',
  power:'380V 50HZ (3 phase)', pintu:'Center Opening', bukaanPintu:'750 mm', tinggiKabin:'2200 mm',
  shaftSize:'2000 * 2000', cabinSize:'1200*1300 (Custom)', pitDepth:'(Custom)', namaLantai:'1.2.3.4', baseFloor:'1',
  ppn:'exclude', masaBerlaku:'3 Minggu', freeMtn:OPT.freeMtn[1], garSpare:OPT.garSpare[1], garMesin:OPT.garMesin[1],
  waktuPengadaan:'2 Bulan', waktuInstalasi:'1,5 Bulan',
  tampilTtd:true, tampilDesain:true,
  finishingStruktur:'', catatanDesain:{},
  sales:'Imam Solikhin', jabatanTtd:'Sales', direktur:'Adhie Kurnia',
  rekening:'BANK BCA : 1662996330 - KCP Cimanggis, Depok',
};

// ── Helper: nomor surat ─────────────────────────────────────
function noSurat(mode: Mode, s: S): string {
  return mode === 'SPH' ? noSuratSPH(s.noUrut, s.tanggal) : noSuratSPK(s.noUrut, s.tanggal, s.formatNoSPK);
}
function namaFile(mode: Mode, s: S): string {
  const th = String(parseDate(s.tanggal).getFullYear()).slice(2);
  return pad3(s.noUrut)+th+'.'+mode+'_'+((s.namaPerusahaan||s.namaCustomer||'Customer').trim())+
    '_'+s.tipeKabin+'_'+s.kapasitas.replace(/\s/g,'')+'_'+s.kotaProyek;
}

// Keterangan desain terpilih — pakai `keterangan` dari Master Data bila diisi,
// kalau kosong pakai default: Struktur → warna (nama tanpa prefix "Struktur "),
// kategori lain (mis. Cabin) → nama desain itu sendiri (model).
function ketDesain(k: string, pilihDesain: DesainPilihan, desain?: Record<string, DesainOption[]>): string {
  const list = (desain || DESAIN)[k] || [];
  const o = list.find(x => x.kode === pilihDesain[k as keyof DesainPilihan]);
  if (!o) return '';
  const manual = String(o.ket || '').trim();
  if (manual) return manual;
  if (k === 'struktur') return o.nama.replace(/^struktur\s+/i, '').trim();
  return o.nama;
}

// Migrasi dokumen lama (I1c → S1g + sisip S1h) kini tinggal di `@/lib/sph-types`
// agar form, preview, dan generator memakai aturan yang sama persis.
// Jangan hidupkan kembali salinan lokal di sini — versi lama memaksa `on:false`
// sehingga centang Struktur hilang saat dokumen lama dibuka.

// ── Print helper ────────────────────────────────────────────
function printDocument(html: string, tipeKabin: string) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { window.alert('Pop-up diblokir. Izinkan pop-up untuk mencetak.'); return; }
  win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Belift — ${tipeKabin}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--orange:#D95103;--burnt:#A63F04;--brown:#592203;--ink:#2B1B10;--paper:#fff;--shell:#F0EDE9;--line:#DFD8D1;--muted:#7A6E66;--ok:#1E6B3A;--warn:#B8860B;--bad:#9C0006;--sub:#8A7A6E}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:'Barlow',system-ui,sans-serif;background:#fff;color:#2B1B10;font-size:14px}
@page{size:A4;margin:0}
.page{width:210mm;min-height:297mm;background:#fff url('/corner-shape-bg.png') no-repeat left top;background-size:33.8mm auto;padding:18mm 17mm 16mm;position:relative;overflow:hidden;font-size:10.5pt;line-height:1.5;font-family:'Barlow',sans-serif;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.page .hex-bg{position:absolute;right:0;bottom:0;width:80mm;height:auto;pointer-events:none;z-index:0;display:block}
.page.cont{padding-top:22mm}
.page::before{content:"";position:absolute;left:0;top:0;width:34mm;height:24mm;background:#D95103;border-bottom-right-radius:9mm}
.page::after{content:"";position:absolute;left:6mm;top:0;width:26mm;height:20mm;border:.7pt solid #fff;border-top:0;border-bottom-right-radius:8mm}
.pgnum{position:absolute;left:17mm;bottom:9mm;font-size:9pt;color:#7A6E66}
.paraf{position:absolute;right:17mm;bottom:9mm;font-size:8pt;color:#7A6E66}
.lethead{display:flex;justify-content:space-between;align-items:flex-start;margin-left:5mm;gap:10mm}
.doctype{font-family:'Barlow',sans-serif;font-size:52pt;color:#da5d1a;letter-spacing:.02em;line-height:1;margin-top:14mm;font-weight:500}
.co{text-align:right;font-size:8.5pt;color:#4A3A2E;line-height:1.45;margin-top:2mm}
.co .mark-logo{height:10mm;width:auto;display:block;margin-left:auto}
.co .ent{font-size:11pt;color:#A63F04;font-weight:500;margin-bottom:1mm}
.docno{text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:19pt;font-weight:600;color:#D95103;letter-spacing:.08em;margin:9mm 0 6mm}
.place{text-align:right;font-size:10pt;margin-bottom:5mm}
.to{margin-bottom:6mm}
.subject{font-weight:700;margin:0 0 4mm 8mm}
.body p{margin:0 0 3.4mm}.body h4{font-size:10.5pt;margin:5mm 0 1.6mm;font-weight:700}
.ind{margin-left:8mm}
.secttl{font-family:'Barlow Condensed',sans-serif;font-size:17pt;font-weight:500;margin:0 0 4mm}
table.doc{width:100%;border-collapse:collapse;font-size:9pt;margin:3mm 0}
table.doc th,table.doc td{border:.6pt solid #4A3A2E;padding:1.8mm 2.2mm;vertical-align:middle}
table.doc th{font-weight:600;text-align:center}
table.doc td.n{text-align:right;white-space:nowrap}
table.doc td.c{text-align:center}
tr.grp2 td{background:#F5F1ED;font-weight:700;font-family:'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;font-size:9.5pt}
tr.subrow td:nth-child(2){padding-left:6mm;font-style:italic;color:#5A4A3E}
tr.subrow td:nth-child(2)::before{content:"↳ "}
.inc{text-align:center;font-style:italic;color:#5A4A3E}
.spec th.head{background:#D95103;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:12pt;letter-spacing:.05em;text-transform:uppercase}
.spec td:first-child{text-align:center;width:16mm}
.spec td:nth-child(2){width:62mm}
.hl{color:#C0392B}
.total td{font-weight:700;background:#FBE9DF}
.terbilang{font-weight:700;margin-top:3mm}
.ol{margin:0;padding-left:10mm;list-style-type:decimal;overflow:visible}.ol li{margin-bottom:2.6mm}
.ul{margin:1mm 0 3mm;padding-left:10mm;list-style-type:disc;overflow:visible}.ul li{margin-bottom:1.4mm}
.dgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm 5mm;margin-top:5mm}
.dcard{text-align:center}
.dcard .box{height:44mm;border:.6pt solid #DFD8D1;border-radius:2mm;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#FBF9F7}
.dcard .box img{max-width:100%;max-height:100%;object-fit:contain}
.dcard .box .ph{font-size:8pt;color:#B5AAA1;padding:4mm;line-height:1.4}
.dcard .cap{font-size:8.5pt;margin-top:1.5mm;font-style:italic}
.dcard .cap b{font-style:normal;display:block;font-size:9pt}
.dcard .cap .cap-sub{display:block;font-style:normal;font-size:7.5pt;color:#8A7F76;margin-top:.5mm;letter-spacing:.1pt}
.dcard .cap .cap-note{display:block;font-style:normal;font-size:7.5pt;color:#8A7F76;margin-top:.8mm;line-height:1.35}
.sign{display:flex;justify-content:space-between;margin-top:10mm;text-align:center;font-size:10pt}
.sign>div{width:74mm}
.sigbox{position:relative;height:30mm;margin-top:2mm}
.sigbox img.cap{position:absolute;left:50%;top:50%;transform:translate(-58%,-50%) rotate(-8deg);height:26mm;opacity:.85}
.sigbox img.ttd{position:absolute;left:50%;top:50%;transform:translate(-42%,-50%);height:20mm}
.sig-nm{font-weight:700;border-top:.6pt solid #2B1B10;padding-top:1.5mm;display:inline-block;min-width:52mm}
.rt{text-align:right}
h4{font-size:10.5pt;margin:5mm 0 1.6mm;font-weight:700}
.page.spk-body{min-height:0;height:auto;overflow:visible;page-break-after:auto;break-after:auto}
.pasal-blk{page-break-inside:avoid;break-inside:avoid;margin-bottom:7mm}
</style>
</head>
<body>${html}</body>
</html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ── Build design options purely from DB master data ──────────
// DB category values: 'Cabin', 'Floor', 'Ceiling', 'Door', 'COP', 'LOP', 'Struktur', 'Add On'
// DESAIN key values:  'cabin', 'floor', 'ceiling', 'door', 'cop', 'lop', 'struktur', 'addon'
const CAT_MAP: Record<string, string> = {
  'cabin':'cabin','floor':'floor','ceiling':'ceiling','door':'door',
  'cop':'cop','lop':'lop','struktur':'struktur','add on':'addon','addon':'addon',
};

// UUID regex — used to detect fallback IDs so we don't show them as SKU labels
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toR2MediaUrl(value: string): string {
  const match = value.match(/\/storage\/v1\/object\/public\/(design-images|signatures)\/([^?]+)/);
  return match ? `/api/media?key=${encodeURIComponent(`recovery/2026-08-19/${match[1]}/${match[2]}`)}` : value;
}

function mergeDesainFromDB(dbRows: any[]): Record<string, DesainOption[]> {
  // Build map keyed by DESAIN category — filled exclusively from DB rows.
  // Categories with no DB rows stay as empty arrays (no static placeholders).
  // We store the raw SKU in the `kode` field and also build a display label
  // that includes the SKU so users can distinguish items with similar names.
  const result: Record<string, DesainOption[]> = {};
  Object.keys(DESAIN).forEach(k => { result[k] = []; });

  dbRows.forEach(row => {
    const rawCat = (row.category || '').toLowerCase().trim();
    const cat = CAT_MAP[rawCat];
    if (!cat) return; // unknown category — skip

    const img = toR2MediaUrl(row.image_url || '');
    const sku = (row.sku || '').trim();
    const kode = sku || row.id; // fallback to id if no sku
    const nama = row.name || kode; // clean name for printing
    // Show "Nama [SKU]" in dropdown only when SKU exists and isn't a UUID fallback
    const label = sku && !UUID_RE.test(sku) ? `${nama} [${sku}]` : nama;

    if (!result[cat]) result[cat] = [];
    // Avoid duplicate kode
    if (!result[cat].find(o => o.kode === kode)) {
      result[cat].push({ kode, nama, label, img, ket: String(row.keterangan || '').trim() || undefined });
    }
  });
  return result;
}

// ── Helper: apply saved docstate to form ────────────────────
function applyDocState(
  doc: any,
  setMode: (m: Mode) => void,
  setS: (s: S) => void,
  setModeHarga: (m: ModeHarga) => void,
  setItems: (i: KatalogItem[]) => void,
  setTermin: (t: Record<string, TerminItem[]>) => void,
  setPilihDesain: (d: DesainPilihan) => void,
  asMode?: Mode, // override mode (e.g. force SPK when loading from SPH)
) {
  const raw = doc || {};
  const nested = (doc.state && typeof doc.state === 'object') ? doc.state : {};
  const st = {
    ...raw,
    ...nested,
    namaPerusahaan: nested.namaPerusahaan || raw.namaPerusahaan || raw.nama_perusahaan || raw.kepada || raw.nama_pic || '',
    namaCustomer: nested.namaCustomer || raw.namaCustomer || raw.nama_customer || raw.nama_pic || raw.kepada || '',
    sapaan: nested.sapaan || raw.sapaan || 'Bapak',
    alamatCustomer: nested.alamatCustomer || raw.alamatCustomer || raw.alamat_customer || '',
    kotaProyek: nested.kotaProyek || raw.kotaProyek || raw.kota_proyek || '',
  };
  if (asMode) setMode(asMode);
  else if (doc.mode === 'SPH' || doc.mode === 'SPK') setMode(doc.mode);

  const keys: (keyof S)[] = [
    'noUrut','tanggal','kota','alamatKantor','formatNoSPK',
    'sapaan','namaCustomer','namaPerusahaan','nikCustomer','alamatCustomer','kotaProyek',
    'jenisLift','tipeKabin','kapasitas','penumpang','kecepatan','mpm','sfd',
    'tipeMesin','traksi','dayaMesin','power','pintu','bukaanPintu',
    'tinggiKabin','shaftSize','cabinSize','pitDepth','namaLantai','baseFloor',
    'ppn','masaBerlaku','freeMtn','garSpare','garMesin','waktuPengadaan','waktuInstalasi',
    'tampilTtd','tampilDesain','finishingStruktur','catatanDesain','sales','jabatanTtd','direktur','rekening',
  ];
  const merged: S = { ...DEFAULT_S };
  keys.forEach(k => { if (st[k] !== undefined) (merged as any)[k] = st[k]; });
  setS(merged);

  if (doc.modeHarga || doc.state?.modeHarga) setModeHarga((doc.modeHarga || doc.state?.modeHarga) as ModeHarga);
  const rawItems = (Array.isArray(doc.items) && doc.items.length) ? doc.items
    : (Array.isArray(doc.state?.items) && doc.state.items.length) ? doc.state.items : null;
  if (rawItems) setItems(normalizeStrukturItems(rawItems));
  if (doc.termin && typeof doc.termin === 'object') setTermin(doc.termin);
  if (doc.pilihDesain && typeof doc.pilihDesain === 'object') setPilihDesain(doc.pilihDesain);
}

// ── Main Component ──────────────────────────────────────────
export default function SPHForm({ defaultMode }: { defaultMode?: Mode }) {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const fromSphId = searchParams.get('from'); // ?from=<sphId> when creating SPK from SPH Final
  const { signOut, fullName, user } = useAuth();
  const [mode, setMode] = useState<Mode>(defaultMode || 'SPH');
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [s, setS] = useState<S>(DEFAULT_S);
  const [modeHarga, setModeHarga] = useState<ModeHarga>('satuan');
  const [items, setItems] = useState<KatalogItem[]>(makeDefaultItems());
  const [termin, setTermin] = useState<Record<string, TerminItem[]>>(JSON.parse(JSON.stringify(TERMIN_AWAL)));
  const [tabTermin, setTabTermin] = useState<string>('PENGADAAN');
  // Start empty — will be populated from DB. No static placeholder pre-selection.
  const [pilihDesain, setPilihDesain] = useState<DesainPilihan>({
    cabin: '', floor: '', ceiling: '', door: '', cop: '', lop: '', struktur: '', addon: '',
  });
  // Design items from Supabase — starts empty, filled after fetch
  const [liveDesain, setLiveDesain] = useState<Record<string, DesainOption[]>>(
    Object.fromEntries(Object.keys(DESAIN).map(k => [k, []])) as Record<string, DesainOption[]>
  );
  // Sales from DB: list of { name, jabatan, signature_url }
  const [salesList, setSalesList] = useState<{ name: string; jabatan: string; signature_url: string | null }[]>([]);

  // Fetch active sales from the Cloudflare/D1 API
  useEffect(() => {
    if (!user) return;
    fetch('/api/data?table=sales')
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Gagal memuat sales');
        return (result.data || []) as { name: string; jabatan: string; signature_url: string | null; active: boolean | number }[];
      })
      .then(data => {
        const activeSales = data
          .filter(sales => sales.active === true || sales.active === 1)
          .sort((a, b) => a.name.localeCompare(b.name));
        setSalesList(activeSales);
        // Jangan biarkan sales nonaktif tetap terpilih pada form baru.
        setS(prev => {
          if (!prev.sales || activeSales.some(sales => sales.name === prev.sales)) return prev;
          const replacement = activeSales[0];
          return replacement
            ? { ...prev, sales: replacement.name, jabatanTtd: replacement.jabatan }
            : { ...prev, sales: '', jabatanTtd: '' };
        });
      })
      .catch(error => console.error('[SPHForm] sales fetch error:', error));
  }, [user]);

  const upd = useCallback((k: keyof S, v: unknown) => setS(prev => ({ ...prev, [k]: v })), []);

  // Load existing document for edit (:id route) or pre-populate from SPH Final (?from=)
  useEffect(() => {
    const loadId = routeId || fromSphId;
    if (!loadId) return;
    loadDocumentById(loadId).then(doc => {
      if (!doc) { toast.error('Dokumen tidak ditemukan'); return; }
      if (fromSphId) {
        // Creating new SPK from SPH Final — force mode=SPK, keep all data, reset noUrut/tanggal
        applyDocState(doc, setMode, setS, setModeHarga, setItems, setTermin, setPilihDesain, 'SPK');
        // Reset date to today and noUrut will be set by getNextNoUrut effect below
        setS(prev => ({ ...prev, tanggal: new Date().toISOString().slice(0, 10) }));
        toast.success('Data SPH dimuat. Lengkapi field SPK sebelum menyimpan.');
      } else {
        // Editing existing document — restore everything as-is
        applyDocState(doc, setMode, setS, setModeHarga, setItems, setTermin, setPilihDesain);
      }
    });
  }, [routeId, fromSphId]);

  // Auto-populate noUrut with next available number per doc type
  // Only runs for new documents (no routeId)
  useEffect(() => {
    if (routeId) return; // editing existing — don't overwrite noUrut
    getNextNoUrut(mode).then(next => {
      upd('noUrut', String(next));
    });
  }, [mode, routeId]);

  // Fetch design_items from D1 API
  useEffect(() => {
    if (!user) return;
    fetch('/api/data?table=design_items').then(r => r.json()).then(({ data }) => {
      if (!data?.length) return;
      const fromDB = mergeDesainFromDB(data);
      setLiveDesain(fromDB);
      setPilihDesain(prev => {
        const next = { ...prev };
        (Object.keys(fromDB) as (keyof DesainPilihan)[]).forEach(k => {
          if (!next[k] && fromDB[k]?.[0]) next[k] = fromDB[k][0].kode;
        });
        return next;
      });
    }).catch(e => console.error('[SPHForm] design_items fetch error:', e));
  }, [user]);

  function setItemField(idx: number, k: keyof KatalogItem, v: unknown) {
    setItems(prev => {
      const next = prev.map((it, i) => i === idx ? { ...it, [k]: (k==='on'||k==='inc') ? v : num(v as unknown) } : it);
      if (k === 'inc' && v) { next[idx].hp = 0; next[idx].hi = 0; }
      if (k === 'on') {
        const it = prev[idx];
        if (!it.par) {
          // Induk dicentang/dimatikan → seluruh anaknya ikut.
          next.forEach(x => { if (x.par === it.id) x.on = v as boolean; });
        } else if (!(v as boolean)) {
          // Anak dimatikan → induk ikut mati bila tak ada anak lain yang menyala.
          const masihAda = next.some(x => x.par === it.par && x.on && x.id !== it.id);
          if (!masihAda) {
            const p = next.find(x => x.id === it.par);
            if (p) p.on = false;
          }
        } else {
          // Anak dinyalakan → pastikan induknya menyala supaya barisnya ikut terhitung.
          const p = next.find(x => x.id === it.par);
          if (p) p.on = true;
        }
      }
      return next;
    });
  }

  function setT(kel: string, i: number, k: 'p'|'s', v: unknown) {
    setTermin(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[kel][i][k] = k === 'p' ? num(v) : v;
      return next;
    });
  }
  function addT(kel: string) { setTermin(prev => { const n = JSON.parse(JSON.stringify(prev)); n[kel].push({p:0,s:SYARAT[kel][0]}); return n; }); }
  function delT(kel: string, i: number) { setTermin(prev => { const n = JSON.parse(JSON.stringify(prev)); if(n[kel].length>1) n[kel].splice(i,1); return n; }); }

  function isiCepat() {
    const v = window.prompt('Nilai kontrak pengadaan + pemasangan (Rp):', '425000000');
    if (v === null) return;
    const t = num(String(v).replace(/\D/g,'')), p = Math.round(t * 0.87);
    setItems(prev => prev.map(it => {
      if (it.id === 'P1') return { ...it, hp:p, hi:0, inc:false, on:true };
      if (it.id === 'I1') return { ...it, hp:0, hi:t-p, inc:false, on:true };
      return it;
    }));
  }

  const gt = grandTotal(items, modeHarga);
  const aktif = kelAktif(items);

  // Fix tabTermin if needed
  const safeTab = aktif.includes(tabTermin) ? tabTermin : (aktif[0] || 'PENGADAAN');

  const [newDocId] = useState(() => generateId());
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  async function buildAndSave(status: 'draft' | 'final') {
    if (!user) { toast.error('Login diperlukan untuk menyimpan'); return false; }
    // Use existing ID when editing, or new ID when creating
    const saveId = routeId || newDocId;
    const renderedHtml = mode === 'SPH'
      ? pageSPH(s, items, termin, modeHarga, pilihDesain, liveDesain)
      : pageSPK(s, items, termin, modeHarga, pilihDesain, liveDesain);
    return saveDocument({
      id: saveId,
      mode,
      noUrut: s.noUrut,
      tanggal: s.tanggal,
      namaCustomer: s.namaCustomer,
      namaPerusahaan: s.namaPerusahaan,
      kotaProyek: s.kotaProyek,
      jenisLift: s.jenisLift,
      tipeKabin: s.tipeKabin,
      kapasitas: s.kapasitas,
      ppn: s.ppn,
      modeHarga,
      sales: s.sales,
      status,
      // full state for re-editing
      state: s,
      items,
      termin,
      pilihDesain,
      // rendered HTML for fast preview
      renderedHtml,
    }, user.id);
  }

  async function handleSave() {
    setSaving(true);
    const ok = await buildAndSave('draft');
    setSaving(false);
    if (ok) toast.success('Dokumen disimpan sebagai draft');
    else toast.error('Gagal menyimpan dokumen');
  }

  async function handleFinalize() {
    if (!user) { toast.error('Login diperlukan'); return; }
    setFinalizing(true);
    const ok = await buildAndSave('final');
    setFinalizing(false);
    if (ok) toast.success('Dokumen berhasil difinalisasi');
    else toast.error('Gagal memfinalisasi dokumen');
  }

  function handlePrint() {
    const html = mode === 'SPH'
      ? pageSPH(s, items, termin, modeHarga, pilihDesain, liveDesain)
      : pageSPK(s, items, termin, modeHarga, pilihDesain, liveDesain);
    printDocument(html, s.tipeKabin);
  }

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100svh', overflow:'hidden'}}>
      {/* TOP BAR */}
      <TopBar mode={mode}
        fullName={fullName} onBack={() => navigate('/')} onSignOut={signOut}
        onPrint={handlePrint} onSave={handleSave} saving={saving}
        onFinalize={handleFinalize} finalizing={finalizing}
        mobileTab={mobileTab} setMobileTab={setMobileTab} />

      {/* SPLIT LAYOUT — desktop: side-by-side | mobile: tab-switched single panel */}
      <div className="gen-layout" style={{flex:1, overflow:'hidden', display:'grid', gridTemplateColumns:'430px 1fr'}}>
        <FormPanel
          mode={mode} s={s} upd={upd} items={items} setItemField={setItemField}
          modeHarga={modeHarga} setModeHarga={setModeHarga} isiCepat={isiCepat}
          termin={termin} tabTermin={safeTab} setTabTermin={setTabTermin}
          addT={addT} delT={delT} setT={setT}
          pilihDesain={pilihDesain} setPilihDesain={setPilihDesain}
          noSuratStr={noSurat(mode,s)} namaFileStr={namaFile(mode,s)}
          totalKelFn={(k) => totalKel(items,k,modeHarga)} gt={gt}
          liveDesain={liveDesain}
          salesList={salesList}
          mobileVisible={mobileTab === 'form'}
        />
        <PreviewPanel mode={mode} s={s} items={items} termin={termin}
          modeHarga={modeHarga} pilihDesain={pilihDesain} liveDesain={liveDesain}
          salesList={salesList}
          mobileVisible={mobileTab === 'preview'} />
      </div>
    </div>
  );
}

// ── Form Panel ──────────────────────────────────────────────
interface SalesListItem { name: string; jabatan: string; signature_url: string | null; }

interface FormPanelProps {
  mode: Mode; s: S; upd: (k: keyof S, v: unknown) => void;
  items: KatalogItem[]; setItemField: (i: number, k: keyof KatalogItem, v: unknown) => void;
  modeHarga: ModeHarga; setModeHarga: (m: ModeHarga) => void; isiCepat: () => void;
  termin: Record<string, TerminItem[]>; tabTermin: string; setTabTermin: (t: string) => void;
  addT: (k: string) => void; delT: (k: string, i: number) => void; setT: (k: string, i: number, f: 'p'|'s', v: unknown) => void;
  pilihDesain: DesainPilihan; setPilihDesain: (d: DesainPilihan) => void;
  noSuratStr: string; namaFileStr: string; totalKelFn: (k: string) => number; gt: number;
  liveDesain: Record<string, DesainOption[]>;
  salesList: SalesListItem[];
  mobileVisible: boolean;
}

function Grp({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="grp-sec" open={open}>
      <summary className="grp-sum">{title}</summary>
      <div className="grp-fields">{children}</div>
    </details>
  );
}

function Fsel({ label, value, options, onChange, hint }: { label: string; value: string; options: string[]; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="f-item">
      <label className="f-label">{label}</label>
      <select className="f-ctrl" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      {hint && <div className="f-hint">{hint}</div>}
    </div>
  );
}

function Ftxt({ label, value, type, onChange, hint }: { label: string; value: string; type?: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="f-item">
      <label className="f-label">{label}</label>
      <input className="f-ctrl" type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} />
      {hint && <div className="f-hint">{hint}</div>}
    </div>
  );
}

function FormPanel(props: FormPanelProps) {
  const { mode, s, upd, items, setItemField, modeHarga, setModeHarga, isiCepat,
    termin, tabTermin, setTabTermin, addT, delT, setT,
    pilihDesain, setPilihDesain, noSuratStr, namaFileStr, totalKelFn, gt, mobileVisible } = props;
  const isSPK = mode === 'SPK';
  const aktif = kelAktif(items);
  const safeTab = aktif.includes(tabTermin) ? tabTermin : (aktif[0] || 'PENGADAAN');

  return (
    <div className="form-panel no-print" style={{display: mobileVisible ? undefined : 'none'}}>
      <Grp title="Nomor &amp; tanggal" open>
        <div className="row2">
          <Ftxt label="No urut" value={s.noUrut} onChange={v => upd('noUrut', v)} />
          <Ftxt label="Tanggal" value={s.tanggal} type="date" onChange={v => upd('tanggal', v)} />
        </div>
        <div className="computed-box">
          Nomor surat: <b>{noSuratStr}</b><br />Nama file: <b>{namaFileStr}</b>
        </div>
        {isSPK && <Fsel label="Format nomor SPK" value={s.formatNoSPK} options={['standar','lama']} onChange={v => upd('formatNoSPK', v)} hint="'standar' = 068/SPK/LIFT/BAI/VIII/2026. 'lama' = 068/LIFT/BAI/VIII/2026." />}
        <Fsel label="Alamat kantor di kop" value={s.alamatKantor} options={OPT.alamatKantor} onChange={v => upd('alamatKantor', v)} />
      </Grp>

      <Grp title="Customer" open>
        <div className="row2">
          <Fsel label="Sapaan" value={s.sapaan} options={['Bapak','Ibu','Bapak/Ibu','—']} onChange={v => upd('sapaan', v)} />
          <Ftxt label="Nama customer" value={s.namaCustomer} onChange={v => upd('namaCustomer', v)} />
        </div>
        <Ftxt label="Nama perusahaan / yayasan" value={s.namaPerusahaan} onChange={v => upd('namaPerusahaan', v)} hint="Kosongkan untuk perorangan." />
        {isSPK && <Ftxt label="NIK" value={s.nikCustomer} onChange={v => upd('nikCustomer', v)} />}
        {isSPK && (
          <div className="f-item">
            <label className="f-label">Alamat lengkap (lokasi pekerjaan)</label>
            <textarea className="f-ctrl f-area" value={s.alamatCustomer} onChange={e => upd('alamatCustomer', e.target.value)} />
          </div>
        )}
        <Ftxt label="Kota lokasi proyek" value={s.kotaProyek} onChange={v => upd('kotaProyek', v)} />
      </Grp>

      <Grp title="Tabel harga" open>
        <div className="f-item">
          <label className="f-label">Mode harga</label>
          <select className="f-ctrl" value={modeHarga} onChange={e => setModeHarga(e.target.value as ModeHarga)}>
            <option value="satuan">Harga Satuan (dikali Qty)</option>
            <option value="lumpsum">Lumpsum (harga total langsung)</option>
          </select>
        </div>
        <PriceTable items={items} setItemField={setItemField} modeHarga={modeHarga}
          pilihDesain={pilihDesain} setPilihDesain={setPilihDesain} liveDesain={props.liveDesain}
          finishing={s.finishingStruktur} onFinishing={v => upd('finishingStruktur', v)}
          catatan={s.catatanDesain || {}} onCatatan={(k, v) => {
            const c = { ...(s.catatanDesain || {}) };
            if (v.trim()) c[k] = v; else delete c[k];
            upd('catatanDesain', c);
          }} />
        <div className="f-hint" style={{marginTop:8}}>Centang <b>Include</b> kalau item sudah tercakup di harga induknya.</div>
        <button className="mini-btn" onClick={isiCepat}>Isi cepat 87/13 dari satu nilai kontrak</button>
        <div className="computed-box">
          Pengadaan: <b>{rupiah(totalKelFn('PENGADAAN'))}</b><br />
          Instalasi: <b>{rupiah(totalKelFn('INSTALASI'))}</b><br />
          Pekerjaan Sipil: <b>{rupiah(totalKelFn('SIPIL'))}</b><br />
          <span className="big-total">Total: {rupiah(gt)}</span><br />
          <span style={{fontSize:'11.5px'}}>{terbilangRp(gt)}</span>
        </div>
      </Grp>

      <Grp title="Termin pembayaran" open>
        <TerminPanel items={items} termin={termin} tabTermin={safeTab} setTabTermin={setTabTermin}
          modeHarga={modeHarga} addT={addT} delT={delT} setT={setT} />
        <div className="flag-box">Tiap SPK punya termin sendiri. Termin pengadaan menempel pada milestone barang (BL, MOS), termin instalasi pada milestone pekerjaan lapangan.</div>
      </Grp>

      <Grp title="Opsi desain">
        <Fsel label="Cetak halaman desain" value={String(s.tampilDesain)} options={['true','false']} onChange={v => upd('tampilDesain', v === 'true')} />
        {(Object.keys(DESAIN_LABEL) as (keyof DesainPilihan)[])
          .filter(k => k !== 'struktur')
          .map(k => {
            const list = (props.liveDesain[k] || DESAIN[k] || []);
            return (
              <div key={k} className="f-item">
                <label className="f-label">{DESAIN_LABEL[k]}</label>
                <select className="f-ctrl" value={pilihDesain[k]} onChange={e => setPilihDesain({...pilihDesain, [k]: e.target.value})}>
                  <option value="">Pilih desain…</option>
                  {list.map(o => <option key={o.kode} value={o.kode}>{o.label ?? o.nama}</option>)}
                </select>
                {(() => {
                  const o = list.find(x => x.kode === pilihDesain[k]);
                  if (!o) return null;
                  const ket = ketDesain(k, pilihDesain, props.liveDesain);
                  if (!ket || ket.toLowerCase() === String(o.nama).toLowerCase()) return null;
                  return <div className="f-hint">{KET_LABEL[k] || 'Keterangan'}: {ket}</div>;
                })()}
                {/* Keterangan modifikasi opsional — hanya tercetak bila diisi. */}
                {pilihDesain[k] && (
                  <input className="f-ctrl note-inp" type="text"
                    placeholder="Keterangan modifikasi (opsional, mis. handle diganti silver)"
                    value={(s.catatanDesain || {})[k] || ''}
                    onChange={e => {
                      const v = e.target.value;
                      const c = { ...(s.catatanDesain || {}) };
                      if (v.trim()) c[k] = v; else delete c[k];
                      upd('catatanDesain', c);
                    }} />
                )}
              </div>
            );
          })}
        <div className="f-hint">
          Desain & finishing <b>Struktur</b> diatur di <b>Tabel harga → Pekerjaan Sipil</b>, muncul saat
          item <b>Struktur Steel</b> / <b>Struktur Aluminium</b> dicentang.
        </div>
      </Grp>

      <Grp title="Unit lift &amp; spesifikasi">
        <Fsel label="Jenis lift" value={s.jenisLift} options={OPT.jenisLift} onChange={v => upd('jenisLift', v)} />
        <Fsel label="Tipe kabin" value={s.tipeKabin} options={OPT.tipeKabin} onChange={v => upd('tipeKabin', v)} />
        <div className="row2">
          <Fsel label="Kapasitas" value={s.kapasitas} options={OPT.kapasitas} onChange={v => upd('kapasitas', v)} />
          <Fsel label="Kapasitas orang" value={s.penumpang} options={OPT.penumpang} onChange={v => upd('penumpang', v)} />
        </div>
        <div className="row3">
          <Fsel label="Kecepatan" value={s.kecepatan} options={OPT.kecepatan} onChange={v => upd('kecepatan', v)} />
          <Fsel label="MPM" value={s.mpm} options={OPT.mpm} onChange={v => upd('mpm', v)} />
          <Fsel label="S/F/D" value={s.sfd} options={OPT.sfd} onChange={v => upd('sfd', v)} />
        </div>
        <div className="row2">
          <Fsel label="Tipe mesin" value={s.tipeMesin} options={OPT.tipeMesin} onChange={v => upd('tipeMesin', v)} />
          <Fsel label="Rasio traksi" value={s.traksi} options={OPT.traksi} onChange={v => upd('traksi', v)} />
        </div>
        <div className="row2">
          <Fsel label="Daya mesin" value={s.dayaMesin} options={OPT.dayaMesin} onChange={v => upd('dayaMesin', v)} />
          <Fsel label="Power supply" value={s.power} options={OPT.power} onChange={v => upd('power', v)} />
        </div>
        <div className="row2">
          <Fsel label="Bukaan pintu" value={s.pintu} options={OPT.pintu} onChange={v => upd('pintu', v)} />
          <Fsel label="Lebar bukaan" value={s.bukaanPintu} options={OPT.bukaanPintu} onChange={v => upd('bukaanPintu', v)} />
        </div>
        <div className="row2">
          <Fsel label="Tinggi kabin" value={s.tinggiKabin} options={OPT.tinggiKabin} onChange={v => upd('tinggiKabin', v)} />
          <Ftxt label="Shaft size" value={s.shaftSize} onChange={v => upd('shaftSize', v)} />
        </div>
        <div className="row2">
          <Ftxt label="Cabin size" value={s.cabinSize} onChange={v => upd('cabinSize', v)} />
          <Ftxt label="Pit depth" value={s.pitDepth} onChange={v => upd('pitDepth', v)} />
        </div>
        <div className="row2">
          <Ftxt label="Nama lantai" value={s.namaLantai} onChange={v => upd('namaLantai', v)} />
          <Ftxt label="Base floor" value={s.baseFloor} onChange={v => upd('baseFloor', v)} />
        </div>
      </Grp>

      <Grp title="Syarat &amp; kondisi">
        <div className="row2">
          <Fsel label="Masa berlaku" value={s.masaBerlaku} options={OPT.masaBerlaku} onChange={v => upd('masaBerlaku', v)} />
          <Fsel label="PPN 11%" value={s.ppn} options={['exclude','include']} onChange={v => upd('ppn', v)} />
        </div>
        <div className="row2">
          <Fsel label="Garansi sparepart" value={s.garSpare} options={OPT.garSpare} onChange={v => upd('garSpare', v)} />
          <Fsel label="Garansi mesin" value={s.garMesin} options={OPT.garMesin} onChange={v => upd('garMesin', v)} />
        </div>
        <Fsel label="Maintenance" value={s.freeMtn} options={OPT.freeMtn} onChange={v => upd('freeMtn', v)} />
        {isSPK && (
          <div className="row2">
            <Ftxt label="Waktu s/d MOS" value={s.waktuPengadaan} onChange={v => upd('waktuPengadaan', v)} />
            <Ftxt label="Instalasi setelah MOS" value={s.waktuInstalasi} onChange={v => upd('waktuInstalasi', v)} />
          </div>
        )}
      </Grp>

      <Grp title="Tanda tangan &amp; cap">
        <Fsel label="Tampilkan tanda tangan &amp; cap" value={String(s.tampilTtd)} options={['true','false']} onChange={v => upd('tampilTtd', v === 'true')} />
        {mode === 'SPH'
          ? <>
              <div className="f-item">
                <label className="f-label">Nama sales</label>
                <select className="f-ctrl" value={s.sales} onChange={e => {
                  upd('sales', e.target.value);
                  // Auto-fill jabatan from salesList if available
                  const found = props.salesList.find(sl => sl.name === e.target.value);
                  if (found) upd('jabatanTtd', found.jabatan);
                }}>
                  {props.salesList.length > 0
                    ? props.salesList.map(sl => <option key={sl.name} value={sl.name}>{sl.name}</option>)
                    : OPT.sales.map(o => <option key={o}>{o}</option>)
                  }
                </select>
                {props.salesList.length === 0 && (
                  <div className="f-hint">Memuat data sales... atau belum ada di database.</div>
                )}
              </div>
              <Fsel label="Jabatan" value={s.jabatanTtd} options={OPT.jabatanTtd} onChange={v => upd('jabatanTtd', v)} />
              {(() => {
                const found = props.salesList.find(sl => sl.name === s.sales);
                return found?.signature_url
                  ? <div className="f-hint" style={{display:'flex',alignItems:'center',gap:6}}>
                      <img src={found.signature_url} alt="TTD" style={{height:32,objectFit:'contain',border:'1px solid #ddd',borderRadius:3,background:'#fff'}} />
                      <span style={{color:'#1E6B3A'}}>✓ Tanda tangan tersedia</span>
                    </div>
                  : <div className="f-hint" style={{color:'#B8860B'}}>Belum ada gambar tanda tangan. Tambahkan di Master Data → Data Sales.</div>;
              })()}
            </>
          : <>
              <Ftxt label="Nama direktur" value={s.direktur} onChange={v => upd('direktur', v)} />
              <Ftxt label="Rekening pembayaran" value={s.rekening} onChange={v => upd('rekening', v)} />
            </>
        }
      </Grp>
    </div>
  );
}

// ── Price Table ──────────────────────────────────────────────
function PriceTable({ items, setItemField, modeHarga, pilihDesain, setPilihDesain, liveDesain, finishing, onFinishing, catatan, onCatatan }:
  { items: KatalogItem[]; setItemField: (i: number, k: keyof KatalogItem, v: unknown) => void; modeHarga: ModeHarga;
    pilihDesain: DesainPilihan; setPilihDesain: (p: DesainPilihan) => void;
    liveDesain: Record<string, DesainOption[]>; finishing: string; onFinishing: (v: string) => void;
    catatan: Record<string,string>; onCatatan: (k: string, v: string) => void }) {
  const q = modeHarga === 'satuan';
  let lastKel = '';
  // Pilih desain + finishing struktur ditampilkan langsung di bawah baris
  // Struktur (S1g/S1h). Kalau dokumen tak punya baris itu, jatuh ke baris
  // Pekerjaan Sipil terakhir. Anchor-nya baris S1*, bukan `kel === 'SIPIL'`
  // terakhir — karena S2/S2a/S2b (Elektrikal) ada DI BAWAH S1g/S1h, jadi
  // "SIPIL terakhir" akan menaruh panel ini terpisah dari barisnya.
  let lastSipil = -1;
  items.forEach((it, i) => { if (it.kel === 'SIPIL') lastSipil = i; });
  let lastS1 = -1;
  items.forEach((it, i) => { if (it.par === 'S1') lastS1 = i; });
  const anchorRow = lastS1 >= 0 ? lastS1 : lastSipil;
  const adaStruktur = items.some(i => (i.id === 'S1g' || i.id === 'S1h') && i.on);
  const listStruktur = (liveDesain['struktur'] || DESAIN['struktur'] || []);
  const ketStruktur = ketDesain('struktur', pilihDesain, liveDesain);
  const selStruktur = pilihDesain.struktur;
  const strukturPick = (
    <tr className="struktur-pick">
      <td></td>
      <td colSpan={q ? 5 : 4}>
        {adaStruktur ? (
          <div className="spk-grid">
            <div className="spk-field">
              <label className="f-label">Desain struktur</label>
              <select className="f-ctrl" value={selStruktur} onChange={e => setPilihDesain({ ...pilihDesain, struktur: e.target.value })}>
                <option value="">Pilih desain…</option>
                {listStruktur.map(o => <option key={o.kode} value={o.kode}>{o.label ?? o.nama}</option>)}
              </select>
            </div>
            <div className="spk-field">
              <label className="f-label">Finishing struktur</label>
              <select className="f-ctrl" value={finishing} onChange={e => onFinishing(e.target.value)}>
                <option value="">— Belum dipilih —</option>
                {OPT.finishingStruktur.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {ketStruktur && <div className="spk-ket">Warna: {ketStruktur}</div>}
            <div className="spk-field" style={{gridColumn:'1 / -1'}}>
              <label className="f-label">Keterangan modifikasi (opsional)</label>
              <input className="f-ctrl note-inp" type="text"
                placeholder="Mis. handle diganti silver, kaca extra clear"
                value={catatan['struktur'] || ''}
                onChange={e => onCatatan('struktur', e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="f-hint">Pilih <b>Struktur Steel</b> atau <b>Struktur Aluminium</b> di atas untuk mengatur desain &amp; finishing struktur.</div>
        )}
      </td>
    </tr>
  );
  return (
    <table className="ptbl">
      <thead>
        <tr>
          <th style={{width:24}}></th>
          <th>Item Pekerjaan</th>
          {q && <th style={{width:44}}>Qty</th>}
          <th style={{width:78}}>Pengadaan</th>
          <th style={{width:78}}>Pemasangan</th>
          <th style={{width:46}}>Include</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, idx) => {
          const kelHeader = it.kel !== lastKel ? (lastKel = it.kel, null) : null;
          const d = it.inc;
          return (
            <Fragment key={it.id}>
              {kelHeader}
              <tr className={(it.par ? 'sub-row ' : '') + (it.on ? '' : 'off-row')}>
                <td className="tc"><input type="checkbox" checked={it.on} onChange={e => setItemField(idx,'on',e.target.checked)} /></td>
                <td dangerouslySetInnerHTML={{__html: it.nama}} />
                {q && <td><input type="number" min={0} value={it.qty} disabled={d} onChange={e => setItemField(idx,'qty',e.target.value)} /></td>}
                <td><input type="number" min={0} value={it.hp} disabled={d} onChange={e => setItemField(idx,'hp',e.target.value)} /></td>
                <td><input type="number" min={0} value={it.hi} disabled={d} onChange={e => setItemField(idx,'hi',e.target.value)} /></td>
                <td className="tc"><input type="checkbox" checked={it.inc} onChange={e => setItemField(idx,'inc',e.target.checked)} /></td>
              </tr>
              {idx === anchorRow && strukturPick}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Termin Panel ─────────────────────────────────────────────
function TerminPanel({ items, termin, tabTermin, setTabTermin, modeHarga, addT, delT, setT }:
  { items: KatalogItem[]; termin: Record<string,TerminItem[]>; tabTermin: string; setTabTermin: (t:string)=>void;
    modeHarga: ModeHarga; addT: (k:string)=>void; delT: (k:string,i:number)=>void; setT: (k:string,i:number,f:'p'|'s',v:unknown)=>void }) {
  const aktif = kelAktif(items);
  const kel = tabTermin;
  const dasar = totalKel(items, kel, modeHarga);
  const tot = sumTermin(termin, kel);
  return (
    <>
      <div className="chip-bar">
        {aktif.map(k => (
          <button key={k} className={'chip'+(tabTermin===k?' chip-on':'')} onClick={() => setTabTermin(k)}>
            {KEL_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="tblk">
        <div className="tblk-title" dangerouslySetInnerHTML={{__html: KEL_LABEL[kel]+' — dasar '+rupiah(dasar)}} />
        {(termin[kel]||[]).map((t, i) => (
          <div key={i} className="trow">
            <input type="number" min={0} value={t.p} onChange={e => setT(kel,i,'p',e.target.value)} />
            <select value={t.s} onChange={e => setT(kel,i,'s',e.target.value)}>
              {(SYARAT[kel]||[]).map(o => <option key={o}>{o}</option>)}
            </select>
            <input type="text" value={ribu(dasar*num(t.p)/100)} readOnly tabIndex={-1} />
            <button className="del-btn" onClick={() => delT(kel,i)}>×</button>
          </div>
        ))}
        <button className="mini-btn" onClick={() => addT(kel)}>+ Tambah termin</button>
        <div className="sum-line">
          <span>Total persentase</span>
          <b className={tot===100?'ok-text':'bad-text'}>{tot}%</b>
        </div>
      </div>
    </>
  );
}

// ── Preview Panel ────────────────────────────────────────────
function PreviewPanel({ mode, s, items, termin, modeHarga, pilihDesain, liveDesain, salesList, mobileVisible }:
  { mode: Mode; s: S; items: KatalogItem[]; termin: Record<string,TerminItem[]>; modeHarga: ModeHarga; pilihDesain: DesainPilihan; liveDesain: Record<string, DesainOption[]>; salesList: SalesListItem[]; mobileVisible: boolean }) {
  const selectedSales = salesList.find(sl => sl.name === s.sales);
  const html = mode === 'SPH'
    ? pageSPH(s, items, termin, modeHarga, pilihDesain, liveDesain, selectedSales?.signature_url ?? undefined)
    : pageSPK(s, items, termin, modeHarga, pilihDesain, liveDesain);

  // Compute scale so 794px-wide A4 page fits within the mobile viewport
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function computeScale() {
      if (window.innerWidth < 768) {
        // 210mm at 96dpi ≈ 794px. Target: viewport width minus 16px margin.
        const s = Math.min(1, (window.innerWidth - 16) / 794);
        setScale(s);
      } else {
        setScale(1);
      }
    }
    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, []);

  // Natural height of all pages: SPH ~5 pages, SPK ~12 pages at 297mm each.
  // We measure via a rough estimate: count <div class="page"> occurrences.
  const pageCount = (html.match(/class="page/g) || []).length || 1;
  // 297mm at 96dpi ≈ 1123px per page
  const naturalH = pageCount * 1123;

  return (
    <div className="preview-panel" style={{display: mobileVisible ? undefined : 'none'}} data-mobile-visible={mobileVisible}>
      <div className="plabel no-print">Pratinjau {mode} — A4</div>
      <div
        className="preview-scaler"
        style={scale < 1 ? {
          ['--preview-scale' as any]: scale,
          ['--preview-natural-h' as any]: `${naturalH}px`,
        } : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── Top Bar ─────────────────────────────────────────────────
function TopBar({ mode, fullName, onBack, onSignOut, onPrint, onSave, saving, onFinalize, finalizing, mobileTab, setMobileTab }:
  { mode:Mode; fullName:string|null;
    onBack:()=>void; onSignOut:()=>void; onPrint:()=>void;
    onSave:()=>void; saving:boolean;
    onFinalize:()=>void; finalizing:boolean;
    mobileTab:'form'|'preview'; setMobileTab:(t:'form'|'preview')=>void; }) {
  return (
    <div className="topbar-app no-print" style={{
      position:'sticky', top:0, zIndex:60, background:'var(--brown)', color:'#fff',
      borderBottom:'3px solid var(--orange)', flexShrink:0,
    }}>
      {/* Main row: back + logo + mode tabs + desktop actions */}
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'0 12px', height:52}}>
        <button onClick={onBack} style={{background:'none',border:0,color:'#E8DCD3',cursor:'pointer',fontSize:20,lineHeight:1,padding:'0 4px',flexShrink:0}}>‹</button>
        <img src="/BELIFT-Logo-White.webp" alt="Belift" style={{height:23,width:'auto',display:'block',flexShrink:0}} />
        {/* Current mode label — no tab switching */}
        <div className="topbar-mode-tabs" style={{display:'flex',gap:2}}>
          <span style={{
            color:'#fff', padding:'8px 14px',
            fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:16, letterSpacing:'.08em',
            borderBottom:'3px solid var(--orange)', marginBottom:-3, whiteSpace:'nowrap',
          }}>{mode === 'SPH' ? 'SPH · Penawaran' : 'SPK · Kontrak'}</span>
        </div>
        {/* Desktop: action buttons — hidden on mobile via CSS */}
        <div className="desktop-topbar-actions" style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          {fullName && <span style={{fontSize:12,opacity:.7}}>{fullName}</span>}
          <button onClick={onSave} disabled={saving} style={{border:'1px solid rgba(255,255,255,.35)',background:'none',color:'#fff',padding:'7px 13px',borderRadius:3,cursor:'pointer',fontWeight:500,fontSize:13,opacity:saving?0.6:1}}>{saving?'Menyimpan…':'Simpan'}</button>
          <button onClick={onFinalize} disabled={finalizing} style={{border:'1px solid #4ade80',background:'rgba(74,222,128,.15)',color:'#4ade80',padding:'7px 13px',borderRadius:3,cursor:'pointer',fontWeight:600,fontSize:13,opacity:finalizing?0.6:1}}>{finalizing?'Memfinalisasi…':'✓ Finalisasi'}</button>
          <button onClick={onPrint} style={{background:'var(--orange)',border:'1px solid var(--orange)',color:'#fff',padding:'7px 13px',borderRadius:3,cursor:'pointer',fontWeight:500,fontSize:13}}>Cetak / Simpan PDF</button>
          <button onClick={onSignOut} style={{border:'1px solid rgba(255,255,255,.35)',background:'none',color:'#fff',padding:'7px 13px',borderRadius:3,cursor:'pointer',fontSize:13}}>Keluar</button>
        </div>
        {/* Mobile: action buttons row (right side) — hidden on desktop via CSS */}
        <div className="mobile-actions" style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}>
          <button onClick={onSave} disabled={saving} title={saving ? 'Menyimpan…' : 'Simpan'} style={{
            border:'1px solid rgba(255,255,255,.45)',background:'none',color:'#fff',
            padding:'7px 9px',borderRadius:3,cursor:'pointer',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',
            opacity:saving?0.6:1,
          }}>
            {saving
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            }
          </button>
          <button onClick={onPrint} title="Cetak / Simpan PDF" style={{
            background:'var(--orange)',border:'1px solid var(--orange)',color:'#fff',
            padding:'7px 9px',borderRadius:3,cursor:'pointer',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </button>
          <button onClick={onSignOut} title="Keluar" style={{
            border:'1px solid rgba(255,255,255,.35)',background:'none',color:'#E8DCD3',
            padding:'7px 9px',borderRadius:3,cursor:'pointer',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* Mobile second row: SPH/SPK mode tabs + Form/Preview switcher */}
      <div className="mobile-tabs" style={{display:'none', alignItems:'center', justifyContent:'space-between', padding:'0 12px 8px', gap:8}}>
        {/* Current mode label — no tab switching */}
        <span style={{
          color:'#fff', padding:'5px 14px',
          fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:14, letterSpacing:'.06em',
          border:'1px solid rgba(255,255,255,.35)', borderRadius:4,
        }}>{mode === 'SPH' ? 'SPH · Penawaran' : 'SPK · Kontrak'}</span>
        {/* Form/Preview tab switcher */}
        <div style={{display:'flex',border:'1px solid rgba(255,255,255,.35)',borderRadius:4,overflow:'hidden'}}>
          {(['form','preview'] as const).map(t => (
            <button key={t} onClick={() => setMobileTab(t)} style={{
              background: mobileTab===t ? 'var(--orange)' : 'none',
              border:0, color:'#fff', padding:'5px 12px', cursor:'pointer',
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:13, letterSpacing:'.04em',
            }}>{t==='form'?'Form':'Preview'}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
