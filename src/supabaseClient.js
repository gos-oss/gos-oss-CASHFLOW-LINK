import { createClient } from '@supabase/supabase-js';

// Credenciales de tu proyecto en Supabase
const supabaseUrl = 'https://kbmbdvcawbhumlyjxkam.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtibWJkdmNhd2JodW1seWp4a2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzM4ODYsImV4cCI6MjEwMTk0OTg4Nn0.b75eLNTYpyby27jBh6IdblZo1RiUi4_zdAKMT-b6hZY';

// Inicialización del cliente oficial
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
