# Capuzzella

AI-Powered Website Builder - Edit websites using natural language.

## Overview

Capuzzella is a website builder where:
- **Frontend**: Static HTML files served directly (the published site)
- **Preview Mode**: Same HTML + injected AI chat sidebar, activated via `?edit=true`
- **AI Chat**: Users describe changes in natural language; AI modifies HTML directly. **Bring your own API Key**.
- **Publishing**: Copy edited HTML from drafts to public directory

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file and update with your settings:

```bash
cp .env.example .env
```

Edit `.env` and set:
- `SESSION_SECRET` - A secure random string for session encryption (see below)
- `AI_PROVIDER` - Either `openai` or `anthropic`
- `OPENAI_API_KEY` - Your OpenAI API key (if using OpenAI)
- `ANTHROPIC_API_KEY` - Your Anthropic API key (if using Anthropic)

Generate a secure SESSION_SECRET:

```bash
npm run generate:secret
# or
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as the `SESSION_SECRET` value in your `.env` file.

### 3. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start at http://localhost:3000

On first run, a default admin user is created automatically:
- **Username**: `admin`
- **Password**: Randomly generated and shown in the server logs

**Important**: Save the password from the logs on first run. It will only be displayed once.

To create additional users, use the create-user script:

```bash
node scripts/create-user.js username password
```

## Usage

### Editing Pages

1. Navigate to any page with `?edit=true` appended to the URL
   - Example: http://localhost:3000/index.html?edit=true
2. Log in with your credentials
3. Use the chat sidebar to describe changes
4. Click "Publish" to make changes live

### Example Commands

- "Change the heading to 'Welcome to Our Website'"
- "Make the hero section background blue"
- "Add a new section with three feature cards"
- "Remove the contact form"
- "Change the button text to 'Get Started'"

## Project Structure of relevant files

```
capuzzella/
├── src/
│   ├── server.js              # Express app entry
├── drafts/                    # Working HTML files (editable)
├── public/                    # Published HTML files (read-only)
├── components/                # Reusable component templates
├── scripts/                   # Utility scripts
│   └── create-user.js         # Create admin users
├── data/                      # SQLite database storage
├── .env                       # Environment configuration
└── package.json
```

## Unified Design

Store UI components like Card, Button, Dialog, etc. in this directory. Capuzzella uses it for a unified/ corportate design across all pages.

```
capuzzella/
└── components/
    ├── card.html
    └── ...
```

## Pages

- `/*.html` - View the published page
- `/sitemap.xml` - The Sitemap of all published pages
- `/*.html?edit=true` - Page in Edit Mode with AI Chat  (Auth required)
- `/*.html?draft=true` - Draft Version of Page without AI Chat (Auth required)
- `/settings` - User Settings (Auth required)
- `/page` - List of all pages (Auth required)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | ExpressJS (ES Modules) |
| Database | SQLite (better-sqlite3) |
| Auth | express-session + bcrypt |
| AI | OpenAI / Anthropic (configurable) |
| Styling | Tailwind CSS |
| Editor UI | Vanilla JS |

## Deploy on Railway

Deploy your own Capuzzella instance with one click:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template?template=https://github.com/mauricewipf/capuzzella)

### Environment Variables

Configure these in your Railway project settings:

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | A secure random string for session encryption |
| `AI_PROVIDER` | Either `openai` or `anthropic` |
| `OPENAI_API_KEY` | Your OpenAI API key (if using OpenAI) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (if using Anthropic) |

### Post-Deployment Setup

On first run, a default admin user is created automatically. Check the deployment logs for the credentials:
- **Username**: `admin`
- **Password**: Shown in the logs (save it immediately)

### Persistent Storage

Railway supports persistent volumes. To ensure your database and draft files persist across deployments, attach a volume to your service:

1. Go to your service in Railway
2. Click "Add Volume"
3. Mount it at `/app/data` for the SQLite database

## License

ISC
