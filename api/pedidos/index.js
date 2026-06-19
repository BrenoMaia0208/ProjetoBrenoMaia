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
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey) {
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

    // Always use anon client with user headers to verify the user identity
    const authSupabase = createClient(supabaseUrl, anonKey, clientOptions);

    // If service role key exists, use it to bypass RLS for database writes/reads
    const dbKey = serviceRoleKey || anonKey;
    const dbOptions = serviceRoleKey ? {} : clientOptions;
    const supabase = createClient(supabaseUrl, dbKey, dbOptions);

    // Function to verify Admin Authorization using the Bearer Token
    const verifyAdmin = async () => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Acesso negado: Token de autorização não fornecido.');
        }

        const token = authHeader.substring(7);
        const { data: { user }, error } = await authSupabase.auth.getUser(token);

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
                .order('data_pedido', { ascending: false })
                .range(0, 5000);

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

            const { id, pedido } = req.query;
            if (id || pedido) {
                // Em vez de deletar o registro do banco de dados (que removeria do dashboard),
                // nós apenas definimos a data_entrega como null, retirando do planejamento semanal
                let query = supabase.from('pedidos').update({ data_entrega: null });
                
                if (id) {
                    if (typeof id === 'string' && id.includes(',')) {
                        const parsedIds = id.split(',').map(x => {
                            const trimmed = x.trim();
                            return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
                        });
                        query = query.in('id', parsedIds);
                    } else {
                        const trimmedId = String(id).trim();
                        const parsedId = /^\d+$/.test(trimmedId) ? Number(trimmedId) : trimmedId;
                        query = query.eq('id', parsedId);
                    }
                } else if (pedido && !isNaN(pedido) && pedido.trim() !== '') {
                    query = query.eq('pedido', Number(pedido));
                } else if (pedido) {
                    query = query.eq('pedido', pedido);
                }

                const { error } = await query;
                if (error) throw error;

                return res.status(200).json({ success: true, message: `Pedido(s) desmarcado(s) do planejamento semanal.` });
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

            // Passo 1: Buscar todos os registros do banco de dados para filtrar em memória
            const { data: allRows, error: fetchError } = await supabase
                .from('pedidos')
                .select('id, status_venda, saldo_faturar, data_entrega');

            if (fetchError) throw fetchError;

            // Passo 2: Identificar quais registros devem ser deletados
            const idsToDelete = [];
            const mondayTime = monday.getTime();
            const fridayTime = friday.getTime();

            (allRows || []).forEach(row => {
                const statusUpper = String(row.status_venda || '').toUpperCase();
                const isDelivered = 
                    ['FATURADO TOTAL', 'FATURADO', 'ENTREGUE'].includes(statusUpper);

                if (!isDelivered) {
                    // Pedidos ativos são sempre excluídos para dar lugar aos dados da nova planilha
                    idsToDelete.push(row.id);
                } else {
                    // Pedidos entregues/faturados são deletados se estiverem fora da semana atual de planejamento
                    if (!row.data_entrega) {
                        idsToDelete.push(row.id);
                    } else {
                        const deliveryDate = new Date(row.data_entrega + 'T12:00:00');
                        const deliveryTime = deliveryDate.getTime();
                        if (deliveryTime < mondayTime || deliveryTime > fridayTime) {
                            idsToDelete.push(row.id);
                        }
                    }
                }
            });

            // Passo 3: Deletar em lote os registros identificados
            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from('pedidos')
                    .delete()
                    .in('id', idsToDelete);

                if (deleteError) throw deleteError;
            }

            return res.status(200).json({ success: true, message: `Pedidos ativos limpos (${idsToDelete.length} registros deletados). Apenas entregas finalizadas da semana corrente foram mantidas.` });
        } catch (err) {
            console.error('Error deleting active/out-of-week orders server-side:', err);
            return res.status(err.message.includes('Acesso negado') ? 403 : 500).json({ error: err.message });
        }
    }

    // 4. PUT - Update Delivery Date of a Pedido
    if (req.method === 'PUT') {
        try {
            await verifyAdmin();

            const { id, pedido, data_entrega } = req.body;
            if (!id && !pedido) {
                return res.status(400).json({ error: 'ID ou Número do pedido é obrigatório para atualização.' });
            }

            let query = supabase.from('pedidos').update({ data_entrega: data_entrega || null });
            
            const cleanPedidoVal = (val) => {
                if (val === null || val === undefined) return '';
                let str = String(val).trim();
                if (str.endsWith('.0')) {
                    str = str.substring(0, str.length - 2);
                }
                return str;
            };

            if (id) {
                // Se for um array de IDs ou uma string de IDs separados por vírgula (agrupamento do planejamento semanal)
                if (Array.isArray(id)) {
                    const parsedIds = id.map(x => Number(String(x).trim())).filter(x => !isNaN(x));
                    query = query.in('id', parsedIds);
                } else if (typeof id === 'string' && id.includes(',')) {
                    const parsedIds = id.split(',').map(x => Number(x.trim())).filter(x => !isNaN(x));
                    query = query.in('id', parsedIds);
                } else {
                    const parsedId = Number(String(id).trim());
                    if (isNaN(parsedId)) {
                        query = query.eq('id', id); // fallback se for string não numérica
                    } else {
                        query = query.eq('id', parsedId);
                    }
                }
            } else if (pedido) {
                if (Array.isArray(pedido)) {
                    const parsedPedidos = pedido.map(x => cleanPedidoVal(x)).filter(Boolean);
                    query = query.in('pedido', parsedPedidos);
                } else if (typeof pedido === 'string' && pedido.includes(',')) {
                    const parsedPedidos = pedido.split(',').map(x => cleanPedidoVal(x)).filter(Boolean);
                    query = query.in('pedido', parsedPedidos);
                } else {
                    query = query.eq('pedido', cleanPedidoVal(pedido));
                }
            }

            const { data, error } = await query.select('id');
            if (error) throw error;

            console.log(`[PUT API] Atualizado com sucesso. Registros afetados:`, data);

            if (!data || data.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Nenhum pedido foi atualizado. Verifique se o pedido existe ou se há restrições de permissão RLS no banco de dados.', 
                    affected: [] 
                });
            }

            return res.status(200).json({ success: true, message: 'Previsão de entrega atualizada com sucesso.', affected: data });
        } catch (err) {
            console.error('Error updating delivery date server-side:', err);
            return res.status(err.message.includes('Acesso negado') ? 403 : 500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
