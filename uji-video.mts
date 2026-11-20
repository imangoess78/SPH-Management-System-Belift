import { htmlSurvey } from './src/lib/survey-cetak';
import { dtKosong, dokumentasiKosong, kesimpulanKosong, pekerjaanKosong } from './src/components/survey/SurveyPanels';

const html = htmlSurvey({
  jenis: 'final', judul: 'Final Survey', noSurvey: '004/SVY/LIFT/BAI/X/2026',
  tgl: '2026-11-06', kodeProyek: 'BLF-2026-009', namaProspek: 'Uji', kodeLead: 'L-1',
  surveyor: 'Imam', pjLapangan: '', pjTelp: '', jamKerja: '',
  dt: dtKosong(), dokumentasi: dokumentasiKosong(), pekerjaan: pekerjaanKosong(),
  kesimpulan: kesimpulanKosong(), ttd: { sales: '', customer: '', surveyor: '' },
  catatanLapangan: '', videoLink: 'https://cekcobafinalsurvey.com',
});
console.log('ADA tautan:', html.includes('cekcobafinalsurvey'));
const i = html.indexOf('Tautan Video');
console.log('KONTEKS:', i < 0 ? 'TIDAK ADA' : html.slice(i - 120, i + 220).replace(/\s+/g, ' '));
