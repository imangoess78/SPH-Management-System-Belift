import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
import { loadSPHById, formatCurrency, formatDate, calculateItemTotal } from '@/lib/sph-utils';
import { SPH } from '@/lib/sph-types';
import { useRef, useState, useEffect, Fragment } from 'react';

export default function SPHPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [sph, setSph] = useState<SPH | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (id) {
        const data = await loadSPHById(id);
        setSph(data);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="text-center py-20 text-muted-foreground text-sm">Memuat...</div>;
  if (!sph) return <div className="text-center py-20 text-muted-foreground">SPH tidak ditemukan</div>;

  const totals = calculateItemTotal({
    items: sph.items,
    includePPN: sph.includePPN !== false,
    priceMode: sph.priceMode || 'harga_satuan',
    lumpSumTotal: sph.lumpSumTotal || 0,
  });
  const isLumpSum = sph.priceMode === 'lump_sum';
  const checkedItems = sph.items.filter(i => i.checked);
  const selectedDesigns = Object.values(sph.designs || {});
  const handlePrint = () => window.print();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 no-print px-1">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold text-foreground flex-1">Preview SPH</h1>
        <Button variant="outline" onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" /> Cetak / PDF</Button>
      </div>

      <div ref={printRef} className="bg-card rounded-xl border shadow-sm p-3 md:p-10 max-w-4xl mx-auto text-sm print:shadow-none print:border-none print:p-0" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8 border-b-2 border-primary pb-6">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
            <div>
              <h2 className="text-lg font-bold text-primary font-sans">PT. BELIFT AMANAH INDONESIA</h2>
              <p className="text-xs text-muted-foreground">Pengadaan & Pemasangan Lift</p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">{sph.nomorSPH}</p>
            <p>{formatDate(sph.tanggal)}</p>
          </div>
        </div>

        <h3 className="text-center text-base font-bold text-foreground mb-6 uppercase tracking-wide font-sans">SURAT PENAWARAN HARGA</h3>

        <div className="mb-6 text-sm space-y-1">
          <p>Kepada Yth,</p>
          <p className="font-semibold">{sph.kepada}</p>
          {sph.namaPIC && <p>Up. {sph.namaPIC}</p>}
          {sph.alamatProyek && <p>{sph.alamatProyek}</p>}
        </div>

        <p className="mb-6 text-sm">Perihal: <span className="font-semibold">{sph.perihal}</span></p>

        <p className="mb-4 text-sm">
          Dengan hormat, bersama ini kami mengajukan penawaran harga untuk pengadaan dan pemasangan{' '}
          <span className="font-semibold">{sph.jenisLift}</span> dengan kapasitas{' '}
          <span className="font-semibold">{sph.kapasitas} Kg</span>, {sph.floors} lantai / {sph.stops} stop / {sph.doors} pintu, sebagai berikut:
        </p>

        {/* Pricing Table */}
        <div className="mb-6 overflow-x-auto">
          <h4 className="font-bold text-sm mb-2 font-sans">A. RINCIAN HARGA</h4>
          {isLumpSum ? (
            <>
              <table className="w-full min-w-[520px] border text-xs">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="border p-2 text-left">No</th>
                    <th className="border p-2 text-left">Item Pekerjaan</th>
                    <th className="border p-2 text-center">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {checkedItems.map((item, idx) => (
                    <Fragment key={item.id}>
                      <tr>
                        <td className="border p-2">{idx + 1}</td>
                        <td className="border p-2 font-medium">{item.name}</td>
                        <td className="border p-2 text-center">{item.qty}</td>
                      </tr>
                      {item.children?.filter(c => c.checked).map(child => (
                        <tr key={child.id} className="text-muted-foreground">
                          <td className="border p-2"></td>
                          <td className="border p-2 pl-6">• {child.name}</td>
                          <td className="border p-2 text-center">{child.qty}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              <div className="text-right text-xs space-y-1 mt-3">
                <p><span className="font-semibold">Subtotal (Lump Sum): </span>{formatCurrency(totals.subtotal)}</p>
                {sph.includePPN !== false && <p><span className="font-semibold">PPN 11%: </span>{formatCurrency(totals.ppn)}</p>}
                <p className="font-bold text-primary text-sm">Grand Total: {formatCurrency(totals.grandTotal)}</p>
              </div>
            </>
          ) : (
            <table className="w-full min-w-[620px] border text-xs">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="border p-2 text-left">No</th>
                  <th className="border p-2 text-left">Item Pekerjaan</th>
                  <th className="border p-2 text-center">Qty</th>
                  <th className="border p-2 text-right">Harga Pengadaan</th>
                  <th className="border p-2 text-right">Harga Pemasangan</th>
                  <th className="border p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {checkedItems.map((item, idx) => (
                  <Fragment key={item.id}>
                    <tr>
                      <td className="border p-2">{idx + 1}</td>
                      <td className="border p-2 font-medium">{item.name}</td>
                      <td className="border p-2 text-center">{item.qty}</td>
                      <td className="border p-2 text-right">{item.isInclude ? 'Include' : formatCurrency(item.hargaPengadaan)}</td>
                      <td className="border p-2 text-right">{item.isInclude ? 'Include' : formatCurrency(item.hargaPemasangan)}</td>
                      <td className="border p-2 text-right">{item.isInclude ? 'Include' : formatCurrency((item.hargaPengadaan + item.hargaPemasangan) * item.qty)}</td>
                    </tr>
                    {item.children?.filter(c => c.checked).map(child => (
                      <tr key={child.id} className="text-muted-foreground">
                        <td className="border p-2"></td>
                        <td className="border p-2 pl-6">• {child.name}</td>
                        <td className="border p-2 text-center">{child.qty}</td>
                        <td className="border p-2 text-right">{child.isInclude ? 'Include' : formatCurrency(child.hargaPengadaan)}</td>
                        <td className="border p-2 text-right">{child.isInclude ? 'Include' : formatCurrency(child.hargaPemasangan)}</td>
                        <td className="border p-2 text-right">{child.isInclude ? 'Include' : formatCurrency((child.hargaPengadaan + child.hargaPemasangan) * child.qty)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold bg-muted/50">
                  <td colSpan={5} className="border p-2 text-right">SUBTOTAL</td>
                  <td className="border p-2 text-right">{formatCurrency(totals.subtotal)}</td>
                </tr>
                {sph.includePPN !== false && (
                  <tr className="bg-muted/50">
                    <td colSpan={5} className="border p-2 text-right">PPN 11%</td>
                    <td className="border p-2 text-right">{formatCurrency(totals.ppn)}</td>
                  </tr>
                )}
                <tr className="font-bold bg-primary/5">
                  <td colSpan={5} className="border p-2 text-right">GRAND TOTAL</td>
                  <td className="border p-2 text-right text-primary">{formatCurrency(totals.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Specs */}
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2 font-sans">B. SPESIFIKASI TEKNIS</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border text-xs">
              <tbody>
                {sph.specs.filter(s => s.value).map(spec => (
                  <tr key={spec.key}>
                    <td className="border p-2 bg-muted/30 w-44 font-medium">{spec.label}</td>
                    <td className="border p-2">{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Designs */}
        {selectedDesigns.length > 0 && (
          <div className="mb-8 overflow-x-auto">
            <h4 className="font-bold text-sm mb-2 font-sans">E. OPSI DESAIN</h4>
            <table className="w-full min-w-[520px] border text-xs">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="border p-2 text-left">Kategori</th>
                  <th className="border p-2 text-left">Desain</th>
                  <th className="border p-2 text-left">SKU</th>
                  <th className="border p-2 text-center">Preview</th>
                </tr>
              </thead>
              <tbody>
                {selectedDesigns.map(d => (
                  <tr key={d.designItemId}>
                    <td className="border p-2 font-medium">{d.category}</td>
                    <td className="border p-2">{d.designName}</td>
                    <td className="border p-2">{d.designSku || '-'}</td>
                    <td className="border p-2 text-center">
                      {d.designImageUrl ? (
                        <img
                          src={d.designImageUrl}
                          alt={d.designName}
                          className="inline-block w-16 h-16 object-cover rounded border"
                        />
                      ) : (
                        <span className="text-muted-foreground">Tidak ada gambar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Terms */}
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2 font-sans">C. SYARAT & KONDISI</h4>
          <ul className="text-xs space-y-1 list-disc pl-5">
            <li>Masa berlaku penawaran: <strong>{sph.terms.masaBerlaku}</strong></li>
            <li>Garansi sparepart: <strong>{sph.terms.garansiSparepart}</strong></li>
            <li>Garansi mesin: <strong>{sph.terms.garansiMesin}</strong></li>
            <li>Free maintenance: <strong>{sph.terms.maintenance}</strong></li>
            <li>Waktu pelaksanaan: <strong>{sph.waktuPelaksanaan}</strong></li>
          </ul>
        </div>

        {/* Payment */}
        <div className="mb-8 overflow-x-auto">
          <h4 className="font-bold text-sm mb-2 font-sans">D. SISTEM PEMBAYARAN</h4>
          <table className="w-full min-w-[520px] border text-xs">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="border p-2 text-left">Termin</th>
                <th className="border p-2 text-center">%</th>
                <th className="border p-2 text-right">Jumlah</th>
                <th className="border p-2 text-left">Kondisi</th>
              </tr>
            </thead>
            <tbody>
              {sph.payments.map((term, idx) => (
                <tr key={term.id}>
                  <td className="border p-2">Termin {idx + 1}</td>
                  <td className="border p-2 text-center">{term.percentage}%</td>
                  <td className="border p-2 text-right">{formatCurrency(totals.grandTotal * term.percentage / 100)}</td>
                  <td className="border p-2">{term.condition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="text-sm">
          <p className="mb-8">Demikian surat penawaran harga ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>
          <div className="flex justify-end">
            <div className="text-center">
              <p>Hormat kami,</p>
              <p className="font-bold mt-1">PT. BELIFT AMANAH INDONESIA</p>
              <div className="mt-14">
                <p className="font-semibold">{sph.namaSales || '____________'}</p>
                <p className="text-xs text-muted-foreground">Sales</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
