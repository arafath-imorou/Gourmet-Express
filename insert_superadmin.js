const supabaseUrl = 'https://ampktfwcpopkomrsckjm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcGt0ZndjcG9wa29tcnNja2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTI5NjgsImV4cCI6MjA5MjI4ODk2OH0.svDhF6SpoJ6v_mwK4Ep8q93CjA5R0sd59X3RcrgBjeo';

async function createSuperAdmin() {
    const headers = {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    console.log('Checking if user exists...');
    const checkRes = await fetch(supabaseUrl + '/rest/v1/staff?email=eq.groupita25%40gmail.com', { headers });
    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
        console.log('User exists, updating password and role...');
        const updateRes = await fetch(supabaseUrl + '/rest/v1/staff?id=eq.' + existing[0].id, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ password: 'Admin123', role: 'superadmin', status: 'active' })
        });
        if (!updateRes.ok) console.error('Error updating:', await updateRes.text());
        else console.log('Successfully updated superadmin!');
    } else {
        console.log('User does not exist, creating...');
        const insertRes = await fetch(supabaseUrl + '/rest/v1/staff', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                firstname: 'Super',
                lastname: 'Admin',
                email: 'groupita25@gmail.com',
                password: 'Admin123',
                role: 'superadmin',
                status: 'active'
            })
        });
        if (!insertRes.ok) console.error('Error creating:', await insertRes.text());
        else console.log('Successfully created superadmin!');
    }
}

createSuperAdmin();
