/**
 * 🎮 TASKQUEST - GAME LOGIC
 * Classes, XP calculations, achievements
 */

// ═══════════════════════════════════════════════════════════════════════════════
//  ⚔️ CLASSES
// ═══════════════════════════════════════════════════════════════════════════════

const CLASSES = {
    DEFAULT: {
        name: 'Default',
        emoji: '⚪',
        cost: 0,
        description: 'No XP bonus. Balanced starter class.'
    },
    HERO: {
        name: 'Hero',
        emoji: '⚔️',
        cost: 500,
        description: '+25 XP on every action. Reliable and simple.'
    },
    GAMBLER: {
        name: 'Gambler',
        emoji: '🎲',
        cost: 300,
        description: 'RNG-based XP. High-risk, high-reward.'
    },
    ASSASSIN: {
        name: 'Assassin',
        emoji: '🗡️',
        cost: 400,
        description: 'XP streak mechanic. +5% per stack (max 10).'
    },
    WIZARD: {
        name: 'Wizard',
        emoji: '🔮',
        cost: 700,
        description: 'Spell combos + Wisdom scaling (+5 XP/level).'
    },
    ARCHER: {
        name: 'Archer',
        emoji: '🏹',
        cost: 600,
        description: 'Precision shot system with crits.'
    },
    TANK: {
        name: 'Tank',
        emoji: '🛡️',
        cost: 500,
        description: 'Shield momentum stacking. Strong early.'
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  📊 XP & LEVELING
// ═══════════════════════════════════════════════════════════════════════════════

const XP_PER_LEVEL = 100;

function calculateLevel(totalXP) {
    return Math.floor(totalXP / XP_PER_LEVEL) + 1;
}

function addXP(user, amount) {
    if (!user.gamification_enabled) {
        return { xpGained: 0, leveledUp: false, newLevel: user.player_level };
    }
    
    const oldLevel = user.player_level;
    user.player_xp += amount;
    user.player_level = calculateLevel(user.player_xp);
    
    return {
        xpGained: amount,
        leveledUp: user.player_level > oldLevel,
        oldLevel,
        newLevel: user.player_level
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  🎯 CLASS XP CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

function calculateClassXP(user, baseXP) {
    let finalXP = baseXP;
    let bonusInfo = { type: null, details: '' };
    const userUpdates = {};
    
    switch (user.player_class) {
        case 'DEFAULT':
            break;
            
        case 'HERO':
            finalXP += 25;
            bonusInfo = { type: 'HERO', details: '⚔️ **Hero Bonus:** +25 XP' };
            break;
            
        case 'GAMBLER': {
            const bonus = Math.floor(Math.random() * (baseXP + 100));
            const lose = Math.random() < 0.2;
            
            if (lose) {
                finalXP = Math.max(1, baseXP - bonus);
                bonusInfo = { type: 'GAMBLER_LOSS', details: `🎲 **Bad Luck!** Lost ${bonus} XP → ${finalXP} XP` };
            } else {
                finalXP = baseXP + bonus;
                bonusInfo = { type: 'GAMBLER_WIN', details: `🎲 **Lucky Roll!** +${bonus} XP → ${finalXP} XP` };
            }
            break;
        }
        
        case 'ASSASSIN': {
            user.assassin_streak = (user.assassin_streak || 0) + 1;
            userUpdates.assassin_streak = user.assassin_streak;
            
            if (user.assassin_streak >= 3) {
                if ((user.assassin_stacks || 0) < 10) {
                    user.assassin_stacks = (user.assassin_stacks || 0) + 1;
                    userUpdates.assassin_stacks = user.assassin_stacks;
                }
                
                const percentBonus = 5 * user.assassin_stacks;
                const bonusXP = Math.floor((baseXP * percentBonus) / 100);
                finalXP = baseXP + bonusXP;
                
                bonusInfo = { type: 'ASSASSIN', details: `🗡️ **Shadow Stack ${user.assassin_stacks}/10** (+${percentBonus}% = +${bonusXP} XP)` };
            } else {
                bonusInfo = { type: 'ASSASSIN_BUILDING', details: `🗡️ Building streak: ${user.assassin_streak}/3` };
            }
            break;
        }
        
        case 'WIZARD': {
            user.wizard_counter = (user.wizard_counter || 0) + 1;
            userUpdates.wizard_counter = user.wizard_counter;
            
            const wisdomBonus = user.player_level * 5;
            
            if (user.wizard_counter % 5 === 0) {
                finalXP = baseXP + (wisdomBonus * 2);
                bonusInfo = { type: 'WIZARD_CRIT', details: `🔮 **ARCANE BURST!** +${wisdomBonus * 2} XP` };
            } else if (user.wizard_counter % 3 === 0) {
                finalXP = baseXP + wisdomBonus;
                bonusInfo = { type: 'WIZARD_COMBO', details: `✨ **Spell Combo!** +${wisdomBonus} XP` };
            } else {
                bonusInfo = { type: 'WIZARD_CHARGE', details: `🔮 Charging: ${user.wizard_counter % 5}/5` };
            }
            
            if (user.wizard_counter >= 5) {
                user.wizard_counter = 0;
                userUpdates.wizard_counter = 0;
            }
            break;
        }
        
        case 'ARCHER': {
            let hitChance = Math.min(97, 80 + (user.player_level * 0.5));
            const roll = Math.random() * 100;
            
            if (roll < hitChance) {
                user.archer_streak = Math.min(15, (user.archer_streak || 0) + 1);
                userUpdates.archer_streak = user.archer_streak;
                
                const streakBonus = Math.floor((baseXP * (user.archer_streak * 8)) / 100) + (3 + user.archer_streak);
                finalXP = baseXP + streakBonus;
                
                let details = `🎯 **HIT!** Streak ${user.archer_streak}/15 (+${streakBonus} XP)`;
                
                // Headshot check
                const headshotChance = Math.min(30, hitChance * 0.2);
                if (roll < headshotChance) {
                    const critBonus = (baseXP * 2) + (user.archer_streak * 3);
                    finalXP += critBonus;
                    details += `\n💥 **HEADSHOT!** +${critBonus} XP`;
                }
                
                // Perfect shot (5%)
                if (Math.random() < 0.05) {
                    const perfectBonus = (baseXP * 4) + (user.archer_streak * 10);
                    finalXP += perfectBonus;
                    details += `\n🌟 **PERFECT SHOT!** +${perfectBonus} XP`;
                }
                
                bonusInfo = { type: 'ARCHER_HIT', details };
            } else {
                user.archer_streak = Math.max(0, (user.archer_streak || 0) - 2);
                userUpdates.archer_streak = user.archer_streak;
                bonusInfo = { type: 'ARCHER_MISS', details: `💨 **Missed!** Streak: ${user.archer_streak}` };
            }
            break;
        }
        
        case 'TANK': {
            user.tank_stacks = (user.tank_stacks || 0) + 1;
            const maxStacks = Math.max(3, 20 - user.player_level);
            
            if (user.tank_stacks > maxStacks) user.tank_stacks = maxStacks;
            userUpdates.tank_stacks = user.tank_stacks;
            
            const percentBonus = Math.floor((baseXP * (user.tank_stacks * 4)) / 100);
            const flatBonus = Math.floor(user.tank_stacks / 2);
            finalXP = baseXP + percentBonus + flatBonus;
            
            bonusInfo = { type: 'TANK', details: `🛡️ **Shield ${user.tank_stacks}/${maxStacks}** (+${percentBonus + flatBonus} XP)` };
            break;
        }
    }
    
    return { finalXP, bonusInfo, userUpdates };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  🔥 STREAKS
// ═══════════════════════════════════════════════════════════════════════════════

function updateStreak(user) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!user.last_active_day) {
        return { streakUpdated: true, newStreak: 1, userUpdates: { streak_count: 1, last_active_day: today } };
    }
    
    const lastDate = new Date(user.last_active_day);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return { streakUpdated: false, newStreak: user.streak_count, userUpdates: {} };
    } else if (diffDays === 1) {
        const newStreak = user.streak_count + 1;
        return { streakUpdated: true, newStreak, increased: true, userUpdates: { streak_count: newStreak, last_active_day: today } };
    } else {
        return { streakUpdated: true, newStreak: 1, broken: true, userUpdates: { streak_count: 1, last_active_day: today } };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  🏆 ACHIEVEMENTS (Personal)
// ═══════════════════════════════════════════════════════════════════════════════

const ACHIEVEMENTS = {
    FIRST_LIST: { name: 'Getting Started', description: 'Create your first list' },
    FIVE_LISTS: { name: 'List Master', description: 'Create 5 lists' },
    TEN_LISTS: { name: 'Organization Pro', description: 'Create 10 lists' },
    FIRST_ITEM: { name: 'Task Beginner', description: 'Add your first item' },
    TEN_ITEMS: { name: 'Busy Bee', description: 'Add 10 items' },
    FIFTY_ITEMS: { name: 'Productivity Machine', description: 'Add 50 items' },
    HUNDRED_ITEMS: { name: 'Task Centurion', description: 'Add 100 items' },
    FIRST_COMPLETE: { name: 'First Victory', description: 'Complete your first item' },
    TEN_COMPLETE: { name: 'Getting Things Done', description: 'Complete 10 items' },
    FIFTY_COMPLETE: { name: 'Achievement Hunter', description: 'Complete 50 items' },
    HUNDRED_COMPLETE: { name: 'Completion Master', description: 'Complete 100 items' },
    STREAK_3: { name: 'Consistent', description: '3 day streak' },
    STREAK_7: { name: 'Week Warrior', description: '7 day streak' },
    STREAK_14: { name: 'Fortnight Fighter', description: '14 day streak' },
    STREAK_30: { name: 'Monthly Dedication', description: '30 day streak' },
    LEVEL_5: { name: 'Rising Star', description: 'Reach level 5' },
    LEVEL_10: { name: 'Veteran', description: 'Reach level 10' },
    LEVEL_25: { name: 'Elite', description: 'Reach level 25' },
    LEVEL_50: { name: 'Legend', description: 'Reach level 50' },
    BUY_CLASS: { name: 'Class Act', description: 'Purchase your first class' },
    ALL_CLASSES: { name: 'Collector', description: 'Own all classes' },
    XP_1000: { name: 'XP Hunter', description: 'Earn 1000 total XP' },
    XP_5000: { name: 'XP Master', description: 'Earn 5000 total XP' },
    XP_10000: { name: 'XP Legend', description: 'Earn 10000 total XP' }
};

function checkAchievements(user, unlockedKeys) {
    const newAchs = [];
    
    const check = (key, condition) => {
        if (!unlockedKeys.includes(key) && condition) {
            newAchs.push({ key, ...ACHIEVEMENTS[key] });
        }
    };
    
    // Lists
    check('FIRST_LIST', user.total_lists_created >= 1);
    check('FIVE_LISTS', user.total_lists_created >= 5);
    check('TEN_LISTS', user.total_lists_created >= 10);
    
    // Items
    check('FIRST_ITEM', user.total_items_added >= 1);
    check('TEN_ITEMS', user.total_items_added >= 10);
    check('FIFTY_ITEMS', user.total_items_added >= 50);
    check('HUNDRED_ITEMS', user.total_items_added >= 100);
    
    // Completions
    check('FIRST_COMPLETE', user.total_items_completed >= 1);
    check('TEN_COMPLETE', user.total_items_completed >= 10);
    check('FIFTY_COMPLETE', user.total_items_completed >= 50);
    check('HUNDRED_COMPLETE', user.total_items_completed >= 100);
    
    // Streaks
    check('STREAK_3', user.streak_count >= 3);
    check('STREAK_7', user.streak_count >= 7);
    check('STREAK_14', user.streak_count >= 14);
    check('STREAK_30', user.streak_count >= 30);
    
    // Levels
    check('LEVEL_5', user.player_level >= 5);
    check('LEVEL_10', user.player_level >= 10);
    check('LEVEL_25', user.player_level >= 25);
    check('LEVEL_50', user.player_level >= 50);
    
    // Classes
    const ownsAny = user.owns_hero || user.owns_gambler || user.owns_assassin || user.owns_wizard || user.owns_archer || user.owns_tank;
    const ownsAll = user.owns_hero && user.owns_gambler && user.owns_assassin && user.owns_wizard && user.owns_archer && user.owns_tank;
    check('BUY_CLASS', ownsAny);
    check('ALL_CLASSES', ownsAll);
    
    // XP
    check('XP_1000', user.player_xp >= 1000);
    check('XP_5000', user.player_xp >= 5000);
    check('XP_10000', user.player_xp >= 10000);
    
    return newAchs;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  🌳 SKILL TREES - Each class has unique skills
// ═══════════════════════════════════════════════════════════════════════════════

const SKILL_TREES = {
    DEFAULT: {
        name: 'Default',
        description: 'Basic skills available to all classes',
        skills: {
            'default_xp_boost': {
                name: 'Quick Learner',
                emoji: '📚',
                description: '+5% XP from all sources',
                cost: 50,
                maxLevel: 3,
                effect: (level) => `+${level * 5}% XP`,
                requires: null
            },
            'default_daily_boost': {
                name: 'Early Bird',
                emoji: '🌅',
                description: '+10 bonus daily XP',
                cost: 75,
                maxLevel: 2,
                effect: (level) => `+${level * 10} daily XP`,
                requires: 'default_xp_boost'
            },
            'default_streak_shield': {
                name: 'Streak Shield',
                emoji: '🛡️',
                description: 'Protect streak on miss',
                cost: 100,
                maxLevel: 1,
                effect: () => '1 free miss/week',
                requires: 'default_daily_boost'
            }
        }
    },
    HERO: {
        name: 'Hero',
        description: 'Reliable XP gains, inspiring others',
        skills: {
            'hero_valor': {
                name: 'Valor',
                emoji: '⚔️',
                description: '+10 flat XP per action',
                cost: 100,
                maxLevel: 3,
                effect: (level) => `+${level * 10} XP`,
                requires: null
            },
            'hero_inspire': {
                name: 'Inspire',
                emoji: '✨',
                description: 'Bonus XP when helping others',
                cost: 150,
                maxLevel: 2,
                effect: (level) => `+${level * 15}% team XP`,
                requires: 'hero_valor'
            },
            'hero_champion': {
                name: 'Champion',
                emoji: '👑',
                description: 'Double XP on level milestones',
                cost: 200,
                maxLevel: 1,
                effect: () => '2x XP every 5 levels',
                requires: 'hero_inspire'
            },
            'hero_legend': {
                name: 'Legendary',
                emoji: '🏆',
                description: 'Permanent XP multiplier',
                cost: 300,
                maxLevel: 1,
                effect: () => '+25% all XP',
                requires: 'hero_champion'
            }
        }
    },
    GAMBLER: {
        name: 'Gambler',
        description: 'High risk, high reward playstyle',
        skills: {
            'gambler_lucky': {
                name: 'Lucky Streak',
                emoji: '🍀',
                description: 'Better RNG outcomes',
                cost: 80,
                maxLevel: 3,
                effect: (level) => `+${level * 5}% luck`,
                requires: null
            },
            'gambler_double': {
                name: 'Double Down',
                emoji: '🎰',
                description: 'Chance for double rewards',
                cost: 120,
                maxLevel: 2,
                effect: (level) => `${level * 10}% double chance`,
                requires: 'gambler_lucky'
            },
            'gambler_safety': {
                name: 'Safety Net',
                emoji: '🪢',
                description: 'Reduce maximum losses',
                cost: 150,
                maxLevel: 2,
                effect: (level) => `-${level * 20}% max loss`,
                requires: 'gambler_double'
            },
            'gambler_jackpot': {
                name: 'Jackpot',
                emoji: '💎',
                description: 'Rare massive payouts',
                cost: 250,
                maxLevel: 1,
                effect: () => '1% chance for 10x',
                requires: 'gambler_safety'
            }
        }
    },
    ASSASSIN: {
        name: 'Assassin',
        description: 'Streak-based damage dealer',
        skills: {
            'assassin_swift': {
                name: 'Swift Strike',
                emoji: '💨',
                description: 'Faster streak building',
                cost: 90,
                maxLevel: 3,
                effect: (level) => `+${level} streak/action`,
                requires: null
            },
            'assassin_critical': {
                name: 'Critical Hit',
                emoji: '🎯',
                description: 'Crit chance on tasks',
                cost: 130,
                maxLevel: 2,
                effect: (level) => `${level * 10}% crit (2x XP)`,
                requires: 'assassin_swift'
            },
            'assassin_shadow': {
                name: 'Shadow Step',
                emoji: '🌑',
                description: 'Preserve streak on fail',
                cost: 180,
                maxLevel: 1,
                effect: () => 'No streak loss on miss',
                requires: 'assassin_critical'
            },
            'assassin_execute': {
                name: 'Execute',
                emoji: '☠️',
                description: 'Massive bonus at max streak',
                cost: 280,
                maxLevel: 1,
                effect: () => '+100% XP at 10 streak',
                requires: 'assassin_shadow'
            }
        }
    },
    WIZARD: {
        name: 'Wizard',
        description: 'Spell combos and wisdom scaling',
        skills: {
            'wizard_study': {
                name: 'Arcane Study',
                emoji: '📖',
                description: 'XP scales with level',
                cost: 100,
                maxLevel: 3,
                effect: (level) => `+${level * 2} XP/level`,
                requires: null
            },
            'wizard_combo': {
                name: 'Spell Combo',
                emoji: '🔥',
                description: 'Chaining bonus XP',
                cost: 150,
                maxLevel: 2,
                effect: (level) => `${level}x combo multiplier`,
                requires: 'wizard_study'
            },
            'wizard_focus': {
                name: 'Focus',
                emoji: '🧘',
                description: 'Bonus XP for consecutive tasks',
                cost: 200,
                maxLevel: 2,
                effect: (level) => `+${level * 15}% focus bonus`,
                requires: 'wizard_combo'
            },
            'wizard_mastery': {
                name: 'Arcane Mastery',
                emoji: '🌟',
                description: 'Ultimate wisdom power',
                cost: 350,
                maxLevel: 1,
                effect: () => 'Triple every 10th action',
                requires: 'wizard_focus'
            }
        }
    },
    ARCHER: {
        name: 'Archer',
        description: 'Precision and critical strikes',
        skills: {
            'archer_aim': {
                name: 'Steady Aim',
                emoji: '🎯',
                description: 'Increased base accuracy',
                cost: 85,
                maxLevel: 3,
                effect: (level) => `+${level * 10}% precision`,
                requires: null
            },
            'archer_multishot': {
                name: 'Multishot',
                emoji: '🏹',
                description: 'Multiple task completion bonus',
                cost: 140,
                maxLevel: 2,
                effect: (level) => `+${level * 5} XP per extra task`,
                requires: 'archer_aim'
            },
            'archer_piercing': {
                name: 'Piercing Shot',
                emoji: '💫',
                description: 'Ignore XP penalties',
                cost: 190,
                maxLevel: 1,
                effect: () => 'No negative modifiers',
                requires: 'archer_multishot'
            },
            'archer_sniper': {
                name: 'Sniper',
                emoji: '🦅',
                description: 'Guaranteed crits on priority tasks',
                cost: 300,
                maxLevel: 1,
                effect: () => 'Auto-crit HIGH priority',
                requires: 'archer_piercing'
            }
        }
    },
    TANK: {
        name: 'Tank',
        description: 'Slow but unstoppable momentum',
        skills: {
            'tank_fortify': {
                name: 'Fortify',
                emoji: '🧱',
                description: 'Build defensive stacks',
                cost: 95,
                maxLevel: 3,
                effect: (level) => `+${level} stack cap`,
                requires: null
            },
            'tank_absorb': {
                name: 'Absorb',
                emoji: '💪',
                description: 'Convert damage to XP',
                cost: 145,
                maxLevel: 2,
                effect: (level) => `${level * 25}% damage→XP`,
                requires: 'tank_fortify'
            },
            'tank_revenge': {
                name: 'Revenge',
                emoji: '⚡',
                description: 'Bonus XP after losses',
                cost: 200,
                maxLevel: 2,
                effect: (level) => `+${level * 20}% after loss`,
                requires: 'tank_absorb'
            },
            'tank_unstoppable': {
                name: 'Unstoppable',
                emoji: '🚀',
                description: 'Cannot lose streak',
                cost: 320,
                maxLevel: 1,
                effect: () => 'Streak never resets',
                requires: 'tank_revenge'
            }
        }
    }
};

// Get user's effective skill bonuses
function getSkillBonuses(userSkills, playerClass) {
    const bonuses = {
        xpMultiplier: 1.0,
        flatXPBonus: 0,
        dailyBonus: 0,
        critChance: 0,
        luckBonus: 0
    };
    
    if (!userSkills || !userSkills.length) return bonuses;
    
    const skillMap = new Map(userSkills.map(s => [s.skill_id, s.skill_level]));
    
    // Apply skill effects
    if (skillMap.has('default_xp_boost')) {
        bonuses.xpMultiplier += skillMap.get('default_xp_boost') * 0.05;
    }
    if (skillMap.has('default_daily_boost')) {
        bonuses.dailyBonus += skillMap.get('default_daily_boost') * 10;
    }
    if (skillMap.has('hero_valor')) {
        bonuses.flatXPBonus += skillMap.get('hero_valor') * 10;
    }
    if (skillMap.has('hero_legend')) {
        bonuses.xpMultiplier += 0.25;
    }
    if (skillMap.has('gambler_lucky')) {
        bonuses.luckBonus += skillMap.get('gambler_lucky') * 5;
    }
    if (skillMap.has('assassin_critical')) {
        bonuses.critChance += skillMap.get('assassin_critical') * 10;
    }
    
    return bonuses;
}

// Combined function: Apply both class AND skill bonuses
function calculateFinalXP(user, userSkills, baseXP) {
    // Step 1: Apply class bonus
    const { finalXP: classXP, bonusInfo, userUpdates } = calculateClassXP(user, baseXP);
    
    // Step 2: Get skill bonuses
    const skillBonuses = getSkillBonuses(userSkills, user.player_class);
    
    // Step 3: Apply skill multiplier and flat bonus
    let finalXP = Math.floor(classXP * skillBonuses.xpMultiplier) + skillBonuses.flatXPBonus;
    
    // Step 4: Crit chance from skills
    let critApplied = false;
    if (skillBonuses.critChance > 0 && Math.random() * 100 < skillBonuses.critChance) {
        const critBonus = Math.floor(finalXP * 0.5);
        finalXP += critBonus;
        critApplied = true;
        bonusInfo.details += `\n💥 **SKILL CRIT!** +${critBonus} XP`;
    }
    
    // Build skill bonus description
    if (skillBonuses.xpMultiplier > 1.0) {
        bonusInfo.details += `\n📚 **Skill Bonus:** +${Math.round((skillBonuses.xpMultiplier - 1) * 100)}%`;
    }
    if (skillBonuses.flatXPBonus > 0) {
        bonusInfo.details += ` +${skillBonuses.flatXPBonus} flat`;
    }
    
    return {
        baseXP,
        finalXP,
        bonusInfo: {
            ...bonusInfo,
            skillBonuses,
            critApplied
        },
        userUpdates
    };
}

module.exports = {
    CLASSES,
    SKILL_TREES,
    XP_PER_LEVEL,
    calculateLevel,
    addXP,
    calculateClassXP,
    calculateFinalXP,
    updateStreak,
    ACHIEVEMENTS,
    checkAchievements,
    getSkillBonuses
};
