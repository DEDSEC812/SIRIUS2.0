import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    const { action } = req.query;
    
    try {
        switch (action) {
            case 'register':
                return await handleRegister(req, res);
            case 'login':
                return await handleLogin(req, res);
            case 'logout':
                return await handleLogout(req, res);
            case 'reset-password':
                return await handleResetPassword(req, res);
            default:
                res.status(404).json({ error: 'Action non trouvée' });
        }
    } catch (error) {
        console.error('Auth API Error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function handleRegister(req, res) {
    const { email, password, username, name } = req.body;
    
    // Validation
    if (!email || !password || !username || !name) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    // Vérifier si l'username est unique
    const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        eq('username', username)
        .single();
        
    if (existingUser) {
        return res.status(400).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
    }
    
    // Créer l'utilisateur dans Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
    });
    
    if (authError) throw authError;
    
    // Créer le profil utilisateur
    const { error: profileError } = await supabase
        .from('users')
        .insert({
            id: authData.user.id,
            username,
            name,
            email,
            created_at: new Date()
        });
        
    if (profileError) throw profileError;
    
    res.status(201).json({ 
        message: 'Inscription réussie',
        user: authData.user 
    });
}

async function handleLogin(req, res) {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) throw error;
    
    res.json({ 
        message: 'Connexion réussie',
        user: data.user,
        session: data.session 
    });
}

async function handleLogout(req, res) {
    const { error } = await supabase.auth.signOut();
    
    if (error) throw error;
    
    res.json({ message: 'Déconnexion réussie' });
}

async function handleResetPassword(req, res) {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.APP_URL}/reset-password`
    });
    
    if (error) throw error;
    
    res.json({ message: 'Email de réinitialisation envoyé' });
}
