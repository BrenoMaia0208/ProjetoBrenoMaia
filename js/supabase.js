(function() {
    'use strict';

    window.SupabaseService = {
        fetchPedidos: async function(filters = {}) {
            try {
                const session = this.getSession();
                const headers = {};
                if (session && session.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }

                const response = await fetch(`/api/pedidos?filters=${encodeURIComponent(JSON.stringify(filters))}`, {
                    headers: headers
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Erro ao carregar pedidos.');
                }
                return await response.json();
            } catch (error) {
                console.error('Error fetching pedidos:', error);
                throw error;
            }
        },

        getSession: function() {
            try {
                const sessionStr = localStorage.getItem('sb-session');
                if (!sessionStr) return null;
                return JSON.parse(sessionStr);
            } catch (e) {
                return null;
            }
        },

        checkAdminSession: async function() {
            const session = this.getSession();
            if (!session || !session.user) {
                throw new Error('Erro na validação de segurança: Sessão inválida ou não autenticada.');
            }
            
            const userEmail = (session.user.email || '').toLowerCase().trim();
            const allowedAdmins = ['contato.brenomaia@hotmail.com', 'brenomaia0208@gmail.com', 'carlos.lucena@distribuidoraprovix.com'];
            if (!userEmail || !allowedAdmins.includes(userEmail)) {
                throw new Error('Acesso negado: Apenas o administrador tem permissão para modificar os dados.');
            }
            return true;
        },

        insertPedidos: async function(rows, onProgress) {
            try {
                await this.checkAdminSession();
                const session = this.getSession();
                
                if (onProgress) onProgress(30);

                const response = await fetch('/api/pedidos', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify(rows)
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Erro ao inserir pedidos.');
                }
                
                if (onProgress) onProgress(100);
                return true;
            } catch (error) {
                console.error('Error inserting pedidos:', error);
                throw error;
            }
        },

        deleteAllPedidos: async function() {
            try {
                await this.checkAdminSession();
                const session = this.getSession();

                const response = await fetch('/api/pedidos', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Erro ao deletar pedidos.');
                }
                return true;
            } catch (error) {
                console.error('Error deleting all pedidos:', error);
                throw error;
            }
        },

        fetchDistinctValues: async function(column) {
            try {
                // Map frontend column names to backend database columns if they differ
                const colMap = {
                    'cidade': 'cidade',
                    'grupo': 'grupo',
                    'programa': 'programa',
                    'vendedor': 'vendedor',
                    'status-compra': 'status_compra',
                    'status-venda': 'status_venda',
                    'tipo-pedido': 'tipo_pedido',
                    'entrega': 'data_entrega'
                };
                
                const dbColName = colMap[column] || column;

                const session = this.getSession();
                const headers = {};
                if (session && session.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }

                const response = await fetch(`/api/pedidos/distinct?column=${dbColName}`, {
                    headers: headers
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Erro ao buscar valores distintos.');
                }
                return await response.json();
            } catch (error) {
                console.error(`Error fetching distinct values for ${column}:`, error);
                return [];
            }
        }
    };
})();
