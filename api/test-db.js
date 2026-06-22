const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: rows, error } = await supabase
            .from('pedidos')
            .select('*')
            .ilike('cidade', '%Guaraciaba%');

        if (error) throw error;

        return res.status(200).json({ 
            count: rows.length, 
            serviceRoleKeyDefined: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            rows 
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
