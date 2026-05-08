const supabaseUrl = 'https://ampktfwcpopkomrsckjm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcGt0ZndjcG9wa29tcnNja2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTI5NjgsImV4cCI6MjA5MjI4ODk2OH0.svDhF6SpoJ6v_mwK4Ep8q93CjA5R0sd59X3RcrgBjeo';

// Ensure the Supabase library is loaded
if (typeof supabase === 'undefined') {
    console.error('Supabase is not loaded. Ensure the CDN script is included before this file.');
} else {
    window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
}
