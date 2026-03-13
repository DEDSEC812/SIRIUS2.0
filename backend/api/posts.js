import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    const { method } = req;
    const { id, action } = req.query;
    
    try {
        switch (method) {
            case 'GET':
                if (id) {
                    return await getPostById(req, res, id);
                } else if (action === 'feed') {
                    return await getFeed(req, res);
                } else if (action === 'trending') {
                    return await getTrendingPosts(req, res);
                } else {
                    return await getAllPosts(req, res);
                }
            case 'POST':
                return await createPost(req, res);
            case 'PUT':
                if (action === 'like') {
                    return await toggleLike(req, res);
                } else if (action === 'view') {
                    return await incrementViews(req, res);
                } else {
                    return await updatePost(req, res, id);
                }
            case 'DELETE':
                return await deletePost(req, res, id);
            default:
                res.status(405).json({ error: 'Méthode non autorisée' });
        }
    } catch (error) {
        console.error('Posts API Error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function getAllPosts(req, res) {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const { data, error, count } = await supabase
        .from('posts')
        .select(`
            *,
            users!inner(*),
            likes(count),
            comments(count)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
    if (error) throw error;
    
    res.json({
        posts: data,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
        }
    });
}

async function getPostById(req, res, id) {
    const { data, error } = await supabase
        .from('posts')
        .select(`
            *,
            users!inner(*),
            likes(
                *,
                users!inner(*)
            ),
            comments(
                *,
                users!inner(*)
            )
        `)
        .eq('id', id)
        .single();
        
    if (error) throw error;
    if (!data) {
        return res.status(404).json({ error: 'Post non trouvé' });
    }
    
    res.json(data);
}

async function getFeed(req, res) {
    const { userId, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    // Récupérer les IDs des utilisateurs suivis
    const { data: following } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', userId);
        
    const followingIds = following.map(f => f.following_id);
    
    const { data, error, count } = await supabase
        .from('posts')
        .select(`
            *,
            users!inner(*),
            likes(count),
            comments(count)
        `, { count: 'exact' })
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
    if (error) throw error;
    
    res.json({
        posts: data,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
        }
    });
}

async function getTrendingPosts(req, res) {
    const { limit = 20 } = req.query;
    
    const { data, error } = await supabase
        .from('posts')
        .select(`
            *,
            users!inner(*),
            likes(count),
            comments(count)
        `)
        .order('views', { ascending: false })
        .limit(limit);
        
    if (error) throw error;
    
    res.json(data);
}

async function createPost(req, res) {
    const { userId, content, type, mediaUrls, location, hashtags, taggedUsers } = req.body;
    
    if (!userId || !content) {
        return res.status(400).json({ error: 'userId et content requis' });
    }
    
    const { data, error } = await supabase
        .from('posts')
        .insert({
            user_id: userId,
            content,
            type: type || 'text',
            media_urls: mediaUrls || [],
            location,
            hashtags: hashtags || [],
            tagged_users: taggedUsers || [],
            created_at: new Date()
        })
        .select()
        .single();
        
    if (error) throw error;
    
    // Créer des notifications pour les utilisateurs tagués
    if (taggedUsers && taggedUsers.length > 0) {
        const notifications = taggedUsers.map(userId => ({
            user_id: userId,
            type: 'tag',
            content: 'Vous avez été tagué dans une publication',
            related_id: data.id,
            created_at: new Date()
        }));
        
        await supabase.from('notifications').insert(notifications);
    }
    
    res.status(201).json(data);
}

async function updatePost(req, res, id) {
    const { content, location, hashtags } = req.body;
    
    const { data, error } = await supabase
        .from('posts')
        .update({
            content,
            location,
            hashtags,
            updated_at: new Date()
        })
        .eq('id', id)
        .select()
        .single();
        
    if (error) throw error;
    
    res.json(data);
}

async function deletePost(req, res, id) {
    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);
        
    if (error) throw error;
    
    res.json({ message: 'Post supprimé avec succès' });
}

async function toggleLike(req, res) {
    const { userId, postId } = req.body;
    
    if (!userId || !postId) {
        return res.status(400).json({ error: 'userId et postId requis' });
    }
    
    // Vérifier si le like existe déjà
    const { data: existingLike } = await supabase
        .from('likes')
        .select('*')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .single();
        
    if (existingLike) {
        // Supprimer le like
        await supabase
            .from('likes')
            .delete()
            .eq('id', existingLike.id);
            
        res.json({ liked: false });
    } else {
        // Ajouter le like
        await supabase
            .from('likes')
            .insert({
                user_id: userId,
                post_id: postId,
                created_at: new Date()
            });
            
        // Récupérer l'ID du propriétaire du post pour la notification
        const { data: post } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', postId)
            .single();
            
        if (post && post.user_id !== userId) {
            // Créer une notification
            await supabase
                .from('notifications')
                .insert({
                    user_id: post.user_id,
                    type: 'like',
                    content: 'a aimé votre publication',
                    related_id: postId,
                    created_at: new Date()
                });
        }
        
        res.json({ liked: true });
    }
}

async function incrementViews(req, res) {
    const { postId } = req.body;
    
    if (!postId) {
        return res.status(400).json({ error: 'postId requis' });
    }
    
    await supabase.rpc('increment_post_views', { post_id: postId });
    
    res.json({ success: true });
}
