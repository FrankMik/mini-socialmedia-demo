const feedDiv = document.getElementById('feed');
const form = document.getElementById('postForm');
const logoutBtn = document.getElementById('logoutBtn');
const allFeedBtn = document.getElementById('allFeedBtn');
const followingFeedBtn = document.getElementById('followingFeedBtn');

let eventSource;
let followingIds = new Set();
let currentFeedUrl = '/posts';

// SSE Connection
function connectSSE() {
    if (eventSource) eventSource.close();
    eventSource = new EventSource('/events');
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_post') {
            const firstPost = feedDiv.querySelector('.post');
            const newPostDiv = createPostElement(data.post);
            if (firstPost) {
                feedDiv.insertBefore(newPostDiv, firstPost);
            } else {
                feedDiv.appendChild(newPostDiv);
            }
            // Initial für neuen Post laden
            loadLikes(data.post.id);
            loadComments(data.post.id);
        }
    };
    eventSource.onerror = () => setTimeout(connectSSE, 3000);
}

// Post-Element erstellen
function createPostElement(p) {
    const div = document.createElement('div');
    div.className = 'post';
    div.dataset.postId = p.id;

    const userId = p.user_id || p.id;
    const followLabel = followingIds.has(userId) ? 'Entfolgen' : 'Folgen';

    div.innerHTML = `
      <div class="post-header">
        <img src="${p.avatar_url || '/avatars/default-avatar.png'}" alt="Avatar" class="avatar">
        <strong>${p.username}</strong>
        <button class="followBtn" data-user-id="${userId}">${followLabel}</button>
        <small>${new Date(p.created_at).toLocaleString()}</small>
      </div>
      ${p.content ? `<p class="post-content">${p.content}</p>` : ''}
      ${p.image_url ? `<img src="${p.image_url}" class="post-image">` : ''}
      <div class="post-actions">
        <button class="likeBtn" data-id="${p.id}">
          Like <img src="images/like2.png" alt="Like" class="likeImg">
        </button>
        <span class="likeCount" id="likes-${p.id}">0</span> Likes
      </div>
      <form class="commentForm" data-id="${p.id}">
        <input type="text" name="content" placeholder="Kommentar..." required>
        <button type="submit">Kommentar</button>
      </form>
      <div class="comments" id="comments-${p.id}"></div>
    `;
    return div;
}

// Hilfsfunktionen für Daten (Global)
async function loadLikes(postId) {
    try {
        const res = await fetch(`/likes/${postId}`, { credentials: 'same-origin' });
        const data = await res.json();
        const span = document.getElementById(`likes-${postId}`);
        if (span) span.textContent = data.likes || 0;
    } catch (err) { console.error("Fehler beim Like-Laden", err); }
}

async function loadComments(postId) {
    try {
        const res = await fetch(`/comments/${postId}`, { credentials: 'same-origin' });
        const comments = await res.json();
        const commentsDiv = document.getElementById(`comments-${postId}`);
        if (!commentsDiv) return;

        const byParent = {};
        comments.forEach(c => {
            const parent = c.parent_comment_id || 0;
            (byParent[parent] ||= []).push(c);
        });

        function renderList(parentId = 0) {
            const list = byParent[parentId] || [];
            if (!list.length) return '';
            return `<ul class="comment-list">
                ${list.map(c => `
                    <li class="comment-item">
                        <div class="comment">
                            <img src="${c.avatar_url || '/avatars/default-avatar.png'}" class="avatar-small">
                            <div class="comment-content">
                                <strong>${c.username}</strong>: ${c.content}
                            </div>
                        </div>
                        <div class="comment-meta">
                            <button class="replyBtn" data-comment-id="${c.id}" data-post-id="${postId}">Antworten</button>
                        </div>
                        
                        <div class="replyForm" id="reply-form-${c.id}" style="display:none;">
                            <input type="text" id="reply-input-${c.id}" placeholder="Antwort schreiben..." class="inline-reply-input">
                            <button class="replySendBtn" data-comment-id="${c.id}" data-post-id="${postId}">Senden</button>
                        </div>
                        ${renderList(c.id)}
                    </li>
                `).join('')}
            </ul>`;
        }
        commentsDiv.innerHTML = renderList(0);
    } catch (err) { console.error("Fehler beim Kommentar-Laden", err); }
}

// Globaler Event-Listener für die Buttons
feedDiv.addEventListener('click', async (e) => {
    // 1. Like Button
    if (e.target.closest('.likeBtn')) {
        const postId = e.target.closest('.likeBtn').dataset.id;
        await fetch(`/like/${postId}`, { method: 'POST', credentials: 'same-origin' });
        loadLikes(postId);
    }

    // 2. Reply Button (Einblenden des Feldes)
    if (e.target.classList.contains('replyBtn')) {
        const cid = e.target.dataset.commentId;
        const f = document.getElementById(`reply-form-${cid}`);
        // Nutzt dein CSS für display
        f.style.display = (f.style.display === 'none' || f.style.display === '') ? 'flex' : 'none';
    }

    // 3. Senden Button für Antworten
    if (e.target.classList.contains('replySendBtn')) {
        const cid = e.target.dataset.commentId;
        const postId = e.target.dataset.postId;
        const input = document.getElementById(`reply-input-${cid}`);
        const content = input.value.trim();
        
        if (!content) return;

        await fetch(`/comment/${postId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ content, parent_comment_id: cid })
        });
        
        input.value = '';
        loadComments(postId);
    }
});

feedDiv.addEventListener('submit', async (e) => {
    if (e.target.classList.contains('commentForm')) {
        e.preventDefault();
        const postId = e.target.dataset.id;
        const content = e.target.content.value.trim();
        if (!content) return;
        await fetch(`/comment/${postId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ content })
        });
        e.target.content.value = '';
        loadComments(postId);
    }
});

async function loadFollowing() {
    const res = await fetch('/following', { credentials: 'same-origin' });
    if (res.ok) {
        const data = await res.json();
        followingIds = new Set(data.map(u => u.id));
    }
}

async function loadPosts(url = '/posts') {
    currentFeedUrl = url;
    await loadFollowing();
    const res = await fetch(url, { credentials: 'same-origin' });
    const posts = await res.json();
    feedDiv.innerHTML = '';
    posts.forEach(p => {
        feedDiv.appendChild(createPostElement(p));
        loadLikes(p.id);
        loadComments(p.id);
    });
}

// Initialisierung
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
        window.location.href = '/login.html';
    });
}

form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/post', { method: 'POST', body: new FormData(form), credentials: 'same-origin' });
    if (res.ok) { form.reset(); loadPosts(currentFeedUrl); }
});

allFeedBtn?.addEventListener('click', () => loadPosts('/posts'));
followingFeedBtn?.addEventListener('click', () => loadPosts('/posts/following'));

loadPosts();
connectSSE();