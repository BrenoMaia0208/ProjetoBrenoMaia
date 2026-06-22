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

                const response = await fetch(`/api/pedidos?filters=${encodeURIComponent(JSON.stringify(filters))}&_t=${Date.now()}`, {
                    headers: headers
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Erro ao carregar pedidos.');
                }
                const data = await response.json();

                // Merge with client-side localStorage overrides
                try {
                    const savedOverrides = localStorage.getItem('weekly-rescheduled-dates');
                    if (savedOverrides) {
                        const overrides = JSON.parse(savedOverrides);
                        data.forEach(p => {
                            const normPedido = String(p.pedido).trim();
                            if (overrides.hasOwnProperty(normPedido)) {
                                p.data_entrega = overrides[normPedido];
                            }
                        });
                    }
                } catch (e) {
                    console.error('Failed to merge localStorage overrides:', e);
                }

                return data;
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

        isAdmin: function() {
            try {
                const session = this.getSession();
                if (!session || !session.user) return false;
                
                const userEmail = (session.user.email || '').toLowerCase().trim();
                const allowedAdmins = ['contato.brenomaia@hotmail.com', 'brenomaia0208@gmail.com', 'carlos.lucena@distribuidoraprovix.com'];
                return allowedAdmins.includes(userEmail);
            } catch (e) {
                return false;
            }
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
        },

        updateDeliveryDate: async function(id, date, pedido) {
            try {
                // Save to localStorage immediately as a client-side fallback
                if (pedido) {
                    try {
                        const savedOverrides = localStorage.getItem('weekly-rescheduled-dates') || '{}';
                        const overrides = JSON.parse(savedOverrides);
                        overrides[String(pedido).trim()] = date;
                        localStorage.setItem('weekly-rescheduled-dates', JSON.stringify(overrides));
                    } catch (e) {
                        console.error('Failed to save to localStorage override:', e);
                    }
                }

                await this.checkAdminSession();
                const session = this.getSession();

                const response = await fetch('/api/pedidos', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ id: id, data_entrega: date || null })
                });

                if (!response.ok) {
                    const err = await response.json();
                    console.warn('[SupabaseService] Database sync failed (RLS or column restriction), but date changes are saved locally:', err.error);
                } else {
                    const result = await response.json();
                    console.log('[SupabaseService] Database sync succeeded:', result);
                }
                return true;
            } catch (error) {
                console.warn('[SupabaseService] Error syncing with database, but date changes are saved locally:', error);
                return true;
            }
        },

        updateDeliveryDateByPedido: async function(pedido, date) {
            try {
                // Save to localStorage immediately
                try {
                    const savedOverrides = localStorage.getItem('weekly-rescheduled-dates') || '{}';
                    const overrides = JSON.parse(savedOverrides);
                    
                    if (typeof pedido === 'string' && pedido.includes(',')) {
                        pedido.split(',').forEach(p => {
                            overrides[p.trim()] = date;
                        });
                    } else if (Array.isArray(pedido)) {
                        pedido.forEach(p => {
                            overrides[String(p).trim()] = date;
                        });
                    } else {
                        overrides[String(pedido).trim()] = date;
                    }
                    localStorage.setItem('weekly-rescheduled-dates', JSON.stringify(overrides));
                } catch (e) {
                    console.error('Failed to save to localStorage override:', e);
                }

                await this.checkAdminSession();
                const session = this.getSession();

                const response = await fetch('/api/pedidos', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ pedido: pedido, data_entrega: date || null })
                });

                if (!response.ok) {
                    const err = await response.json();
                    console.warn('[SupabaseService] Database sync failed (RLS or column restriction), but date changes are saved locally:', err.error);
                } else {
                    const result = await response.json();
                    console.log('[SupabaseService] Database sync succeeded:', result);
                }
                
                return true;
            } catch (error) {
                console.warn('[SupabaseService] Error syncing with database, but date changes are saved locally:', error);
                return true;
            }
        },

        syncLocalOverridesToDatabase: async function() {
            try {
                const savedOverrides = localStorage.getItem('weekly-rescheduled-dates');
                if (!savedOverrides) return;

                const overrides = JSON.parse(savedOverrides);
                const keys = Object.keys(overrides);
                if (keys.length === 0) return;

                console.log('[SupabaseService] Sincronizando alterações locais com o banco de dados...', keys.length);
                
                let session = null;
                try {
                    await this.checkAdminSession();
                    session = this.getSession();
                } catch (e) {
                    // Não é admin ou não está autenticado, pula a sincronização automática
                    return;
                }
                if (!session) return;

                let syncedCount = 0;
                for (const pedido of keys) {
                    const date = overrides[pedido];
                    try {
                        const response = await fetch('/api/pedidos', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify({ pedido: pedido, data_entrega: date || null })
                        });

                        if (response.ok) {
                            delete overrides[pedido];
                            syncedCount++;
                        }
                    } catch (err) {
                        console.error(`[SupabaseService] Erro ao sincronizar pedido ${pedido}:`, err);
                    }
                }

                if (syncedCount > 0) {
                    localStorage.setItem('weekly-rescheduled-dates', JSON.stringify(overrides));
                    console.log(`[SupabaseService] Sincronizados com sucesso: ${syncedCount} pedidos.`);
                    if (window.app && window.app.showNotification) {
                        window.app.showNotification(`${syncedCount} alteração(ões) de data sincronizada(s) com o banco de dados!`, 'success');
                    }
                }
            } catch (error) {
                console.warn('[SupabaseService] Erro geral ao sincronizar dados locais:', error);
            }
        },
 
        deletePedido: async function(id) {
            try {
                await this.checkAdminSession();
                const session = this.getSession();

                const response = await fetch(`/api/pedidos?id=${encodeURIComponent(id)}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Erro ao remover pedido.');
                }
                return true;
            } catch (error) {
                console.error('Error deleting pedido:', error);
                throw error;
            }
        }
    };
})();
