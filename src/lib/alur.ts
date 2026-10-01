// ============================================================
//  RINGKASAN ALUR PROYEK — data untuk Dasbor & Laporan
//
//  Dasbor dan Laporan awalnya hanya menghitung SPH dan SPK. Setelah alur
//  kerja bertambah (Survey Sales, Final Survey, PO Pabrik), keduanya jadi
//  buta terhadap tiga tahap terakhir: Laporan bisa bilang "SPH 0" padahal
//  ada proyek yang sudah jalan sampai PO.
//
//  Modul ini menyatukan pembacaan alur itu di satu tempat supaya Dasbor dan
//  Laporan tidak menghitung sendiri-sendiri lalu hasilnya berbeda.
//
//  Baris dibangun dari crm_leads — bukan dari tabel proyek — supaya funnel
//  ikut menghitung lead yang belum sempat jadi proyek. Kalau dibangun dari
//  proyek, tahap "Lead Baru" akan selalu sama dengan tahap terakhir dan
//  funnel-nya menyesatkan.
// ============================================================

import { loadDocumentList } from '@/lib/sph-utils';
import { surveyApi, poApi, type BarisSurvey } from '@/lib/survey-api';
import type { PoRow, ProyekRow } from '@/lib/survey-types';

export interface AngkaAlur {
  leadTotal: number;
  leadHot: number;
  leadWarm: number;
  leadCold: number;
  leadGugur: number;

  /** Survey Sales — kunjungan awal ke lokasi. */
  surveySales: number;
  surveySalesSelesai: number;

  /** SPH (penawaran) dan SPK (kontrak). */
  sph: number;
  sphFinal: number;
  sphDraft: number;
  spk: number;
  spkFinal: number;

  /** Final Survey — pengukuran ulang sebelum masuk pabrik. */
  finalSurvey: number;
  finalTerkunci: number;
  finalDraft: number;

  /** PO Pabrik — pesanan ke pabrik. */
  poTotal: number;
  poTerbit: number;
  poDraft: number;
  /** Proyek yang datanya berubah setelah Final Survey dikunci. */
  poPerluTinjau: number;
  jmlRevisi: number;

  /** Jumlah proyek berjalan (lead yang sudah punya kode proyek). */
  proyek: number;
}

/** Satu baris = satu lead, dengan penanda tahap mana saja yang sudah dilewati. */
export interface BarisAlur {
  id_lead: string;
  kode_lead: string;
  kode_proyek: string;
  nama_prospek: string;
  kota: string;
  sales: string;
  kualifikasi: string;
  statusLead: string;
  /** YYYY-MM-DD — tanggal lead masuk, dipakai untuk saringan periode. */
  tanggal: string;
  /** 0..4 — indeks tahap terjauh yang sudah tercapai. */
  tahap: number;
  tahapNama: string;
  surveySales: boolean;
  sph: boolean;
  spk: boolean;
  finalSurvey: boolean;
  finalTerkunci: boolean;
  po: boolean;
  poTerbit: boolean;
  revTerakhir: number;
  /** Data PO berubah setelah Final Survey dikunci — perlu ditinjau. */
  revisiSetelahFinal: boolean;
  surveyor: string;
}

export const TAHAP = [
  { nama: 'Lead Baru', pendek: 'Lead' },
  { nama: 'Survey Sales', pendek: 'Survey' },
  { nama: 'SPH / SPK', pendek: 'SPH/SPK' },
  { nama: 'Final Survey', pendek: 'Final' },
  { nama: 'PO Pabrik', pendek: 'PO' },
] as const;

export interface BahanAlur {
  angka: AngkaAlur;
  baris: BarisAlur[];
}

export interface MasukanAlur {
  dokumen: Record<string, unknown>[];
  proyek: ProyekRow[];
  survey: BarisSurvey[];
  po: (PoRow & { jml_revisi?: number })[];
  lead: Record<string, unknown>[];
}

const KOSONG: AngkaAlur = {
  leadTotal: 0, leadHot: 0, leadWarm: 0, leadCold: 0, leadGugur: 0,
  surveySales: 0, surveySalesSelesai: 0,
  sph: 0, sphFinal: 0, sphDraft: 0, spk: 0, spkFinal: 0,
  finalSurvey: 0, finalTerkunci: 0, finalDraft: 0,
  poTotal: 0, poTerbit: 0, poDraft: 0, poPerluTinjau: 0, jmlRevisi: 0,
  proyek: 0,
};

interface HasilKlasifikasi { jenis: 'SPH' | 'SPK' | ''; final: boolean }

/**
 * Klasifikasi dokumen SPH/SPK. Nomor surat adalah sumber utama; __docstate
 * dipakai sebagai cadangan dan untuk membaca status terbaru.
 */
export function klasifikasiDokumen(doc: Record<string, unknown>): HasilKlasifikasi {
  const nomor = String(doc.nomor_sph || doc.nomorSPH || '').toUpperCase();
  let mode: 'SPH' | 'SPK' | '' = '';
  let final = ['final', 'disetujui', 'approved'].includes(String(doc.status || '').toLowerCase());

  const ds = (doc.specs as { key?: string; value?: string }[] | undefined)?.find(s => s?.key === '__docstate');
  if (ds?.value) {
    try {
      const parsed = JSON.parse(ds.value);
      if (parsed?.mode === 'SPH' || parsed?.mode === 'SPK') mode = parsed.mode;
      if (String(parsed?.status || '').toLowerCase() === 'final') final = true;
    } catch { /* pakai nomor surat */ }
  }

  if (nomor.includes('/SPK/')) return { jenis: 'SPK', final };
  if (nomor.includes('/SPH/')) return { jenis: 'SPH', final };
  return { jenis: mode, final };
}

/** Waktu ke milidetik; toleran terhadap spasi (SQLite) maupun ISO. */
function waktu(nilai?: string | null): number {
  if (!nilai) return 0;
  const t = new Date(String(nilai).replace(' ', 'T')).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** YYYY-MM-DD dari berbagai bentuk tanggal. */
function tanggalSaja(nilai?: string | null): string {
  if (!nilai) return '';
  return String(nilai).slice(0, 10);
}

/** Pisahkan dari muatBahanAlur supaya bisa diuji tanpa jaringan. */
export function susunBahan(m: MasukanAlur): BahanAlur {
  const angka: AngkaAlur = { ...KOSONG };

  // ── SPH / SPK ──
  const sphPerLead = new Map<string, Record<string, unknown>[]>();
  const spkPerLead = new Map<string, Record<string, unknown>[]>();
  for (const d of m.dokumen || []) {
    const k = klasifikasiDokumen(d);
    const idLead = String(d.id_lead || d.idLead || '');
    if (k.jenis === 'SPH') {
      angka.sph++;
      if (k.final) angka.sphFinal++;
      if (idLead) sphPerLead.set(idLead, [...(sphPerLead.get(idLead) || []), d]);
    } else if (k.jenis === 'SPK') {
      angka.spk++;
      if (k.final) angka.spkFinal++;
      if (idLead) spkPerLead.set(idLead, [...(spkPerLead.get(idLead) || []), d]);
    }
  }
  angka.sphDraft = angka.sph - angka.sphFinal;

  // ── Survey (per lead) ──
  const surveyPerLead = new Map<string, BarisSurvey[]>();
  for (const s of m.survey || []) {
    surveyPerLead.set(s.id_lead, [...(surveyPerLead.get(s.id_lead) || []), s]);
    if (s.jenis === 'sales') {
      angka.surveySales++;
      if (String(s.status || '').toLowerCase() !== 'draft') angka.surveySalesSelesai++;
    } else if (s.jenis === 'final') {
      angka.finalSurvey++;
      if (s.terkunci) angka.finalTerkunci++;
    }
  }
  angka.finalDraft = angka.finalSurvey - angka.finalTerkunci;

  // ── PO (per lead) ──
  const poPerLead = new Map<string, (PoRow & { jml_revisi?: number })[]>();
  for (const p of m.po || []) {
    poPerLead.set(p.id_lead, [...(poPerLead.get(p.id_lead) || []), p]);
    angka.poTotal++;
    if (String(p.status || '').toLowerCase() === 'terbit') angka.poTerbit++;
    angka.jmlRevisi += Number(p.jml_revisi || 0);
  }
  angka.poDraft = angka.poTotal - angka.poTerbit;

  // ── Kode proyek per lead (dari tabel proyek) ──
  const proyekPerLead = new Map<string, ProyekRow>();
  for (const p of m.proyek || []) proyekPerLead.set(p.id_lead, p);
  angka.proyek = (m.proyek || []).length;

  // ── Baris per lead ──
  //
  // PENTING: daftar baris TIDAK boleh hanya bersumber dari `m.lead`.
  // Staf tidak punya izin `crm`, jadi `/api/crm?resource=leads` menolaknya dan
  // `m.lead` berisi kosong. Dulu itu membuat seluruh tabel "Rincian per Lead"
  // lenyap — dan yang lebih berbahaya, peringatan "proyek berubah setelah
  // Final Survey dikunci" tidak pernah muncul untuk staf, padahal justru staf
  // yang memproses revisi PO tersebut. Kegagalan izin menyamar sebagai
  // "tidak ada data".
  //
  // Karena itu baris disusun dari gabungan seluruh sumber yang berhasil dibaca:
  // lead, kode proyek, SPH/SPK, survey, dan PO. Kolom yang hanya ada di CRM
  // (kualifikasi HOT/WARM, status lead) tampil "—" bila lead-nya tidak terbaca
  // — jujur menyatakan tidak diketahui, bukan mengarang nilai.
  const leadPerId = new Map<string, Record<string, unknown>>();
  for (const l of m.lead || []) {
    const k = String(l.id || '');
    if (k) leadPerId.set(k, l);
  }
  const semuaId = new Set<string>(Array.from(leadPerId.keys()));
  for (const m2 of [sphPerLead, spkPerLead, surveyPerLead, poPerLead, proyekPerLead]) {
    for (const k of Array.from(m2.keys())) semuaId.add(k);
  }

  const baris: BarisAlur[] = Array.from(semuaId).map(idLead => {
    const l = leadPerId.get(idLead) || {};
    const svy = surveyPerLead.get(idLead) || [];
    const salesRow = svy.find(s => s.jenis === 'sales') || null;
    const finalRow = svy.find(s => s.jenis === 'final') || null;
    const sphLead = sphPerLead.get(idLead) || [];
    const spkLead = spkPerLead.get(idLead) || [];
    const poLead = poPerLead.get(idLead) || [];
    const poPertama = poLead[0] || null;
    const revTerakhir = poLead.reduce((a, x) => Math.max(a, Number(x.rev_terakhir || 0)), 0);
    const proyek = proyekPerLead.get(idLead);

    // Perubahan PO setelah Final Survey dikunci → perlu ditinjau
    const acuan = waktu(finalRow?.dikunci_pada || finalRow?.updated_at);
    const revisiSetelahFinal = !!finalRow?.terkunci && poLead.some(x => waktu(x.updated_at) > acuan);

    const punyaSphSpk = sphLead.length > 0 || spkLead.length > 0;

    let tahap = 0;
    if (salesRow) tahap = 1;
    if (punyaSphSpk) tahap = 2;
    if (finalRow) tahap = 3;
    if (poPertama) tahap = 4;

    return {
      id_lead: idLead,
      kode_lead: String(l.kode_lead || '—'),
      kode_proyek: String(l.kode_proyek || proyek?.kode_proyek || '—'),
      nama_prospek: String(l.nama_prospek || '—'),
      kota: String(l.kota || '—'),
      sales: String(l.sales || '—'),
      kualifikasi: String(l.kualifikasi || '—'),
      statusLead: String(l.status_terakhir || '—'),
      tanggal: tanggalSaja(l.waktu_masuk as string) || tanggalSaja(l.created_at as string),
      tahap,
      tahapNama: TAHAP[tahap]?.nama || '—',
      surveySales: !!salesRow,
      sph: sphLead.length > 0,
      spk: spkLead.length > 0,
      finalSurvey: !!finalRow,
      finalTerkunci: !!finalRow?.terkunci,
      po: !!poPertama,
      poTerbit: String(poPertama?.status || '').toLowerCase() === 'terbit',
      revTerakhir,
      revisiSetelahFinal,
      surveyor: String(finalRow?.surveyor || salesRow?.surveyor || '—'),
    };
  });

  angka.leadTotal = baris.length;
  for (const b of baris) {
    const k = b.kualifikasi.toUpperCase();
    if (k === 'HOT') angka.leadHot++;
    else if (k === 'WARM') angka.leadWarm++;
    else if (k === 'COLD') angka.leadCold++;
    if (b.statusLead.toLowerCase() === 'gugur') angka.leadGugur++;
  }
  angka.poPerluTinjau = baris.filter(b => b.revisiSetelahFinal).length;

  return { angka, baris };
}

/** Baca seluruh data alur. Tiap sumber gagal sendiri-sendiri. */
export async function muatBahanAlur(): Promise<BahanAlur> {
  // Kegagalan tiap sumber dicatat, bukan ditelan. Sebelumnya `.catch(() => [])`
  // membuat penolakan izin (403) tampak sama dengan "datanya kosong", sehingga
  // Dasbor menampilkan 0 tanpa ada yang tahu itu salah.
  const catat = (nama: string) => (e: unknown) => {
    console.error(`[Dasbor] gagal memuat ${nama}:`, e);
    return undefined as never;
  };
  const [dokumen, daftarProyek, daftarSurvey, daftarPo, lead] = await Promise.all([
    loadDocumentList().catch(catat('dokumen SPH/SPK')),
    surveyApi.proyek().catch(catat('proyek')),
    surveyApi.daftar().catch(catat('daftar survey')),
    poApi.daftar().catch(catat('daftar PO')),
    ambilLead().catch(catat('lead CRM')),
  ]);

  return susunBahan({
    dokumen: (dokumen || []) as unknown as Record<string, unknown>[],
    proyek: (daftarProyek?.data || []) as ProyekRow[],
    survey: (daftarSurvey?.data || []) as BarisSurvey[],
    po: (daftarPo?.data || []) as (PoRow & { jml_revisi?: number })[],
    lead: lead as Record<string, unknown>[],
  });
}

async function ambilLead(): Promise<Record<string, unknown>[]> {
  const r = await fetch('/api/crm?resource=leads', { headers: { Accept: 'application/json' } });
  if (!r.ok) {
    // Jangan telan galatnya. Dulu di sini hanya `return []`, sehingga penolakan
    // 403 tampak persis seperti "tidak ada lead": Dasbor menampilkan 0 dan
    // tidak ada satu pun petunjuk bahwa angkanya salah. Sekarang dicatat ke
    // konsol lengkap dengan status HTTP-nya.
    console.error(`[Dasbor] gagal memuat lead: HTTP ${r.status}`, await r.text().catch(() => ''));
    return [];
  }
  const j = await r.json();
  const data = j?.data;
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  // Server bisa mengirim { data: { data: [...] } }
  if (data && Array.isArray(data.data)) return data.data as Record<string, unknown>[];
  return Array.isArray(j) ? (j as Record<string, unknown>[]) : [];
}
