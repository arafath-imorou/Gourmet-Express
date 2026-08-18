const supabaseUrl = 'https://egpgppglcnwrzznhzgbi.supabase.co';
const supabaseKey = 'sb_publishable_8ew895OxNCne1kc4CnPshw_smMvmpMk';

// Ensure the Supabase library is loaded
if (typeof supabase === 'undefined') {
    console.error('Supabase is not loaded. Ensure the CDN script is included before this file.');
} else {
    window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
}

