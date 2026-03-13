import { supabase } from './backend/utils/supabaseClient.js';

document.getElementById('loginBtn').addEventListener('click', () => {
  alert('Login modal placeholder');
});

document.getElementById('registerBtn').addEventListener('click', () => {
  alert('Register modal placeholder');
});

async function loadFeed() {
  const { data: posts, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
  const feed = document.getElementById('feed');
  posts.forEach(post => {
    const postEl = document.createElement('div');
    postEl.className = 'post';
    postEl.innerHTML = `
      <h3>${post.username}</h3>
      <p>${post.content}</p>
    `;
    feed.appendChild(postEl);
  });
}

loadFeed();
