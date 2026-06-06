const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Supabase credentials are not configured on Vercel' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Function to verify Admin Authorization using the Bearer Token
    const verifyAdmin = async () => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Acesso negado: Token de autorização não fornecido.');
        }

        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            throw new Error('Acesso negado: Sessão de usuário inválida ou expirada.');
        }

        const userEmail = (user.email || '').toLowerCase().trim();
        const allowedAdmins = ['contato.brenomaia@hotmail.com', 'brenomaia0208@gmail.com'];

        if (!userEmail || !allowedAdmins.includes(userEmail)) {
            throw new Error('Acesso negado: Apenas administradores permitidos.');
        }

        return user;
    };

    // 1. GET - Fetch Pedidos (with filters support)
    if (req.method === 'GET') {
        try {
            let filters = {};
            if (req.query.filters) {
                try {
                    filters = JSON.parse(req.query.filters);
                } catch (e) {
                    return res.status(400).json({ error: 'Filtros inválidos' });
                }
            }

            let query = supabase
                .from('pedidos')
                .select('*')
                .order('data_pedido', { ascending: false });

            // Global search
            if (filters.search) {
                query = query.or(`nome.ilike.%${filters.search}%,pedido.ilike.%${filters.search}%,cidade.ilike.%${filters.search}%`);
            }

            // Multiple choice filters
            const arrayCols = {
                'cidade': 'cidade',
                'grupo': 'grupo',
                'programa': 'programa',
                'vendedor': 'vendedor',
                'status-compra': 'status_compra',
                'status-venda': 'status_venda',
                'tipo-pedido': 'tipo_pedido',
                'entrega': 'entrega_pedido'
            };

            for (const [filterKey, dbCol] of Object.entries(arrayCols)) {
                if (filters[filterKey] && filters[filterKey].length > 0) {
                    query = query.in(dbCol, filters[filterKey]);
                }
            }

            // Quick filters
            if (filters.quick) {
                const today = new Date().toISOString().split('T')[0];
                if (filters.quick === 'atrasados') {
                    query = query.lt('data_entrega', today);
                    query = query.in('status_venda', ['EM ABERTO', 'EM ANDAMENTO', 'PARCIAL']);
                } else if (filters.quick === 'aguardando') {
                    query = query.eq('status_compra', 'SEM SOLICITAÇÃO DE COMPRA');
                } else if (filters.quick === 'estoque') {
                    query = query.eq('status_venda', 'EM ESTOQUE');
                }
            }

            const { data, error } = await query;
            if (error) throw error;

            return res.status(200).json(data || []);
        } catch (err) {
            console.error('Error fetching pedidos server-side:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    // 2. POST - Insert Pedidos (Bulk insert)
    if (req.method === 'POST') {
        try {
            await verifyAdmin();

            const rows = req.body;
            if (!Array.isArray(rows)) {
                return res.status(400).json({ error: 'Corpo da requisição deve ser uma lista de pedidos.' });
            }

            const { data, error } = await supabase
                .from('pedidos')
                .insert(rows);

            if (error) throw error;

            return res.status(200).json({ success: true, message: `${rows.length} pedidos inseridos.` });
        } catch (err) {
            console.error('Error inserting pedidos server-side:', err);
            return res.status(err.message.includes('Acesso negado') ? 403 : 500).json({ error: err.message });
        }
    }

    // 3. DELETE - Delete All Pedidos
    if (req.method === 'DELETE') {
        try {
            await verifyAdmin();

            const { data, error } = await supabase
                .from('pedidos')
                .delete()
                .neq('id', 0); // deletes all rows

            if (error) throw error;

            return res.status(200).json({ success: true, message: 'Todos os pedidos foram removidos.' });
        } catch (err) {
            console.error('Error deleting all pedidos server-side:', err);
            return res.status(err.message.includes('Acesso negado') ? 403 : 500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
