# 🤖 TaskQuest Discord Bot

A gamified task management Discord bot with RPG elements.

## Features

- 📋 **Lists & Tasks**: Create lists, add items, track progress
- 🎮 **Gamification**: XP, levels, streaks, achievements
- ⚔️ **7 Classes**: Default, Hero, Gambler, Assassin, Wizard, Archer, Tank
- 🌳 **Skill Trees**: Unlock abilities with skill points
- 🎰 **Mini-games**: Blackjack, Rock-Paper-Scissors, Hangman
- 🏆 **Leaderboards**: Compete with server members

## Commands

| Command | Description |
|---------|-------------|
| `/list create` | Create a new list |
| `/list add` | Add item to a list |
| `/list view` | View list items |
| `/list check` | Mark item complete |
| `/profile` | View your stats |
| `/class` | View/buy/equip classes |
| `/skills` | Manage skill trees |
| `/achievements` | View achievements |
| `/leaderboard` | Server rankings |
| `/blackjack` | Play Blackjack |
| `/rps` | Rock Paper Scissors |
| `/hangman` | Play Hangman |
| `/daily` | Claim daily reward |
| `/help` | Show all commands |

## Setup

### 1. Create Discord Application

1. Go to https://discord.com/developers/applications
2. Create new application
3. Go to Bot tab → Add Bot
4. Copy the token
5. Enable all Privileged Gateway Intents

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in:
- `DISCORD_TOKEN` - Bot token
- `CLIENT_ID` - Application ID
- `DB_*` - Database credentials

### 4. Set Up Database

Use XAMPP locally or Aiven for cloud MySQL.
The bot auto-creates tables on first run.

### 5. Deploy Commands

```bash
npm run deploy
```

### 6. Start Bot

```bash
npm start
```

## Deployment (Render.com)

Deploy as **Background Worker**:

```
Build Command: npm install
Start Command: npm start
```

Environment variables:
- `DISCORD_TOKEN`
- `CLIENT_ID`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SSL=true`

## Project Structure

```
├── commands/           # Slash commands
│   ├── list.js        # List management
│   ├── gamification.js # Profile, classes, skills
│   └── game.js        # Mini-games
├── database/
│   └── db.js          # Database module
├── utils/
│   ├── ui.js          # Discord embeds
│   └── gameLogic.js   # Game mechanics
├── index.js           # Bot entry point
└── deploy-commands.js # Command deployment
```

## Database

Supports:
- Local MySQL (XAMPP)
- Aiven MySQL (cloud)
- Any MySQL-compatible database

Set `DB_SSL=true` for cloud databases.

## License

MIT
