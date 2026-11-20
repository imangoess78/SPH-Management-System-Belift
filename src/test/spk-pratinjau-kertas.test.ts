import { describe, it, expect } from 'vitest';
import { cssPratinjau, cssCetak, labelPratinjau, normalCetak, DIMENSI_KERTAS } from '@/lib/spk-susun';

/**
 * Celah nyata yang pernah lolos: pengaturan kertas berubah ke A5, tetapi
 * pratinjau tetap 794px (A4) karena label dan CSS-nya hardcode. Tes ini
 * mengunci tiga jalur: pratinjau, dokumen cetak, dan label judul.
 */

describe('cssPratinjau — pratinjau harus mengikuti pilihan kertas', () => {
  it('A5 menyempitkan .page di pratinjau', () => {
    const css = cssPratinjau(normalCetak({ kertas: 'A5' }));
    expect(css).toContain('width:148mm');
    expect(css).toContain('min-height:210mm');
  });

  it('A4 tetap 210 × 297', () => {
    const css = cssPratinjau(normalCetak({ kertas: 'A4' }));
    expect(css).toContain('width:210mm');
    expect(css).toContain('min-height:297mm');
  });

  it('margin pengguna masuk sebagai padding pratinjau', () => {
    const css = cssPratinjau(normalCetak({ marginAtas: 25, marginBawah: 12, marginKiri: 30, marginKanan: 8 }));
    expect(css).toContain('padding:25mm 8mm 12mm 30mm');
  });

  it('memakai !important supaya menang atas .page global', () => {
    expect(cssPratinjau(normalCetak())).toContain('!important');
  });

  it('memilih .preview-scaler agar tidak mengganggu pratinjau lain', () => {
    expect(cssPratinjau(normalCetak())).toMatch(/^\.preview-scaler \.page\{/);
  });
});

describe('cssCetak — dokumen cetak memakai ukuran yang sama dengan pratinjau', () => {
  it('setiap ukuran kertas menghasilkan @page dan .page yang konsisten', () => {
    (['A4', 'A5', 'Letter', 'Legal'] as const).forEach(kertas => {
      const c = normalCetak({ kertas });
      const cetak = cssCetak(c);
      const pratinjau = cssPratinjau(c);
      const d = DIMENSI_KERTAS[kertas];
      expect(cetak, kertas).toContain('@page{size:' + kertas);
      // Lebar di cetak dan di pratinjau harus sama persis.
      expect(cetak).toContain('width:' + d.w + 'mm');
      expect(pratinjau).toContain('width:' + d.w + 'mm');
      expect(pratinjau).toContain('min-height:' + d.h + 'mm');
    });
  });
});

describe('labelPratinjau — tidak boleh lagi hardcode A4', () => {
  it('menyebut kertas & margin sebenarnya', () => {
    const label = labelPratinjau(normalCetak({ kertas: 'Legal', marginAtas: 20, marginBawah: 15, marginKiri: 25, marginKanan: 10 }));
    expect(label).toBe('Legal · margin 20/15/25/10 mm');
    expect(label).not.toContain('A4');
  });

  it('default tetap A4 dengan margin asli SPK', () => {
    expect(labelPratinjau(normalCetak())).toBe('A4 · margin 18/16/17/17 mm');
  });
});
