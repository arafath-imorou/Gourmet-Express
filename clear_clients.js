const supabaseUrl = 'https://ampktfwcpopkomrsckjm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcGt0ZndjcG9wa29tcnNja2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTI5NjgsImV4cCI6MjA5MjI4ODk2OH0.svDhF6SpoJ6v_mwK4Ep8q93CjA5R0sd59X3RcrgBjeo';

async function clearClients() {
    const headers = {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json'
    };

    console.log('Nullifying client_id references in restau_orders...');
    const orderRes = await fetch(supabaseUrl + '/rest/v1/restau_orders?client_id=not.is.null', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ client_id: null })
    });
    
    if (orderRes.ok) {
        console.log('Successfully nullified client references on orders.');
    } else {
        console.log('Failed or skipped updating orders:', await orderRes.text());
    }

    console.log('Deleting all clients from restau_clients...');
    const deleteRes = await fetch(supabaseUrl + '/rest/v1/restau_clients?id=not.is.null', {
        method: 'DELETE',
        headers
    });

    if (deleteRes.ok) {
        console.log('Successfully deleted all clients!');
    } else {
        console.error('Error deleting clients:', await deleteRes.text());
    }
}

clearClients();
