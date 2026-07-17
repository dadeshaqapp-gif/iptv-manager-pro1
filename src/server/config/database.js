/** 
 * Configura‡Æo do Supabase 
 * IPTV Manager Pro 
 */ 
 
const { createClient } = require('@supabase/supabase-js'); 
require('dotenv').config(); 
 
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co'; 
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'; 
 
const supabase = createClient(supabaseUrl, supabaseServiceKey, { 
  auth: { 
    autoRefreshToken: false, 
    persistSession: false 
  } 
}); 
 
const supabaseAnon = createClient( 
  supabaseUrl, 
  process.env.SUPABASE_ANON_KEY || 'your-anon-key', 
  { auth: { autoRefreshToken: false, persistSession: false } } 
); 
 
module.exports = { supabase, supabaseAnon }; 
