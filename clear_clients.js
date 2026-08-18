const supabaseUrl = 'https://egpgppglcnwrzznhzgbi.supabase.co';
const supabaseKey = 'sb_publishable_8ew895OxNCne1kc4CnPshw_smMvmpMk';

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
