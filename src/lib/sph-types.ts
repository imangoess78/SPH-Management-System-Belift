export interface SPHItem {
  id: string;
  name: string;
  checked: boolean;
  qty: number;
  hargaPengadaan: number;
  hargaPemasangan: number;
  isInclude: boolean;
  children?: SPHItem[];
}

export interface SPHSpec {
  key: string;
  label: string;
  value: string;
}

export interface SPHPaymentTerm {
  id: string;
  percentage: number;
  condition: string;
}

export interface SPHDesignSelection {
  category: string;
  designItemId: string;
  designName: string;
  designSku: string;
  designImageUrl: string | null;
}

export interface SPH {
  id: string;
  nomorSPH: string;
  tanggal: string;
  kepada: string;
  namaPIC: string;
  alamatProyek: string;
  perihal: string;
  jenisLift: string;
  kapasitas: number;
  floors: number;
  stops: number;
  doors: number;
  waktuPelaksanaan: string;
  items: SPHItem[];
  specs: SPHSpec[];
  terms: {
    masaBerlaku: string;
    garansiSparepart: string;
    garansiMesin: string;
    maintenance: string;
    excludes: string[];
  };
  payments: SPHPaymentTerm[];
  designs: Record<string, SPHDesignSelection>;
  includePPN: boolean;
  status: 'draft' | 'final';
  createdAt: string;
  updatedAt: string;
}

export const JENIS_LIFT = [
  'Homelift', 'Passenger Lift', 'Bed Lift', 'Freight Lift', 'Car Lift', 'Dumbwaiter'
];

export const KAPASITAS_LIFT = [250, 300, 400, 450, 630, 800, 1000, 1250, 1350, 1600, 1800, 2000];

export const PAYMENT_CONDITIONS = [
  'Setelah Kontrak Ditandatangani',
  'Setelah Barang Siap Dikirim',
  'Setelah BL Keluar',
  'Setelah Barang Sampai Gudang',
  'Setelah Material On Site',
  'Setelah Mekanikal Selesai',
  'Setelah Elektrikal Selesai',
  'Setelah BAST',
  'Setelah Retensi',
];

export const DEFAULT_ITEMS: SPHItem[] = [
  { id: '1', name: 'Pengadaan Lift', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: false },
  { id: '2', name: 'Pengiriman Lift', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: false },
  { id: '3', name: 'Instalasi', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: false },
  { id: '4', name: 'Pekerjaan Sipil', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: false, children: [
    { id: '4a', name: 'Pembuatan Pit', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: true },
    { id: '4b', name: 'Struktur Beton/Baja', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: true },
    { id: '4c', name: 'Arsitektural Opening Pintu', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: true },
    { id: '4d', name: 'Control Panel / Jamb Pintu', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: true },
    { id: '4e', name: 'Sirkulasi Udara', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: true },
    { id: '4f', name: 'Finishing Sill', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: true },
  ]},
  { id: '5', name: 'Elektrikal/Kelistrikan', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: false, children: [
    { id: '5a', name: 'Daya Listrik & Sub Panel', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: true },
    { id: '5b', name: 'Grounding', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: true },
  ]},
  { id: '6', name: 'Gudang Peralatan Lift', checked: true, qty: 1, hargaPengadaan: 0, hargaPemasangan: 0, isInclude: false },
];

export const DEFAULT_SPECS: SPHSpec[] = [
  { key: 'type', label: 'Type', value: 'Machine Roomless (MRL)' },
  { key: 'capacity', label: 'Loading Capacity', value: '' },
  { key: 'speed', label: 'Speed', value: '1.0 m/s' },
  { key: 'stops', label: 'Stops/Floors/Doors', value: '' },
  { key: 'floorName', label: 'Floor Name', value: '' },
  { key: 'baseFloor', label: 'Base Floor', value: '1F' },
  { key: 'tractionPower', label: 'Traction Power', value: '' },
  { key: 'powerSupply', label: 'Power Supply', value: '3 Phase' },
  { key: 'shaftSize', label: 'Shaft Size', value: '' },
  { key: 'floorHeight', label: 'Floor Height', value: '' },
  { key: 'overhead', label: 'Overhead', value: '' },
  { key: 'pitDepth', label: 'Pit Depth', value: '' },
  { key: 'doorType', label: 'Door Opening Type', value: 'Center Opening' },
  { key: 'cabinSize', label: 'Cabin Size', value: '' },
  { key: 'cabinDecor', label: 'Cabin Decoration', value: 'Stainless Steel Hairline' },
  { key: 'handrail', label: 'Handrail', value: 'Yes' },
  { key: 'floorMaterial', label: 'Floor Material', value: 'PVC / Granite' },
  { key: 'cop', label: 'COP', value: 'Standard' },
  { key: 'lop', label: 'LOP', value: 'Standard' },
  { key: 'buttonType', label: 'Button COP & LOP', value: 'Braille Button' },
];
