import { createClient } from '@supabase/supabase-js';

// Reemplaza estos valores con las credenciales de tu panel de Supabase
const supabaseUrl = 'TU_SUPABASE_URL_AQUI';
const supabaseAnonKey = 'TU_SUPABASE_ANON_KEY_AQUI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
