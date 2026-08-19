import { useState } from 'react';
import { Download, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const TABLES = ['profiles', 'user_roles', 'sph', 'design_items', 'sales'] as const;
const BATCH_SIZE = 500;

type TableName = typeof TABLES[number];
type TableResult = { rows: number; sha256: string; status: 'PASS' | 'FAIL'; error?: string };

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readTable(table: TableName) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await (supabase as any).from(table).select('*').range(from, from + BATCH_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < BATCH_SIZE) break;
  }
  return rows;
}

export default function EmergencyBackup() {
  const { role, user } = useAuth();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<Record<string, TableResult>>({});

  if (role !== 'admin') {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Halaman ini hanya dapat diakses admin.</CardContent></Card>;
  }

  const runBackup = async () => {
    if (!window.confirm('Backup hanya membaca data production dan tidak mengubah database. Mulai sekarang?')) return;
    setRunning(true); setMessage('Backup berjalan...'); setResults({});
    const exported: Record<string, unknown[]> = {};
    const summary: Record<string, TableResult> = {};
    try {
      for (const table of TABLES) {
        setMessage(`Membaca ${table}...`);
        try {
          const rows = await readTable(table);
          const serialized = JSON.stringify(rows);
          summary[table] = { rows: rows.length, sha256: await sha256(serialized), status: 'PASS' };
          exported[table] = rows;
          setResults({ ...summary });
        } catch (error) {
          summary[table] = { rows: 0, sha256: '', status: 'FAIL', error: error instanceof Error ? error.message : 'Unknown error' };
          setResults({ ...summary });
        }
      }
      const failed = TABLES.some((table) => summary[table]?.status === 'FAIL');
      const manifest = {
        backup_type: 'emergency-production-database-backup',
        created_at: new Date().toISOString(),
        source: 'production-application-authenticated-session',
        authenticated_user: user?.id || null,
        batch_size: BATCH_SIZE,
        status: failed ? 'PARTIAL' : 'COMPLETE',
        tables: summary,
        auth_users: 'NOT_BACKED_UP',
        storage: 'NOT_BACKED_UP',
      };
      downloadJson(`production-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, { manifest, data: exported });
      setMessage(failed ? 'Backup PARTIAL. Tabel yang gagal tidak diberi label lengkap.' : 'Backup COMPLETE dan berhasil diunduh.');
    } catch (error) {
      setMessage(`Backup FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally { setRunning(false); }
  };

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Emergency Production Backup</h1><p className="text-muted-foreground">Export read-only menggunakan permission admin yang sedang login.</p></div>
    <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Operasi aman</AlertTitle><AlertDescription>Backup hanya membaca data. Tidak ada INSERT, UPDATE, DELETE, perubahan RLS, atau akses ke password dan session.</AlertDescription></Alert>
    <Card><CardHeader><CardTitle>Tabel yang diekspor</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2">{TABLES.map((table) => <div key={table} className="rounded border p-3 font-mono text-sm">{table}: {results[table] ? `${results[table].rows} rows — ${results[table].status}` : 'menunggu'}</div>)}</div><Button className="mt-6" onClick={runBackup} disabled={running}>{running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</> : <><Download className="mr-2 h-4 w-4" />Mulai Backup</>}</Button>{message && <p className="mt-4 text-sm">{message}</p>}</CardContent></Card>
    {Object.values(results).some((r) => r.status === 'FAIL') && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Backup sebagian</AlertTitle><AlertDescription>Beberapa tabel gagal dibaca. Simpan hasil sebagai PARTIAL dan jangan gunakan sebagai backup lengkap.</AlertDescription></Alert>}
  </div>;
}
