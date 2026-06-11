const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { column } = req.query;

    if (!column) {
        return res.status(400).json({ error: 'Parâmetro column é obrigatório' });
    }

    // List of allowed columns to prevent SQL injection or querying unmapped tables
    const allowedColumns = ['cidade', 'grupo', 'programa', 'vendedor', 'status_compra', 'status_venda', 'tipo_pedido', 'data_entrega'];
    if (!allowedColumns.includes(column)) {
        return res.status(400).json({ error: 'Coluna inválida' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Supabase credentials are not configured on Vercel' });
    }

    const authHeader = req.headers.authorization;
    const clientOptions = {};
    if (authHeader) {
        clientOptions.global = {
            headers: {
                Authorization: authHeader
            }
        };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, clientOptions);

    try {
        const { data, error } = await supabase
            .from('pedidos')
            .select(column)
            .not(column, 'is', null);

        if (error) throw error;

        const uniqueValues = [...new Set(data.map(item => item[column]))]
            .filter(val => val !== null && val !== '')
            .sort();

        return res.status(200).json(uniqueValues);
    } catch (err) {
        console.error(`Error fetching distinct values for ${column}:`, err);
        return res.status(500).json({ error: err.message });
    }
};
