// Initialisation de Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// État global de l application
let currentUser = null;
let currentTheme = localStorage.getItem( theme ) ||  light ;
let currentPage =  home ;
let currentFeed =  home ;
let currentProfile = null;

// Initialisation
document.addEventListener( DOMContentLoaded , () => {
    initializeApp();
});

async function initializeApp() {
    // Vérifier la session
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        showMainApp();
    } else {
        showAuthScreen();
    }
    
    // Appliquer le thème sauvegardé
    document.documentElement.setAttribute( data-theme , currentTheme);
    
    // Initialiser les écouteurs d événements
    initializeEventListeners();
    
    // Configurer les abonnements en temps réel
    setupRealtimeSubscriptions();
}

function initializeEventListeners() {
    // Navigation
    document.querySelectorAll( [data-page] ).forEach(link => {
        link.addEventListener( click , (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });
    
    // Auth
    document.getElementById( showRegister ).addEventListener( click , (e) => {
        e.preventDefault();
        showRegisterForm();
    });
    
    document.getElementById( showLogin ).addEventListener( click , (e) => {
        e.preventDefault();
        showLoginForm();
    });
    
    document.getElementById( loginForm ).addEventListener( submit , handleLogin);
    document.getElementById( registerForm ).addEventListener( submit , handleRegister);
    document.getElementById( logoutBtn ).addEventListener( click , handleLogout);
    
    // Profile menu
    document.getElementById( profileMenuButton ).addEventListener( click , toggleProfileMenu);
    
    // Theme toggle
    document.getElementById( themeToggle ).addEventListener( click , toggleTheme);
    
    // Create post
    document.getElementById( postInput ).addEventListener( click , openCreatePostModal);
    document.querySelectorAll( .post-action ).forEach(btn => {
        btn.addEventListener( click , (e) => {
            e.preventDefault();
            openCreatePostModal(btn.id);
        });
    });
    
    // Modal close
    document.querySelector( .close-modal ).addEventListener( click , closeCreatePostModal);
    document.getElementById( cancelPost ).addEventListener( click , closeCreatePostModal);
    
    // Post type selector
    document.querySelectorAll( .post-type-btn ).forEach(btn => {
        btn.addEventListener( click , () => selectPostType(btn.dataset.type));
    });
    
    // Media upload
    document.getElementById( uploadImageBtn ).addEventListener( click , () => {
        document.getElementById( mediaUpload ).click();
    });
    
    document.getElementById( mediaUpload ).addEventListener( change , handleMediaUpload);
    
    // Publish post
    document.getElementById( publishPost ).addEventListener( click , publishPost);
    
    // Feed filters
    document.querySelectorAll( .filter-btn ).forEach(btn => {
        btn.addEventListener( click , () => {
            currentFeed = btn.dataset.feed;
            document.querySelectorAll( .filter-btn ).forEach(b => b.classList.remove( active ));
            btn.classList.add( active );
            loadFeed(currentFeed);
        });
    });
    
    // Profile tabs
    document.querySelectorAll( .tab-btn ).forEach(btn => {
        btn.addEventListener( click , () => {
            document.querySelectorAll( .tab-btn ).forEach(b => b.classList.remove( active ));
            btn.classList.add( active );
            loadProfileTab(btn.dataset.tab);
        });
    });
    
    // Edit profile
    document.getElementById( editProfileBtn )?.addEventListener( click , openEditProfileModal);
    document.getElementById( followBtn )?.addEventListener( click , toggleFollow);
    
    // Close dropdown when clicking outside
    window.addEventListener( click , (e) => {
        if (!e.target.matches( .profile-menu img )) {
            document.getElementById( profileDropdown ).classList.remove( show );
        }
    });
    
    // Infinite scroll
    window.addEventListener( scroll , handleInfiniteScroll);
}

function setupRealtimeSubscriptions() {
    if (!currentUser) return;
    
    // Notifications en temps réel
    supabaseClient
        .channel( notifications )
        .on( postgres_changes , { 
            event:  INSERT , 
            schema:  public , 
            table:  notifications ,
            filter: `user_id=eq.${currentUser.id}`
        }, handleNewNotification)
        .subscribe();
    
    // Messages en temps réel
    supabaseClient
        .channel( messages )
        .on( postgres_changes , { 
            event:  INSERT , 
            schema:  public , 
            table:  messages ,
            filter: `receiver_id=eq.${currentUser.id}`
        }, handleNewMessage)
        .subscribe();
    
    // Nouveaux posts
    supabaseClient
        .channel( posts )
        .on( postgres_changes , { 
            event:  INSERT , 
            schema:  public , 
            table:  posts  
        }, handleNewPost)
        .subscribe();
}

// Navigation
function navigateTo(page) {
    currentPage = page;
    
    // Mettre à jour la navigation active
    document.querySelectorAll( .nav-item ).forEach(item => {
        item.classList.remove( active );
        if (item.dataset.page === page) {
            item.classList.add( active );
        }
    });
    
    // Cacher toutes les pages
    document.querySelectorAll( #home-page, #profile-page, #auth-container ).forEach(el => {
        el.style.display =  none ;
    });
    
    // Afficher la page demandée
    switch(page) {
        case  home :
            document.getElementById( home-page ).style.display =  block ;
            loadFeed(currentFeed);
            loadStories();
            break;
        case  profile :
            document.getElementById( profile-page ).style.display =  block ;
            loadProfile(currentUser?.id);
            break;
        case  explore :
            loadExplore();
            break;
        case  reels :
            loadReels();
            break;
        case  groups :
            loadGroups();
            break;
        case  messages :
            loadMessages();
            break;
        case  notifications :
            loadNotifications();
            break;
    }
}

// Auth functions
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById( loginEmail ).value;
    const password = document.getElementById( loginPassword ).value;
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        await loadUserProfile();
        showMainApp();
        showToast( Connexion réussie! ,  success );
    } catch (error) {
        showToast(error.message,  error );
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const email = document.getElementById( regEmail ).value;
    const username = document.getElementById( regUsername ).value;
    const name = document.getElementById( regName ).value;
    const password = document.getElementById( regPassword ).value;
    const confirmPassword = document.getElementById( regConfirmPassword ).value;
    
    if (password !== confirmPassword) {
        showToast( Les mots de passe ne correspondent pas ,  error );
        return;
    }
    
    try {
        // Vérifier si l username est unique
        const { data: existingUser } = await supabaseClient
            .from( users )
            .select( username )
            .eq( username , username)
            .single();
            
        if (existingUser) {
            showToast( Ce nom d\ utilisateur est déjà pris ,  error );
            return;
        }
        
        // Créer l utilisateur dans Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email,
            password
        });
        
        if (authError) throw authError;
        
        // Créer le profil utilisateur
        const { error: profileError } = await supabaseClient
            .from( users )
            .insert({
                id: authData.user.id,
                username,
                name,
                email,
                created_at: new Date(),
                name_updated_at: new Date()
            });
            
        if (profileError) throw profileError;
        
        currentUser = authData.user;
        showMainApp();
        showToast( Inscription réussie! ,  success );
    } catch (error) {
        showToast(error.message,  error );
    }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        showAuthScreen();
        showToast( Déconnexion réussie ,  success );
    } catch (error) {
        showToast(error.message,  error );
    }
}

// Profile functions
async function loadUserProfile() {
    try {
        const { data, error } = await supabaseClient
            .from( users )
            .select( * )
            .eq( id , currentUser.id)
            .single();
            
        if (error) throw error;
        
        currentUser = { ...currentUser, ...data };
        
        // Mettre à jour l UI
        document.getElementById( profileMenuButton ).src = currentUser.avatar_url ||  https://via.placeholder.com/40 ;
    } catch (error) {
        console.error( Error loading profile: , error);
    }
}

async function loadProfile(userId) {
    try {
        const { data: profile, error } = await supabaseClient
            .from( users )
            .select(`
                *,
                followers:followers!follower_id(count),
                following:followers!following_id(count),
                posts(count)
            `)
            .eq( id , userId || currentUser.id)
            .single();
            
        if (error) throw error;
        
        currentProfile = profile;
        
        // Mettre à jour l UI
        document.getElementById( profileName ).textContent = profile.name;
        document.getElementById( profileUsername ).textContent = `@${profile.username}`;
        document.getElementById( profileBio ).textContent = profile.bio ||  Aucune bio pour le moment ;
        document.getElementById( profileAvatar ).src = profile.avatar_url ||  https://via.placeholder.com/150 ;
        
        if (profile.cover_url) {
            document.getElementById( coverPhoto ).style.backgroundImage = `url(${profile.cover_url})`;
        }
        
        document.getElementById( postsCount ).textContent = profile.posts[0].count;
        document.getElementById( followersCount ).textContent = profile.followers[0].count;
        document.getElementById( followingCount ).textContent = profile.following[0].count;
        
        // Vérifier si c est le profil de l utilisateur connecté
        const isOwnProfile = userId === currentUser.id || !userId;
        
        if (isOwnProfile) {
            document.getElementById( editProfileBtn ).style.display =  block ;
            document.getElementById( followBtn ).style.display =  none ;
        } else {
            document.getElementById( editProfileBtn ).style.display =  none ;
            document.getElementById( followBtn ).style.display =  block ;
            
            // Vérifier si l utilisateur suit déjà ce profil
            const { data: followStatus } = await supabaseClient
                .from( followers )
                .select( * )
                .eq( follower_id , currentUser.id)
                .eq( following_id , userId)
                .single();
                
            if (followStatus) {
                document.getElementById( followBtn ).textContent =  Ne plus suivre ;
            } else {
                document.getElementById( followBtn ).textContent =  Suivre ;
            }
        }
        
        // Charger les posts du profil
        loadProfilePosts(userId || currentUser.id);
    } catch (error) {
        console.error( Error loading profile: , error);
    }
}

async function loadProfilePosts(userId) {
    try {
        const { data: posts, error } = await supabaseClient
            .from( posts )
            .select(`
                *,
                users!inner(*),
                likes(count),
                comments(count)
            `)
            .eq( user_id , userId)
            .order( created_at , { ascending: false });
            
        if (error) throw error;
        
        displayPosts(posts,  profilePosts );
    } catch (error) {
        console.error( Error loading profile posts: , error);
    }
}

// Feed functions
async function loadFeed(type =  home ) {
    try {
        let query = supabaseClient
            .from( posts )
            .select(`
                *,
                users!inner(*),
                likes(count),
                comments(count)
            `)
            .order( created_at , { ascending: false })
            .limit(APP_CONFIG.postsPerPage);
            
        if (type ===  following  && currentUser) {
            // Posts des personnes suivies
            const { data: following } = await supabaseClient
                .from( followers )
                .select( following_id )
                .eq( follower_id , currentUser.id);
                
            const followingIds = following.map(f => f.following_id);
            query = query.in( user_id , followingIds);
        } else if (type ===  trending ) {
            // Posts avec le plus d interactions
            // À implémenter avec un calcul de score
        }
        
        const { data: posts, error } = await query;
        
        if (error) throw error;
        
        displayPosts(posts,  postsFeed );
    } catch (error) {
        console.error( Error loading feed: , error);
    }
}

async function loadStories() {
    try {
        const { data: stories, error } = await supabaseClient
            .from( stories )
            .select(`
                *,
                users!inner(*)
            `)
            .gt( expires_at , new Date().toISOString())
            .order( created_at , { ascending: false });
            
        if (error) throw error;
        
        displayStories(stories);
    } catch (error) {
        console.error( Error loading stories: , error);
    }
}

// Post functions
async function publishPost() {
    const content = document.getElementById( postContent ).value;
    const type = document.querySelector( .post-type-btn.active ).dataset.type;
    
    if (!content && type ===  text ) {
        showToast( Veuillez écrire quelque chose ,  error );
        return;
    }
    
    try {
        let mediaUrls = [];
        
        // Upload des médias si présents
        const files = document.getElementById( mediaUpload ).files;
        if (files.length > 0) {
            mediaUrls = await uploadMedia(files);
        }
        
        const postData = {
            user_id: currentUser.id,
            content,
            type,
            media_urls: mediaUrls,
            created_at: new Date()
        };
        
        const { data, error } = await supabaseClient
            .from( posts )
            .insert(postData)
            .select()
            .single();
            
        if (error) throw error;
        
        closeCreatePostModal();
        showToast( Publication réussie! ,  success );
        
        // Ajouter le nouveau post au feed
        const postWithUser = { ...data, users: currentUser };
        addPostToFeed(postWithUser);
    } catch (error) {
        console.error( Error publishing post: , error);
        showToast( Erreur lors de la publication ,  error );
    }
}

async function uploadMedia(files) {
    const urls = [];
    
    for (const file of files) {
        // Vérifier la taille du fichier
        if (file.size > APP_CONFIG.maxFileSize) {
            throw new Error(`Le fichier ${file.name} est trop volumineux`);
        }
        
        // Vérifier le type de fichier
        const isValidImage = APP_CONFIG.allowedImageTypes.includes(file.type);
        const isValidVideo = APP_CONFIG.allowedVideoTypes.includes(file.type);
        
        if (!isValidImage && !isValidVideo) {
            throw new Error(`Type de fichier non supporté: ${file.type}`);
        }
        
        const fileName = `${currentUser.id}/${Date.now()}_${file.name}`;
        const filePath = `posts/${fileName}`;
        
        const { data, error } = await supabaseClient.storage
            .from( media )
            .upload(filePath, file);
            
        if (error) throw error;
        
        const { data: { publicUrl } } = supabaseClient.storage
            .from( media )
            .getPublicUrl(filePath);
            
        urls.push(publicUrl);
    }
    
    return urls;
}

async function handleLike(postId, button) {
    try {
        // Vérifier si l utilisateur a déjà liké
        const { data: existingLike } = await supabaseClient
            .from( likes )
            .select( * )
            .eq( user_id , currentUser.id)
            .eq( post_id , postId)
            .single();
            
        if (existingLike) {
            // Unlike
            await supabaseClient
                .from( likes )
                .delete()
                .eq( id , existingLike.id);
                
            button.classList.remove( liked );
            updateLikeCount(postId, -1);
        } else {
            // Like
            await supabaseClient
                .from( likes )
                .insert({
                    user_id: currentUser.id,
                    post_id: postId,
                    created_at: new Date()
                });
                
            button.classList.add( liked );
            updateLikeCount(postId, 1);
            
            // Créer une notification
            await createNotification({
                user_id: postUserId,
                type:  like ,
                content: `${currentUser.name} a aimé votre publication`,
                post_id: postId
            });
        }
    } catch (error) {
        console.error( Error handling like: , error);
    }
}

async function addComment(postId, commentText) {
    if (!commentText.trim()) return;
    
    try {
        const { data, error } = await supabaseClient
            .from( comments )
            .insert({
                user_id: currentUser.id,
                post_id: postId,
                content: commentText,
                created_at: new Date()
            })
            .select(`
                *,
                users!inner(*)
            `)
            .single();
            
        if (error) throw error;
        
        // Ajouter le commentaire à l UI
        displayComment(data);
        
        // Créer une notification
        await createNotification({
            user_id: postUserId,
            type:  comment ,
            content: `${currentUser.name} a commenté votre publication`,
            post_id: postId
        });
    } catch (error) {
        console.error( Error adding comment: , error);
    }
}

// Story functions
async function createStory(file) {
    try {
        const fileName = `${currentUser.id}/story_${Date.now()}_${file.name}`;
        const filePath = `stories/${fileName}`;
        
        const { data, error } = await supabaseClient.storage
            .from( media )
            .upload(filePath, file);
            
        if (error) throw error;
        
        const { data: { publicUrl } } = supabaseClient.storage
            .from( media )
            .getPublicUrl(filePath);
            
        const storyData = {
            user_id: currentUser.id,
            media_url: publicUrl,
            media_type: file.type.startsWith( image/ ) ?  image  :  video ,
            created_at: new Date(),
            expires_at: new Date(Date.now() + APP_CONFIG.storiesExpiry)
        };
        
        const { error: dbError } = await supabaseClient
            .from( stories )
            .insert(storyData);
            
        if (dbError) throw dbError;
        
        showToast( Story publiée! ,  success );
    } catch (error) {
        console.error( Error creating story: , error);
        showToast( Erreur lors de la création de la story ,  error );
    }
}

// Notification functions
async function createNotification(notification) {
    try {
        await supabaseClient
            .from( notifications )
            .insert({
                ...notification,
                created_at: new Date()
            });
    } catch (error) {
        console.error( Error creating notification: , error);
    }
}

// UI helper functions
function showAuthScreen() {
    document.getElementById( navbar ).style.display =  none ;
    document.getElementById( main-content ).style.marginTop =  0 ;
    document.getElementById( auth-container ).style.display =  block ;
    document.getElementById( home-page ).style.display =  none ;
    document.getElementById( profile-page ).style.display =  none ;
}

function showMainApp() {
    document.getElementById( navbar ).style.display =  block ;
    document.getElementById( main-content ).style.marginTop =  70px ;
    document.getElementById( auth-container ).style.display =  none ;
    document.getElementById( home-page ).style.display =  block ;
}

function showLoginForm() {
    document.getElementById( login-form ).style.display =  block ;
    document.getElementById( register-form ).style.display =  none ;
}

function showRegisterForm() {
    document.getElementById( login-form ).style.display =  none ;
    document.getElementById( register-form ).style.display =  block ;
}

function toggleProfileMenu() {
    document.getElementById( profileDropdown ).classList.toggle( show );
}

function toggleTheme() {
    currentTheme = currentTheme ===  light  ?  dark  :  light ;
    document.documentElement.setAttribute( data-theme , currentTheme);
    localStorage.setItem( theme , currentTheme);
    
    const themeIcon = document.querySelector( #themeToggle i );
    if (currentTheme ===  dark ) {
        themeIcon.classList.remove( fa-moon );
        themeIcon.classList.add( fa-sun );
        document.querySelector( #themeToggle ).innerHTML =  <i class="fas fa-sun"></i> Mode clair ;
    } else {
        themeIcon.classList.remove( fa-sun );
        themeIcon.classList.add( fa-moon );
        document.querySelector( #themeToggle ).innerHTML =  <i class="fas fa-moon"></i> Mode sombre ;
    }
}

function openCreatePostModal(trigger) {
    document.getElementById( createPostModal ).style.display =  flex ;
}

function closeCreatePostModal() {
    document.getElementById( createPostModal ).style.display =  none ;
    document.getElementById( postContent ).value =   ;
    document.getElementById( mediaPreview ).innerHTML =   ;
    document.getElementById( mediaUpload ).value =   ;
}

function selectPostType(type) {
    document.querySelectorAll( .post-type-btn ).forEach(btn => {
        btn.classList.remove( active );
    });
    document.querySelector(`.post-type-btn[data-type="${type}"]`).classList.add( active );
}

function handleMediaUpload(e) {
    const files = Array.from(e.target.files);
    const preview = document.getElementById( mediaPreview );
    preview.innerHTML =   ;
    
    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement( div );
            previewItem.className =  preview-item ;
            
            if (file.type.startsWith( image/ )) {
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <button class="remove-preview" data-index="${index}">&times;</button>
                `;
            } else {
                previewItem.innerHTML = `
                    <video src="${e.target.result}"></video>
                    <button class="remove-preview" data-index="${index}">&times;</button>
                `;
            }
            
            preview.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
    
    // Ajouter les écouteurs pour supprimer les aperçus
    document.querySelectorAll( .remove-preview ).forEach(btn => {
        btn.addEventListener( click , (e) => {
            e.preventDefault();
            const index = btn.dataset.index;
            const dt = new DataTransfer();
            const files = document.getElementById( mediaUpload ).files;
            
            for (let i = 0; i < files.length; i++) {
                if (i !== parseInt(index)) {
                    dt.items.add(files[i]);
                }
            }
            
            document.getElementById( mediaUpload ).files = dt.files;
            btn.parentElement.remove();
        });
    });
}

function displayPosts(posts, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML =   ;
    
    posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

function createPostElement(post) {
    const postDiv = document.createElement( div );
    postDiv.className =  post-card ;
    postDiv.dataset.postId = post.id;
    
    const timeAgo = getTimeAgo(post.created_at);
    const likeCount = post.likes[0]?.count || 0;
    const commentCount = post.comments[0]?.count || 0;
    
    postDiv.innerHTML = `
        <div class="post-header">
            <img src="${post.users.avatar_url ||  https://via.placeholder.com/40 }" alt="Avatar" class="post-avatar">
            <div class="post-user-info">
                <h3>${post.users.name}</h3>
                <span class="post-time">@${post.users.username} · ${timeAgo}</span>
            </div>
            <button class="post-options-btn">
                <i class="fas fa-ellipsis-h"></i>
            </button>
        </div>
        
        <div class="post-content">
            <p class="post-text">${post.content}</p>
            ${post.media_urls && post.media_urls.length > 0 ? `
                <div class="post-media-container">
                    ${post.media_urls.map(url => `
                        ${url.match(/\.(mp4|webm|ogg)$/i) ? 
                            `<video src="${url}" controls class="post-media"></video>` : 
                            `<img src="${url}" alt="Post media" class="post-media">`
                        }
                    `).join(  )}
                </div>
            ` :   }
        </div>
        
        <div class="post-stats">
            <span><i class="fas fa-heart"></i> ${likeCount} j aime</span>
            <span>${commentCount} commentaires</span>
        </div>
        
        <div class="post-actions-bar">
            <button class="post-action-btn like-btn">
                <i class="far fa-heart"></i> J aime
            </button>
            <button class="post-action-btn comment-btn">
                <i class="far fa-comment"></i> Commenter
            </button>
            <button class="post-action-btn share-btn">
                <i class="far fa-share-square"></i> Partager
            </button>
            <button class="post-action-btn save-btn">
                <i class="far fa-bookmark"></i>
            </button>
        </div>
        
        <div class="comments-section" style="display: none;">
            <div class="comments-list" id="comments-${post.id}"></div>
            <div class="add-comment">
                <input type="text" placeholder="Écrire un commentaire..." class="comment-input-${post.id}">
                <button class="submit-comment" data-post-id="${post.id}">Publier</button>
            </div>
        </div>
    `;
    
    // Ajouter les écouteurs d événements
    const likeBtn = postDiv.querySelector( .like-btn );
    likeBtn.addEventListener( click , () => handleLike(post.id, likeBtn));
    
    const commentBtn = postDiv.querySelector( .comment-btn );
    commentBtn.addEventListener( click , () => toggleComments(post.id));
    
    const submitComment = postDiv.querySelector( .submit-comment );
    submitComment.addEventListener( click , () => {
        const input = postDiv.querySelector(`.comment-input-${post.id}`);
        addComment(post.id, input.value);
        input.value =   ;
    });
    
    return postDiv;
}

function displayStories(stories) {
    const container = document.getElementById( storiesList );
    if (!container) return;
    
    container.innerHTML =   ;
    
    // Ajouter l option pour créer une story
    if (currentUser) {
        const createStoryDiv = document.createElement( div );
        createStoryDiv.className =  story-item create-story ;
        createStoryDiv.innerHTML = `
            <div class="story-avatar" style="background: linear-gradient(45deg, var(--primary-color), var(--secondary-color)); display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-plus" style="color: white; font-size: 30px;"></i>
            </div>
            <span class="story-username">Ajouter</span>
        `;
        createStoryDiv.addEventListener( click , () => {
            const input = document.createElement( input );
            input.type =  file ;
            input.accept =  image/*,video/* ;
            input.onchange = (e) => createStory(e.target.files[0]);
            input.click();
        });
        container.appendChild(createStoryDiv);
    }
    
    stories.forEach(story => {
        const storyDiv = document.createElement( div );
        storyDiv.className =  story-item ;
        storyDiv.innerHTML = `
            <div class="story-avatar">
                <img src="${story.users.avatar_url ||  https://via.placeholder.com/70 }" alt="Story">
            </div>
            <span class="story-username">${story.users.username}</span>
        `;
        storyDiv.addEventListener( click , () => openStoryViewer(story));
        container.appendChild(storyDiv);
    });
}

function displayComment(comment) {
    const commentsList = document.getElementById(`comments-${comment.post_id}`);
    if (!commentsList) return;
    
    const commentDiv = document.createElement( div );
    commentDiv.className =  comment ;
    commentDiv.innerHTML = `
        <img src="${comment.users.avatar_url ||  https://via.placeholder.com/32 }" alt="Avatar" class="comment-avatar">
        <div class="comment-content">
            <div class="comment-header">
                <span class="comment-author">${comment.users.name}</span>
                <span class="comment-time">${getTimeAgo(comment.created_at)}</span>
            </div>
            <p class="comment-text">${comment.content}</p>
            <div class="comment-actions">
                <button>J aime</button>
                <button>Répondre</button>
            </div>
        </div>
    `;
    
    commentsList.appendChild(commentDiv);
}

function toggleComments(postId) {
    const commentsSection = document.querySelector(`#post-${postId} .comments-section`);
    if (commentsSection) {
        commentsSection.style.display = commentsSection.style.display ===  none  ?  block  :  none ;
        
        if (commentsSection.style.display ===  block ) {
            loadComments(postId);
        }
    }
}

async function loadComments(postId) {
    try {
        const { data: comments, error } = await supabaseClient
            .from( comments )
            .select(`
                *,
                users!inner(*)
            `)
            .eq( post_id , postId)
            .order( created_at , { ascending: true });
            
        if (error) throw error;
        
        const commentsList = document.getElementById(`comments-${postId}`);
        commentsList.innerHTML =   ;
        
        comments.forEach(comment => displayComment(comment));
    } catch (error) {
        console.error( Error loading comments: , error);
    }
}

async function updateLikeCount(postId, change) {
    const postElement = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (postElement) {
        const likeStat = postElement.querySelector( .post-stats span:first-child );
        const currentLikes = parseInt(likeStat.textContent.match(/\d+/)[0]);
        likeStat.innerHTML = `<i class="fas fa-heart"></i> ${currentLikes + change} j aime`;
    }
}

// Utility functions
function getTimeAgo(date) {
    const now = new Date();
    const postDate = new Date(date);
    const diffInSeconds = Math.floor((now - postDate) / 1000);
    
    if (diffInSeconds < 60) return  à l\ instant ;
    if (diffInSeconds < 3600) return `il y a ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `il y a ${Math.floor(diffInSeconds / 3600)} h`;
    if (diffInSeconds < 604800) return `il y a ${Math.floor(diffInSeconds / 86400)} j`;
    return postDate.toLocaleDateString();
}

function showToast(message, type =  info ) {
    const toast = document.createElement( div );
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function handleInfiniteScroll() {
    const scrollY = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const threshold = height - 200;
    
    if (scrollY > threshold) {
        // Charger plus de posts
        loadMorePosts();
    }
}

async function loadMorePosts() {
    // À implémenter : pagination
}

// Realtime handlers
function handleNewNotification(payload) {
    const badge = document.getElementById( notificationBadge );
    const currentCount = parseInt(badge.textContent) || 0;
    badge.textContent = currentCount + 1;
    badge.style.display =  block ;
    
    showToast( Nouvelle notification! ,  info );
}

function handleNewMessage(payload) {
    const badge = document.getElementById( messageBadge );
    const currentCount = parseInt(badge.textContent) || 0;
    badge.textContent = currentCount + 1;
    badge.style.display =  block ;
    
    showToast( Nouveau message! ,  info );
}

function handleNewPost(payload) {
    if (currentPage ===  home ) {
        // Recharger le feed si on est sur la page d accueil
        loadFeed(currentFeed);
    }
}

function addPostToFeed(post) {
    const feed = document.getElementById( postsFeed );
    if (feed) {
        const postElement = createPostElement(post);
        feed.insertBefore(postElement, feed.firstChild);
    }
}
