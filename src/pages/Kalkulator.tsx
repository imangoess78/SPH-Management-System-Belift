/* Halaman publik: Kalkulator per Komponen — Belift
 * Port dari kalkulator-belift-komponen.html (standalone).
 * Semua CSS di-scope di bawah .kalk-root + prefix --k- agar tidak membocorkan
 * gaya ke halaman lain (body/global app memakai Tailwind + shadcn).
 * Logika hitung() dipertahankan PERSIS seperti file asal.
 */
import { useEffect, useMemo, useState } from "react";
import "./kalkulator.css";

/* ===== Data dari kalkulator_belift.xlsx ===== */
const CABIN: Record<string, number> = {
  "Standard Silver HSS": 0,
  "Etched HSS": 460,
  "HSS Panoramic": 985,
  "HSS GOLD/BLACK TITANIUM": 758,
  "Alumunium Panoramic": 1402,
  "Panoramic with HSS GOLD/BLACK TITANIUM": 1212,
};

const DOOR: Record<string, number> = {
  "Standard HSS": 0,
  "Standard GOLD/BLACK TITANIUM": 91,
  "Glass HSS": 197,
  "Glass HSS GOLD/BLACK TITANIUM": 227,
  "Panoramic Alumunium Narrow": 258,
  "Panoramic Frameless": 265,
};

const LOKASI: Record<string, number> = {
  Jabodetabek: 0,
  "Jawa Barat": 15000000,
  "Jawa Tengah & Yogyakarta": 18000000,
  "Jawa Timur & Bali": 19000000,
  "Kota Besar Sumatera": 40000000,
  "Kota Besar Kalimantan": 50000000,
  "Kota Besar Sulawesi": 55000000,
  "Kota Kecil Indonesia Barat dan Tengah": 70000000,
  "Indonesia Timur": 90000000,
};

const YN = ["NO", "YES"];
const STD = ["Standard", "GOLD/BLACK TI"];
const FAKTOR = 1.145;
const TETAP = 7000000 + 25000000;

function unitDasar(kap: number, kec: number): number {
  if (kap === 450 && kec === 0.4) return 6350;
  if (kap === 450 && (kec === 0.6 || kec === 1)) return 6580;
  if (kap === 630 && kec === 0.4) return 6580;
  return 6810;
}

const KAPASITAS = [450, 630];
const KECEPATAN = [0.4, 0.6, 1];
const BUKAAN = ["Center Opening", "Side Opening"];
const LANTAI_KABIN = ["PVC", "Non-PVC (marmer/granit)"];
const SHAFT = ["None (by customer)", "Alumunium Shaft", "Steel Shaft"];
const DINDING = ["None (by customer)", "Include"];

interface State {
  c2: string; c3: string; c4: string; c5: string; c6: string; c7: string;
  c8: string; c9: string; c10: string; c11: string; c12: string; c13: string;
  c14: string; c15: string; c16: string; c17: string; c18: string; c19: string;
  c20: string; rate: string; ppn: string;
}

const INITIAL: State = {
  c2: "450", c3: "0.4", c4: "2",
  c5: "Standard Silver HSS", c6: "Standard HSS", c7: "Center Opening",
  c8: "PVC", c9: "None (by customer)", c10: "None (by customer)",
  c11: "20000", c12: "Standard", c13: "Standard",
  c14: "YES", c15: "NO", c16: "NO", c17: "NO", c18: "NO", c19: "NO",
  c20: "Jabodetabek", rate: "17730", ppn: "11",
};

const rp = (n: number) => Math.round(n).toLocaleString("id-ID");

/** Bangun <option> dari array nilai. */
function Options({ values }: { values: (string | number)[] }) {
  return (
    <>
      {values.map((v) => (
        <option key={String(v)} value={String(v)}>
          {String(v)}
        </option>
      ))}
    </>
  );
}

export default function Kalkulator() {
  const [s, setS] = useState<State>(INITIAL);
  const set = (k: keyof State) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    setS((p) => ({ ...p, [k]: e.target.value }));

  const num = (k: keyof State) => parseFloat(s[k]) || 0;

  /* Normalisasi jumlah lantai: min 2 (seperti f4.addEventListener("blur")) */
  const commitLantai = () => {
    const n = parseInt(s.c4, 10);
    const v = isNaN(n) || n < 2 ? "2" : String(n);
    if (v !== s.c4) setS((p) => ({ ...p, c4: v }));
  };

  const hasil = useMemo(() => {
    const kap = +s.c2;
    const kec = +s.c3;
    const lt = Math.max(2, parseInt(s.c4, 10) || 2);
    const tinggi = num("c11");
    const shaft = s.c9;
    const rate = num("rate") || 0;
    const adaShaft = shaft !== "None (by customer)";
    const outdoor = s.c18 === "YES";
    const IMP = rate * FAKTOR; // USD -> Rupiah termasuk faktor biaya masuk

    /* 1. Unit lift */
    const usd1 =
      unitDasar(kap, kec) +
      (lt - 2) * 450 +
      CABIN[s.c5] +
      DOOR[s.c6] * (lt + 1) +
      (s.c7 === "Side Opening" ? 220 + (lt - 2) * 50 : 0) +
      (s.c8 === "PVC" ? 0 : 250) +
      (s.c12 === "GOLD/BLACK TI" ? 152 : 0) +
      (s.c13 === "GOLD/BLACK TI" ? 23 * lt : 0);

    /* 2. Struktur & finishing */
    const usd2 =
      (shaft === "Alumunium Shaft" ? (tinggi / 1000) * 294
        : shaft === "Steel Shaft" ? (tinggi / 1000) * 175
        : 0) +
      (s.c10 === "Include" ? (tinggi / 1000) * (415 - 294) : 0) +
      (outdoor ? 305 * (lt - 1) : 0);
    const idr2 = outdoor ? lt * 1500000 : 0; // finishing outdoor

    /* 3. Instalasi lift, struktur, kaca */
    const idr3 =
      (lt === 2 ? 3 : lt) * 7500000 +
      (adaShaft ? lt * 1000000 : 0) +
      (adaShaft ? lt * 1000000 : 0);

    /* 4. Add-on lainnya */
    const usd4 =
      (s.c14 === "YES" ? 45 : 0) +
      (s.c15 === "YES" ? 220 : 0) +
      (s.c16 === "YES" ? 555 : 0) +
      (s.c17 === "YES" ? 230 : 0) +
      (s.c19 === "YES" ? 530 : 0);

    /* 5. Pengiriman & biaya tetap */
    const idr5 = (LOKASI[s.c20] ?? 0) + TETAP;

    const pembagi = adaShaft ? 0.8 : 0.75;
    const K_raw: [string, string, number][] = [
      ["Harga unit lift", "Mesin, kabin, pintu, COP & LOP", usd1 * IMP],
      [
        "Struktur & finishing",
        adaShaft
          ? shaft + (s.c10 === "Include" ? " + dinding kaca" : "")
          : "Shaft oleh pelanggan",
        usd2 * IMP + idr2,
      ],
      ["Instalasi lift, struktur & kaca", "Tenaga kerja pemasangan di lokasi", idr3],
      ["Add-on lainnya", "Handrail, IC card, AC, knob, stabilizer", usd4 * IMP],
      ["Pengiriman & biaya tetap", s.c20, idr5],
    ];
    const K: [string, string, number][] = K_raw.map(
      ([a, b, c]): [string, string, number] => [a, b, c / pembagi],
    );

    const jual = K.reduce((a, b) => a + b[2], 0);
    const t = num("ppn") / 100;
    const ppn = jual * t;
    const grand = jual + ppn;

    return { K, jual, ppn, grand, adaShaft };
  }, [s]);

  const { K, jual, ppn, grand, adaShaft } = hasil;

  useEffect(() => {
    document.title = "Kalkulator per Komponen — Belift";
  }, []);

  return (
    <div className="kalk-root">
      <div className="wrap">
        <header>
          <h1>Kalkulator per Komponen</h1>
          <div className="sub">Belift · harga jual dipecah 4 komponen</div>
        </header>

        <div className="grid">
          <div>
            <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
              <fieldset>
                <legend>Unit lift</legend>
                <div className="field">
                  <label htmlFor="c2">Kapasitas (kg)</label>
                  <select id="c2" value={s.c2} onChange={set("c2")}>
                    <Options values={KAPASITAS} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c3">Kecepatan (m/s)</label>
                  <select id="c3" value={s.c3} onChange={set("c3")}>
                    <Options values={KECEPATAN} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c4">Jumlah lantai</label>
                  <input
                    type="number" id="c4" min={2} step={1}
                    value={s.c4}
                    onChange={set("c4")}
                    onBlur={commitLantai}
                  />
                </div>
                <div className="field">
                  <label htmlFor="c5">Tipe kabin</label>
                  <select id="c5" value={s.c5} onChange={set("c5")}>
                    <Options values={Object.keys(CABIN)} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c6">Tipe pintu</label>
                  <select id="c6" value={s.c6} onChange={set("c6")}>
                    <Options values={Object.keys(DOOR)} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c7">Bukaan pintu</label>
                  <select id="c7" value={s.c7} onChange={set("c7")}>
                    <Options values={BUKAAN} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c8">Lantai kabin</label>
                  <select id="c8" value={s.c8} onChange={set("c8")}>
                    <Options values={LANTAI_KABIN} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c12">COP</label>
                  <select id="c12" value={s.c12} onChange={set("c12")}>
                    <Options values={STD} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c13">LOP</label>
                  <select id="c13" value={s.c13} onChange={set("c13")}>
                    <Options values={STD} />
                  </select>
                </div>
              </fieldset>

              <fieldset>
                <legend>Struktur &amp; finishing</legend>
                <div className="field">
                  <label htmlFor="c9">Shaft</label>
                  <select id="c9" value={s.c9} onChange={set("c9")}>
                    <Options values={SHAFT} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c10">Dinding kaca</label>
                  <select id="c10" value={s.c10} onChange={set("c10")}>
                    <Options values={DINDING} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c11">Total ketinggian (mm)</label>
                  <input type="number" id="c11" min={0} step={100} value={s.c11} onChange={set("c11")} />
                </div>
                <div className="field">
                  <label htmlFor="c18">Outdoor</label>
                  <select id="c18" value={s.c18} onChange={set("c18")}>
                    <Options values={YN} />
                  </select>
                </div>
              </fieldset>

              <fieldset>
                <legend>Add-on lainnya</legend>
                <div className="field">
                  <label htmlFor="c14">Handrail</label>
                  <select id="c14" value={s.c14} onChange={set("c14")}>
                    <Options values={YN} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c15">IC Card</label>
                  <select id="c15" value={s.c15} onChange={set("c15")}>
                    <Options values={YN} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c16">AC</label>
                  <select id="c16" value={s.c16} onChange={set("c16")}>
                    <Options values={YN} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c17">Knob</label>
                  <select id="c17" value={s.c17} onChange={set("c17")}>
                    <Options values={YN} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c19">Stabilizer</label>
                  <select id="c19" value={s.c19} onChange={set("c19")}>
                    <Options values={YN} />
                  </select>
                </div>
              </fieldset>

              <fieldset>
                <legend>Lokasi, kurs &amp; PPN</legend>
                <div className="field">
                  <label htmlFor="c20">Lokasi pemasangan</label>
                  <select id="c20" value={s.c20} onChange={set("c20")}>
                    <Options values={Object.keys(LOKASI)} />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="rate">Kurs USD/IDR</label>
                  <input type="number" id="rate" min={1} step={1} value={s.rate} onChange={set("rate")} />
                </div>
                <div className="field">
                  <label htmlFor="ppn">Tarif PPN efektif (%)</label>
                  <input type="number" id="ppn" min={0} step={0.1} value={s.ppn} onChange={set("ppn")} />
                </div>
                <p className="hint">
                  Margin dibagi proporsional ke tiap komponen, jadi jumlahnya tetap sama dengan harga jual total.
                </p>
              </fieldset>
            </form>
          </div>

          <div className="rail">
            <div className="car">
              <div className="cap">Harga jual sebelum PPN</div>
              <div className="price">
                <span className="rp">Rp</span>
                <span id="out">{rp(jual)}</span>
              </div>
              <div className="ln">
                <span>PPN <span id="ppnLbl">{num("ppn").toLocaleString("id-ID")}%</span></span>
                <b>Rp <span id="ppnOut">{rp(ppn)}</span></b>
              </div>
              <div className="ln">
                <span>Total tagihan</span>
                <b>Rp <span id="grand">{rp(grand)}</span></b>
              </div>
            </div>

            <div className="komp">
              <h2>Rincian per komponen</h2>
              <div id="items">
                {K.map((x) => {
                  const pct = jual ? (x[2] / jual) * 100 : 0;
                  return (
                    <div className="item" key={x[0]}>
                      <div className="top">
                        <div className="nm">
                          {x[0]}
                          <i>{x[1]}</i>
                        </div>
                        <div className="amt">Rp {rp(x[2])}</div>
                      </div>
                      <div className="meter">
                        <span style={{ width: `${pct.toFixed(1)}%` }} />
                      </div>
                      <div className="pct">{pct.toFixed(1).replace(".", ",")}% dari harga jual</div>
                    </div>
                  );
                })}
              </div>
              <div className="sumrow tot">
                <span>Harga jual</span>
                <b>Rp <span id="totOut">{rp(jual)}</span></b>
              </div>
              <div className="foot" id="note">
                {adaShaft
                  ? "Shaft dikerjakan Belift — margin 20% menempel proporsional di tiap komponen."
                  : "Shaft dikerjakan pelanggan — margin 25% menempel proporsional di tiap komponen."}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bar">
        <span>Total tagihan</span>
        <strong>Rp <span id="out2">{rp(grand)}</span></strong>
      </div>
    </div>
  );
}
