(function() {
    'use strict';

    const SUPABASE_URL = 'https://wtdvkqvacwstduspuzou.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZHZrcXZhY3dzdGR1c3B1em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjI4MjEsImV4cCI6MjA5NjA5ODgyMX0.31F3wU8kk-9xBi30LjTbP1tLVC2aYSr1mK_pPXTyK9M';

    const { createClient } = supabase;
    window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    window.SupabaseService = {
        getClient: function() {
            return window.supabaseClient;
        },

        fetchPedidos: async function(filters = {}) {
            try {
                let query = window.supabaseClient
                    .from('pedidos')
                    .select('*')
                    .order('data_pedido', { ascending: false });

                // Busca Global de texto
                if (filters.search) {
                    // Busca por nome do cliente ou número do pedido ou cidade
                    query = query.or(`nome.ilike.%${filters.search}%,pedido.ilike.%${filters.search}%,cidade.ilike.%${filters.search}%`);
                }

                // Filtros de Múltipla Escolha (Arrays)
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

                // Filtros Rápidos (Botões)
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
                return data || [];
            } catch (error) {
                console.error('Error fetching pedidos:', error);
                throw error;
            }
        },

        checkAdminSession: async function() {
            let session = null;
            let error = null;
            try {
                const res = await window.supabaseClient.auth.getSession();
                session = res.data.session;
                error = res.error;
            } catch (e) {
                error = e;
            }
            
            if (error || !session || !session.user) {
                throw new Error('Erro na validação de segurança: Sessão inválida ou não autenticada.');
            }
            
                        // Debug: log the full session object for troubleshooting
            console.log('Admin check - full session:', session);
            // Attempt to retrieve email from possible fields
            const possibleEmail = session.user.email || session.user.email_address || (session.user.user_metadata && session.user.user_metadata.email) || '';
            const userEmail = possibleEmail.toLowerCase().trim();
            const allowedAdmins = ['contato.brenomaia@hotmail.com', 'brenomaia0208@gmail.com'];
            if (!userEmail || !allowedAdmins.includes(userEmail)) {
                throw new Error('Acesso negado: Apenas o administrador tem permissão para modificar os dados.');
            }
            return true;
        },

        insertPedidos: async function(rows, onProgress) {
            try {
                await this.checkAdminSession();
                
                const batchSize = 50;
                const totalBatches = Math.ceil(rows.length / batchSize);
                
                for (let i = 0; i < totalBatches; i++) {
                    const start = i * batchSize;
                    const batch = rows.slice(start, start + batchSize);
                    
                    const { error } = await window.supabaseClient
                        .from('pedidos')
                        .insert(batch);
                        
                    if (error) throw error;
                    
                    if (onProgress) {
                        onProgress(((i + 1) / totalBatches) * 100);
                    }
                }
                return true;
            } catch (error) {
                console.error('Error inserting pedidos:', error);
                throw error;
            }
        },

        deleteAllPedidos: async function() {
            try {
                await this.checkAdminSession();
                
                const { error } = await window.supabaseClient
                    .from('pedidos')
                    .delete()
                    .neq('id', 0);
                    
                if (error) throw error;
                return true;
            } catch (error) {
                console.error('Error deleting all pedidos:', error);
                throw error;
            }
        },

        fetchDistinctValues: async function(column) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('pedidos')
                    .select(column)
                    .not(column, 'is', null);
                    
                if (error) throw error;
                
                const uniqueValues = [...new Set(data.map(item => item[column]))]
                    .filter(val => val !== null && val !== '')
                    .sort();
                    
                return uniqueValues;
            } catch (error) {
                console.error(`Error fetching distinct values for ${column}:`, error);
                return [];
            }
        }
    };
})();
