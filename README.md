# LinkedIn Comment Tracker

A lightweight React app for organizing and analyzing engagement on your LinkedIn posts. Track comments, threaded replies, and repeat commenters — all saved locally in your browser.

**🔗 Live app: [jackchern2007.github.io/CommentTracker](https://jackchern2007.github.io/CommentTracker/)**

No install needed — just open the link and start tracking. Your data is saved privately in your own browser.

## Why This Exists

If you're actively posting on LinkedIn, you'll notice the same people showing up in your comments across different posts. LinkedIn doesn't give you a good way to track this. This tool lets you log comments, preserve full reply threads, and automatically surface your most engaged followers with tiered scoring.

## Features

- **Post & Comment Management** — Log posts with URLs, add comments manually or paste them in bulk
- **Threaded Conversations** — Preserve full reply chains with visual nesting, just like LinkedIn's comment threads
- **People Dashboard** — Automatically tracks unique commenters across all posts with engagement tiers:
  - 🆕 **New** (1 comment)
  - 🔄 **Returning** (2 comments)
  - ✅ **Regular** (3-4 comments)
  - ⭐ **Super Fan** (5+ comments)
- **Date Extraction** — Paste a LinkedIn post or comment URL and the date is automatically extracted from LinkedIn's snowflake ID
- **CSV Export** — Export comments (with post URLs, thread depth, and comment links) or people (with engagement stats) as CSV files
- **Persistent Storage** — All data auto-saves to localStorage and persists between sessions
- **Bulk Paste Mode** — Quickly add multiple comments at once using a simple `Name: Comment` format

## Screenshots

*Coming soon*

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)

### Installation

```bash
# Clone the repo
git clone https://github.com/jackChern2007/CommentTracker.git
cd CommentTracker

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build for Production

```bash
npm run build
```

The output will be in the `dist/` folder, ready to deploy anywhere that serves static files.

## Usage

1. **Add a Post** — Enter a title and optionally paste the LinkedIn URL (the date auto-fills)
2. **Add Comments** — Select a post, enter the commenter's name, paste the comment text, and optionally include the comment URL
3. **View Threads** — Click "View Threads" on any post to see the full conversation tree
4. **Check People** — The People tab shows all commenters ranked by engagement with automatic tier badges
5. **Export** — Download CSV files for comments or people to use in spreadsheets or further analysis

### Bulk Paste Format

```
Dave Miller: Great post about automation!
  Jack: Thanks Dave, glad you liked it!
  Dave Miller: Will definitely try this approach
Sarah Chen: This resonates so much
```

Indent replies with spaces/tabs, or prefix with `↳` or `>`.

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- localStorage for persistence
- No backend required

## License

MIT

## Contributing

Feel free to open issues or submit PRs. Some ideas for future improvements:

- Browser extension to capture comments directly from LinkedIn
- Data visualization / engagement charts over time
- Import/export JSON for backup and transfer between browsers
- Search and filter across all comments
