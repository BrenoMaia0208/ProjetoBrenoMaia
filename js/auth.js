(function() {
    'use strict';

    window.AuthService = {
        listeners: [],

        init: function() {
            const isLoginPage = !!document.getElementById('login-form');
            const isDashboardPage = !!document.getElementById('dashboard-content');

            if (isLoginPage) {
                this.setupLoginHandlers();
                this.checkSessionForLogin();
            } else if (isDashboardPage) {
                this.checkSessionForDashboard();
                this.setupAdminUserHandlers();
            }

            this.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT' && isDashboardPage) {
                    window.location.href = 'index.html';
                } else if (event === 'SIGNED_IN' && isLoginPage) {
                    window.location.href = 'dashboard.html';
                }
            });
        },

        setupLoginHandlers: function() {
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const toggleLink = document.getElementById('toggle-auth-link');
            const authError = document.getElementById('auth-error');

            if (toggleLink) {
                toggleLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (loginForm.classList.contains('hidden')) {
                        loginForm.classList.remove('hidden');
                        registerForm.classList.add('hidden');
                        toggleLink.textContent = 'Não tem uma conta? Registre-se';
                    } else {
                        loginForm.classList.add('hidden');
                        registerForm.classList.remove('hidden');
                        toggleLink.textContent = 'Já tem uma conta? Faça login';
                    }
                    authError.classList.add('hidden');
                });
            }

            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const email = document.getElementById('login-email').value;
                    const password = document.getElementById('login-password').value;
                    const btn = document.getElementById('login-btn');
                    
                    try {
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
                        await this.login(email, password);
                    } catch (error) {
                        authError.textContent = error.message;
                        authError.classList.remove('hidden');
                        btn.disabled = false;
                        btn.textContent = 'Entrar';
                    }
                });
            }

            if (registerForm) {
                registerForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const email = document.getElementById('register-email').value;
                    const password = document.getElementById('register-password').value;
                    const confirm = document.getElementById('register-password-confirm').value;
                    const btn = document.getElementById('register-btn');

                    if (password !== confirm) {
                        authError.textContent = 'As senhas não coincidem.';
                        authError.classList.remove('hidden');
                        return;
                    }

                    try {
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';
                        await this.register(email, password);
                        authError.textContent = 'Conta criada! Faça login agora.';
                        authError.className = 'auth-error notification-success';
                        authError.classList.remove('hidden');
                        toggleLink.click();
                    } catch (error) {
                        authError.textContent = error.message;
                        authError.className = 'auth-error';
                        authError.classList.remove('hidden');
                    } finally {
                        btn.disabled = false;
                        btn.textContent = 'Criar Conta';
                    }
                });
            }
        },

        checkSessionForLogin: function() {
            const session = this.getSession();
            if (session) {
                window.location.href = 'dashboard.html';
            } else {
                const overlay = document.getElementById('loading-overlay');
                if (overlay) overlay.classList.add('hidden');
            }
        },

        checkSessionForDashboard: function() {
            const session = this.getSession();
            if (!session) {
                window.location.href = 'index.html';
                return null;
            }
            
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    await this.logout();
                });
            }

            const emailEl = document.getElementById('user-email');
            if (emailEl && session.user) {
                emailEl.textContent = session.user.email;
            }
            
            return session;
        },

        login: async function(email, password) {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Credenciais inválidas');
            }

            const data = await response.json();
            if (data.session) {
                localStorage.setItem('sb-session', JSON.stringify(data.session));
                this.triggerAuthStateChange('SIGNED_IN', data.session);
            }
            return data;
        },

        register: async function(email, password) {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erro ao registrar usuário');
            }

            return await response.json();
        },

        logout: async function() {
            localStorage.removeItem('sb-session');
            this.triggerAuthStateChange('SIGNED_OUT', null);
        },

        getUser: function() {
            const session = this.getSession();
            return session ? session.user : null;
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

        onAuthStateChange: function(callback) {
            this.listeners.push(callback);
            const session = this.getSession();
            callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
        },

        triggerAuthStateChange: function(event, session) {
            this.listeners.forEach(cb => cb(event, session));
        },

        setupAdminUserHandlers: function() {
            const createUserBtn = document.getElementById('create-user-btn');
            const userModal = document.getElementById('user-modal');
            const userCloseBtn = document.getElementById('user-close-btn');
            const createUserForm = document.getElementById('create-user-form');
            const userError = document.getElementById('user-error');
            const submitBtn = document.getElementById('new-user-submit-btn');

            if (createUserBtn && userModal) {
                this.checkAdminUserToggle();

                createUserBtn.addEventListener('click', () => {
                    userModal.classList.remove('hidden');
                    if (createUserForm) createUserForm.reset();
                    if (userError) userError.classList.add('hidden');
                });
            }

            if (userCloseBtn && userModal) {
                userCloseBtn.addEventListener('click', () => {
                    userModal.classList.add('hidden');
                });
            }

            if (createUserForm) {
                createUserForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const email = document.getElementById('new-user-email').value;
                    const password = document.getElementById('new-user-password').value;
                    const confirmPassword = document.getElementById('new-user-password-confirm').value;

                    if (password !== confirmPassword) {
                        if (userError) {
                            userError.textContent = 'As senhas não coincidem.';
                            userError.classList.remove('hidden');
                        }
                        return;
                    }

                    try {
                        if (submitBtn) {
                            submitBtn.disabled = true;
                            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando...';
                        }
                        
                        const session = this.getSession();
                        const response = await fetch('/api/auth/register', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify({ email, password })
                        });

                        const resData = await response.json();
                        if (!response.ok) {
                            throw new Error(resData.error || 'Erro ao cadastrar usuário.');
                        }

                        if (userModal) userModal.classList.add('hidden');
                        if (window.app && window.app.showNotification) {
                            window.app.showNotification('Novo usuário cadastrado com sucesso!', 'success');
                        }
                    } catch (err) {
                        if (userError) {
                            userError.textContent = err.message;
                            userError.classList.remove('hidden');
                        }
                    } finally {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Criar Conta';
                        }
                    }
                });
            }
        },

        checkAdminUserToggle: async function() {
            const createUserBtn = document.getElementById('create-user-btn');
            if (!createUserBtn) return;
            try {
                const session = this.getSession();
                if (session && session.user) {
                    const userEmail = (session.user.email || '').toLowerCase().trim();
                    const allowedAdmins = ['contato.brenomaia@hotmail.com', 'brenomaia0208@gmail.com', 'carlos.lucena@distribuidoraprovix.com'];
                    if (allowedAdmins.includes(userEmail)) {
                        createUserBtn.classList.remove('hidden');
                    }
                }
            } catch (e) {
                createUserBtn.classList.add('hidden');
            }
        }
    };
})();
