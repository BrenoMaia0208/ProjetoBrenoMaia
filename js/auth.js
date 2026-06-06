(function() {
    'use strict';

    window.AuthService = {
        init: function() {
            const isLoginPage = !!document.getElementById('login-form');
            const isDashboardPage = !!document.getElementById('dashboard-content');

            if (isLoginPage) {
                this.setupLoginHandlers();
                this.checkSessionForLogin();
            } else if (isDashboardPage) {
                this.checkSessionForDashboard();
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

        checkSessionForLogin: async function() {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                window.location.href = 'dashboard.html';
            } else {
                document.getElementById('loading-overlay').classList.add('hidden');
            }
        },

        checkSessionForDashboard: async function() {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
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
            
            return session;
        },

        login: async function(email, password) {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });
            if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Credenciais inválidas' : error.message);
            return data;
        },

        register: async function(email, password) {
            const { data, error } = await window.supabaseClient.auth.signUp({
                email: email,
                password: password,
            });
            if (error) throw new Error(error.message);
            return data;
        },

        logout: async function() {
            const { error } = await window.supabaseClient.auth.signOut();
            if (error) console.error('Error logging out:', error);
        },

        getUser: async function() {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            return user;
        },

        onAuthStateChange: function(callback) {
            window.supabaseClient.auth.onAuthStateChange(callback);
        }
    };
})();
