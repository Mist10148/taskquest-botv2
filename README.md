# TaskQuest Bot v3.8.3

A gamified Discord task management bot with RPG elements. Manage your tasks through lists, earn XP, level up, pick a class, unlock skills, chase achievements, and play mini-games -- all inside Discord.

## Features

- **Lists & Tasks** -- Create lists, add items, set deadlines & priorities, filter, sort, and search
- **XP & Leveling** -- Earn XP for completing tasks and playing games, level up automatically
- **7 RPG Classes** -- Default, Hero, Gambler, Assassin, Wizard, Archer, Tank -- each with unique mechanics
- **Skill Trees** -- Unlock passive abilities with skill points to boost XP gains
- **27 Achievements** -- Milestone-based unlocks across lists, tasks, levels, streaks, XP, classes, and games
- **Mini-Games** -- Blackjack (with full deck simulation), Rock-Paper-Scissors, Hangman
- **Leaderboards** -- Compete with server members by XP
- **Daily Rewards** -- Claim daily XP with streak bonuses
- **Deadline Reminders** -- Automated DM notifications for lists due today
- **Gamification Toggle** -- Enable or disable XP tracking per user

## Commands

| Command | Description |
|---------|-------------|
| `/list` | View all your lists, or view a specific list by name |
| `/profile` | View your stats (XP, level, class, streak, achievements) |
| `/daily` | Claim your daily XP reward (24h cooldown, streak bonuses) |
| `/class` | View, buy, or equip RPG classes |
| `/skills` | Browse and unlock skills from your class skill tree |
| `/achievements` | View all achievements and your unlock progress |
| `/leaderboard` | Server XP rankings |
| `/game` | Game center -- play Blackjack, Rock-Paper-Scissors, or Hangman |
| `/automation` | Toggle deadline reminder DMs |
| `/toggle` | Enable or disable the gamification system |
| `/ping` | Check bot latency |
| `/app` | Link to the TaskQuest web dashboard |
| `/help` | Show command reference |

## Classes

| Class | Cost | Mechanic |
|-------|------|----------|
| Default | Free | No bonus (starter class) |
| Hero | 500 XP | +25 flat XP per action |
| Gambler | 300 XP | Random 0.5x-2x XP multiplier |
| Assassin | 400 XP | Streak stacking (+5% per stack, max 10) |
| Wizard | 700 XP | Spell combos -- every 3rd task gives bonus, every 5th gives 2x |
| Archer | 600 XP | Crit system with streak bonuses |
| Tank | 500 XP | Shield momentum stacking (4% per stack + flat bonus) |

## Prerequisites

- [Node.js](https://nodejs.org/) v18.0.0 or higher
- MySQL database (local via [XAMPP](https://www.apachefriends.org/) or cloud via Aiven, PlanetScale, Railway, AWS, etc.)
- A [Discord application](https://discord.com/developers/applications) with a bot token

## Setup

### 1. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name
3. Go to the **Bot** tab and click **Add Bot**
4. Copy the **bot token**
5. Copy the **Application ID** (from General Information)
6. Under **Privileged Gateway Intents**, enable all intents
7. Go to **OAuth2 > URL Generator**, select the `bot` and `applications.commands` scopes, then invite the bot to your server

### 2. Install Dependencies

```bash
cd taskquest-bot
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

```env
# Required
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_application_client_id_here

# Optional (for dev -- instant command updates on one server)
GUILD_ID=your_test_server_id

# Database -- Option A: Local MySQL (XAMPP)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=taskquest_bot

# Database -- Option B: Cloud MySQL (uncomment and use instead)
# DB_URL=mysql://username:password@hostname:port/database
# DB_SSL=true
# DB_SSL_REJECT_UNAUTHORIZED=true
```

See `.env.example` for all available options including pool size, timezone, logging level, and web app URL.

### 4. Set Up the Database

**Local (XAMPP):**
1. Start XAMPP and enable MySQL
2. Open phpMyAdmin and create a database called `taskquest_bot`
3. The bot auto-creates all tables on first run

**Cloud:**
1. Create a MySQL database on your provider
2. Set the `DB_*` variables (or `DB_URL`) in `.env`
3. Set `DB_SSL=true` for cloud connections
4. Tables are auto-created on first run

### 5. Deploy Slash Commands

```bash
# Global deployment (takes up to 1 hour to propagate)
npm run deploy

# Guild-specific deployment (instant, for development)
npm run deploy
# Make sure GUILD_ID is set in .env
```

### 6. Start the Bot

```bash
# Production
npm start

# Development (auto-restarts on file changes)
npm run dev
```

The bot will:
1. Start an HTTP keep-alive server on port 3000
2. Connect to MySQL and initialize tables
3. Log in to Discord
4. Begin checking deadlines every hour

## Project Structure

```
taskquest-bot/
├── index.js               # Entry point -- client setup, event handlers, keep-alive server
├── deploy-commands.js     # Deploys slash commands to Discord API
├── package.json
├── .env.example           # Environment variable template
├── render.yaml            # Render.com deployment blueprint
├── commands/
│   ├── list.js            # /list command -- list & item CRUD, filtering, sorting, search
│   ├── gamification.js    # /profile, /class, /skills, /achievements, /daily, /leaderboard, etc.
│   └── game.js            # /game command -- Blackjack, RPS, Hangman
├── database/
│   ├── db.js              # Connection pool, query helpers, table initialization
│   └── schema.sql         # Full database schema reference
└── utils/
    ├── ui.js              # Discord embed builders for all UI
    ├── gameLogic.js       # Class mechanics, skill trees, achievements, XP calculations
    └── games/
        ├── deck.js            # Card deck for Blackjack
        ├── sessionManager.js  # Game session tracking & state
        └── xpTransaction.js   # XP transaction logging
```

## Database

The bot uses MySQL with the following tables (auto-created on startup):

| Table | Purpose |
|-------|---------|
| `users` | Player stats, class, XP, level, streak, settings |
| `lists` | Task lists with deadlines, priorities, categories |
| `items` | Individual tasks within lists |
| `user_skills` | Unlocked skill tree abilities per user |
| `achievements` | Achievement unlock tracking |
| `game_sessions` | Active and past game sessions |
| `blackjack_hands` | Detailed Blackjack game state |
| `xp_transactions` | Immutable XP change log |

## Deployment (Render.com)

The included `render.yaml` provides a ready-made blueprint.

1. Push to a GitHub/GitLab repo
2. On Render, create a **New Blueprint Instance** and connect the repo
3. Or manually create a **Background Worker**:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add environment variables:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `DB_SSL=true`

The bot includes a built-in HTTP keep-alive server on port 3000 to prevent free-tier services from sleeping.

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | -- | Bot token from Discord Developer Portal |
| `CLIENT_ID` | Yes | -- | Application ID from Discord Developer Portal |
| `GUILD_ID` | No | -- | Server ID for instant dev command deployment |
| `DB_HOST` | Yes* | `localhost` | MySQL host |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_USER` | Yes* | `root` | MySQL username |
| `DB_PASSWORD` | Yes* | -- | MySQL password |
| `DB_NAME` | Yes* | `taskquest_bot` | MySQL database name |
| `DB_URL` | No | -- | Full connection string (alternative to individual DB vars) |
| `DB_SSL` | No | `false` | Enable SSL for cloud databases |
| `DB_SSL_REJECT_UNAUTHORIZED` | No | `true` | Reject unauthorized SSL certs |
| `DB_POOL_SIZE` | No | `10` | Connection pool size |
| `DB_TIMEZONE` | No | `UTC` | Database timezone |
| `LOG_LEVEL` | No | `info` | Logging level |
| `WEB_APP_URL` | No | -- | URL for the `/app` command |
| `PORT` | No | `3000` | Keep-alive HTTP server port |

*Required unless `DB_URL` is provided.

## License

MIT
