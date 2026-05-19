import { useState, useReducer, useEffect } from "react";

const getTier = (count) => count >= 5 ? "Super Fan" : count >= 3 ? "Regular" : count >= 2 ? "Returning" : "New";
const tierColor = (tier) => ({
  "Super Fan": "bg-amber-100 text-amber-800 border-amber-300",
  "Regular": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Returning": "bg-sky-100 text-sky-800 border-sky-300",
  "New": "bg-slate-100 text-slate-700 border-slate-300",
}[tier] || "bg-slate-100 text-slate-700 border-slate-300");

const genId = () => Math.random().toString(36).slice(2, 8);

function extractDateFromLinkedInUrl(url) {
  if (!url) return null;
  try {
    const patterns = [
      /activity[:\-](\d{19})/,
      /activity\/(\d{19})/,
      /ugcPost[:\-](\d{19})/,
      /share[:\-](\d{19})/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const id = BigInt(match[1]);
        const timestampMs = Number(id >> 22n);
        const date = new Date(timestampMs);
        if (date.getFullYear() >= 2010 && date.getFullYear() <= 2030) {
          return date.toISOString().slice(0, 10);
        }
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

const STORAGE_KEY = "linkedin_comment_tracker_data";

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...parsed, activeTab: "input", selectedPost: null, inputMode: "manual" };
    }
  } catch (e) { /* ignore */ }
  return null;
}

function saveState(state) {
  try {
    const { activeTab, selectedPost, inputMode, ...data } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

const defaultState = { posts: [], comments: [], activeTab: "input", selectedPost: null, inputMode: "manual" };

function reducer(state, action) {
  switch (action.type) {
    case "ADD_POST": return { ...state, posts: [...state.posts, { id: genId(), title: action.title, url: action.url || "", date: action.date || new Date().toISOString().slice(0, 10), notes: "" }] };
    case "ADD_COMMENT": return { ...state, comments: [...state.comments, action.comment] };
    case "ADD_BULK": return { ...state, posts: [...state.posts, ...action.posts.filter(p => !state.posts.find(ep => ep.title === p.title))], comments: [...state.comments, ...action.comments] };
    case "SET_TAB": return { ...state, activeTab: action.tab };
    case "SELECT_POST": return { ...state, selectedPost: action.id, activeTab: "threads" };
    case "DELETE_POST": return { ...state, posts: state.posts.filter(p => p.id !== action.id), comments: state.comments.filter(c => c.postId !== action.id) };
    case "DELETE_COMMENT": {
      const toDelete = new Set([action.id]);
      let changed = true;
      while (changed) {
        changed = false;
        state.comments.forEach(c => { if (c.parentId && toDelete.has(c.parentId) && !toDelete.has(c.id)) { toDelete.add(c.id); changed = true; } });
      }
      return { ...state, comments: state.comments.filter(c => !toDelete.has(c.id)) };
    }
    case "SET_INPUT_MODE": return { ...state, inputMode: action.mode };
    case "CLEAR_ALL": return { ...defaultState };
    default: return state;
  }
}

function getPeople(comments) {
  const map = {};
  comments.forEach(c => {
    if (!map[c.name]) map[c.name] = { name: c.name, posts: new Set(), count: 0, first: c.date, last: c.date };
    map[c.name].posts.add(c.postId);
    map[c.name].count++;
    if (c.date < map[c.name].first) map[c.name].first = c.date;
    if (c.date > map[c.name].last) map[c.name].last = c.date;
  });
  return Object.values(map).sort((a, b) => b.count - a.count);
}

function Tab({ label, active, onClick, count }) {
  return (
    <button onClick={onClick} className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 ${active ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}>
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-slate-600 text-slate-200" : "bg-slate-200 text-slate-600"}`}>{count}</span>
      )}
    </button>
  );
}

function Badge({ children, className = "" }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>{children}</span>;
}

function DateExtractor() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);

  const extract = () => {
    const date = extractDateFromLinkedInUrl(url);
    if (date) {
      setResult({ success: true, date });
    } else {
      setResult({ success: false });
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-medium text-slate-600">Extract date from any LinkedIn URL</p>
      <div className="flex gap-2">
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste any LinkedIn post or comment URL..." className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-300" onKeyDown={e => e.key === "Enter" && extract()} />
        <button onClick={extract} className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-600 transition-colors font-medium">Extract</button>
      </div>
      {result && (
        <p className={`text-xs ${result.success ? "text-emerald-600" : "text-red-500"}`}>
          {result.success ? `Date extracted: ${result.date}` : "Couldn't extract date — make sure the URL contains a LinkedIn activity/post ID"}
        </p>
      )}
    </div>
  );
}

function ManualInput({ state, dispatch }) {
  const [postTitle, setPostTitle] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [postDate, setPostDate] = useState(new Date().toISOString().slice(0, 10));
  const [selPost, setSelPost] = useState("");
  const [commenter, setCommenter] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentUrl, setCommentUrl] = useState("");
  const [parentComment, setParentComment] = useState("");
  const [commentDate, setCommentDate] = useState(new Date().toISOString().slice(0, 10));
  const [postDateExtracted, setPostDateExtracted] = useState(false);
  const [commentDateExtracted, setCommentDateExtracted] = useState(false);

  // Auto-extract date from post URL and update the date picker
  useEffect(() => {
    const extracted = extractDateFromLinkedInUrl(postUrl);
    if (extracted) {
      setPostDate(extracted);
      setPostDateExtracted(true);
    } else {
      setPostDateExtracted(false);
    }
  }, [postUrl]);

  // Auto-extract date from comment URL and update the date picker
  useEffect(() => {
    const extracted = extractDateFromLinkedInUrl(commentUrl);
    if (extracted) {
      setCommentDate(extracted);
      setCommentDateExtracted(true);
    } else {
      setCommentDateExtracted(false);
    }
  }, [commentUrl]);

  const addPost = () => {
    if (!postTitle.trim()) return;
    dispatch({ type: "ADD_POST", title: postTitle.trim(), url: postUrl.trim(), date: postDate });
    setPostTitle(""); setPostUrl(""); setPostDate(new Date().toISOString().slice(0, 10)); setPostDateExtracted(false);
  };

  const addComment = () => {
    if (!selPost || !commenter.trim() || !commentText.trim()) return;
    const parent = parentComment || null;
    const depth = parent ? (state.comments.find(c => c.id === parent)?.depth || 0) + 1 : 0;
    dispatch({
      type: "ADD_COMMENT",
      comment: { id: genId(), postId: selPost, name: commenter.trim(), text: commentText.trim(), depth, parentId: parent, date: commentDate, url: commentUrl.trim() }
    });
    setCommentText(""); setParentComment(""); setCommentUrl(""); setCommentDate(new Date().toISOString().slice(0, 10)); setCommentDateExtracted(false);
  };

  const postComments = state.comments.filter(c => c.postId === selPost);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-slate-800 text-white text-xs flex items-center justify-center">1</span>
          Add a Post
        </h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Post topic or title" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" onKeyDown={e => e.key === "Enter" && addPost()} />
            <div className="relative">
              <input type="date" value={postDate} onChange={e => { setPostDate(e.target.value); setPostDateExtracted(false); }} className={`w-40 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors ${postDateExtracted ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`} />
              {postDateExtracted && <span className="absolute -top-2 right-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 rounded-full font-medium">auto</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <input value={postUrl} onChange={e => setPostUrl(e.target.value)} placeholder="LinkedIn post URL (date auto-extracts)" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <button onClick={addPost} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors font-medium">Add</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-slate-800 text-white text-xs flex items-center justify-center">2</span>
          Add a Comment
        </h3>
        <div className="space-y-3">
          <select value={selPost} onChange={e => { setSelPost(e.target.value); setParentComment(""); }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white">
            <option value="">Select a post...</option>
            {state.posts.map(p => <option key={p.id} value={p.id}>{p.title} ({p.date})</option>)}
          </select>
          <input value={commenter} onChange={e => setCommenter(e.target.value)} placeholder="Commenter name" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
          <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Comment text..." rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none" />
          <div className="flex gap-2">
            <input value={commentUrl} onChange={e => setCommentUrl(e.target.value)} placeholder="Comment URL (date auto-extracts)" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <div className="relative">
              <input type="date" value={commentDate} onChange={e => { setCommentDate(e.target.value); setCommentDateExtracted(false); }} className={`w-40 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors ${commentDateExtracted ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`} />
              {commentDateExtracted && <span className="absolute -top-2 right-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 rounded-full font-medium">auto</span>}
            </div>
          </div>
          {selPost && postComments.length > 0 && (
            <select value={parentComment} onChange={e => setParentComment(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white">
              <option value="">Top-level comment (no parent)</option>
              {state.comments.filter(c => c.postId === selPost).map(c => (
                <option key={c.id} value={c.id}>↳ Reply to: {c.name} — "{c.text.slice(0, 50)}..."</option>
              ))}
            </select>
          )}
          <button onClick={addComment} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors font-medium">Add Comment</button>
        </div>
      </div>

      <DateExtractor />
    </div>
  );
}

function BulkInput({ state, dispatch }) {
  const [raw, setRaw] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [postDate, setPostDate] = useState(new Date().toISOString().slice(0, 10));
  const [parsed, setParsed] = useState(null);
  const [postDateExtracted, setPostDateExtracted] = useState(false);

  useEffect(() => {
    const extracted = extractDateFromLinkedInUrl(postUrl);
    if (extracted) {
      setPostDate(extracted);
      setPostDateExtracted(true);
    } else {
      setPostDateExtracted(false);
    }
  }, [postUrl]);

  const parse = () => {
    if (!raw.trim() || !postTitle.trim()) return;
    const lines = raw.trim().split("\n").filter(l => l.trim());
    const comments = [];
    let currentParent = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      const isReply = line.startsWith("  ") || line.startsWith("\t") || trimmed.startsWith("↳") || trimmed.startsWith("→") || trimmed.startsWith(">");
      const cleaned = trimmed.replace(/^[↳→>\-•]\s*/, "");
      const match = cleaned.match(/^([^:\-]+?)\s*[:\-–—]\s*(.+)$/);
      if (match) {
        const c = { id: genId(), name: match[1].trim(), text: match[2].trim(), depth: isReply ? 1 : 0, parentId: isReply ? currentParent : null, date: postDate, url: "" };
        if (!isReply) currentParent = c.id;
        comments.push(c);
      }
    });
    setParsed(comments);
  };

  const confirm = () => {
    if (!parsed?.length) return;
    const postId = genId();
    dispatch({
      type: "ADD_BULK",
      posts: [{ id: postId, title: postTitle.trim(), url: postUrl.trim(), date: postDate, notes: "" }],
      comments: parsed.map(c => ({ ...c, postId }))
    });
    setRaw(""); setPostTitle(""); setPostUrl(""); setPostDate(new Date().toISOString().slice(0, 10)); setParsed(null); setPostDateExtracted(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">Paste Comments in Bulk</h3>
      <p className="text-xs text-slate-500">Format each line as <code className="bg-slate-100 px-1 rounded">Name: Comment text</code>. Indent replies with spaces or tabs, or prefix with ↳ or &gt;</p>
      <div className="flex gap-2">
        <input value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Post title" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        <div className="relative">
          <input type="date" value={postDate} onChange={e => { setPostDate(e.target.value); setPostDateExtracted(false); }} className={`w-40 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors ${postDateExtracted ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`} />
          {postDateExtracted && <span className="absolute -top-2 right-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 rounded-full font-medium">auto</span>}
        </div>
      </div>
      <input value={postUrl} onChange={e => setPostUrl(e.target.value)} placeholder="LinkedIn post URL (date auto-extracts)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8} placeholder={"Dave Miller: Great post about automation!\n  Jack: Thanks Dave, glad you liked it!\n  Dave Miller: Will definitely try this approach\nSarah Chen: This resonates so much"} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none" />
      <div className="flex gap-2">
        <button onClick={parse} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors font-medium">Parse</button>
        {parsed && <button onClick={confirm} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500 transition-colors font-medium">Confirm & Add {parsed.length} comments</button>}
      </div>
      {parsed && (
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 max-h-48 overflow-y-auto">
          <p className="text-xs font-medium text-slate-600 mb-2">Preview ({parsed.length} comments parsed):</p>
          {parsed.map(c => (
            <div key={c.id} className="text-xs text-slate-700 py-1" style={{ paddingLeft: c.depth * 20 }}>
              {c.depth > 0 && <span className="text-slate-400">↳ </span>}
              <span className="font-medium">{c.name}</span>: {c.text.slice(0, 80)}{c.text.length > 80 && "..."}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadView({ state, dispatch }) {
  const post = state.posts.find(p => p.id === state.selectedPost);
  const postComments = state.comments.filter(c => c.postId === state.selectedPost);
  const topLevel = postComments.filter(c => c.depth === 0);

  const getReplies = (parentId) => postComments.filter(c => c.parentId === parentId);

  const renderThread = (comment, depth = 0) => (
    <div key={comment.id} className={`${depth > 0 ? "ml-6 border-l-2 border-slate-200 pl-4" : ""}`}>
      <div className="py-2.5 group">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{comment.name[0]}</span>
          <span className="text-sm font-semibold text-slate-800">{comment.name}</span>
          <span className="text-xs text-slate-400">{comment.date}</span>
          {comment.url && <a href={comment.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-500 hover:text-sky-700">comment link ↗</a>}
          <button onClick={() => dispatch({ type: "DELETE_COMMENT", id: comment.id })} className="ml-auto opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition-all">✕</button>
        </div>
        <p className="text-sm text-slate-600 ml-9">{comment.text}</p>
      </div>
      {getReplies(comment.id).map(r => renderThread(r, depth + 1))}
    </div>
  );

  if (!post) return (
    <div className="text-center py-16 text-slate-400">
      <p className="text-lg mb-1">Select a post to view threads</p>
      <p className="text-sm">Go to the Posts tab and click "View Threads"</p>
    </div>
  );

  return (
    <div>
      <button onClick={() => dispatch({ type: "SET_TAB", tab: "posts" })} className="text-sm text-slate-500 hover:text-slate-700 mb-3 flex items-center gap-1">← Back to Posts</button>
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-4">
        <h3 className="font-semibold text-slate-800">{post.title}</h3>
        <p className="text-xs text-slate-400 mt-1">
          {post.date} · {postComments.length} comments · {new Set(postComments.map(c => c.name)).size} people
          {post.url && <> · <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-700">View on LinkedIn ↗</a></>}
        </p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm divide-y divide-slate-100">
        {topLevel.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">No comments yet</p> : topLevel.map(c => renderThread(c))}
      </div>
    </div>
  );
}

function ExportView({ state }) {
  const [copied, setCopied] = useState(false);

  const toCSV = () => {
    const headers = ["Post Title", "Post Date", "Post URL", "Commenter", "Comment", "Reply Depth", "Comment Date", "Comment URL"];
    const rows = state.comments.map(c => {
      const post = state.posts.find(p => p.id === c.postId);
      return [post?.title || "", post?.date || "", post?.url || "", c.name, c.text, c.depth, c.date, c.url].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    return [headers.join(","), ...rows].join("\n");
  };

  const toPeopleCSV = () => {
    const people = getPeople(state.comments);
    const headers = ["Name", "Total Comments", "Posts Commented On", "First Seen", "Last Seen", "Engagement Tier"];
    const rows = people.map(p => {
      return [p.name, p.count, p.posts.size, p.first, p.last, getTier(p.count)].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    return [headers.join(","), ...rows].join("\n");
  };

  const download = (content, filename) => {
    const blob = new Blob([content], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  const copyCSV = () => {
    navigator.clipboard.writeText(toCSV());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Export Comments</h3>
        <p className="text-xs text-slate-500">All comments with post titles, URLs, dates, thread depth, and direct comment links.</p>
        <div className="flex gap-2">
          <button onClick={() => download(toCSV(), "linkedin_comments_export.csv")} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors font-medium">Download Comments CSV</button>
          <button onClick={copyCSV} className="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors font-medium">{copied ? "Copied!" : "Copy to Clipboard"}</button>
        </div>
        <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-600 max-h-48 overflow-auto whitespace-pre-wrap">{toCSV()}</pre>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Export People</h3>
        <p className="text-xs text-slate-500">All unique commenters with engagement stats and tiers.</p>
        <div className="flex gap-2">
          <button onClick={() => download(toPeopleCSV(), "linkedin_people_export.csv")} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors font-medium">Download People CSV</button>
        </div>
        <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-600 max-h-48 overflow-auto whitespace-pre-wrap">{toPeopleCSV()}</pre>
      </div>
    </div>
  );
}

function SettingsView({ dispatch }) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">Settings</h3>
      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-sm font-medium text-red-600 mb-2">Danger Zone</h4>
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)} className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors font-medium">Clear All Data</button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-red-600">Are you sure? This deletes everything permanently.</p>
            <button onClick={() => { dispatch({ type: "CLEAR_ALL" }); localStorage.removeItem(STORAGE_KEY); setConfirmClear(false); }} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-500 transition-colors font-medium">Yes, Delete All</button>
            <button onClick={() => setConfirmClear(false)} className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors font-medium">Cancel</button>
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">Data is saved automatically to your browser's localStorage. It persists between sessions but is tied to this browser — clearing browser data will remove it.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, defaultState, () => loadState() || defaultState);
  const people = getPeople(state.comments);

  useEffect(() => {
    saveState(state);
  }, [state.posts, state.comments]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LinkedIn Comment Tracker</h1>
            <p className="text-sm text-slate-500 mt-1">Organize comments, track threads, and spot your repeat engagers</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Auto-saving locally
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Posts", value: state.posts.length, color: "text-slate-800" },
            { label: "Comments", value: state.comments.length, color: "text-emerald-600" },
            { label: "People", value: people.length, color: "text-sky-600" },
            { label: "Repeat Engagers", value: people.filter(p => p.count >= 2).length, color: "text-amber-600" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mb-5 bg-white rounded-xl border border-slate-200 p-1 shadow-sm flex-wrap">
          {[
            { id: "input", label: "Add Data" },
            { id: "posts", label: "Posts", count: state.posts.length },
            { id: "threads", label: "Threads" },
            { id: "people", label: "People", count: people.length },
            { id: "export", label: "Export" },
            { id: "settings", label: "⚙" },
          ].map(t => <Tab key={t.id} label={t.label} count={t.count} active={state.activeTab === t.id} onClick={() => dispatch({ type: "SET_TAB", tab: t.id })} />)}
        </div>

        {state.activeTab === "input" && (
          <div className="space-y-4">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
              <button onClick={() => dispatch({ type: "SET_INPUT_MODE", mode: "manual" })} className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${state.inputMode === "manual" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Manual Entry</button>
              <button onClick={() => dispatch({ type: "SET_INPUT_MODE", mode: "bulk" })} className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${state.inputMode === "bulk" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Bulk Paste</button>
            </div>
            {state.inputMode === "manual" ? <ManualInput state={state} dispatch={dispatch} /> : <BulkInput state={state} dispatch={dispatch} />}
          </div>
        )}

        {state.activeTab === "posts" && (
          <div className="space-y-2">
            {state.posts.length === 0 ? (
              <div className="text-center py-16 text-slate-400"><p>No posts yet — add one in the "Add Data" tab</p></div>
            ) : state.posts.map(p => {
              const pc = state.comments.filter(c => c.postId === p.id);
              const uniquePeople = new Set(pc.map(c => c.name)).size;
              return (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-800 text-sm truncate">{p.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.date} · {pc.length} comments · {uniquePeople} people
                      {p.url && <> · <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-700">LinkedIn ↗</a></>}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => dispatch({ type: "SELECT_POST", id: p.id })} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium">View Threads</button>
                    <button onClick={() => dispatch({ type: "DELETE_POST", id: p.id })} className="px-2 py-1.5 text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {state.activeTab === "threads" && <ThreadView state={state} dispatch={dispatch} />}

        {state.activeTab === "people" && (
          <div className="space-y-2">
            {people.length === 0 ? (
              <div className="text-center py-16 text-slate-400"><p>No people tracked yet</p></div>
            ) : people.map(p => (
              <div key={p.name} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">{p.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 text-sm">{p.name}</span>
                    <Badge className={tierColor(getTier(p.count))}>{getTier(p.count)}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{p.count} comments across {p.posts.size} posts · {p.first === p.last ? p.first : `${p.first} → ${p.last}`}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-slate-800">{p.count}</div>
                  <div className="text-xs text-slate-400">comments</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {state.activeTab === "export" && <ExportView state={state} />}
        {state.activeTab === "settings" && <SettingsView dispatch={dispatch} />}
      </div>
    </div>
  );
}
