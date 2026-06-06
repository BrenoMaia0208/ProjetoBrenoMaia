// App entry point
(function() { try {
    console.log('🔧 App script loading');
    'use strict';
    'use strict';

    // Utility for notifications
    const showNotification = (message, type = 'info') => {
        const notification = document.getElementById('notification');
        const msgEl = document.getElementById('notification-message');
        if (notification && msgEl) {
            notification.className = `notification notification-${type}`;
            msgEl.textContent = message;
            notification.classList.remove('hidden');
            setTimeout(() => notification.classList.add('hidden'), 3000);
        }
    };

    const loadData = async () => {
        try {
            const filters = window.FiltersService ? window.FiltersService.getActiveFilters() : {};
            const data = await window.SupabaseService.fetchPedidos(filters);
            if (window.DashboardService) window.DashboardService.update(data);
            if (window.TableService) window.TableService.render(data);
        } catch (e) {
            console.error('Error loading data', e);
            showNotification('Erro ao carregar dados', 'error');
        }
    };

    const init = async () => {
        console.log('🚀 App init started');
        const isLogin = !!document.getElementById('login-form');
        const isDashboard = !!document.getElementById('dashboard-content');

        if (isLogin) {
            if (window.AuthService) {
                window.AuthService.init();
            } else {
                document.getElementById('loading-overlay').classList.add('hidden');
            }
            return;
        }

        if (isDashboard) {
            // Verify admin session to decide whether to show upload button
            const uploadBtn = document.getElementById('upload-btn');
            console.log('🔎 Starting admin session check');
            try {
                // Directly fetch session for debugging
                const { data: { session }, error } = await window.supabaseClient.auth.getSession();
                console.log('Supabase session object:', session);
                await window.SupabaseService.checkAdminSession();
                if (uploadBtn) uploadBtn.classList.remove('hidden');
                console.log('Admin verification passed');
                showNotification('Acesso de administrador confirmado.', 'success');
            } catch (e) {
                if (uploadBtn) uploadBtn.classList.add('hidden');
                console.warn('Admin verification failed', e);
                showNotification('Acesso de administrador negado.', 'error');
            }
            console.log('🏁 Admin session check finished');

            // Init other services
            if (window.AuthService) window.AuthService.init();
            if (window.FiltersService) {
                await window.FiltersService.init();
            } else { console.warn('FiltersService not available'); }
            if (window.TableService) {
                window.TableService.init();
            } else { console.warn('TableService not available'); }
            if (window.DashboardService) {
                window.DashboardService.init();
            } else { console.warn('DashboardService not available'); }
            if (window.UploadService) {
                window.UploadService.init();
            } else { console.warn('UploadService not available'); }
            if (window.ExportService) {
                window.ExportService.init();
            } else { console.warn('ExportService not available'); }

            await loadData();

            if (window.FiltersService) {
                window.FiltersService.onChange(() => loadData());
            }

            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) loadingOverlay.classList.add('hidden');

            const dashboardContent = document.getElementById('dashboard-content');
            if (dashboardContent) dashboardContent.classList.remove('hidden');
        }
    };

    // Expose public API
    window.app = {
        showNotification,
        loadData,
        init
    };

    // Run on DOM ready
    const runInit = () => {
        console.log('✅ DOMContentLoaded ou execução imediata disparada');
        window.app.init();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runInit);
    } else {
        runInit();
    }
} catch (e) {
    console.error('❌ App script fatal error', e);
    alert('Erro crítico ao carregar aplicação: ' + e.message);
}
})();
