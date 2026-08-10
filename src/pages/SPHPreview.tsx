import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
import { loadSPHById, formatCurrency, formatDate, calculateItemTotal } from '@/lib/sph-utils';
import { SPH } from '@/lib/sph-types';
import { useState, useEffect, Fragment } from 'react';
import { pageSPH, pageSPK } from '@/lib/sph-generator';

// CSS for generator A4 pages rendered inside the preview
const GEN_CSS = `
:root{--orange:#D95103;--burnt:#A63F04;--brown:#592203;--ink:#2B1B10;--line:#DFD8D1;--muted:#7A6E66}
*{box-sizing:border-box}
body{margin:0;padding:16px 0 24px;background:#F0EDE9;font-family:'Barlow',system-ui,sans-serif}
@import url('https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@400;500;600&display=swap');
/* .page-wrap is injected by JS — centres each scaled page */
.page-wrap{width:100%;overflow:hidden;display:flex;justify-content:center}
.page{width:210mm;min-height:297mm;background:#fff;box-shadow:0 2px 18px rgba(89,34,3,.16);
  padding:18mm 17mm 16mm;position:relative;overflow:hidden;font-size:10.5pt;line-height:1.5;
  font-family:'Barlow',sans-serif;flex-shrink:0;transform-origin:top center}
.page.cont{padding-top:22mm}
.page::before{content:"";position:absolute;left:0;top:0;width:34mm;height:24mm;background:#D95103;border-bottom-right-radius:9mm}
.page::after{content:"";position:absolute;left:6mm;top:0;width:26mm;height:20mm;border:.7pt solid #fff;border-top:0;border-bottom-right-radius:8mm}
.pgnum{position:absolute;left:17mm;bottom:9mm;font-size:9pt;color:#7A6E66}
.paraf{position:absolute;right:17mm;bottom:9mm;font-size:8pt;color:#7A6E66}
.lethead{display:flex;justify-content:space-between;align-items:flex-start;margin-left:36mm;gap:10mm}
.doctype{font-family:'Barlow Condensed',sans-serif;font-size:34pt;color:#A63F04;letter-spacing:.02em;line-height:1;margin-top:14mm}
.co{text-align:right;font-size:8.5pt;color:#4A3A2E;line-height:1.45;margin-top:2mm}
.co .mark{font-family:'Barlow Condensed',sans-serif;font-size:26pt;font-weight:700;color:#D95103}
.co .mark i{font-style:normal;color:#D95103}
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
.ol{margin:0;padding-left:6mm}.ol li{margin-bottom:2.6mm}
.ul{margin:1mm 0 3mm;padding-left:6mm}.ul li{margin-bottom:1.4mm}
.dgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm 5mm;margin-top:5mm}
.dcard{text-align:center}
.dcard .box{height:44mm;border:.6pt solid #DFD8D1;border-radius:2mm;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#FBF9F7}
.dcard .box img{max-width:100%;max-height:100%;object-fit:contain}
.dcard .box .ph{font-size:8pt;color:#B5AAA1;padding:4mm;line-height:1.4}
.dcard .cap{font-size:8.5pt;margin-top:1.5mm;font-style:italic}
.dcard .cap b{font-style:normal;display:block;font-size:9pt}
.sign{display:flex;justify-content:space-between;margin-top:10mm;text-align:center;font-size:10pt}
.sign>div{width:74mm}
.sigbox{position:relative;height:30mm;margin-top:2mm}
.sigbox img.cap{position:absolute;left:50%;top:50%;transform:translate(-58%,-50%) rotate(-8deg);height:26mm;opacity:.85}
.sigbox img.ttd{position:absolute;left:50%;top:50%;transform:translate(-42%,-50%);height:20mm}
.sig-nm{font-weight:700;border-top:.6pt solid #2B1B10;padding-top:1.5mm;display:inline-block;min-width:52mm}
.rt{text-align:right}
h4{font-size:10.5pt;margin:5mm 0 1.6mm;font-weight:700}
@media print{body{padding:0;background:#fff}.page{box-shadow:none;margin:0;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}}
`;

// Script injected into iframe: wraps each .page in a centering .page-wrap div,
// then scales the .page using top-center origin so it stays horizontally centred
// on any viewport width including mobile (no manual margin math needed).
const SCALE_SCRIPT = `
<script>
(function(){
  function wrapPages(){
    document.querySelectorAll('.page').forEach(function(p){
      if(p.parentElement&&p.parentElement.classList.contains('page-wrap'))return;
      var w=document.createElement('div');
      w.className='page-wrap';
      p.parentNode.insertBefore(w,p);
      w.appendChild(p);
    });
  }
  function scalePages(){
    var pages=document.querySelectorAll('.page-wrap .page');
    if(!pages.length){wrapPages();pages=document.querySelectorAll('.page-wrap .page');}
    if(!pages.length)return;
    var vw=window.innerWidth;
    var pageW=pages[0].offsetWidth||794;
    var scale=vw/pageW;
    if(scale>=1)scale=1;
    pages.forEach(function(p){
      // Scale from top-center: the .page-wrap flex centres the page, so no
      // manual marginLeft is needed — scaling keeps it centred automatically.
      p.style.transformOrigin='top center';
      p.style.transform='scale('+scale+')';
      p.style.marginLeft='';
      var ph=p.offsetHeight||1122;
      p.parentElement.style.height=(ph*scale)+'px';
      p.parentElement.style.marginBottom='8px';
    });
  }
  // Run immediately (script is at end of body so DOM exists)
  wrapPages();
  // Defer scale until layout is complete
  requestAnimationFrame(function(){
    requestAnimationFrame(scalePages);
  });
  window.addEventListener('resize',scalePages);
  if(document.fonts)document.fonts.ready.then(scalePages);
})();
</script>
`;

// ── Generator preview renderer ──────────────────────────────
function GeneratorPreview({ html, mode }: { html: string; mode: string }) {
  const navigate = useNavigate();

  function handlePrint() {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Pop-up diblokir. Izinkan pop-up untuk mencetak.'); return; }
    win.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Belift</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>${GEN_CSS}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1 no-print">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-base font-bold text-foreground flex-1 truncate">Preview {mode}</h1>
        <Button onClick={handlePrint} size="sm" className="gap-1.5 shrink-0 text-xs px-3">
          <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cetak / </span>PDF
        </Button>
      </div>
      {/* Render A4 pages inside a scoped iframe so styles don't bleed */}
      <iframe
        title="preview"
        style={{ width: '100%', height: 'calc(100vh - 72px)', border: 'none', background: '#F0EDE9' }}
        srcDoc={`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>${GEN_CSS}</style></head><body>${html}${SCALE_SCRIPT}</body></html>`}
      />
    </div>
  );
}

// ── Legacy preview (old SPHForm format) ─────────────────────
function LegacyPreview({ sph }: { sph: SPH }) {
  const navigate = useNavigate();
  const totals = calculateItemTotal({
    items: sph.items,
    includePPN: sph.includePPN !== false,
    priceMode: sph.priceMode || 'harga_satuan',
    lumpSumTotal: sph.lumpSumTotal || 0,
  });
  const isLumpSum = sph.priceMode === 'lump_sum';
  const checkedItems = (sph.items as any[]).filter((i: any) => i.checked);
  const selectedDesigns = Object.values(sph.designs || {}) as any[];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 no-print px-1">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-base font-bold text-foreground flex-1 truncate">Preview SPH</h1>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 shrink-0 text-xs px-3">
          <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cetak / </span>PDF
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-3 md:p-8 max-w-4xl mx-auto text-sm print:shadow-none print:border-none print:p-0" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4 border-b-2 border-primary pb-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-primary font-sans leading-tight">PT. BELIFT AMANAH INDONESIA</h2>
              <p className="text-xs text-muted-foreground">Pengadaan & Pemasangan Lift</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            <p className="font-semibold text-foreground">{sph.nomorSPH}</p>
            <p>{formatDate(sph.tanggal)}</p>
          </div>
        </div>

        <h3 className="text-center text-sm font-bold text-foreground mb-4 uppercase tracking-wide font-sans">SURAT PENAWARAN HARGA</h3>

        <div className="mb-4 text-xs space-y-0.5">
          <p>Kepada Yth,</p>
          <p className="font-semibold">{sph.kepada}</p>
          {sph.namaPIC && <p>Up. {sph.namaPIC}</p>}
          {sph.alamatProyek && <p>{sph.alamatProyek}</p>}
        </div>

        <p className="mb-4 text-xs">Perihal: <span className="font-semibold">{sph.perihal}</span></p>

        <p className="mb-4 text-xs">
          Dengan hormat, bersama ini kami mengajukan penawaran harga untuk pengadaan dan pemasangan{' '}
          <span className="font-semibold">{sph.jenisLift}</span> dengan kapasitas{' '}
          <span className="font-semibold">{sph.kapasitas} Kg</span>, {sph.floors} lantai / {sph.stops} stop / {sph.doors} pintu, sebagai berikut:
        </p>

        {/* Pricing Table */}
        <div className="mb-4">
          <h4 className="font-bold text-xs mb-2 font-sans uppercase tracking-wide">A. RINCIAN HARGA</h4>
          {isLumpSum ? (
            <>
              {/* Lump sum — simple list, no wide table needed */}
              <div className="border border-border rounded text-xs overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto] bg-primary text-primary-foreground font-semibold">
                  <span className="px-2 py-1.5 border-r border-primary-foreground/20">No</span>
                  <span className="px-2 py-1.5 border-r border-primary-foreground/20">Item Pekerjaan</span>
                  <span className="px-2 py-1.5 text-center">Qty</span>
                </div>
                {checkedItems.map((item, idx) => (
                  <Fragment key={item.id}>
                    <div className="grid grid-cols-[auto_1fr_auto] border-t border-border">
                      <span className="px-2 py-1.5 border-r border-border">{idx + 1}</span>
                      <span className="px-2 py-1.5 font-medium border-r border-border">{item.name}</span>
                      <span className="px-2 py-1.5 text-center">{item.qty}</span>
                    </div>
                    {item.children?.filter((c: any) => c.checked).map((child: any) => (
                      <div key={child.id} className="grid grid-cols-[auto_1fr_auto] border-t border-border text-muted-foreground">
                        <span className="px-2 py-1.5 border-r border-border"></span>
                        <span className="px-2 py-1.5 pl-5 border-r border-border">• {child.name}</span>
                        <span className="px-2 py-1.5 text-center">{child.qty}</span>
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>
              <div className="text-right text-xs space-y-0.5 mt-2">
                <p><span className="font-semibold">Subtotal (Lump Sum): </span>{formatCurrency(totals.subtotal)}</p>
                {sph.includePPN !== false && <p><span className="font-semibold">PPN 11%: </span>{formatCurrency(totals.ppn)}</p>}
                <p className="font-bold text-primary">Grand Total: {formatCurrency(totals.grandTotal)}</p>
              </div>
            </>
          ) : (
            <>
              {/* Mobile: card per item */}
              <div className="sm:hidden space-y-2">
                {checkedItems.map((item, idx) => (
                  <Fragment key={item.id}>
                    <div className="border border-border rounded p-2 text-xs">
                      <div className="flex justify-between gap-2 mb-1">
                        <span className="font-semibold">{idx + 1}. {item.name} <span className="text-muted-foreground font-normal">×{item.qty}</span></span>
                        <span className="font-bold text-primary shrink-0">
                          {item.isInclude ? 'Include' : formatCurrency((item.hargaPengadaan + item.hargaPemasangan) * item.qty)}
                        </span>
                      </div>
                      {!item.isInclude && (
                        <div className="text-muted-foreground text-[10px] flex gap-3">
                          <span>Pengadaan: {formatCurrency(item.hargaPengadaan)}</span>
                          <span>Pasang: {formatCurrency(item.hargaPemasangan)}</span>
                        </div>
                      )}
                      {item.children?.filter((c: any) => c.checked).map((child: any) => (
                        <div key={child.id} className="mt-1 pl-3 border-l-2 border-border text-muted-foreground text-[10px]">
                          <span>↳ {child.name} ×{child.qty}</span>
                          {!child.isInclude && <span className="ml-2">{formatCurrency((child.hargaPengadaan + child.hargaPemasangan) * child.qty)}</span>}
                        </div>
                      ))}
                    </div>
                  </Fragment>
                ))}
                <div className="border border-border rounded p-2 text-xs space-y-0.5 text-right">
                  <p>Subtotal: <strong>{formatCurrency(totals.subtotal)}</strong></p>
                  {sph.includePPN !== false && <p>PPN 11%: <strong>{formatCurrency(totals.ppn)}</strong></p>}
                  <p className="font-bold text-primary">Grand Total: {formatCurrency(totals.grandTotal)}</p>
                </div>
              </div>
              {/* Desktop: full table */}
              <table className="hidden sm:table w-full border text-xs">
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
                      {item.children?.filter((c: any) => c.checked).map((child: any) => (
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
            </>
          )}
        </div>

        {/* Specs — two-column grid on mobile, no forced min-width */}
        <div className="mb-4">
          <h4 className="font-bold text-xs mb-2 font-sans uppercase tracking-wide">B. SPESIFIKASI TEKNIS</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 border border-border rounded text-xs overflow-hidden">
            {(sph.specs as any[]).filter((s: any) => s.value && s.key !== '__docstate').map((spec: any) => (
              <div key={spec.key} className="flex border-b border-border last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                <span className="bg-muted/30 font-medium px-2 py-1.5 w-32 shrink-0 border-r border-border">{spec.label}</span>
                <span className="px-2 py-1.5 flex-1">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Designs — card grid on mobile */}
        {selectedDesigns.length > 0 && (
          <div className="mb-4">
            <h4 className="font-bold text-xs mb-2 font-sans uppercase tracking-wide">E. OPSI DESAIN</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectedDesigns.map((d: any) => (
                <div key={d.designItemId} className="border border-border rounded p-2 text-xs flex flex-col gap-1">
                  {d.designImageUrl ? (
                    <img src={d.designImageUrl} alt={d.designName} className="w-full h-16 object-cover rounded border" />
                  ) : (
                    <div className="w-full h-16 bg-muted/20 rounded border flex items-center justify-center text-muted-foreground text-[10px]">Tidak ada gambar</div>
                  )}
                  <span className="font-medium leading-tight">{d.designName}</span>
                  <span className="text-muted-foreground text-[10px]">{d.category}{d.designSku ? ` · ${d.designSku}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terms */}
        <div className="mb-4">
          <h4 className="font-bold text-xs mb-2 font-sans uppercase tracking-wide">C. SYARAT & KONDISI</h4>
          <ul className="text-xs space-y-1 list-disc pl-4">
            <li>Masa berlaku penawaran: <strong>{sph.terms.masaBerlaku}</strong></li>
            <li>Garansi sparepart: <strong>{sph.terms.garansiSparepart}</strong></li>
            <li>Garansi mesin: <strong>{sph.terms.garansiMesin}</strong></li>
            <li>Free maintenance: <strong>{sph.terms.maintenance}</strong></li>
            <li>Waktu pelaksanaan: <strong>{sph.waktuPelaksanaan}</strong></li>
          </ul>
        </div>

        {/* Payment — card list on mobile, table on larger screens */}
        <div className="mb-6">
          <h4 className="font-bold text-xs mb-2 font-sans uppercase tracking-wide">D. SISTEM PEMBAYARAN</h4>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {sph.payments.map((term, idx) => (
              <div key={term.id} className="border border-border rounded p-2 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold">Termin {idx + 1} — {term.percentage}%</span>
                  <span className="font-bold text-primary">{formatCurrency(totals.grandTotal * term.percentage / 100)}</span>
                </div>
                <p className="text-muted-foreground">{term.condition}</p>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <table className="hidden sm:table w-full border text-xs">
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
        <div className="text-xs">
          <p className="mb-6">Demikian surat penawaran harga ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>
          <div className="flex justify-end">
            <div className="text-center">
              <p>Hormat kami,</p>
              <p className="font-bold mt-1">PT. BELIFT AMANAH INDONESIA</p>
              <div className="mt-10">
                <p className="font-semibold">{sph.namaSales || '____________'}</p>
                <p className="text-[10px] text-muted-foreground">Sales</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function SPHPreview() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (id) {
        const raw = await loadSPHById(id);
        setData(raw);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="text-center py-20 text-muted-foreground text-sm">Memuat...</div>;
  if (!data)   return <div className="text-center py-20 text-muted-foreground">SPH tidak ditemukan</div>;

  // Detect generator document: loadSPHById already tries to parse __docstate.
  // If the returned object has a `mode` field (SPH/SPK) and `state` sub-object,
  // it came from the new generator — use GeneratorPreview.
  const isGenerator = (data.mode === 'SPH' || data.mode === 'SPK') && data.state;

  if (isGenerator) {
    // Try stored __html first (saved by handleSave after this fix was deployed)
    const rawSpecs: any[] = data.specs || [];
    const htmlSpec = rawSpecs.find((s: any) => s.key === '__html');
    let html: string = htmlSpec?.value || '';

    // Fallback: regenerate from __docstate when __html is missing (old saves)
    if (!html && data.state) {
      try {
        const st = data.state;
        const docMode: string = data.mode || 'SPH';
        // Normalise tampilTtd / tampilDesain — stored as string "true"/"false" or boolean
        const normState = {
          ...st,
          tampilTtd: st.tampilTtd === true || st.tampilTtd === 'true',
          tampilDesain: st.tampilDesain === true || st.tampilDesain === 'true',
        };
        const items = data.items || [];
        const termin = data.termin || {};
        const modeHarga = data.modeHarga || 'satuan';
        const pilihDesain = data.pilihDesain || { cabin:'',floor:'',ceiling:'',door:'',cop:'',lop:'',struktur:'',addon:'' };
        html = docMode === 'SPH'
          ? pageSPH(normState, items, termin, modeHarga, pilihDesain)
          : pageSPK(normState, items, termin, modeHarga, pilihDesain);
      } catch (e) {
        console.error('Regenerate HTML failed:', e);
      }
    }

    return <GeneratorPreview html={html} mode={String(data.mode || 'SPH')} />;
  }

  // Legacy format — must have items array and nomorSPH
  return <LegacyPreview sph={data as SPH} />;
}
