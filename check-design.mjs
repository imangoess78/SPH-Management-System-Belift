import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env manually
const env = readFileSync('.env', 'utf8');
const vars = Object.fromEntries(env.split('\n').filter(l=>l.includes('=')).map(l=>{
  const [k,...v]=l.split('='); return [k.trim(), v.join('=').trim()];
}));

const url = vars['VITE_SUPABASE_URL'];
const key = vars['VITE_SUPABASE_PUBLISHABLE_KEY'];
console.log('URL:', url ? url.slice(0,40)+'...' : 'MISSING');

const sb = createClient(url, key);
const { data, error } = await sb.from('design_items').select('id,category,sku,name,image_url');
if (error) { console.error('Error:', error.message); process.exit(1); }
console.log('Total rows:', data.length);
console.log(JSON.stringify(data, null, 2));
