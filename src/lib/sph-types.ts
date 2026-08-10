// ============================================================
//  KATALOG ITEM PEKERJAAN
//  kel: PENGADAAN (SPK 1) · INSTALASI (SPK 2) · SIPIL (SPK 3)
//  inc:true → baris "Include", tidak menambah nilai
// ============================================================
export interface KatalogItem {
  id: string;
  kel: 'PENGADAAN' | 'INSTALASI' | 'SIPIL';
  nama: string;
  sat: string;
  on: boolean;
  inc: boolean;
  par?: string; // parent item id
  qty: number;
  hp: number;  // harga pengadaan
  hi: number;  // harga instalasi/pemasangan
}

export interface TerminItem {
  p: number;   // persentase
  s: string;   // syarat/milestone
}

export interface DesainPilihan {
  cabin: string;
  floor: string;
  ceiling: string;
  door: string;
  cop: string;
  lop: string;
  struktur: string;
  addon: string;
}

// Full document state — saved to Supabase
export interface DocState {
  id: string;
  mode: 'SPH' | 'SPK';

  // Nomor & tanggal
  noUrut: string;
  tanggal: string;
  kota: string;
  alamatKantor: string;
  formatNoSPK: 'standar' | 'lama';

  // Customer
  sapaan: string;
  namaCustomer: string;
  namaPerusahaan: string;
  nikCustomer: string;
  alamatCustomer: string;
  kotaProyek: string;

  // Unit lift & spesifikasi
  jenisLift: string;
  tipeKabin: string;
  kapasitas: string;
  penumpang: string;
  kecepatan: string;
  mpm: string;
  sfd: string;
  tipeMesin: string;
  traksi: string;
  dayaMesin: string;
  power: string;
  pintu: string;
  bukaanPintu: string;
  tinggiKabin: string;
  shaftSize: string;
  cabinSize: string;
  pitDepth: string;
  namaLantai: string;
  baseFloor: string;

  // Harga
  modeHarga: 'satuan' | 'lumpsum';
  items: KatalogItem[];

  // Termin
  termin: Record<string, TerminItem[]>;

  // Desain
  tampilDesain: boolean;
  pilihDesain: DesainPilihan;

  // Syarat & kondisi
  ppn: 'exclude' | 'include';
  masaBerlaku: string;
  freeMtn: string;
  garSpare: string;
  garMesin: string;
  waktuPengadaan: string;
  waktuInstalasi: string;

  // TTD & cap
  tampilTtd: boolean;
  sales: string;
  jabatanTtd: string;
  direktur: string;
  rekening: string;

  // Meta
  status: 'draft' | 'final';
  createdAt: string;
  updatedAt: string;
}

// ============================================================
//  KATALOG DEFAULT
// ============================================================
export const KATALOG_DEFAULT: Omit<KatalogItem, 'qty' | 'hp' | 'hi'>[] = [
  {id:"P1",  kel:"PENGADAAN", nama:"Pengadaan Lift",              sat:"Unit", on:true,  inc:false},
  {id:"P1a", kel:"PENGADAAN", nama:"Unit Elevator + Mesin",       sat:"Unit", on:true,  inc:true,  par:"P1"},
  {id:"P1b", kel:"PENGADAAN", nama:"ARD (Auto Rescue Device)",    sat:"Unit", on:true,  inc:true,  par:"P1"},
  {id:"P1c", kel:"PENGADAAN", nama:"Panel Kontrol",               sat:"Unit", on:true,  inc:true,  par:"P1"},
  {id:"P2",  kel:"PENGADAAN", nama:"Pengiriman Lift",             sat:"Ls",   on:true,  inc:false},
  {id:"P2a", kel:"PENGADAAN", nama:"Transport ke Lokasi Proyek",  sat:"Ls",   on:true,  inc:true,  par:"P2"},
  {id:"P2b", kel:"PENGADAAN", nama:"Bongkar Muat / MOS",          sat:"Ls",   on:true,  inc:true,  par:"P2"},
  {id:"P3",  kel:"PENGADAAN", nama:"Perijinan SLO",               sat:"Ls",   on:true,  inc:true},

  {id:"I1",  kel:"INSTALASI", nama:"Instalasi",                   sat:"Unit", on:true,  inc:false},
  {id:"I1a", kel:"INSTALASI", nama:"Mekanikal",                   sat:"Ls",   on:true,  inc:true,  par:"I1"},
  {id:"I1b", kel:"INSTALASI", nama:"Elektrikal",                  sat:"Ls",   on:true,  inc:true,  par:"I1"},
  {id:"I1c", kel:"INSTALASI", nama:"Struktur Steel",              sat:"Ls",   on:true,  inc:true,  par:"I1"},
  {id:"I2",  kel:"INSTALASI", nama:"Testing & Commissioning",     sat:"Ls",   on:true,  inc:true},
  {id:"I3",  kel:"INSTALASI", nama:"Mob - Demobilisasi",          sat:"Ls",   on:true,  inc:true},
  {id:"I4",  kel:"INSTALASI", nama:"Free Maintenance",            sat:"Ls",   on:true,  inc:true},

  {id:"S1",  kel:"SIPIL", nama:"Pekerjaan Sipil",                 sat:"Ls", on:false, inc:false},
  {id:"S1a", kel:"SIPIL", nama:"Pembuatan Pit",                   sat:"Ls", on:false, inc:true,  par:"S1"},
  {id:"S1b", kel:"SIPIL", nama:"Struktur Beton / Baja",           sat:"Ls", on:false, inc:true,  par:"S1"},
  {id:"S1c", kel:"SIPIL", nama:"Arsitektural Opening Pintu",      sat:"Ls", on:false, inc:true,  par:"S1"},
  {id:"S1d", kel:"SIPIL", nama:"Control Panel / Jamb Pintu",      sat:"Ls", on:false, inc:true,  par:"S1"},
  {id:"S1e", kel:"SIPIL", nama:"Sirkulasi Udara Ruang Mesin",     sat:"Ls", on:false, inc:true,  par:"S1"},
  {id:"S1f", kel:"SIPIL", nama:"Finishing Sill",                  sat:"Ls", on:false, inc:true,  par:"S1"},
  {id:"S2",  kel:"SIPIL", nama:"Elektrikal / Kelistrikan",        sat:"Ls", on:false, inc:false},
  {id:"S2a", kel:"SIPIL", nama:"Daya Listrik & Sub Panel",        sat:"Ls", on:false, inc:true,  par:"S2"},
  {id:"S2b", kel:"SIPIL", nama:"Grounding Khusus Lift",           sat:"Ls", on:false, inc:true,  par:"S2"},
];

export function makeDefaultItems(): KatalogItem[] {
  return KATALOG_DEFAULT.map(k => ({ ...k, qty: 1, hp: 0, hi: 0 }));
}

export const KEL_LABEL: Record<string, string> = {
  PENGADAAN: 'SPK 1 · Pengadaan Lift',
  INSTALASI: 'SPK 2 · Instalasi & Maintenance',
  SIPIL:     'SPK 3 · Pekerjaan Sipil',
};

export const SYARAT: Record<string, string[]> = {
  PENGADAAN: ['Setelah Kontrak Ditandatangani','Setelah Barang Siap Dikirim','Setelah BL Keluar',
              'Setelah Barang Sampai Gudang','Setelah Material On Site','Setelah BAST','Setelah Retensi'],
  INSTALASI: ['Setelah Kontrak Ditandatangani','Setelah Material On Site','Setelah Mekanikal Selesai',
              'Setelah Elektrikal Selesai','Setelah Testing dan Commissioning','Setelah BAST','Setelah Retensi'],
  SIPIL:     ['Setelah Kontrak Ditandatangani','Setelah Pekerjaan Pit Selesai','Setelah Struktur Selesai',
              'Setelah Finishing Sipil Selesai','Setelah Serah Terima Pekerjaan Sipil','Setelah Retensi'],
};

export const TERMIN_AWAL: Record<string, TerminItem[]> = {
  PENGADAAN: [
    {p:30, s:'Setelah Kontrak Ditandatangani'},
    {p:30, s:'Setelah BL Keluar'},
    {p:30, s:'Setelah Material On Site'},
    {p:10, s:'Setelah BAST'},
  ],
  INSTALASI: [
    {p:50, s:'Setelah Material On Site'},
    {p:40, s:'Setelah Mekanikal Selesai'},
    {p:10, s:'Setelah BAST'},
  ],
  SIPIL: [
    {p:40, s:'Setelah Kontrak Ditandatangani'},
    {p:40, s:'Setelah Struktur Selesai'},
    {p:20, s:'Setelah Serah Terima Pekerjaan Sipil'},
  ],
};

// ============================================================
//  DROPDOWN OPTIONS
// ============================================================
export const OPT = {
  jenisLift:    ['Home Lift','Passenger Lift','Elevator','Dumbwaiter','Cargo Lift','Hydraulic Cargo Lift','Car Lift','Bed Lift','Platform Lift'],
  tipeKabin:    ['Premium Cabin','Premium Stainless','Premium Pintu Kaca','Premium Pintu Stainless','Premium Throught Door',
                 'Full Stainless','Stainless Pintu Kaca','Stainless Custom','Full Panoramic','Semi Panoramic',
                 'Panoramic Pintu Stainless','Luxury','Luxury Pintu Kaca','Luxury Pintu Stainless'],
  kapasitas:    ['100 Kg','320 Kg','400 Kg','450 Kg','550 Kg','630 Kg','800 Kg','1000 Kg','1300 Kg','1350 Kg','1600 Kg','3000 Kg'],
  penumpang:    ['1-2 orang','3-4 orang','3-5 orang','5-6 orang','6-8 orang','8-10 orang','Barang (non-penumpang)'],
  kecepatan:    ['0,3 m/s','0,4 m/s','0,5 m/s','1,0 m/s'],
  mpm:          ['18 mpm','24 mpm','30 mpm','60 mpm'],
  sfd:          ['2/2/2','3/3/3','4/4/4','5/5/5','6/6/6','3/3/4','4/4/5'],
  tipeMesin:    ['MRL Lift','MR Lift (dengan ruang mesin)','Hydraulic'],
  traksi:       ['2:1','1:1'],
  dayaMesin:    ['1,2 kw','1,5 kw','2,2 kw','3,7 kw','5,5 kw'],
  power:        ['380V 50HZ (3 phase)','220V 50HZ (1 phase)','Custom'],
  pintu:        ['Center Opening','Side Opening','Two Panel Side Opening','Swing Door'],
  bukaanPintu:  ['700 mm','750 mm','800 mm','900 mm','1000 mm','Custom'],
  tinggiKabin:  ['2100 mm','2200 mm','2300 mm'],
  sales:        ['Imam Solikhin','Firman','Dewo','Arif','Jihad','Izzu'],
  jabatanTtd:   ['Sales','Sales Manager','Direktur Operasional','Direktur'],
  alamatKantor: [
    'Komplek Pelni, Jalan Gama Setia Raya No. B3/8, Bakti Jaya, Kec. Sukmajaya, Kota Depok',
    'Central Duta Graha, Jl. Raya Pd. Duta No.6A, Tugu, Cimanggis, Kota Depok',
  ],
  masaBerlaku:  ['2 Minggu','3 Minggu','1 Bulan','2 Bulan'],
  freeMtn:      ['3 (tiga) bulan','6 (enam) bulan','12 (dua belas) bulan'],
  garSpare:     ['1 (satu) tahun','2 (dua) tahun','3 (tiga) tahun'],
  garMesin:     ['3 (tiga) tahun','5 (lima) tahun','10 (sepuluh) tahun'],
};

// ============================================================
//  DESAIN DATABASE (static — images filled later)
// ============================================================
export interface DesainOption {
  kode: string;
  nama: string;   // clean name — used in printed document
  label?: string; // display label with SKU — used in form dropdowns only
  img: string;
}

// ── Placeholder images — ganti dengan foto produk asli Belift ──────────────────
// Format: URL publik atau data URI base64 PNG/JPG
// Sementara memakai foto generik dari Unsplash (300×200, landscape)
const _PH = (id: string) => `https://images.unsplash.com/photo-${id}?w=400&h=300&fit=crop&auto=format`;

export const DESAIN: Record<string, DesainOption[]> = {
  cabin: [
    {kode:'CB-PSTL', nama:'Premium Stainless Hairline', img:_PH('1558618666-fcd25c85cd64')},
    {kode:'CB-FSTL', nama:'Full Stainless Mirror',      img:_PH('1556742049-0cfed4f6a45d')},
    {kode:'CB-PANO', nama:'Panoramic Kaca Tempered',    img:_PH('1486325212027-8081e485255e')},
    {kode:'CB-LUX',  nama:'Luxury Gold Hairline',       img:_PH('1600607687939-add6609c1a63')},
  ],
  floor: [
    {kode:'FL-MIV', nama:'Marmer Ivory', img:_PH('1549497538-10861eed5a75')},
    {kode:'FL-MBK', nama:'Marmer Black', img:_PH('1502005229762-cf1b2da7c5d6')},
    {kode:'FL-PVC', nama:'PVC',          img:_PH('1616594039964-ae485021aacd')},
    {kode:'FL-GRN', nama:'Granit',       img:_PH('1600566752355-35792bedcfea')},
  ],
  ceiling: [
    {kode:'CL-LED', nama:'LED Panel Stainless', img:_PH('1565814329452-e1efa11ef5b1')},
    {kode:'CL-SPT', nama:'Spotlight Downlight',  img:_PH('1600210492493-0fe640394a71')},
  ],
  door: [
    {kode:'DR-NRW', nama:'Narrow Frame Door',   img:_PH('1558618666-fcd25c85cd64')},
    {kode:'DR-STL', nama:'Stainless Hairline',  img:_PH('1556742049-0cfed4f6a45d')},
    {kode:'DR-KCA', nama:'Pintu Kaca Tempered', img:_PH('1486325212027-8081e485255e')},
  ],
  cop: [
    {kode:'COP-BLK', nama:'COP Black Panel LCD', img:_PH('1565814329452-e1efa11ef5b1')},
    {kode:'COP-STL', nama:'COP Stainless',        img:_PH('1556742049-0cfed4f6a45d')},
  ],
  lop: [
    {kode:'LOP-BLK', nama:'LOP Black Panel', img:_PH('1565814329452-e1efa11ef5b1')},
    {kode:'LOP-STL', nama:'LOP Stainless',   img:_PH('1558618666-fcd25c85cd64')},
  ],
  struktur: [
    {kode:'ST-ALU', nama:'Aluminium Alloy + Kaca Tempered', img:_PH('1486325212027-8081e485255e')},
    {kode:'ST-STL', nama:'Structure Steel (Hollow)',         img:_PH('1502005229762-cf1b2da7c5d6')},
  ],
  addon: [
    {kode:'AD-ARD',  nama:'ARD (Auto Rescue Device)', img:_PH('1565814329452-e1efa11ef5b1')},
    {kode:'AD-HND',  nama:'Handrail Stainless',        img:_PH('1558618666-fcd25c85cd64')},
    {kode:'AD-CCTV', nama:'CCTV Kabin',                img:_PH('1600566752355-35792bedcfea')},
    {kode:'AD-INT',  nama:'Interphone',                img:_PH('1600210492493-0fe640394a71')},
  ],
};

export const DESAIN_LABEL: Record<string, string> = {
  cabin:'Cabin', floor:'Floor', ceiling:'Ceiling', door:'Door',
  cop:'COP', lop:'LOP', struktur:'Struktur', addon:'Add On',
};

// ============================================================
//  ASSET SIGNATURES (fill base64 or URL when ready)
// ============================================================
export const ASET = {
  capPerusahaan: '',
  ttd: {
    'Adhie Kurnia':  '',
    'Imam Solikhin': '',
    'Firman':        '',
    'Dewo':          '',
    'Arif':          '',
    'Jihad':         '',
    'Izzu':          '',
  } as Record<string, string>,
};

// ============================================================
//  LOCALE HELPERS
// ============================================================
export const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
export const BULAN_ID = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export const HARI_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

// Legacy — kept so SPHList still compiles
export interface SPH {
  id: string;
  nomorSPH: string;
  tanggal: string;
  kepada: string;
  namaPIC: string;
  namaSales: string;
  alamatProyek: string;
  perihal: string;
  jenisLift: string;
  kapasitas: number;
  floors: number;
  stops: number;
  doors: number;
  waktuPelaksanaan: string;
  items: unknown[];
  specs: unknown[];
  priceMode: 'lump_sum' | 'harga_satuan';
  lumpSumTotal: number;
  terms: { masaBerlaku: string; garansiSparepart: string; garansiMesin: string; maintenance: string; excludes: string[] };
  payments: { id: string; percentage: number; condition: string }[];
  designs: Record<string, unknown>;
  includePPN: boolean;
  status: 'draft' | 'final';
  createdAt: string;
  updatedAt: string;
}
export const JENIS_LIFT = OPT.jenisLift;
export const KAPASITAS_LIFT = [250, 300, 400, 450, 630, 800, 1000, 1250, 1350, 1600, 1800, 2000];
export const PAYMENT_CONDITIONS = SYARAT.PENGADAAN;
export interface SPHItem { id: string; name: string; checked: boolean; qty: number; hargaPengadaan: number; hargaPemasangan: number; isInclude: boolean; children?: SPHItem[] }
export interface SPHSpec { key: string; label: string; value: string }
export interface SPHPaymentTerm { id: string; percentage: number; condition: string }
export interface SPHDesignSelection { category: string; designItemId: string; designName: string; designSku: string; designImageUrl: string | null }
export const DEFAULT_ITEMS: SPHItem[] = [];
export const DEFAULT_SPECS: SPHSpec[] = [];
