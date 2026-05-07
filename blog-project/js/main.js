/* =========================================================
   PlacementPrep Hub - Vanilla JavaScript (No dependencies)
   ========================================================= */

const BlogStore = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { console.error("localStorage read:", key, e); return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.error("localStorage write:", key, e); return false; }
  },
  remove(key) {
    try { localStorage.removeItem(key); }
    catch (e) { console.error("localStorage remove:", key, e); }
  }
};

/* ===== Lightweight backend sync (same JS stack) ===== */
const SyncStoreAPI = {
  enabled: /^https?:/i.test(window.location.protocol),
  getLocalSnapshot() {
    const snapshot = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      try { snapshot[key] = JSON.parse(raw); }
      catch (e) { console.warn("Skipping non-JSON local key:", key, e); }
    }
    return snapshot;
  },
  async mergeLocalIntoServer(data) {
    if (!this.enabled) return;
    try {
      await fetch("/api/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data })
      });
    } catch (e) {
      console.warn("Server merge sync skipped:", e);
    }
  },
  async hydrateLocalFromServer() {
    if (!this.enabled) return;
    try {
      const response = await fetch("/api/store", { headers: { "Accept": "application/json" } });
      if (!response.ok) return;
      const payload = await response.json();
      const serverData = payload && payload.data && typeof payload.data === "object" ? payload.data : {};
      const localData = this.getLocalSnapshot();

      // One-time reconciliation:
      // - Pull server data into local storage
      // - Push local-only keys to server so existing browser data is not lost
      Object.keys(serverData).forEach((key) => {
        try { localStorage.setItem(key, JSON.stringify(serverData[key])); }
        catch (e) { console.error("localStorage hydrate:", key, e); }
      });

      const localOnly = {};
      Object.keys(localData).forEach((key) => {
        if (!(key in serverData)) localOnly[key] = localData[key];
      });
      if (Object.keys(localOnly).length > 0) await this.mergeLocalIntoServer(localOnly);
    } catch (e) {
      console.warn("Server hydrate skipped:", e);
    }
  },
  async setKey(key, value) {
    if (!this.enabled) return;
    try {
      await fetch(`/api/store/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
      });
    } catch (e) {
      console.warn("Server sync set failed:", key, e);
    }
  },
  async removeKey(key) {
    if (!this.enabled) return;
    try {
      await fetch(`/api/store/${encodeURIComponent(key)}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Server sync remove failed:", key, e);
    }
  }
};

const _originalSet = BlogStore.set.bind(BlogStore);
BlogStore.set = function(key, value) {
  const ok = _originalSet(key, value);
  // Fire-and-forget server persistence to keep current synchronous UI flow unchanged.
  SyncStoreAPI.setKey(key, value);
  return ok;
};

const _originalRemove = BlogStore.remove.bind(BlogStore);
BlogStore.remove = function(key) {
  _originalRemove(key);
  SyncStoreAPI.removeKey(key);
};

/* ===== Seed Data ===== */
const seedPosts = [
  {
    id: "seed-1",
    createdAt: 1712870400000,
    title: "Placement plan that works (without losing the semester)",
    category: "Interview Prep",
    coverImage: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    content: "Placement preparation works better when it is treated as a weekly habit, not a last-month emergency. Keep three tracks open: DSA practice, core subject revision, and one visible project that you can explain clearly.\n\nUse short blocks during regular college weeks. Revise data structures twice a week, solve aptitude sets on alternate days, and write down interview answers after every mock. The goal is not to finish every resource. The goal is to become consistent enough that interviews do not feel unfamiliar.",
    excerpt: "A realistic weekly approach for balancing placement preparation with classes.",
    author: "Placement Desk",
    authorEmail: "placement@lumen.test",
    authorBio: "Curates student placement workflows and prep habits.",
    expertise: "Interview Prep",
    date: "Apr 12, 2026",
    likes: 0,
    status: "published"
  },
  {
    id: "seed-2",
    createdAt: 1713571200000,
    title: "Resume checklist: what recruiters actually scan first",
    category: "Resume & Profile",
    coverImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    content: "A good resume is a fast scan, not a story. Keep your header clean, keep links working, and write projects like: problem → approach → impact.\n\nUse numbers where possible. Avoid walls of text. For each project, show the tech stack and your role. Keep one strong project that you can explain end-to-end in interviews.",
    excerpt: "A quick, practical resume checklist for campus and off-campus placements.",
    author: "Resume Notes",
    authorEmail: "resume@lumen.test",
    authorBio: "Summarizes resume patterns that help in shortlists.",
    expertise: "Resume & Profile",
    date: "Apr 20, 2026",
    likes: 0,
    status: "published"
  },
  {
    id: "seed-3",
    createdAt: 1714176000000,
    title: "DSA routine: 30 minutes daily (that scales to interviews)",
    category: "DSA & Coding",
    coverImage: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=80",
    content: "Consistency beats marathon study. Start with 30 minutes a day: 1 problem + 10 minutes of review.\n\nTrack patterns: sliding window, two pointers, hashing, stacks/queues, trees, graphs, DP. Every weekend, do one timed mock. The goal is to become fluent with patterns, not memorize solutions.",
    excerpt: "A small daily routine that compiles into real interview confidence.",
    author: "DSA Desk",
    authorEmail: "dsa@lumen.test",
    authorBio: "Collects practical DSA routines and interview patterns.",
    expertise: "DSA & Coding",
    date: "Apr 27, 2026",
    likes: 0,
    status: "published"
  }
];

const placementCategories = [
  "All",
  "DSA & Coding",
  "Resume & Profile",
  "System Design",
  "Interview Prep",
  "Internships",
  "Core Subjects",
  "CGPA & Academics",
  "Off-Campus"
];

function showToast(message, kind = "success") {
  const toast = document.getElementById("globalToast");
  if (!toast) return;
  // If jQuery is present, use it for smooth toast transitions.
  if (window.jQuery) {
    const $t = window.jQuery(toast);
    toast.style.borderColor = kind === "error" ? "rgba(255, 107, 107, 0.35)" : "rgba(31, 78, 216, 0.26)";
    toast.style.color = kind === "error" ? "#ff6b6b" : "var(--accent-2)";
    toast.style.background = kind === "error" ? "rgba(255, 107, 107, 0.08)" : "rgba(31, 78, 216, 0.08)";
    toast.innerHTML = message;
    $t.stop(true, true).fadeIn(160);
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => { $t.fadeOut(180); }, 2600);
    return;
  }

  toast.style.display = "block";
  toast.style.borderColor = kind === "error" ? "rgba(255, 107, 107, 0.35)" : "rgba(31, 78, 216, 0.26)";
  toast.style.color = kind === "error" ? "#ff6b6b" : "var(--accent-2)";
  toast.style.background = kind === "error" ? "rgba(255, 107, 107, 0.08)" : "rgba(31, 78, 216, 0.08)";
  toast.innerHTML = message;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { toast.style.display = "none"; }, 2600);
}

/* ===== Data Access ===== */
function getStoredPosts() {
  return BlogStore.get("posts", []).map(p => ({
    ...p,
    status: p.status || "published",
    createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now()
  }));
}

function getAllPosts() {
  return seedPosts.concat(getStoredPosts()).filter(p => (p.status || "published") === "published");
}

function normalizeRole(role) {
  return String(role || "").toLowerCase() === "admin" ? "admin" : "user";
}

function getLoggedInUser() {
  const user = BlogStore.get("loggedInUser", null);
  if (!user) return null;
  return { ...user, role: normalizeRole(user.role) };
}

function getUserRecord(email) {
  const found = BlogStore.get("users", []).find(u => u.email === email) || null;
  if (!found) return null;
  return { ...found, role: normalizeRole(found.role) };
}

function isAdminUser(user) {
  return Boolean(user) && normalizeRole(user.role) === "admin";
}

function getOrCreateGuestId() {
  const existing = BlogStore.get("guestId", "");
  if (existing) return String(existing);
  const id = "guest-" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  BlogStore.set("guestId", id);
  return id;
}

function getLikeActorId() {
  const u = getLoggedInUser();
  return u ? String(u.email) : getOrCreateGuestId();
}

function getLikesByPost() {
  const map = BlogStore.get("likesByPost", null);
  if (map && typeof map === "object") return map;
  return {};
}

function setLikesByPost(map) {
  BlogStore.set("likesByPost", map || {});
}

function migrateLegacyLikesIfNeeded() {
  // Legacy keys used a global likedPosts array + postLikes numeric map (not per-user).
  // We migrate once by converting the current browser's likedPosts into likesByPost entries
  // attributed to the current actor (or guest id).
  if (BlogStore.get("likesMigrated_v2", false)) return;

  const legacyLiked = BlogStore.get("likedPosts", null);
  const legacyCounts = BlogStore.get("postLikes", null);
  const next = getLikesByPost();
  const actor = getLikeActorId();

  if (Array.isArray(legacyLiked)) {
    legacyLiked.map(String).forEach(postId => {
      const arr = Array.isArray(next[postId]) ? next[postId].map(String) : [];
      if (!arr.includes(actor)) arr.push(actor);
      next[postId] = arr;
    });
  }

  // If legacyCounts exists but likesByPost is empty for a post, keep the numeric count as a fallback.
  // We store it separately so counts don't suddenly drop to 0 on migration.
  if (legacyCounts && typeof legacyCounts === "object") {
    const fallback = BlogStore.get("likeCountFallback", {});
    Object.keys(legacyCounts).forEach(pid => {
      const n = Number(legacyCounts[pid]);
      if (!Number.isFinite(n) || n <= 0) return;
      const hasList = Array.isArray(next[pid]) && next[pid].length > 0;
      if (!hasList) fallback[pid] = Math.max(0, Math.floor(n));
    });
    BlogStore.set("likeCountFallback", fallback);
  }

  setLikesByPost(next);
  BlogStore.set("likesMigrated_v2", true);
}

/* ===== Utility ===== */
function escapeHTML(v) {
  return String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }
function formatDate(date) { return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function calculateReadTime(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function makeExcerpt(content) {
  const clean = String(content || "").trim();
  return clean.substring(0, 145) + (clean.length > 145 ? "..." : "");
}

function getWordCount(text) { return String(text || "").trim().split(/\s+/).filter(Boolean).length; }
function getReadingLevel(text) {
  const w = getWordCount(text);
  return w < 250 ? "Quick guide" : w < 800 ? "Standard read" : "Deep dive";
}

function getLikeCount(post) {
  migrateLegacyLikesIfNeeded();
  const map = getLikesByPost();
  const arr = Array.isArray(map[post.id]) ? map[post.id] : null;
  if (arr) return arr.length;
  const fallback = BlogStore.get("likeCountFallback", {});
  if (typeof fallback[post.id] === "number") return fallback[post.id];
  return Number(post.likes || 0) || 0;
}

function isLikedByCurrentUser(postId) {
  migrateLegacyLikesIfNeeded();
  const actor = getLikeActorId();
  const map = getLikesByPost();
  const arr = Array.isArray(map[postId]) ? map[postId].map(String) : [];
  return arr.includes(actor);
}

function getCommentCount(postId) { return BlogStore.get(`comments:${postId}`, []).length; }
function getSavedKey() {
  const user = getLoggedInUser();
  return user ? `savedPosts:${user.email}` : "savedPosts:guest";
}

function isSavedPost(id) { return BlogStore.get(getSavedKey(), []).map(String).includes(String(id)); }
function getSavedPosts() {
  const ids = BlogStore.get(getSavedKey(), []).map(String);
  return getAllPosts().filter(p => ids.includes(String(p.id)));
}

function getTrendingPosts() {
  return getAllPosts().slice().sort((a, b) => ((getLikeCount(b) * 3) + getCommentCount(b.id)) - ((getLikeCount(a) * 3) + getCommentCount(a.id)));
}

function getDraftForUser(email) { return BlogStore.get(`draft:${email}`, null); }
function followAuthor(email) { const u = getLoggedInUser(); if (!u) return; const f = BlogStore.get("followers:" + email, []); if (!f.includes(u.email)) { f.push(u.email); BlogStore.set("followers:" + email, f); } }
function unfollowAuthor(email) { const u = getLoggedInUser(); if (!u) return; BlogStore.set("followers:" + email, BlogStore.get("followers:" + email, []).filter(e => e !== u.email)); }
function isFollowingAuthor(email) { const u = getLoggedInUser(); if (!u) return false; return BlogStore.get("followers:" + email, []).includes(u.email); }
function getFollowers(email) { return BlogStore.get("followers:" + email, []); }
function trackPostView(postId) { const a = BlogStore.get("analytics:" + postId, { views: 0 }); a.views = (a.views || 0) + 1; BlogStore.set("analytics:" + postId, a); }
function getPostAnalytics(postId) { return BlogStore.get("analytics:" + postId, { views: 0 }); }

function getAuthorAnalytics(email) {
  const posts = getAllPosts().filter(p => p.authorEmail === email);
  let tv = 0, tc = 0, tl = 0;
  posts.forEach(p => { tv += getPostAnalytics(p.id).views || 0; tc += getCommentCount(p.id); tl += getLikeCount(p); });
  return { posts: posts.length, totalViews: tv, totalComments: tc, totalLikes: tl };
}

/* ===== Card Rendering ===== */
function renderPostCard(post) {
  const saved = isSavedPost(post.id);
  return `
    <article class="post-card" data-category="${escapeHTML(post.category)}">
      <a href="post.html?id=${encodeURIComponent(post.id)}">
        <img class="post-image" src="${escapeHTML(post.coverImage || "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80")}" alt="${escapeHTML(post.title)}" loading="lazy">
        <div class="post-body">
          <div class="meta">
            <span class="category-pill">${escapeHTML(post.category)}</span>
            <span>${escapeHTML(post.date)}</span>
            <span>${calculateReadTime(post.content)} min read</span>
          </div>
          <h3>${escapeHTML(post.title)}</h3>
          <p class="excerpt">${escapeHTML(post.excerpt || makeExcerpt(post.content))}</p>
          <div class="meta"><span>By <a href="profile.html?email=${encodeURIComponent(post.authorEmail)}" class="author-link" onclick="event.stopPropagation()">${escapeHTML(post.author)}</a></span><span>${getLikeCount(post)} likes</span><span>${getCommentCount(post.id)} comments</span></div>
        </div>
      </a>
      <div class="post-actions">
        <button class="btn btn-secondary save-post-btn" data-id="${escapeHTML(post.id)}"><i class="${saved ? "fa-solid" : "fa-regular"} fa-bookmark"></i> <span>${saved ? "Saved" : "Save"}</span></button>
        <button class="btn btn-secondary share-post-btn" data-id="${escapeHTML(post.id)}"><i class="fa-regular fa-share-from-square"></i></button>
      </div>
    </article>
  `;
}

/* ===== Navigation ===== */
function initNav() {
  const nav = document.getElementById("navLinks");
  const hamburger = document.getElementById("hamburger");
  if (!nav) return;

  const user = getLoggedInUser();
  const authLinks = user
    ? `<a class="nav-link" href="${isAdminUser(user) ? "admin.html" : "dashboard.html"}">${isAdminUser(user) ? "Admin" : "Dashboard"}</a><a class="nav-link" href="create.html">Write</a><a class="nav-link" href="#" id="logoutLink">Logout</a>`
    : `<a class="nav-link" href="login.html">Login</a><a class="nav-link" href="signup.html">Sign Up</a>`;

  nav.innerHTML = `
    <a class="nav-link" href="index.html">Home</a>
    <a class="nav-link" href="blog.html">Blog</a>
    <a class="nav-link" href="about.html">About</a>
    <a class="nav-link" href="contact.html">Contact</a>
    ${authLinks}
  `;

  const current = location.pathname.split("/").pop() || "index.html";
  nav.querySelectorAll(".nav-link").forEach(link => {
    if (link.getAttribute("href") === current) link.classList.add("active");
  });

  if (hamburger) {
    hamburger.addEventListener("click", () => {
      nav.classList.toggle("open");
      hamburger.setAttribute("aria-expanded", nav.classList.contains("open"));
    });
  }

  // Close nav on link click
  nav.addEventListener("click", e => {
    if (e.target.closest(".nav-link")) nav.classList.remove("open");
  });

  const logoutLink = document.getElementById("logoutLink");
  if (logoutLink) {
    logoutLink.addEventListener("click", e => {
      e.preventDefault();
      BlogStore.remove("loggedInUser");
      window.location.href = "index.html";
    });
  }
  const logoutLinkDash = document.getElementById("logoutLinkDashboard");
  if (logoutLinkDash) {
    logoutLinkDash.addEventListener("click", e => {
      e.preventDefault();
      BlogStore.remove("loggedInUser");
      window.location.href = "index.html";
    });
  }
}

function initTheme() {
  const saved = BlogStore.get("theme", "dark");
  document.documentElement.setAttribute("data-theme", saved);
}

/* ===== Hero Typing ===== */
function initHeroTyping() {
  const target = document.getElementById("typingText");
  if (!target) return;
  // Keep it calm: no looping typing animation.
  target.textContent = "placement prep.";
}

/* ===== Home Page ===== */
function initHomeLatest() {
  const latest = document.getElementById("latestPosts");
  const featured = document.getElementById("featuredPosts");
  const trending = document.getElementById("trendingPosts");

  const trend = getTrendingPosts();
  if (featured) featured.innerHTML = trend.slice(0, 6).map(renderPostCard).join("");
  if (trending) trending.innerHTML = trend.slice(0, 3).map(renderPostCard).join("");
  if (!latest) return;
  const posts = getAllPosts()
    .slice()
    .sort((a, b) => (Number(b.createdAt || 0)) - (Number(a.createdAt || 0)))
    .slice(0, 6);
  latest.innerHTML = posts.length
    ? posts.map(renderPostCard).join("")
    : `<p class="lead">No student submissions yet. Sign up, publish a campus guide, and it will appear here instantly.</p>`;
}

/* ===== Blog Listing (Replaces AngularJS) ===== */
function initBlogListing() {
  const container = document.getElementById("blogListing");
  const searchInput = document.getElementById("blogSearch");
  const sortSelect = document.getElementById("blogSort");
  const categoryContainer = document.getElementById("categoryTabs");
  const resultsInfo = document.getElementById("resultsInfo");
  const paginationBar = document.getElementById("paginationBar");

  if (!container) return;

  let selectedCategory = "All";
  let searchText = "";
  let sortMode = "latest";
  let currentPage = 1;
  const perPage = 6;

  // Deep links: blog.html?cat=DSA%20%26%20Coding&q=arrays&sort=likes
  const params = new URLSearchParams(window.location.search);
  const initialCat = params.get("cat");
  const initialQ = params.get("q");
  const initialSort = params.get("sort");
  if (initialCat && placementCategories.includes(initialCat)) selectedCategory = initialCat;
  if (typeof initialQ === "string" && initialQ.trim()) searchText = initialQ.trim();
  if (initialSort && ["latest", "likes", "shortest", "longest"].includes(initialSort)) sortMode = initialSort;

  function getFilteredPosts() {
    let posts = getAllPosts().map(p => ({
      ...p,
      _likes: getLikeCount(p),
      _comments: getCommentCount(p.id),
      _readTime: calculateReadTime(p.content),
      _createdAt: typeof p.createdAt === "number" ? p.createdAt : 0
    }));

    if (selectedCategory !== "All") posts = posts.filter(p => p.category === selectedCategory);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      posts = posts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.excerpt || "").toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q)
      );
    }

    if (sortMode === "likes") posts.sort((a, b) => b._likes - a._likes);
    else if (sortMode === "shortest") posts.sort((a, b) => a._readTime - b._readTime);
    else if (sortMode === "longest") posts.sort((a, b) => b._readTime - a._readTime);
    else posts.sort((a, b) => b._createdAt - a._createdAt);

    return posts;
  }

  function render() {
    const all = getFilteredPosts();
    const totalPages = Math.max(1, Math.ceil(all.length / perPage));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * perPage;
    const pagePosts = all.slice(start, start + perPage);

    if (resultsInfo) {
      resultsInfo.textContent = `${all.length} post${all.length !== 1 ? "s" : ""} found`;
    }

    container.innerHTML = pagePosts.length
      ? pagePosts.map(renderPostCard).join("")
      : `<div class="empty-state" style="grid-column:1/-1"><i class="fa-regular fa-file-lines"></i><h3>No posts found</h3><p>Try adjusting your search or filters.</p></div>`;

    if (paginationBar) {
      paginationBar.innerHTML = totalPages > 1
        ? `<button class="btn btn-secondary btn-sm" ${currentPage <= 1 ? "disabled" : ""} onclick="window._blogPage(${currentPage - 1})"><i class="fa-solid fa-chevron-left"></i> Previous</button><span style="display:grid;place-items:center;color:var(--muted);font-size:0.9rem">Page ${currentPage} of ${totalPages}</span><button class="btn btn-secondary btn-sm" ${currentPage >= totalPages ? "disabled" : ""} onclick="window._blogPage(${currentPage + 1})">Next <i class="fa-solid fa-chevron-right"></i></button>`
        : "";
    }
  }

  window._blogPage = function(page) { currentPage = page; render(); };

  // Category tabs
  if (categoryContainer) {
    categoryContainer.innerHTML = placementCategories.map(cat =>
      `<button class="tab ${cat === selectedCategory ? "active" : ""}" data-category="${cat}">${cat}</button>`
    ).join("");
    categoryContainer.addEventListener("click", e => {
      const btn = e.target.closest(".tab");
      if (!btn) return;
      categoryContainer.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      selectedCategory = btn.dataset.category;
      currentPage = 1;
      render();
    });
  }

  if (searchInput) {
    if (searchText) searchInput.value = searchText;
    let debounceTimer;
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { searchText = searchInput.value; currentPage = 1; render(); }, 250);
    });
  }

  if (sortSelect) {
    sortSelect.value = sortMode;
    sortSelect.addEventListener("change", () => { sortMode = sortSelect.value; currentPage = 1; render(); });
  }

  render();
}

/* ===== Blog Post View ===== */
function initSinglePost() {
  const article = document.getElementById("articleView");
  if (!article) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const post = getAllPosts().find(item => String(item.id) === String(id));

  if (!post) {
    article.innerHTML = `<section class="section narrow"><p class="eyebrow">Post not found</p><h1>This article is not available.</h1><p class="lead">It may have been deleted. Return to the blog to continue reading.</p><a class="btn btn-primary" href="blog.html">Back to Blog</a></section>`;
    return;
  }

  // Set dynamic page title
  document.title = `${post.title} | PlacementPrep Hub`;

  trackPostView(post.id);

  const commentsKey = `comments:${post.id}`;
  const liked = isLikedByCurrentUser(String(post.id));
  const authorPosts = getAllPosts().filter(item => item.authorEmail === post.authorEmail).length;
  const authorBio = post.authorBio || (getUserRecord(post.authorEmail) && getUserRecord(post.authorEmail).bio) || "Campus contributor";
  const expertise = post.expertise || (getUserRecord(post.authorEmail) && getUserRecord(post.authorEmail).expertise) || post.category;
  const saved = isSavedPost(post.id);

  article.innerHTML = `
    <header class="article-header article-hero" style="--article-image: url('${escapeHTML(post.coverImage)}')">
      <div class="narrow">
        <p class="eyebrow">${escapeHTML(post.category)}</p>
        <h1>${escapeHTML(post.title)}</h1>
        <div class="meta"><span>By ${escapeHTML(post.author)}</span><span>Published ${escapeHTML(post.date)}</span><span>${calculateReadTime(post.content)} min read</span></div>
        <p class="lead">${escapeHTML(post.excerpt || makeExcerpt(post.content))}</p>
      </div>
    </header>
    <div class="narrow">
      <img class="post-image" src="${escapeHTML(post.coverImage)}" alt="${escapeHTML(post.title)}" loading="lazy">
      <div class="dashboard-panel article-tools">
        <div>
          <p class="eyebrow">Article details</p>
          <div class="meta"><span>${getWordCount(post.content)} words</span><span>${getReadingLevel(post.content)}</span><span>${getCommentCount(post.id)} comments</span></div>
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary save-post-btn" data-id="${escapeHTML(post.id)}"><i class="${saved ? "fa-solid" : "fa-regular"} fa-bookmark"></i> <span>${saved ? "Saved" : "Save"}</span></button>
          <button class="btn btn-secondary share-post-btn" data-id="${escapeHTML(post.id)}"><i class="fa-regular fa-share-from-square"></i> Share</button>
          <button class="btn btn-secondary" id="reportButton"><i class="fa-regular fa-flag"></i></button>
        </div>
      </div>
      <div class="article-content section-small">${post.content.includes('<') ? post.content : post.content.split("\n").filter(Boolean).map(p => `<p>${escapeHTML(p)}</p>`).join("")}</div>
      <button class="btn btn-secondary" id="likeButton" data-post-id="${escapeHTML(post.id)}" data-liked="${liked}"><i class="${liked ? "fa-solid" : "fa-regular"} fa-heart"></i> <span id="likeCount">${getLikeCount(post)}</span> Likes</button>
      <div class="dashboard-panel" id="reportPanel" style="margin-top:16px">
        <p class="eyebrow">Report guide</p>
        <form id="reportForm" novalidate>
          <div class="field">
            <label>Reason</label>
            <select id="reportReason">
              <option value="">Choose a reason</option>
              <option>Outdated info</option>
              <option>Incorrect details</option>
              <option>Spam / promotion</option>
              <option>Inappropriate content</option>
            </select>
          </div>
          <div class="field">
            <label>Optional note</label>
            <input id="reportNote" type="text" placeholder="Add a short note (optional)">
          </div>
          <p class="error" id="reportError"></p>
          <p class="success-message" id="reportSuccess"></p>
          <button class="btn btn-primary btn-sm" type="submit"><i class="fa-regular fa-flag"></i> Submit report</button>
        </form>
      </div>
      <aside class="dashboard-panel author-card">
        <p class="eyebrow">Author Profile</p>
        <h3>${escapeHTML(post.author)}</h3>
        <p>${escapeHTML(authorBio)}</p>
        <div class="meta"><span>${escapeHTML(expertise)}</span><span>${authorPosts} published post${authorPosts === 1 ? "" : "s"}</span></div>
      </aside>
    </div>
  `;

  // Media attachments
  const mediaAttachments = document.getElementById("mediaAttachments");
  if (mediaAttachments) {
    const blocks = [];
    if (post.videoUrl) blocks.push(`<div class="media-box"><h2>Attached video</h2><video controls autoplay muted loop><source src="${escapeHTML(post.videoUrl)}" type="video/mp4">Your browser does not support the video tag.</video></div>`);
    if (post.youtubeUrl) blocks.push(`<div><h2>Related video</h2><div class="iframe-wrap"><iframe src="${escapeHTML(post.youtubeUrl)}" title="Related YouTube video" allowfullscreen></iframe></div></div>`);
    mediaAttachments.innerHTML = blocks.join("");
    if (!blocks.length) mediaAttachments.style.display = "none";
  }

  // Related posts
  const related = document.getElementById("relatedPosts");
  if (related) {
    const sameCat = getAllPosts().filter(item => item.id !== post.id && item.category === post.category);
    const fallback = getAllPosts().filter(item => item.id !== post.id && item.category !== post.category);
    related.innerHTML = sameCat.concat(fallback).slice(0, 3).map(renderPostCard).join("");
  }

  // Comments
  initComments(post.id);
}

/* ===== Comments ===== */
function initComments(postId) {
  const commentsKey = `comments:${postId}`;
  const commentsList = document.getElementById("commentsList");
  const commentForm = document.getElementById("commentForm");
  const commentError = document.getElementById("commentError");

  function renderComments() {
    const comments = BlogStore.get(commentsKey, []);
    if (!commentsList) return;
    commentsList.innerHTML = comments.length
      ? comments.map(c => `
        <div class="comment" data-comment-id="${escapeHTML(c.id)}">
          <strong>${escapeHTML(c.name)}</strong>
          <div class="meta"><span>${escapeHTML(c.date)}</span><span>${escapeHTML(c.email)}</span></div>
          <p>${escapeHTML(c.comment)}</p>
          <button class="btn btn-secondary reply-toggle" data-comment-id="${escapeHTML(c.id)}"><i class="fa-solid fa-reply"></i> Reply</button>
          <form class="reply-form" data-comment-id="${escapeHTML(c.id)}">
            <div class="field"><label>Reply</label><input type="text" class="reply-text" placeholder="Add a useful reply"></div>
            <p class="error"></p>
            <button class="btn btn-primary" type="submit">Save Reply</button>
          </form>
          <div class="reply-list">${(c.replies || []).map(r => `<div class="reply"><strong>${escapeHTML(r.name)}</strong><span>${escapeHTML(r.date)}</span><p>${escapeHTML(r.text)}</p></div>`).join("")}</div>
        </div>
      `).join("")
      : `<p class="lead">No comments yet. Start the conversation.</p>`;
  }

  if (commentForm) {
    commentForm.addEventListener("submit", e => {
      e.preventDefault();
      const user = getLoggedInUser();
      const name = user ? user.fullName : "Guest reader";
      const email = user ? user.email : "";
      const comment = document.getElementById("commentText").value.trim();
      if (!comment) { commentError.textContent = "Write a comment first."; return; }
      const comments = BlogStore.get(commentsKey, []);
      comments.push({ id: Date.now().toString(), name, email, comment, date: formatDate(new Date()), replies: [] });
      BlogStore.set(commentsKey, comments);
      commentError.textContent = "";
      commentForm.reset();
      renderComments();
    });
  }

  if (commentsList) {
    commentsList.addEventListener("submit", e => {
      if (!e.target.classList.contains("reply-form")) return;
      e.preventDefault();
      const form = e.target;
      const commentId = form.dataset.commentId;
      const input = form.querySelector(".reply-text");
      const error = form.querySelector(".error");
      const text = input.value.trim();
      if (!text) { error.textContent = "Reply cannot be empty."; return; }
      const user = getLoggedInUser();
      const comments = BlogStore.get(commentsKey, []);
      const target = comments.find(c => String(c.id) === String(commentId));
      if (target) {
        target.replies = target.replies || [];
        target.replies.push({ id: Date.now().toString(), name: user ? user.fullName : "Guest reader", text, date: formatDate(new Date()) });
        BlogStore.set(commentsKey, comments);
        renderComments();
      }
    });
  }

  renderComments();
}

/* ===== Dashboard ===== */
function initDashboard() {
  const panel = document.getElementById("dashboardPanel");
  if (!panel) return;
  const user = requireAuth();
  if (!user) return;
  const adminMode = isAdminUser(user);

  function render() {
    const name = document.getElementById("dashboardName");
    const avatar = document.getElementById("dashboardAvatar");
    const roleLabel = document.getElementById("dashboardRoleLabel");
    const roleDescription = document.getElementById("dashboardRoleDescription");
    const count = document.getElementById("postCount");
    const savedCount = document.getElementById("savedCount");
    const inboxCount = document.getElementById("inboxCount");
    const reportCount = document.getElementById("reportCount");
    const list = document.getElementById("dashboardList");
    const savedList = document.getElementById("savedList");
    const draftList = document.getElementById("draftList");
    const inboxList = document.getElementById("inboxList");
    const reportsList = document.getElementById("reportsList");
    const usersList = document.getElementById("usersList");

    const posts = getStoredPosts().filter(p => p.authorEmail === user.email);
    const allPosts = getAllPosts();
    const managedPosts = adminMode ? allPosts : posts;
    const saved = getSavedPosts();
    const draft = getDraftForUser(user.email);
    const messages = BlogStore.get("contactMessages", []);
    const reports = BlogStore.get("reports", []);
    const users = BlogStore.get("users", []).map(u => ({ ...u, role: normalizeRole(u.role) }));
    const nonCurrentUsers = users.filter(u => u.email !== user.email);

    if (name) name.textContent = user.fullName;
    if (avatar) avatar.textContent = user.fullName.trim().charAt(0).toUpperCase();
    if (roleLabel) roleLabel.textContent = adminMode ? "Admin Console" : "Writer Console";
    if (roleDescription) roleDescription.textContent = adminMode
      ? "Manage users, content moderation, reports, and inbox"
      : "Manage your guides and reading list";
    if (count) count.textContent = managedPosts.length;
    if (savedCount) savedCount.textContent = adminMode ? users.length : saved.length;
    if (inboxCount) inboxCount.textContent = adminMode ? messages.length : 0;
    if (reportCount) reportCount.textContent = adminMode ? reports.length : 0;

    document.querySelectorAll(".admin-only").forEach(el => {
      el.style.display = adminMode ? "" : "none";
    });

    if (list) {
      list.innerHTML = managedPosts.length
        ? managedPosts.map(p => `
          <article class="publication-row">
            <img src="${escapeHTML(p.coverImage)}" alt="${escapeHTML(p.title)}" loading="lazy">
            <div class="publication-main">
              <span class="category-pill">${escapeHTML(p.category)}</span>
              <h3>${escapeHTML(p.title)}</h3>
              <p>${escapeHTML(p.excerpt || makeExcerpt(p.content))}</p>
              <div class="meta"><span>${escapeHTML(p.date)}</span><span>${calculateReadTime(p.content)} min read</span><span>${getLikeCount(p)} likes</span><span>${getCommentCount(p.id)} comments</span><span>By ${escapeHTML(p.author)}</span></div>
            </div>
            <div class="publication-actions">
              <a class="btn btn-secondary btn-sm" href="post.html?id=${encodeURIComponent(p.id)}"><i class="fa-solid fa-eye"></i> View</a>
              <button class="btn btn-secondary btn-sm delete-post" data-id="${p.id}" data-author-email="${escapeHTML(p.authorEmail)}"><i class="fa-solid fa-trash"></i></button>
            </div>
          </article>
        `).join("")
        : `<div class="empty-state"><i class="fa-regular fa-newspaper"></i><h3>No published guides yet</h3><p>Start with one practical campus guide.</p><a class="btn btn-primary" href="create.html">Write your first guide</a></div>`;
    }

    if (draftList) {
      draftList.innerHTML = draft
        ? `<article class="publication-row compact-publication draft-row"><div class="publication-main"><span class="category-pill">${escapeHTML(draft.category || "Uncategorized")}</span><h3>${escapeHTML(draft.title || "Untitled draft")}</h3><p>${escapeHTML((draft.content || "").substring(0, 150))}</p><div class="meta"><span>Last edited ${escapeHTML(draft.lastUpdated || "recently")}</span></div></div><div class="publication-actions"><a class="btn btn-primary btn-sm" href="create.html"><i class="fa-solid fa-pen"></i> Continue</a></div></article>`
        : `<div class="empty-state"><i class="fa-regular fa-file-lines"></i><h3>No active draft</h3><p>Start writing and your draft will autosave here.</p><a class="btn btn-secondary" href="create.html">Open writer studio</a></div>`;
    }

    if (savedList) {
      savedList.innerHTML = saved.length
        ? saved.map(p => `<article class="publication-row compact-publication"><img src="${escapeHTML(p.coverImage)}" alt="${escapeHTML(p.title)}" loading="lazy"><div class="publication-main"><span class="category-pill">${escapeHTML(p.category)}</span><h3>${escapeHTML(p.title)}</h3><div class="meta"><span>${getLikeCount(p)} likes</span><span>${getCommentCount(p.id)} comments</span></div></div><div class="publication-actions"><a class="btn btn-secondary btn-sm" href="post.html?id=${encodeURIComponent(p.id)}"><i class="fa-solid fa-book-open"></i> Read</a></div></article>`).join("")
        : `<div class="empty-state"><i class="fa-regular fa-bookmark"></i><h3>No saved posts</h3><p>Use the Save button on any guide to build your reading list.</p><a class="btn btn-secondary" href="blog.html">Browse guides</a></div>`;
    }

    if (inboxList) {
      inboxList.innerHTML = adminMode
        ? (messages.length
          ? messages.slice().reverse().map(m => `<article class="message-card"><div><strong>${escapeHTML(m.name)}</strong><p>${escapeHTML(m.message)}</p></div><div class="meta"><span>${escapeHTML(m.email)}</span><span>${escapeHTML(m.date)}</span></div></article>`).join("")
          : `<div class="empty-state"><i class="fa-regular fa-envelope"></i><h3>Inbox is clear</h3><p>Messages from the contact form will collect here.</p></div>`)
        : `<div class="empty-state"><i class="fa-regular fa-lock"></i><h3>Admin only</h3><p>Only admins can access contact inbox messages.</p></div>`;
    }

    if (reportsList) {
      reportsList.innerHTML = adminMode
        ? (reports.length
          ? reports.slice().reverse().map(r => {
            const rp = getAllPosts().find(p => String(p.id) === String(r.postId));
            return `<article class="message-card report-card"><div><strong>${escapeHTML(rp ? rp.title : "Deleted post")}</strong><p>${escapeHTML(r.note || "No extra note added.")}</p></div><div class="meta"><span>${escapeHTML(r.reason)}</span><span>${escapeHTML(r.date)}</span></div><div class="card-actions"><button class="btn btn-secondary btn-sm resolve-report" data-id="${escapeHTML(r.id)}"><i class="fa-solid fa-check"></i> Resolve</button>${rp ? `<button class="btn btn-secondary btn-sm delete-post" data-id="${escapeHTML(rp.id)}" data-author-email="${escapeHTML(rp.authorEmail)}"><i class="fa-solid fa-trash"></i> Remove post</button>` : ""}</div></article>`;
          }).join("")
          : `<div class="empty-state"><i class="fa-regular fa-flag"></i><h3>No reports</h3><p>Flagged guide reports will appear here for review.</p></div>`)
        : `<div class="empty-state"><i class="fa-regular fa-lock"></i><h3>Admin only</h3><p>Only admins can review and resolve reported posts.</p></div>`;
    }

    if (usersList) {
      usersList.innerHTML = adminMode
        ? (nonCurrentUsers.length
          ? nonCurrentUsers.map(u => `
            <article class="message-card">
              <div>
                <strong>${escapeHTML(u.fullName)}</strong>
                <p>${escapeHTML(u.email)}</p>
              </div>
              <div class="meta">
                <span>${escapeHTML(u.expertise || "General")}</span>
                <span class="category-pill">${escapeHTML(normalizeRole(u.role))}</span>
              </div>
              <div class="card-actions">
                <button class="btn btn-secondary btn-sm toggle-user-role" data-email="${escapeHTML(u.email)}" data-role="${escapeHTML(normalizeRole(u.role))}">
                  <i class="fa-solid fa-user-shield"></i> ${normalizeRole(u.role) === "admin" ? "Set as User" : "Promote to Admin"}
                </button>
              </div>
            </article>
          `).join("")
          : `<div class="empty-state"><i class="fa-regular fa-user"></i><h3>No users available</h3><p>Create user accounts to manage roles.</p></div>`)
        : "";
    }
  }

  render();
  window.renderDashboard = render;
}

/* ===== Create Post ===== */
function initCreatePost() {
  const form = document.getElementById("createForm");
  if (!form) return;
  const user = requireAuth();
  if (!user) return;
  const title = document.getElementById("title");
  const category = document.getElementById("category");
  const coverImage = document.getElementById("coverImage");
  const videoUrl = document.getElementById("videoUrl");
  const youtubeUrl = document.getElementById("youtubeUrl");
  const content = document.getElementById("content");
  const metrics = document.getElementById("postMetrics");
  const error = document.getElementById("createError");
  const draftStatus = document.getElementById("draftStatus");
  const draftKey = `draft:${user.email}`;
  const draft = BlogStore.get(draftKey, null);

  if (draft) {
    if (title) title.value = draft.title || "";
    if (category) category.value = draft.category || "";
    if (coverImage) coverImage.value = draft.coverImage || "";
    if (videoUrl) videoUrl.value = draft.videoUrl || "";
    if (youtubeUrl) youtubeUrl.value = draft.youtubeUrl || "";
    if (content) content.value = draft.content || "";
  }

  function updatePreview() {
    const text = (content ? content.value : "").trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    if (metrics) metrics.textContent = `${words} words • ${Math.max(1, Math.ceil(words / 200))} min read`;
    const hasDraft = Boolean(text || (title && title.value.trim()) || (category && category.value) || (coverImage && coverImage.value.trim()));
    if (hasDraft) {
      BlogStore.set(draftKey, {
        title: title ? title.value.trim() : "",
        category: category ? category.value : "",
        coverImage: coverImage ? coverImage.value.trim() : "",
        videoUrl: videoUrl ? videoUrl.value.trim() : "",
        youtubeUrl: youtubeUrl ? youtubeUrl.value.trim() : "",
        content: text,
        status: "draft",
        lastUpdated: formatDate(new Date())
      });
    } else {
      BlogStore.remove(draftKey);
    }
    if (draftStatus) draftStatus.textContent = hasDraft ? "Draft saved in this browser" : "Draft is empty";
  }

  [title, category, coverImage, videoUrl, youtubeUrl, content].filter(Boolean).forEach(el => el.addEventListener("input", updatePreview));
  updatePreview();

  form.addEventListener("submit", e => {
    e.preventDefault();
    const t = title ? title.value.trim() : "";
    const c = category ? category.value : "";
    const ct = content ? content.value.trim() : "";
    if (!t || !c || !ct) { error.textContent = "Title, category, and content are required."; return; }
    if (t.length < 8) { error.textContent = "Use a more specific title, at least 8 characters."; return; }
    if (ct.split(/\s+/).filter(Boolean).length < 25) { error.textContent = "Write at least 25 words."; return; }

    const posts = getStoredPosts();
    const post = {
      id: Date.now().toString(),
      createdAt: Date.now(),
      title: t,
      category: c,
      coverImage: coverImage && coverImage.value.trim() || "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
      videoUrl: videoUrl ? videoUrl.value.trim() : "",
      youtubeUrl: youtubeUrl ? youtubeUrl.value.trim() : "",
      content: ct,
      excerpt: makeExcerpt(ct),
      author: user.fullName,
      authorEmail: user.email,
      authorBio: user.bio || (getUserRecord(user.email) && getUserRecord(user.email).bio) || "Campus contributor",
      expertise: user.expertise || (getUserRecord(user.email) && getUserRecord(user.email).expertise) || c,
      date: formatDate(new Date()),
      updatedAt: formatDate(new Date()),
      status: "published",
      likes: 0
    };
    posts.push(post);
    BlogStore.set("posts", posts);
    BlogStore.remove(draftKey);
    error.textContent = "";
    form.reset();
    updatePreview();

    // Show toast
    const toast = document.getElementById("createToast");
    if (toast) {
      toast.style.display = "block";
      toast.innerHTML = `<strong>Published.</strong> Your post is saved. <a class="category-pill" href="post.html?id=${encodeURIComponent(post.id)}">View it</a>`;
      setTimeout(() => { toast.style.display = "none"; }, 3000);
    } else {
      alert("Post published successfully!");
    }
  });
}

/* ===== Auth ===== */
function requireAuth() {
  const user = getLoggedInUser();
  if (!user) {
    BlogStore.set("authRedirect", window.location.pathname + window.location.search);
    window.location.href = "login.html";
  }
  return user;
}

function guardAdminPage() {
  const page = location.pathname.split("/").pop() || "";
  if (page !== "admin.html") return;
  const user = getLoggedInUser();
  if (!user) {
    BlogStore.set("authRedirect", "admin.html");
    window.location.href = "login.html";
    return;
  }
  if (!isAdminUser(user)) {
    window.location.href = "dashboard.html";
  }
}

function ensureDefaultAdminAccount() {
  const users = BlogStore.get("users", []);
  let changed = false;
  const normalizedUsers = users.map(u => {
    const nextRole = normalizeRole(u.role);
    if (u.role !== nextRole) changed = true;
    return { ...u, role: nextRole };
  });
  const hasAdmin = normalizedUsers.some(u => normalizeRole(u.role) === "admin");
  if (!hasAdmin) {
    normalizedUsers.push({
      fullName: "Admin",
      email: "admin@placementprep.local",
      password: "admin123",
      bio: "Platform administrator",
      expertise: "Operations",
      role: "admin"
    });
    changed = true;
  }
  if (changed) BlogStore.set("users", normalizedUsers);
}

function initSignup() {
  const form = document.getElementById("signupForm");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const bio = document.getElementById("bio") ? document.getElementById("bio").value.trim() : "";
    const expertise = document.getElementById("expertise") ? document.getElementById("expertise").value : "";
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const error = document.getElementById("signupError");

    if (!fullName || !email || !bio || !expertise || !password || !confirmPassword) { error.textContent = "All fields are required."; return; }
    if (!isValidEmail(email)) { error.textContent = "Enter a valid email address."; return; }
    if (password.length < 6) { error.textContent = "Password must be at least 6 characters."; return; }
    if (password !== confirmPassword) { error.textContent = "Passwords do not match."; return; }

    const users = BlogStore.get("users", []);
    if (users.some(u => u.email.toLowerCase() === email)) { error.textContent = "An account with this email already exists."; return; }
    users.push({ fullName, email, password, bio, expertise, role: "user" });
    BlogStore.set("users", users);
    error.textContent = "";

    const success = document.getElementById("signupSuccess");
    if (success) success.textContent = "Account created. Redirecting to login...";
    setTimeout(() => { window.location.href = "login.html"; }, 900);
  });
}

function initLogin() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const error = document.getElementById("loginError");
    const formCard = form.closest(".form-card");

    if (!email || !password) { error.textContent = "Email and password are required."; return; }
    if (!isValidEmail(email) || password.length < 6) { error.textContent = "Use a valid email and a 6 character password."; return; }

    const user = BlogStore.get("users", []).find(u => u.email.toLowerCase() === email && u.password === password);
    if (!user) {
      error.textContent = "Invalid login credentials.";
      if (formCard) { formCard.classList.add("shake"); setTimeout(() => formCard.classList.remove("shake"), 600); }
      return;
    }
    BlogStore.set("loggedInUser", {
      fullName: user.fullName,
      email: user.email,
      bio: user.bio || "",
      expertise: user.expertise || "",
      role: normalizeRole(user.role)
    });
    const redirect = BlogStore.get("authRedirect", "index.html");
    BlogStore.remove("authRedirect");
    window.location.href = redirect || "index.html";
  });
}

function initContact() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const message = document.getElementById("message");
  const counter = document.getElementById("charCounter");
  if (message && counter) {
    message.addEventListener("input", () => { counter.textContent = `${message.value.length} characters`; });
  }
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("contactName").value.trim();
    const email = document.getElementById("contactEmail").value.trim();
    const text = message ? message.value.trim() : "";
    const error = document.getElementById("contactError");
    if (!name || !email || !text) { error.textContent = "All fields are required."; return; }
    if (!isValidEmail(email)) { error.textContent = "Enter a valid email address."; return; }
    const messages = BlogStore.get("contactMessages", []);
    messages.push({ id: Date.now().toString(), name, email, message: text, date: formatDate(new Date()) });
    BlogStore.set("contactMessages", messages);
    error.textContent = "";
    form.reset();
    if (counter) counter.textContent = "0 characters";
    const success = document.getElementById("contactSuccess");
    if (success) { success.textContent = "Message sent successfully."; success.style.display = "block"; }
  });
}

/* ===== Event Delegation (jQuery replacement) ===== */
function initEventDelegation() {
  // Like button
  document.addEventListener("click", e => {
    const btn = e.target.closest("#likeButton");
    if (btn) {
      migrateLegacyLikesIfNeeded();
      const postId = String(btn.getAttribute("data-post-id"));
      const actor = getLikeActorId();
      const map = getLikesByPost();
      const list = Array.isArray(map[postId]) ? map[postId].map(String) : [];
      const already = list.includes(actor);
      const nextList = already ? list.filter(a => a !== actor) : list.concat(actor);
      map[postId] = Array.from(new Set(nextList));
      setLikesByPost(map);

      // Clear fallback count for this post since we now have a real list.
      const fallback = BlogStore.get("likeCountFallback", {});
      if (fallback && typeof fallback === "object" && typeof fallback[postId] === "number") {
        delete fallback[postId];
        BlogStore.set("likeCountFallback", fallback);
      }

      const isNowLiked = !already;
      btn.setAttribute("data-liked", String(isNowLiked));
      const span = document.getElementById("likeCount");
      if (span) span.textContent = String((map[postId] || []).length);
      const icon = btn.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-regular", !isNowLiked);
        icon.classList.toggle("fa-solid", isNowLiked);
      }
    }
  });

  // Save post
  document.addEventListener("click", e => {
    const btn = e.target.closest(".save-post-btn");
    if (!btn) return;
    e.preventDefault();
    const id = String(btn.getAttribute("data-id"));
    const key = getSavedKey();
    const saved = BlogStore.get(key, []).map(String);
    const wasSaved = saved.includes(id);
    const next = wasSaved ? saved.filter(pid => pid !== id) : saved.concat(id);
    BlogStore.set(key, Array.from(new Set(next)));
    document.querySelectorAll(`.save-post-btn[data-id="${CSS.escape(id)}"]`).forEach(b => {
      const icon = b.querySelector("i");
      const span = b.querySelector("span");
      const isNowSaved = !wasSaved;
      if (icon) { icon.classList.toggle("fa-regular", !isNowSaved); icon.classList.toggle("fa-solid", isNowSaved); }
      if (span) span.textContent = isNowSaved ? "Saved" : "Save";
    });
    if (window.renderDashboard) window.renderDashboard();
  });

  // Share post
  document.addEventListener("click", e => {
    const btn = e.target.closest(".share-post-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.getAttribute("data-id");
    const modal = document.getElementById("shareModal");
    const urlInput = document.getElementById("shareUrl");
    const shareUrl = new URL(`post.html?id=${encodeURIComponent(id)}`, window.location.href);
    const post = getAllPosts().find(p => String(p.id) === String(id));
    const title = post ? post.title : "PlacementPrep guide";

    // Prefer native share if available.
    if (navigator.share) {
      navigator.share({ title, text: title, url: shareUrl.href }).catch(() => {});
      return;
    }

    if (!modal || !urlInput) { showToast("Share modal not available on this page.", "error"); return; }
    urlInput.value = shareUrl.href;
    modal.classList.add("open");
  });

  // Close share modal
  document.addEventListener("click", e => {
    const modal = document.getElementById("shareModal");
    if (!modal) return;
    if (e.target === modal || e.target.closest("#closeShareModal")) {
      modal.classList.remove("open");
    }
  });

  // Copy share link
  document.addEventListener("click", e => {
    const btn = e.target.closest("#copyShareLink");
    if (!btn) return;
    const input = document.getElementById("shareUrl");
    if (!input) return;
    input.select();
    navigator.clipboard.writeText(input.value)
      .then(() => { btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = "Copy"; }, 2000); })
      .catch(() => { showToast("Copy failed. Select the link and copy manually.", "error"); });
  });

  // Share to Twitter
  document.addEventListener("click", e => {
    const btn = e.target.closest("#shareTwitter");
    if (!btn) return;
    const url = document.getElementById("shareUrl");
    if (url) window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url.value)}`, "_blank");
  });

  // Reply toggle
  document.addEventListener("click", e => {
    const btn = e.target.closest(".reply-toggle");
    if (!btn) return;
    const form = btn.nextElementSibling;
    if (form && form.classList.contains("reply-form")) {
      form.style.display = form.style.display === "block" ? "none" : "block";
    }
  });

  // Report button
  document.addEventListener("click", e => {
    const btn = e.target.closest("#reportButton");
    if (!btn) return;
    const panel = document.getElementById("reportPanel");
    if (panel) panel.style.display = panel.style.display === "block" ? "none" : "block";
  });

  // Report form
  const reportForm = document.getElementById("reportForm");
  if (reportForm) {
    reportForm.addEventListener("submit", e => {
      e.preventDefault();
      const reason = document.getElementById("reportReason").value;
      const note = document.getElementById("reportNote").value.trim();
      const error = document.getElementById("reportError");
      const params = new URLSearchParams(window.location.search);
      const postId = params.get("id");
      if (!reason) { error.textContent = "Choose a report reason."; return; }
      const reports = BlogStore.get("reports", []);
      reports.push({ id: Date.now().toString(), postId, reason, note, date: formatDate(new Date()) });
      BlogStore.set("reports", reports);
      error.textContent = "";
      reportForm.reset();
      document.getElementById("reportPanel").style.display = "none";
      const success = document.getElementById("reportSuccess");
      if (success) { success.textContent = "Report saved."; success.style.display = "block"; }
    });
  }

  // Dashboard tab switching
  document.addEventListener("click", e => {
    const tab = e.target.closest(".console-tab");
    if (!tab) return;
    const target = tab.getAttribute("data-dashboard-tab");
    document.querySelectorAll(".console-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".console-panel").forEach(p => p.classList.remove("active"));
    const panel = document.querySelector(`.console-panel[data-dashboard-panel="${target}"]`);
    if (panel) panel.classList.add("active");
  });

  // Delete post
  document.addEventListener("click", e => {
    const btn = e.target.closest(".delete-post");
    if (!btn) return;
    const currentUser = getLoggedInUser();
    if (!currentUser) return;
    const id = btn.getAttribute("data-id");
    const authorEmail = btn.getAttribute("data-author-email") || "";
    const canDelete = isAdminUser(currentUser) || authorEmail === currentUser.email;
    if (!canDelete) {
      showToast("You do not have permission to delete this post.", "error");
      return;
    }
    if (!confirm("Delete this post?")) return;
    const posts = BlogStore.get("posts", []).filter(p => String(p.id) !== String(id));
    BlogStore.set("posts", posts);
    const likesByPost = BlogStore.get("likesByPost", {});
    if (likesByPost && typeof likesByPost === "object") {
      delete likesByPost[id];
      BlogStore.set("likesByPost", likesByPost);
    }
    const fallback = BlogStore.get("likeCountFallback", {});
    if (fallback && typeof fallback === "object") {
      delete fallback[id];
      BlogStore.set("likeCountFallback", fallback);
    }
    BlogStore.remove("comments:" + id);
    if (window.renderDashboard) window.renderDashboard();
  });

  // Admin: resolve report
  document.addEventListener("click", e => {
    const btn = e.target.closest(".resolve-report");
    if (!btn) return;
    const currentUser = getLoggedInUser();
    if (!isAdminUser(currentUser)) {
      showToast("Only admins can resolve reports.", "error");
      return;
    }
    const reportId = btn.getAttribute("data-id");
    const reports = BlogStore.get("reports", []).filter(r => String(r.id) !== String(reportId));
    BlogStore.set("reports", reports);
    showToast("Report resolved.");
    if (window.renderDashboard) window.renderDashboard();
  });

  // Admin: toggle user role
  document.addEventListener("click", e => {
    const btn = e.target.closest(".toggle-user-role");
    if (!btn) return;
    const currentUser = getLoggedInUser();
    if (!isAdminUser(currentUser)) {
      showToast("Only admins can change roles.", "error");
      return;
    }
    const email = String(btn.getAttribute("data-email") || "").toLowerCase();
    if (!email) return;
    const users = BlogStore.get("users", []);
    const nextUsers = users.map(u => {
      if (String(u.email).toLowerCase() !== email) return { ...u, role: normalizeRole(u.role) };
      const nextRole = normalizeRole(u.role) === "admin" ? "user" : "admin";
      return { ...u, role: nextRole };
    });
    BlogStore.set("users", nextUsers);
    if (currentUser && String(currentUser.email).toLowerCase() === email) {
      BlogStore.set("loggedInUser", { ...currentUser, role: normalizeRole(currentUser.role) === "admin" ? "user" : "admin" });
    }
    showToast("User role updated.");
    if (window.renderDashboard) window.renderDashboard();
  });
}

/* ===== Profile Page ===== */
function initProfile() {
  const container = document.getElementById("profileContent");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const email = params.get("email");
  const user = email ? getUserRecord(email) : getLoggedInUser();

  if (!user) {
    container.innerHTML = `<div class="empty-state"><i class="fa-regular fa-user"></i><h3>User not found</h3><p>This profile does not exist.</p></div>`;
    return;
  }

  const posts = getAllPosts().filter(p => p.authorEmail === user.email);
  const analytics = getAuthorAnalytics(user.email);
  const followers = getFollowers(user.email).length;
  const isOwn = getLoggedInUser() && getLoggedInUser().email === user.email;
  const following = isFollowingAuthor(user.email);

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${user.fullName.charAt(0).toUpperCase()}</div>
      <div>
        <h1>${escapeHTML(user.fullName)}</h1>
        <p class="profile-bio">${escapeHTML(user.bio || "Campus contributor.")}</p>
        <div class="profile-stats">
          <span><strong>${posts.length}</strong> Posts</span>
          <span><strong>${analytics.totalViews}</strong> Views</span>
          <span><strong>${followers}</strong> Followers</span>
        </div>
        <div class="card-actions" style="margin-top:18px">
          ${!isOwn && getLoggedInUser() ? `
            <button class="btn ${following ? "btn-secondary" : "btn-primary"} btn-sm" id="followBtn" data-email="${escapeHTML(user.email)}">
              ${following ? "<i class='fa-solid fa-user-check'></i> Following" : "<i class='fa-regular fa-user-plus'></i> Follow"}
            </button>
          ` : ""}
          ${isOwn ? `<a class="btn btn-secondary btn-sm" href="dashboard.html"><i class="fa-solid fa-gauge"></i> Dashboard</a>` : ""}
        </div>
      </div>
    </div>
    <section class="section">
      <div class="section-heading"><div><p class="eyebrow">Publications</p><h2>Guides by ${escapeHTML(user.fullName)}</h2></div></div>
      <div class="grid grid-3">${posts.length ? posts.map(renderPostCard).join("") : `<p class="lead">No published guides yet.</p>`}</div>
    </section>
  `;

  // Follow button
  const followBtn = document.getElementById("followBtn");
  if (followBtn) {
    followBtn.addEventListener("click", () => {
      const email = followBtn.getAttribute("data-email");
      if (isFollowingAuthor(email)) { unfollowAuthor(email); followBtn.className = "btn btn-primary btn-sm"; followBtn.innerHTML = "<i class='fa-regular fa-user-plus'></i> Follow"; }
      else { followAuthor(email); followBtn.className = "btn btn-secondary btn-sm"; followBtn.innerHTML = "<i class='fa-solid fa-user-check'></i> Following"; }
    });
  }
}

/* ===== About Page Counters ===== */
function initAboutCounters() {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;
  const postTotal = getAllPosts().length;
  const userTotal = BlogStore.get("users", []).length;
  const commentTotal = getAllPosts().reduce((total, post) => total + BlogStore.get(`comments:${post.id}`, []).length, 0);
  document.querySelectorAll("[data-live-stat='posts']").forEach(n => { n.dataset.count = postTotal; });
  document.querySelectorAll("[data-live-stat='users']").forEach(n => { n.dataset.count = userTotal; });
  document.querySelectorAll("[data-live-stat='comments']").forEach(n => { n.dataset.count = commentTotal; });
  counters.forEach(counter => {
    const target = Number(counter.dataset.count);
    let value = 0;
    const step = Math.max(1, Math.ceil(target / 50));
    const timer = setInterval(() => {
      value += step;
      if (value >= target) { value = target; clearInterval(timer); }
      counter.textContent = value.toLocaleString();
    }, 30);
  });
}

/* ===== Reading Progress ===== */
function initReadingProgress() {
  const bar = document.getElementById("readingProgress");
  if (!bar) return;
  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const percent = height > 0 ? Math.min(100, Math.round((scrollTop / height) * 100)) : 0;
    bar.style.width = `${percent}%`;
  });
}

/* ===== Scroll Animation ===== */
function initSmoothExperience() {
  document.querySelectorAll(".post-card, .form-card, .dashboard-panel, .comment, .preview-panel, .stat, .toolbar-panel, .page-hero-inner, .profile-header").forEach(el => {
    el.classList.add("reveal-on-scroll");
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  document.querySelectorAll(".reveal-on-scroll").forEach(el => observer.observe(el));

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", e => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", async () => {
  await SyncStoreAPI.hydrateLocalFromServer();
  ensureDefaultAdminAccount();
  guardAdminPage();
  initNav();
  initHeroTyping();
  initHomeLatest();
  initBlogListing();
  initSignup();
  initLogin();
  initCreatePost();
  initDashboard();
  initSinglePost();
  initProfile();
  initReadingProgress();
  initSmoothExperience();
  initAboutCounters();
  initContact();
  initEventDelegation();
});