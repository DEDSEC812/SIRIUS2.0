import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qijugwzvozshmzdyasjy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.vA6rAD9Eo1TCuGNQgI_Aw_dfZdvX3aF1U3qC5Y2n2OY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
