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
        const allowedAdmins = ['contato.brenomaia@hotmail.com', 'brenomaia0208@gmail.com', 'carlos.lucena@distribuidoraprovix.com'];

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
                'entrega': 'data_entrega'
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

            let { data, error } = await query;
            if (error) throw error;

            return res.status(200).json(data || []);
        } catch (err) {
            console.error('Error fetching pedidos server-side:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    // 2. POST - Insert Pedidos (Bulk insert with deduplication against preserved delivered orders)
    if (req.method === 'POST') {
        try {
            await verifyAdmin();

            const rows = req.body;
            if (!Array.isArray(rows)) {
                return res.status(400).json({ error: 'Corpo da requisição deve ser uma lista de pedidos.' });
            }

            // Fetch existing preserved orders to avoid duplicates
            const { data: existing, error: fetchError } = await supabase
                .from('pedidos')
                .select('pedido');

            if (fetchError) throw fetchError;

            const existingSet = new Set((existing || []).map(p => String(p.pedido)));

            // Filter out rows that are already in the database
            const rowsToInsert = rows.filter(row => row.pedido && !existingSet.has(String(row.pedido)));

            if (rowsToInsert.length > 0) {
                const { data, error } = await supabase
                    .from('pedidos')
                    .insert(rowsToInsert);

                if (error) throw error;
            }

            return res.status(200).json({ success: true, message: `${rowsToInsert.length} novos pedidos inseridos.` });
        } catch (err) {
            console.error('Error inserting pedidos server-side:', err);
            return res.status(err.message.includes('Acesso negado') ? 403 : 500).json({ error: err.message });
        }
    }

    // 3. DELETE - Delete Pedidos
    if (req.method === 'DELETE') {
        try {
            await verifyAdmin();

            const { pedido } = req.query;
            if (pedido) {
                // Em vez de deletar o registro do banco de dados (que removeria do dashboard),
                // nós apenas definimos a data_entrega como null, retirando do planejamento semanal
                const { error } = await supabase
                    .from('pedidos')
                    .update({ data_entrega: null })
                    .eq('pedido', pedido);

                if (error) throw error;

                return res.status(200).json({ success: true, message: `Pedido ${pedido} desmarcado do planejamento semanal.` });
            }

            // Se não houver parâmetro "pedido", executa a limpeza padrão da importação:
            // Calculate current planning week range (using the exact same logic as WeeklyPlanService)
            const today = new Date();
            const dayOfWeek = today.getDay();
            const hours = today.getHours();
            
            let shiftToNextWeek = false;
            if (dayOfWeek === 5 && hours >= 17) {
                shiftToNextWeek = true;
            } else if (dayOfWeek === 6 || dayOfWeek === 0) {
                shiftToNextWeek = true;
            }

            const baseDate = new Date(today);
            if (shiftToNextWeek) {
                const daysToAdd = dayOfWeek === 5 ? 3 : (dayOfWeek === 6 ? 2 : 1);
                baseDate.setDate(today.getDate() + daysToAdd);
            }

            const baseDayOfWeek = baseDate.getDay();
            const monday = new Date(baseDate);
            const diffToMonday = baseDayOfWeek === 0 ? -6 : 1 - baseDayOfWeek;
            monday.setDate(baseDate.getDate() + diffToMonday);
            monday.setHours(0, 0, 0, 0);

            const friday = new Date(monday);
            friday.setDate(monday.getDate() + 4);
            friday.setHours(23, 59, 59, 999);

            const mondayStr = monday.toISOString().split('T')[0];
            const fridayStr = friday.toISOString().split('T')[0];

            // Passo 1: Deleta pedidos ATIVOS (não faturados/entregues totalmente)
            const { error: activeError } = await supabase
                .from('pedidos')
                .delete()
                .or('status_venda.is.null,status_venda.not.in.("FATURADO TOTAL","FATURADO","ENTREGUE")')
                .not('saldo_faturar', 'eq', 0);

            if (activeError) throw activeError;

            // Passo 2: Deleta pedidos ENTREGUES de outras semanas (anteriores ou posteriores à semana de planejamento)
            const { error: pastError } = await supabase
                .from('pedidos')
                .delete()
                .or(`data_entrega.lt.${mondayStr},data_entrega.gt.${fridayStr},data_entrega.is.null`)
                .or('status_venda.in.("FATURADO TOTAL","FATURADO","ENTREGUE"),saldo_faturar.eq.0');

            if (pastError) throw pastError;

            return res.status(200).json({ success: true, message: 'Pedidos ativos limpos. Apenas entregas finalizadas da semana corrente foram mantidas.' });
        } catch (err) {
            console.error('Error deleting active/out-of-week orders server-side:', err);
            return res.status(err.message.includes('Acesso negado') ? 403 : 500).json({ error: err.message });
        }
    }

    // 4. PUT - Update Delivery Date of a Pedido
    if (req.method === 'PUT') {
        try {
            await verifyAdmin();

            const { pedido, data_entrega } = req.body;
            if (!pedido) {
                return res.status(400).json({ error: 'Número do pedido é obrigatório para atualização.' });
            }

            const { data, error } = await supabase
                .from('pedidos')
                .update({ data_entrega: data_entrega || null })
                .eq('pedido', pedido);

            if (error) throw error;

            return res.status(200).json({ success: true, message: 'Previsão de entrega atualizada com sucesso.' });
        } catch (err) {
            console.error('Error updating delivery date server-side:', err);
            return res.status(err.message.includes('Acesso negado') ? 403 : 500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
