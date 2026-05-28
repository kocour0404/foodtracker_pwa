import { openDB, seedDefaultFoods, getAllFoods, addFood, editFood, deleteFood, saveDailyLog, getDailyLog, getAllLoggedDates, deleteDailyLog, getAllDailyLogs, clearDB, clearAllLogs, getAllIngredientGroups, addIngredientGroup, editIngredientGroup, deleteIngredientGroup } from './db.js';

let db;
let currentDate = new Date();
let calendarDate = new Date();
let foodDictionary = [];
let ingredientGroups = [];
let cachedDailyLogs = null;
let computedGroupLabels = {};
let computedGroupLabelDetails = {};
const FOOD_MOOD_MEALS = ['breakfast', 'lunch', 'dinner', 'anytime_snack'];
const FOOD_MOOD_MEAL_LABELS = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    anytime_snack: 'Anytime Snack'
};

async function getCachedDailyLogs() {
    if (cachedDailyLogs) return cachedDailyLogs;
    cachedDailyLogs = await getAllDailyLogs(db);
    return cachedDailyLogs;
}


function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker registered.');
        } catch (err) {
            console.warn('Service Worker registration failed:', err);
        }
    });
}


let helpLoaded = false;

function applyLocalIconFallback(root = document) {
    const iconMap = {
        menu:'☰', close:'✕', edit_note:'📝', calendar_today:'📅', monitor_heart:'❤', search:'🔎', bar_chart:'📊',
        lightbulb:'💡', settings:'⚙', help_outline:'?', chevron_left:'‹', chevron_right:'›', edit:'✎', delete:'🗑',
        expand_more:'▾', save:'💾', arrow_drop_down:'▾', breakfast_dining:'🍳', lunch_dining:'🍽', dinner_dining:'🍲',
        local_cafe:'☕', bakery_dining:'🥐', add:'＋', keyboard_arrow_up:'▴', download:'⬇', navigate_next:'›',
        shuffle:'🔀', content_copy:'⧉', upload:'⬆', delete_sweep:'🧹', delete_forever:'🚫', arrow_downward:'↓',
        arrow_upward:'↑', restaurant:'🍴', trending_up:'↗', trending_down:'↘', trending_flat:'→'
    };
    iconMap.mood = '★';

    const icons = root instanceof Element && root.matches('.material-icons')
        ? [root]
        : Array.from(root.querySelectorAll?.('.material-icons') || []);

    icons.forEach((el) => {
        const key = (el.dataset.iconName || el.textContent || '').trim();
        if (!iconMap[key]) return;
        el.dataset.iconName = key;
        el.setAttribute('aria-hidden', 'true');
        el.textContent = iconMap[key];
    });
}

function setLocalMaterialIcon(icon, iconName) {
    if (!icon) return;
    icon.dataset.iconName = iconName;
    icon.textContent = iconName;
    applyLocalIconFallback(icon);
}



async function loadHelpContent() {
    if (helpLoaded) return;
    
    try {
        const [readmeRes, planRes] = await Promise.all([
            fetch('README.md'),
            fetch('implementation_plan.md')
        ]);
        
        if (readmeRes.ok) {
            const readmeText = await readmeRes.text();
            document.getElementById('help-readme-content').innerHTML = parseMarkdown(readmeText);
        } else {
            document.getElementById('help-readme-content').innerHTML = '<p>Failed to load README.md</p>';
        }
        
        if (planRes.ok) {
            const planText = await planRes.text();
            document.getElementById('help-plan-content').innerHTML = parseMarkdown(planText);
        } else {
            document.getElementById('help-plan-content').innerHTML = '<p>Failed to load implementation_plan.md</p>';
        }
        
        helpLoaded = true;
    } catch (e) {
        console.error('Error loading help content:', e);
        document.getElementById('help-readme-content').innerHTML = '<p>Error loading help content.</p>';
        document.getElementById('help-plan-content').innerHTML = '<p>Error loading help content.</p>';
    }
}

function parseMarkdown(text) {
    let html = text;
    // Replace headings (up to ###)
    html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');
    
    // Replace bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Replace code blocks / inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Replace links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // Replace list items
    html = html.replace(/^\s*[\*\-] (.*)/gim, '<li>$1</li>');
    
    // Wrap lists in <ul> (simple implementation)
    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    // Consolidate adjacent <ul> elements
    html = html.replace(/<\/ul>\n*<ul>/gs, '');

    // Replace line breaks for paragraphs (if not wrapped in tags)
    // Basic approach: replace double newlines with <br><br> for simplicity
    html = html.replace(/\n\n/g, '<br><br>');
    
    // Replace single newlines where not inside list items or headers
    // Doing a clean pass is complex with Regex alone, let's keep it simple.
    
    return html;
}

function initPrivacySection() {
    const section = document.getElementById('privacy-section');
    const link = document.getElementById('privacy-footer-link');
    if (!section || !link) return;

    const setExpanded = (expanded, shouldScroll = false) => {
        section.hidden = !expanded;
        link.setAttribute('aria-expanded', String(expanded));

        if (expanded && shouldScroll) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    setExpanded(window.location.hash === '#privacy-section');

    link.addEventListener('click', (event) => {
        event.preventDefault();
        setExpanded(section.hidden, true);
    });
}

if (typeof document !== 'undefined') {
// Ensure initNavigation is called
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Food4Me initializing...');
    
    applyLocalIconFallback();
    initServiceWorker();

    // Initialize UI
    initNavigation();
    initMobileNavigation();
    initSkipToggles();
    initEditButtons();
    initDeleteButtons();
    initAnytimeCoffeeEntries();
    initAnytimeSnackEntries();
    initFoodMoodRatings();
    initPrivacySection();

    try {
        // Init Database
        db = await openDB();
        const seeded = await seedDefaultFoods(db);
        if (seeded) {
            console.log('Database seeded with default foods.');
        }

        // Fetch dictionary once for formatting text later
        foodDictionary = await getAllFoods(db);
        ingredientGroups = await getAllIngredientGroups(db);

        // Precompute streaks before initial render
        await recalculateGroupStreaks();

        // Render UI from DB
        refreshFoodUI(); // Sync

        // Setup Features
        initGroupForm();
        initSettingsForm();
        initDbBackupRestore();
        initDateNavigation();
        initCalendarNavigation();
        initSaveLog();
        initSearch();
        initReports();
        initMoodView();
        initSuggestions();
        initHelpCollapsibles();
        
        // Load today's log
        await loadDailyLog(currentDate);
        
        // Set initial visibility for time-awareness
        updateMealVisibility();

    } catch (err) {
        console.error('Failed to initialize database:', err);
        alert('Failed to load database. Please try refreshing the page.');
    }
});
}

// --- Date & Navigation ---

function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function updateMealVisibility() {
    const cardBreakfast = document.getElementById('card-breakfast');
    const cardLunch = document.getElementById('card-lunch');
    const cardDinner = document.getElementById('card-dinner');
    
    if (!cardBreakfast || !cardLunch || !cardDinner) return;

    const todayStr = formatDateString(new Date());
    const currentStr = formatDateString(currentDate);

    if (todayStr === currentStr) {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeVal = hours + minutes / 60; // fractional hours

        if (timeVal < 11.0) {
            // Before 11:00
            cardBreakfast.style.display = 'block';
            cardLunch.style.display = 'none';
            cardDinner.style.display = 'none';
        } else if (timeVal >= 11.0 && timeVal < 14.5) {
            // 11:00 to 14:30
            cardBreakfast.style.display = 'block';
            cardLunch.style.display = 'block';
            cardDinner.style.display = 'none';
        } else {
            // After 14:30
            cardBreakfast.style.display = 'block';
            cardLunch.style.display = 'block';
            cardDinner.style.display = 'block';
        }
    } else {
        // Not today, show all past/future meals
        cardBreakfast.style.display = 'block';
        cardLunch.style.display = 'block';
        cardDinner.style.display = 'block';
    }
}

function updateDateDisplay() {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const todayStr = formatDateString(new Date());
    const currentStr = formatDateString(currentDate);
    
    const display = document.getElementById('current-date-display');
    if (todayStr === currentStr) {
        display.textContent = `Today, ${currentDate.toLocaleDateString('en-US', options)}`;
    } else {
        display.textContent = currentDate.toLocaleDateString('en-US', options);
    }
    
    updateDailyGroupLabels();
    updateDailyVitalityTrends();
    updateMealVisibility();
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

export function normalizeFoodMoodRating(value) {
    const rating = Number(value);
    return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

export function calculateDailyFoodMoodRating(log) {
    const ratings = FOOD_MOOD_MEALS
        .filter(mealName => log?.[mealName] && !log[mealName].skipped)
        .map(mealName => normalizeFoodMoodRating(log[mealName].moodRating))
        .filter(rating => rating !== null);

    if (log?.anytime_coffee && !log.anytime_coffee.skipped && Array.isArray(log.anytime_coffee.entries)) {
        log.anytime_coffee.entries.forEach(entry => {
            const entryRating = normalizeFoodMoodRating(entry.rating);
            if (entryRating !== null) ratings.push(entryRating);
        });
    }

    if (ratings.length === 0) {
        return null;
    }

    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    return {
        average,
        stars: Math.round(average),
        percentage: Math.round((average / 5) * 100),
        count: ratings.length
    };
}

function renderFoodMoodStars(stars) {
    const count = normalizeFoodMoodRating(stars) || 0;
    return `${'&#9733;'.repeat(count)}${'&#9734;'.repeat(5 - count)}`;
}

export function formatGroupLabel(baseName, streak, maxPluses = Infinity) {
    if (!Number.isFinite(maxPluses)) {
        return streak > 4 ? `${baseName}+[${streak}]` : `${baseName}${'+'.repeat(streak)}`;
    }

    const plusCount = Math.min(streak, maxPluses);
    return `${baseName}${'+'.repeat(plusCount)}`;
}

export function capGroupLabel(label, maxPluses) {
    if (!Number.isFinite(maxPluses)) return label;
    const compactMatch = String(label).match(/^(.*?)\+\[(\d+)\]$/);
    if (compactMatch) {
        return formatGroupLabel(compactMatch[1], Number(compactMatch[2]), maxPluses);
    }

    const match = String(label).match(/^(.*?)(\++)$/);
    if (!match || match[2].length <= maxPluses) return label;
    return `${match[1]}${'+'.repeat(maxPluses)}`;
}

function renderGroupLabelsHtml(dateStr, options = {}) {
    return getGroupLabelsForDate(dateStr, options)
        .map(label => `<span class="group-label">${escapeHtml(label)}</span>`)
        .join('');
}

function getGroupLabelsForDate(dateStr, options = {}) {
    const maxPluses = options.maxPluses ?? Infinity;
    if (computedGroupLabelDetails[dateStr]) {
        return computedGroupLabelDetails[dateStr].map(item => {
            if (item.baseName && item.streak) {
                return formatGroupLabel(item.baseName, item.streak, maxPluses);
            }
            return capGroupLabel(item.label, maxPluses);
        });
    }

    return (computedGroupLabels[dateStr] || []).map(label => capGroupLabel(label, maxPluses));
}

function updateDailyGroupLabels() {
    const container = document.getElementById('daily-group-labels');
    if (!container) return;

    container.innerHTML = renderGroupLabelsHtml(formatDateString(currentDate));
    container.style.display = container.innerHTML ? 'flex' : 'none';
}

function parseDateString(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function daysBetweenDateStrings(startDateStr, endDateStr) {
    const start = parseDateString(startDateStr);
    const end = parseDateString(endDateStr);
    return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function getVitalityTrendStates(dateStr = formatDateString(currentDate)) {
    const plusGroups = ingredientGroups
        .filter(group => group.name.endsWith('+'))
        .sort((a, b) => a.name.localeCompare(b.name));

    const labelDates = Object.keys(computedGroupLabelDetails).sort();

    return plusGroups.map(group => {
        const baseName = group.name.substring(0, group.name.length - 1);
        let lastHit = null;

        for (const labelDate of labelDates) {
            if (labelDate > dateStr) break;
            const detail = computedGroupLabelDetails[labelDate]?.find(item => item.groupId === group.id);
            if (detail) {
                lastHit = { date: labelDate, label: detail.label, streak: detail.streak };
            }
        }

        if (!lastHit) {
            return {
                groupId: group.id,
                groupName: group.name,
                baseName,
                label: baseName,
                trend: 'neutral',
                trendText: 'Neutral',
                icon: 'trending_flat',
                daysSince: null,
                streak: 0,
                lastHitDate: null
            };
        }

        const daysSince = daysBetweenDateStrings(lastHit.date, dateStr);
        const trend = daysSince === 0 ? 'increasing' : (daysSince === 1 ? 'decreasing' : 'neutral');
        const trendText = trend === 'increasing' ? 'Zunehmend' : (trend === 'decreasing' ? 'Abnehmend' : 'Neutral');
        const icon = trend === 'increasing' ? 'trending_up' : (trend === 'decreasing' ? 'trending_down' : 'trending_flat');
        const streak = lastHit.streak ?? Math.max(0, lastHit.label.length - baseName.length);
        const severity = trend === 'increasing' && streak > 2 ? 'high' : 'normal';

        return {
            groupId: group.id,
            groupName: group.name,
            baseName,
            label: lastHit.label,
            trend,
            trendText,
            icon,
            daysSince,
            streak,
            severity,
            lastHitDate: lastHit.date
        };
    });
}

function renderVitalityTrendChip(state) {
    return `
        <span class="vitality-trend-chip ${state.trend} ${state.severity || 'normal'}">
            <span class="material-icons">${state.icon}</span>
            <span class="vitality-trend-label">${escapeHtml(state.baseName)}</span>
            <span>${escapeHtml(state.trendText)}</span>
        </span>
    `;
}

function updateDailyVitalityTrends() {
    const container = document.getElementById('daily-vitality-trends');
    if (!container) return;

    const states = getVitalityTrendStates();
    container.innerHTML = states.map(renderVitalityTrendChip).join('');
    applyLocalIconFallback(container);
    container.style.display = states.length ? 'flex' : 'none';
}

function updateDailyFoodMoodRating(log) {
    const container = document.getElementById('daily-food-mood');
    if (!container) return;

    const rating = calculateDailyFoodMoodRating(log);
    if (!rating) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.innerHTML = `
        <span class="food-mood-chip" title="Food-Mood average from ${rating.count} rating${rating.count === 1 ? '' : 's'}">
            <span class="food-mood-chip-label">Food-Mood</span>
            <span aria-hidden="true">${renderFoodMoodStars(rating.stars)}</span>
            <span class="food-mood-chip-value">${rating.average.toFixed(1)}/5 &middot; ${rating.percentage}%</span>
        </span>
    `;
    container.style.display = 'flex';
}

function initDateNavigation() {
    document.getElementById('prev-day').addEventListener('click', async () => {
        currentDate.setDate(currentDate.getDate() - 1);
        updateDateDisplay();
        await loadDailyLog(currentDate);
    });
    
    document.getElementById('next-day').addEventListener('click', async () => {
        currentDate.setDate(currentDate.getDate() + 1);
        updateDateDisplay();
        await loadDailyLog(currentDate);
    });
    
    updateDateDisplay();
}

function initNavigation() {
    const navButtons = {
        'nav-daily': 'view-daily',
        'nav-settings': 'view-settings',
        'nav-calendar': 'view-calendar',
        'nav-vitality': 'view-vitality',
        'nav-mood': 'view-mood',
        'nav-search': 'view-search',
        'nav-reports': 'view-reports',
        'nav-suggestions': 'view-suggestions',
        'nav-help': 'view-help'
    };

    document.getElementById('nav-daily').classList.add('active');

    for (const [btnId, viewId] of Object.entries(navButtons)) {
        const btn = document.getElementById(btnId);
        if (!btn) continue;

        btn.addEventListener('click', async () => {
            document.querySelectorAll('.app-bar .icon-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            closeMobileNavigation();

            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            
            const view = document.getElementById(viewId);
            if (view) view.classList.add('active');
            
            if (viewId === 'view-daily') {
                updateMealVisibility();
                await loadDailyLog(currentDate); // Refresh log in case navigated from calendar
            } else if (viewId === 'view-calendar') {
                calendarDate = new Date(currentDate); // Center calendar on currently viewed date
                await renderCalendar();
            } else if (viewId === 'view-vitality') {
                renderVitalityView();
            } else if (viewId === 'view-mood') {
                await renderMoodView();
            } else if (viewId === 'view-help') {
                loadHelpContent();
            }
        });
    }
}

function closeMobileNavigation() {
    const appBar = document.querySelector('.app-bar');
    const toggle = document.getElementById('nav-menu-toggle');
    if (!appBar || !toggle) return;

    appBar.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    const icon = toggle.querySelector('.material-icons');
    setLocalMaterialIcon(icon, 'menu');
}

function initMobileNavigation() {
    const appBar = document.querySelector('.app-bar');
    const toggle = document.getElementById('nav-menu-toggle');
    const navigation = document.getElementById('app-navigation');
    if (!appBar || !toggle || !navigation) return;

    toggle.addEventListener('click', () => {
        const isOpen = appBar.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
        const icon = toggle.querySelector('.material-icons');
        setLocalMaterialIcon(icon, isOpen ? 'close' : 'menu');
    });

    document.addEventListener('click', (event) => {
        if (!appBar.classList.contains('nav-open')) return;
        if (appBar.contains(event.target)) return;
        closeMobileNavigation();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMobileNavigation();
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 720) closeMobileNavigation();
    });
}

// --- Calendar Logic ---

function initCalendarNavigation() {
    document.getElementById('cal-prev-month')?.addEventListener('click', async () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        await renderCalendar();
    });
    
    document.getElementById('cal-next-month')?.addEventListener('click', async () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        await renderCalendar();
    });
}

async function renderCalendar() {
    const container = document.getElementById('calendar-days-container');
    const display = document.getElementById('calendar-month-display');
    if (!container || !display) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    // Display
    display.textContent = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Calculate days
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Get logged dates from DB
    const allLoggedDates = await getAllLoggedDates(db);
    const loggedSet = new Set(allLoggedDates);
    
    const todayStr = formatDateString(new Date());

    let html = '';

    // Empty slots before first day
    for (let i = 0; i < firstDayIndex; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = formatDateString(new Date(year, month, i));
        
        let classes = ['calendar-day'];
        if (dateStr === todayStr) classes.push('today');
        if (loggedSet.has(dateStr)) classes.push('has-log');

        const labelHtml = renderGroupLabelsHtml(dateStr, { maxPluses: 2 });

        html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${i}<div class="calendar-labels-container">${labelHtml}</div></div>`;
    }

    container.innerHTML = html;

    // Attach listeners
    container.querySelectorAll('.calendar-day:not(.empty)').forEach(dayEl => {
        dayEl.addEventListener('click', () => {
            const dateStr = dayEl.getAttribute('data-date');
            currentDate = new Date(dateStr); // set current date to clicked date
            updateDateDisplay();
            
            // Navigate back to daily view
            document.getElementById('nav-daily').click(); 
        });
    });
}

// --- Daily Logging Logic ---

function updateFoodMoodRatingUI(mealName) {
    const rating = getFoodMoodRating(mealName);
    const container = document.getElementById(`food-mood-${mealName}`);
    if (!container) return;

    container.querySelectorAll('label').forEach(label => {
        const value = Number(label.querySelector('input[type="radio"]')?.value);
        label.classList.toggle('is-active', rating !== null && value <= rating);
    });
}

function initFoodMoodRatings() {
    FOOD_MOOD_MEALS.forEach(mealName => {
        const container = document.getElementById(`food-mood-${mealName}`);
        if (!container) return;

        container.querySelectorAll('input[type="radio"]').forEach(input => {
            input.addEventListener('change', () => updateFoodMoodRatingUI(mealName));
        });
    });

    document.querySelectorAll('.clear-food-mood').forEach(btn => {
        btn.addEventListener('click', () => {
            const mealName = btn.getAttribute('data-meal');
            setFoodMoodRating(mealName, null);
            setFoodMoodNote(mealName, '');
        });
    });
}

function getFoodMoodRating(mealName) {
    if (!FOOD_MOOD_MEALS.includes(mealName)) return null;
    const checked = document.querySelector(`input[name="food-mood-${mealName}"]:checked`);
    return normalizeFoodMoodRating(checked?.value);
}

function setFoodMoodRating(mealName, rating) {
    if (!FOOD_MOOD_MEALS.includes(mealName)) return;

    const normalized = normalizeFoodMoodRating(rating);
    document.querySelectorAll(`input[name="food-mood-${mealName}"]`).forEach(input => {
        input.checked = normalized !== null && Number(input.value) === normalized;
    });
    updateFoodMoodRatingUI(mealName);
}

function getFoodMoodNote(mealName) {
    if (!FOOD_MOOD_MEALS.includes(mealName)) return '';
    return document.getElementById(`food-mood-note-${mealName}`)?.value.trim() || '';
}

function setFoodMoodNote(mealName, note) {
    if (!FOOD_MOOD_MEALS.includes(mealName)) return;
    const input = document.getElementById(`food-mood-note-${mealName}`);
    if (input) input.value = note || '';
}

function initSkipToggles() {
    const setupSkipToggle = (mealName) => {
        const toggle = document.getElementById(`skip-${mealName}`);
        const content = document.getElementById(`form-${mealName}`); // We disable inputs in the form
        
        if (toggle && content) {
            toggle.addEventListener('change', (e) => {
                const isSkipped = e.target.checked;
                if (isSkipped) {
                    content.classList.add('disabled');
                } else {
                    content.classList.remove('disabled');
                }
                const inputs = content.querySelectorAll('input[type="checkbox"]:not([id^="skip-"]), input[type="radio"], input[type="time"], select, textarea, button:not(.save-meal-btn)');
                inputs.forEach(input => {
                    input.disabled = isSkipped;
                });
                
                // Keep the save button enabled so they can save the "skipped" state
                const saveBtn = content.querySelector('.save-meal-btn');
                if (saveBtn) saveBtn.disabled = false;
            });
        }
    };
    
    setupSkipToggle('breakfast');
    setupSkipToggle('lunch');
    setupSkipToggle('dinner');
    setupSkipToggle('anytime_coffee');
    setupSkipToggle('anytime_snack');
}

function initEditButtons() {
    document.querySelectorAll('.edit-meal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mealName = e.currentTarget.getAttribute('data-meal');
            toggleMealView(mealName, 'edit');
        });
    });
}

export function isMealEmpty(mealName, meal, isBreakfast) {
    if (!meal) return true;
    if (meal.skipped) return false; // An explicitly skipped meal is a logged state
    if (mealName === 'anytime_coffee') {
        return getAnytimeCoffeeEntriesFromMeal(meal).length === 0;
    }
    if (mealName === 'anytime_snack') {
        return getAnytimeSnackEntriesFromMeal(meal).length === 0;
    }
    if (isBreakfast) {
        return (!meal.items || meal.items.length === 0) && (!meal.coffeeIds || meal.coffeeIds.length === 0) && (!meal.drinkIds || meal.drinkIds.length === 0);
    } else {
        return !meal.soupId && !meal.mainId && (!meal.sideIds || meal.sideIds.length === 0) && !meal.dessertId && (!meal.coffeeIds || meal.coffeeIds.length === 0) && (!meal.drinkIds || meal.drinkIds.length === 0);
    }
}

function isLogEmpty(log) {
    return isMealEmpty('breakfast', log.breakfast, true) && isMealEmpty('lunch', log.lunch, false) && isMealEmpty('dinner', log.dinner, false) && isMealEmpty('anytime_coffee', log.anytime_coffee, false) && isMealEmpty('anytime_snack', log.anytime_snack, false);
}

function initDeleteButtons() {
    document.querySelectorAll('.delete-meal-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('Are you sure you want to delete this meal log?')) return;
            
            const mealName = e.currentTarget.getAttribute('data-meal');
            const dateStr = formatDateString(currentDate);
            let existingLog = await getDailyLog(db, dateStr);
            
            if (existingLog) {
                if (mealName === 'breakfast') {
                    existingLog.breakfast = { skipped: false, location: 'home', items: [], coffeeIds: [], drinkIds: [] };
                } else if (mealName === 'anytime_coffee') {
                    existingLog.anytime_coffee = { skipped: false, location: 'home', entries: [] };
                } else if (mealName === 'anytime_snack') {
                    existingLog.anytime_snack = { skipped: false, location: 'home', entries: [] };
                } else {
                    existingLog[mealName] = { skipped: false, location: 'home', soupId: null, mainId: null, sideIds: [], dessertId: null, coffeeIds: [], drinkIds: [] };
                }
                
                try {
                    if (isLogEmpty(existingLog)) {
                        await deleteDailyLog(db, dateStr);
                        existingLog = null;
                    } else {
                        await saveDailyLog(db, existingLog);
                    }
                    cachedDailyLogs = null;
                    await recalculateGroupStreaks();
                    updateDailyGroupLabels();
                    updateDailyVitalityTrends();
                    updateDailyFoodMoodRating(existingLog);
                    renderVitalityView();
                    await renderMoodView();
                    await loadDailyLog(currentDate);
                } catch (err) {
                    console.error('Failed to delete log:', err);
                    alert('Failed to delete log.');
                }
            }
        });
    });
}

function initSaveLog() {
    const saveBtns = document.querySelectorAll('.save-meal-btn');
    
    saveBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const mealName = btn.getAttribute('data-meal');
            const dateStr = formatDateString(currentDate);
            
            // Fetch existing log to avoid overwriting other meals
            let existingLog = await getDailyLog(db, dateStr);
            if (!existingLog) {
                existingLog = {
                    date: dateStr,
                    breakfast: { skipped: true },
                    lunch: { skipped: true },
                    dinner: { skipped: true }
                };
            }
            
            // Update specific meal
            existingLog[mealName] = getMealData(mealName, mealName === 'breakfast');
            
            try {
                if (isLogEmpty(existingLog)) {
                    await deleteDailyLog(db, dateStr);
                    existingLog = null;
                } else {
                    await saveDailyLog(db, existingLog);
                }
                cachedDailyLogs = null;
                await recalculateGroupStreaks();
                updateDailyGroupLabels();
                updateDailyVitalityTrends();
                updateDailyFoodMoodRating(existingLog);
                renderVitalityView();
                await renderMoodView();

                // Switch to summary view
                if (existingLog) {
                    updateMealSummary(mealName, existingLog[mealName]);
                    toggleMealView(mealName, 'summary');
                } else {
                    await loadDailyLog(currentDate);
                }

            } catch (err) {
                console.error('Failed to save log:', err);
                alert('Failed to save log.');
            }
        });
    });
}

function getMealData(mealName, isBreakfast) {
    const skipped = document.getElementById(`skip-${mealName}`).checked;
    const isRemote = document.getElementById(`remote-${mealName}`).checked;
    const location = isRemote ? 'remote' : 'home';
    const moodRating = getFoodMoodRating(mealName);
    const moodNote = getFoodMoodNote(mealName);
    const withMoodRating = (mealData) => {
        if (moodRating !== null) {
            mealData.moodRating = moodRating;
            if (moodNote) mealData.moodNote = moodNote;
        }
        return mealData;
    };
    
    if (skipped) {
        return { skipped: true, location };
    }
    
    if (mealName === 'anytime_coffee') {
        const entries = getAnytimeCoffeeEntries();
        return { skipped: false, location, entries };
    }

    if (mealName === 'anytime_snack') {
        const entries = getAnytimeSnackEntries();
        return withMoodRating({ skipped: false, location, entries });
    }
    
    if (isBreakfast) {
        const items = getCheckedValues(`${mealName}-items-container`);
        const coffeeIds = getCheckedValues(`${mealName}-coffee-container`);
        const drinkIds = getCheckedValues(`${mealName}-drinks-container`);
        return withMoodRating({ skipped: false, location, items, coffeeIds, drinkIds });
    } else {
        return withMoodRating({
            skipped: false,
            location,
            soupId: getSelectValue(`${mealName}-soup`),
            mainId: getSelectValue(`${mealName}-main`),
            sideIds: getCheckedValues(`${mealName}-sides-container`),
            dessertId: getSelectValue(`${mealName}-dessert`),
            coffeeIds: getCheckedValues(`${mealName}-coffee-container`),
            drinkIds: getCheckedValues(`${mealName}-drinks-container`)
        });
    }
}

function getCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const checked = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checked).map(cb => Number(cb.value));
}

function getSelectValue(selectId) {
    const select = document.getElementById(selectId);

function getCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const checked = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checked).map(cb => Number(cb.value));
}

function getSelectValue(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return null;
    return select.value ? Number(select.value) : null;
}

function formatTimeString(date = new Date()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function getAnytimeCoffeeEntriesFromMeal(meal) {
    if (!meal) return [];

    if (Array.isArray(meal.entries)) {
        return meal.entries
            .map(entry => ({
                id: Number(entry.id),
                time: entry.time || '',
                rating: entry.rating || null,
                note: entry.note || '',
                location: entry.location || ''
            }))
            .filter(entry => entry.id);
    }

    if (Array.isArray(meal.items)) {
        return meal.items
            .map(id => ({ id: Number(id), time: '' }))
            .filter(entry => entry.id);
    }

    return [];
}

function createCoffeeOptions(selectedId = '') {
    const coffees = foodDictionary
        .filter(food => food.category === 'coffee')
        .sort((a, b) => a.name.localeCompare(b.name));

    return '<option value="">None</option>' + coffees.map(coffee => `
        <option value="${coffee.id}" ${Number(selectedId) === coffee.id ? 'selected' : ''}>${coffee.name}</option>
    `).join('');
}

function renderAnytimeCoffeeEntryRows(entries = []) {
    const list = document.getElementById('anytime_coffee-entries-list');
    const empty = document.getElementById('anytime_coffee-entries-empty');
    if (!list) return;

    const isRemote = document.getElementById('remote-anytime_coffee')?.checked;

    list.innerHTML = entries.map((entry, index) => `
        <li class="coffee-entry-row">
            <div class="coffee-entry-main">
                <div class="select-wrapper">
                    <select class="material-select anytime-coffee-entry-id">
                        ${createCoffeeOptions(entry.id)}
                    </select>
                    <span class="material-icons select-arrow">arrow_drop_down</span>
                </div>
                <input type="time" class="material-input anytime-coffee-entry-time" value="${entry.time || ''}">
                <button class="btn-icon-small delete-anytime-coffee-entry" type="button" title="Delete coffee entry">
                    <span class="material-icons">delete</span>
                </button>
            </div>
            <div class="coffee-entry-details">
                <div class="food-mood-rating anytime-coffee-entry-rating" role="radiogroup" aria-label="Coffee Rating">
                    <label class="${entry.rating >= 1 ? 'is-active' : ''}"><input type="radio" name="coffee-rating-${index}" value="1" ${entry.rating === 1 ? 'checked' : ''}><span>&#9733;</span></label>
                    <label class="${entry.rating >= 2 ? 'is-active' : ''}"><input type="radio" name="coffee-rating-${index}" value="2" ${entry.rating === 2 ? 'checked' : ''}><span>&#9733;</span></label>
                    <label class="${entry.rating >= 3 ? 'is-active' : ''}"><input type="radio" name="coffee-rating-${index}" value="3" ${entry.rating === 3 ? 'checked' : ''}><span>&#9733;</span></label>
                    <label class="${entry.rating >= 4 ? 'is-active' : ''}"><input type="radio" name="coffee-rating-${index}" value="4" ${entry.rating === 4 ? 'checked' : ''}><span>&#9733;</span></label>
                    <label class="${entry.rating >= 5 ? 'is-active' : ''}"><input type="radio" name="coffee-rating-${index}" value="5" ${entry.rating === 5 ? 'checked' : ''}><span>&#9733;</span></label>
                    <button class="btn-icon-small clear-coffee-rating" type="button" title="Clear Rating"><span class="material-icons">close</span></button>
                </div>
                <input type="text" class="material-input anytime-coffee-entry-note" placeholder="Internal note" value="${escapeHtml(entry.note || '')}">
                <input type="text" class="material-input anytime-coffee-entry-location" placeholder="Location name" value="${escapeHtml(entry.location || '')}" style="display: ${isRemote ? 'block' : 'none'}; flex: 1;">
            </div>
        </li>
    `).join('');

    list.querySelectorAll('.delete-anytime-coffee-entry').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.coffee-entry-row')?.remove();
            updateAnytimeCoffeeEmptyState();
        });
    });

    list.querySelectorAll('.anytime-coffee-entry-rating input[type="radio"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const container = e.target.closest('.anytime-coffee-entry-rating');
            const val = Number(e.target.value);
            container.querySelectorAll('label').forEach(label => {
                const labelVal = Number(label.querySelector('input').value);
                label.classList.toggle('is-active', labelVal <= val);
            });
        });
    });

    list.querySelectorAll('.clear-coffee-rating').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const container = e.target.closest('.anytime-coffee-entry-rating');
            container.querySelectorAll('input[type="radio"]').forEach(input => input.checked = false);
            container.querySelectorAll('label').forEach(label => label.classList.remove('is-active'));
        });
    });

    applyLocalIconFallback(list);
    updateAnytimeCoffeeEmptyState();
}

function updateAnytimeCoffeeEmptyState() {
    const list = document.getElementById('anytime_coffee-entries-list');
    const empty = document.getElementById('anytime_coffee-entries-empty');
    if (!list || !empty) return;
    empty.style.display = list.querySelectorAll('.coffee-entry-row').length === 0 ? 'block' : 'none';
}

function getAnytimeCoffeeEntries() {
    const list = document.getElementById('anytime_coffee-entries-list');
    if (!list) return [];

    return Array.from(list.querySelectorAll('.coffee-entry-row'))
        .map(row => ({
            id: Number(row.querySelector('.anytime-coffee-entry-id')?.value),
            time: row.querySelector('.anytime-coffee-entry-time')?.value || '',
            rating: Number(row.querySelector('.anytime-coffee-entry-rating input:checked')?.value) || null,
            note: row.querySelector('.anytime-coffee-entry-note')?.value || '',
            location: row.querySelector('.anytime-coffee-entry-location')?.value || ''
        }))
        .filter(entry => entry.id);
}

function initAnytimeCoffeeEntries() {
    const addBtn = document.getElementById('btn-add-anytime-coffee');
    const remoteCheckbox = document.getElementById('remote-anytime_coffee');
    
    if (remoteCheckbox) {
        remoteCheckbox.addEventListener('change', (e) => {
            const isRemote = e.target.checked;
            const list = document.getElementById('anytime_coffee-entries-list');
            if (list) {
                list.querySelectorAll('.anytime-coffee-entry-location').forEach(input => {
                    input.style.display = isRemote ? 'block' : 'none';
                });
            }
        });
    }

    if (!addBtn) return;

    addBtn.addEventListener('click', () => {
        const select = document.getElementById('anytime_coffee-select');
        const timeInput = document.getElementById('anytime_coffee-time');
        const id = Number(select?.value);
        const time = timeInput?.value || formatTimeString();

        if (!id) {
            alert('Please select a coffee.');
            return;
        }

        renderAnytimeCoffeeEntryRows([...getAnytimeCoffeeEntries(), { id, time }]);
        if (select) select.value = '';
        if (timeInput) timeInput.value = formatTimeString();
    });
}

export function getAnytimeSnackEntriesFromMeal(meal) {
    if (!meal) return [];

    if (Array.isArray(meal.entries)) {
        return meal.entries
            .map(entry => ({
                id: Number(entry.id),
                time: entry.time || ''
            }))
            .filter(entry => entry.id);
    }

    if (Array.isArray(meal.items)) {
        return meal.items
            .map(id => ({ id: Number(id), time: '' }))
            .filter(entry => entry.id);
    }

    return [];
}

function createSnackOptions(selectedId = '') {
    const snacks = foodDictionary
        .filter(food => food.category === 'snack')
        .sort((a, b) => a.name.localeCompare(b.name));

    return '<option value="">None</option>' + snacks.map(snack => `
        <option value="${snack.id}" ${Number(selectedId) === snack.id ? 'selected' : ''}>${snack.name}</option>
    `).join('');
}

function renderAnytimeSnackEntryRows(entries = []) {
    const list = document.getElementById('anytime_snack-entries-list');
    if (!list) return;

    list.innerHTML = entries.map(entry => `
        <li class="coffee-entry-row">
            <div class="select-wrapper">
                <select class="material-select anytime-snack-entry-id">
                    ${createSnackOptions(entry.id)}
                </select>
                <span class="material-icons select-arrow">arrow_drop_down</span>
            </div>
            <input type="time" class="material-input anytime-snack-entry-time" value="${entry.time || ''}">
            <button class="btn-icon-small delete-anytime-snack-entry" type="button" title="Delete snack entry">
                <span class="material-icons">delete</span>
            </button>
        </li>
    `).join('');

    list.querySelectorAll('.delete-anytime-snack-entry').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.coffee-entry-row')?.remove();
            updateAnytimeSnackEmptyState();
        });
    });

    applyLocalIconFallback(list);
    updateAnytimeSnackEmptyState();
}

function updateAnytimeSnackEmptyState() {
    const list = document.getElementById('anytime_snack-entries-list');
    const empty = document.getElementById('anytime_snack-entries-empty');
    if (!list || !empty) return;
    empty.style.display = list.querySelectorAll('.coffee-entry-row').length === 0 ? 'block' : 'none';
}

function getAnytimeSnackEntries() {
    const list = document.getElementById('anytime_snack-entries-list');
    if (!list) return [];

    return Array.from(list.querySelectorAll('.coffee-entry-row'))
        .map(row => ({
            id: Number(row.querySelector('.anytime-snack-entry-id')?.value),
            time: row.querySelector('.anytime-snack-entry-time')?.value || ''
        }))
        .filter(entry => entry.id);
}

function initAnytimeSnackEntries() {
    const addBtn = document.getElementById('btn-add-anytime-snack');
    if (!addBtn) return;

    addBtn.addEventListener('click', () => {
        const select = document.getElementById('anytime_snack-select');
        const timeInput = document.getElementById('anytime_snack-time');
        const id = Number(select?.value);
        const time = timeInput?.value || formatTimeString();

        if (!id) {
            alert('Please select a snack.');
            return;
        }

        renderAnytimeSnackEntryRows([...getAnytimeSnackEntries(), { id, time }]);
        if (select) select.value = '';
        if (timeInput) timeInput.value = formatTimeString();
    });
}

// View Toggling & Summary

function toggleMealView(mealName, viewType) {
    const summary = document.getElementById(`summary-${mealName}`);
    const form = document.getElementById(`form-${mealName}`);
    
    if (viewType === 'summary') {
        summary.style.display = 'flex';
        form.style.display = 'none';
    } else {
        summary.style.display = 'none';
        form.style.display = 'block';
    }
}

function getFoodName(id) {
    if (!id) return null;
    const food = foodDictionary.find(f => f.id === id);
    return food ? food.name : 'Unknown';
}

function getFoodGroupLabelHtml(foodId, dateStr) {
    const dailyLabels = computedGroupLabelDetails[dateStr] || [];
    if (dailyLabels.length === 0 || !foodId) return '';

    const food = foodDictionary.find(f => f.id === foodId);
    if (!food) return '';

    const ingredientIds = food.category === 'ingredient'
        ? [food.id]
        : (food.ingredientIds || []);

    if (ingredientIds.length === 0) return '';

    const groupIdsForFood = new Set();
    ingredientIds.forEach(ingredientId => {
        const ingredient = foodDictionary.find(f => f.id === ingredientId);
        (ingredient?.groupIds || []).forEach(groupId => groupIdsForFood.add(groupId));
    });

    const labels = dailyLabels
        .filter(item => groupIdsForFood.has(item.groupId))
        .map(item => item.label);

    if (labels.length === 0) return '';

    return `<span class="summary-food-labels">${labels.map(label => `<span class="group-label">${escapeHtml(label)}</span>`).join('')}</span>`;
}

function updateMealSummary(mealName, mealData) {
    const summaryText = document.getElementById(`summary-text-${mealName}`);
    if (!summaryText) return;

    const dateStr = formatDateString(currentDate);
    const locationText = mealData.location === 'remote' ? ' 🌍 (Remote)' : ' 🏠 (Home)';

    const moodRating = normalizeFoodMoodRating(mealData.moodRating);
    const moodNote = moodRating !== null && mealData.moodNote ? String(mealData.moodNote).trim() : '';
    const moodText = moodRating !== null
        ? `<span class="summary-food-mood">${renderFoodMoodStars(moodRating)} ${moodRating}/5</span>${moodNote ? `<span class="summary-food-mood-note">${escapeHtml(moodNote)}</span>` : ''}<br>`
        : '';

    const isAnytimeCoffee = mealName === 'anytime_coffee';
    const isAnytimeSnack = mealName === 'anytime_snack';
    
    // Determine if meal is effectively empty
    let isEmpty = false;
    if (mealData.skipped) {
        isEmpty = true;
    } else if (isAnytimeCoffee) {
        isEmpty = getAnytimeCoffeeEntriesFromMeal(mealData).length === 0;
    } else if (isAnytimeSnack) {
        isEmpty = getAnytimeSnackEntriesFromMeal(mealData).length === 0;
    } else if (mealName === 'breakfast') {
        isEmpty = (!mealData.items || mealData.items.length === 0) && (!mealData.coffeeIds || mealData.coffeeIds.length === 0) && (!mealData.drinkIds || mealData.drinkIds.length === 0);
    } else {
        isEmpty = !mealData.soupId && !mealData.mainId && (!mealData.sideIds || mealData.sideIds.length === 0) && !mealData.dessertId && (!mealData.coffeeIds || mealData.coffeeIds.length === 0) && (!mealData.drinkIds || mealData.drinkIds.length === 0);
    }

    if (isEmpty) {
        summaryText.innerHTML = `<em>Skipped / Nothing logged</em><br><small>${locationText}</small>`;
        return;
    }

    let text = [];
    const categoryIcons = {
        breakfast: '🍳',
        soup: '🍲',
        main: '🍽️',
        side: '🥗',
        dessert: '🍰',
        coffee: '☕',
        drink: '🥤'
    };
    const withIcon = (icon, name, id) => {
        if (!name) return null;
        const food = id ? foodDictionary.find(f => f.id === id) : null;
        const labelHtml = getFoodGroupLabelHtml(id, dateStr);
        let ingredientsHtml = '';
        if (food && food.ingredientIds && food.ingredientIds.length > 0) {
            const ingredientNames = food.ingredientIds.map(ingId => getFoodName(ingId)).join(', ');
            ingredientsHtml = `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 24px;">Ingredients: ${ingredientNames}</div>`;
        }
        return `${icon} ${escapeHtml(name)}${labelHtml}${ingredientsHtml}`;
    };
    
    if (isAnytimeCoffee) {
        text = getAnytimeCoffeeEntriesFromMeal(mealData)
            .map(entry => {
                const name = getFoodName(entry.id);
                if (!name) return null;
                const timeStr = entry.time ? `${entry.time} ` : '';
                const labelHtml = getFoodGroupLabelHtml(entry.id, dateStr);
                
                const food = foodDictionary.find(f => f.id === entry.id);
                let ingredientsHtml = '';
                if (food && food.ingredientIds && food.ingredientIds.length > 0) {
                    const ingredientNames = food.ingredientIds.map(ingId => getFoodName(ingId)).join(', ');
                    ingredientsHtml = `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 24px;">Ingredients: ${ingredientNames}</div>`;
                }

                let extraHtml = '';
                if (entry.rating) {
                    extraHtml += ` <span class="summary-food-mood" style="margin-left: 8px;">${renderFoodMoodStars(entry.rating)} ${entry.rating}/5</span>`;
                }
                if (entry.note) {
                    extraHtml += ` <span class="summary-food-mood-note">${escapeHtml(entry.note)}</span>`;
                }
                if (entry.location && mealData.location === 'remote') {
                    extraHtml += ` <span class="summary-location" style="font-size: 0.85rem; color: var(--text-secondary); margin-left: 8px;">📍 ${escapeHtml(entry.location)}</span>`;
                }

                return `${escapeHtml(timeStr)}${escapeHtml(name)}${labelHtml}${extraHtml}${ingredientsHtml}`;
            })
            .filter(Boolean);
    } else if (isAnytimeSnack) {
        text = getAnytimeSnackEntriesFromMeal(mealData)
            .map(entry => {
                const name = getFoodName(entry.id);
                if (!name) return null;
                const timeStr = entry.time ? `${entry.time} ` : '';
                const labelHtml = getFoodGroupLabelHtml(entry.id, dateStr);
                
                const food = foodDictionary.find(f => f.id === entry.id);
                let ingredientsHtml = '';
                if (food && food.ingredientIds && food.ingredientIds.length > 0) {
                    const ingredientNames = food.ingredientIds.map(ingId => getFoodName(ingId)).join(', ');
                    ingredientsHtml = `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 24px;">Ingredients: ${ingredientNames}</div>`;
                }
                return `${escapeHtml(timeStr)}${escapeHtml(name)}${labelHtml}${ingredientsHtml}`;
            })
            .filter(Boolean);
    } else if (mealName === 'breakfast') {
        if (mealData.items) text.push(...mealData.items.map(id => withIcon(categoryIcons.breakfast, getFoodName(id), id)).filter(Boolean));
        if (mealData.coffeeIds) text.push(...mealData.coffeeIds.map(id => withIcon(categoryIcons.coffee, getFoodName(id), id)).filter(Boolean));
        if (mealData.drinkIds) text.push(...mealData.drinkIds.map(id => withIcon(categoryIcons.drink, getFoodName(id), id)).filter(Boolean));
    } else {
        if (mealData.soupId) text.push(withIcon(categoryIcons.soup, getFoodName(mealData.soupId), mealData.soupId));
        if (mealData.mainId) text.push(withIcon(categoryIcons.main, getFoodName(mealData.mainId), mealData.mainId));
        if (mealData.sideIds && mealData.sideIds.length > 0) {
            mealData.sideIds.forEach(id => text.push(withIcon(categoryIcons.side, getFoodName(id), id)));
        }
        if (mealData.dessertId) text.push(withIcon(categoryIcons.dessert, getFoodName(mealData.dessertId), mealData.dessertId));
        if (mealData.coffeeIds && mealData.coffeeIds.length > 0) {
            mealData.coffeeIds.forEach(id => text.push(withIcon(categoryIcons.coffee, getFoodName(id), id)));
        }
        if (mealData.drinkIds && mealData.drinkIds.length > 0) {
            mealData.drinkIds.forEach(id => text.push(withIcon(categoryIcons.drink, getFoodName(id), id)));
        }
    }

    summaryText.innerHTML = text.join('<br>') + `<br>${moodText}<small>${locationText}</small>`;
}

async function loadDailyLog(dateObj) {
    const dateStr = formatDateString(dateObj);
    const log = await getDailyLog(db, dateStr);
    
    resetForm();
    updateDailyGroupLabels();
    updateDailyVitalityTrends();
    updateDailyFoodMoodRating(log);
    
    if (log) {
        // Populate Breakfast
        if (log.breakfast) {
            setSkipped('breakfast', log.breakfast.skipped);
            setRemote('breakfast', log.breakfast.location === 'remote');
            setFoodMoodRating('breakfast', log.breakfast.moodRating);
            setFoodMoodNote('breakfast', log.breakfast.moodNote);
            if (!log.breakfast.skipped) {
                checkCheckboxes('breakfast-items-container', log.breakfast.items || []);
                checkCheckboxes('breakfast-coffee-container', log.breakfast.coffeeIds || []);
                checkCheckboxes('breakfast-drinks-container', log.breakfast.drinkIds || []);
            }
        }
        
        // Populate Lunch
        if (log.lunch) {
            setSkipped('lunch', log.lunch.skipped);
            setRemote('lunch', log.lunch.location === 'remote');
            setFoodMoodRating('lunch', log.lunch.moodRating);
            setFoodMoodNote('lunch', log.lunch.moodNote);
            if (!log.lunch.skipped) {
                setSelect('lunch-soup', log.lunch.soupId);
                setSelect('lunch-main', log.lunch.mainId);
                checkCheckboxes('lunch-sides-container', log.lunch.sideIds || []);
                setSelect('lunch-dessert', log.lunch.dessertId);
                checkCheckboxes('lunch-coffee-container', log.lunch.coffeeIds || []);
                checkCheckboxes('lunch-drinks-container', log.lunch.drinkIds || []);
            }
        }
        
        // Populate Dinner
        if (log.dinner) {
            setSkipped('dinner', log.dinner.skipped);
            setRemote('dinner', log.dinner.location === 'remote');
            setFoodMoodRating('dinner', log.dinner.moodRating);
            setFoodMoodNote('dinner', log.dinner.moodNote);
            if (!log.dinner.skipped) {
                setSelect('dinner-soup', log.dinner.soupId);
                setSelect('dinner-main', log.dinner.mainId);
                checkCheckboxes('dinner-sides-container', log.dinner.sideIds || []);
                setSelect('dinner-dessert', log.dinner.dessertId);
                checkCheckboxes('dinner-coffee-container', log.dinner.coffeeIds || []);
                checkCheckboxes('dinner-drinks-container', log.dinner.drinkIds || []);
            }
        }

        // Populate Anytime Coffee
        if (log.anytime_coffee) {
            setSkipped('anytime_coffee', log.anytime_coffee.skipped);
            setRemote('anytime_coffee', log.anytime_coffee.location === 'remote');
            if (!log.anytime_coffee.skipped) {
                renderAnytimeCoffeeEntryRows(getAnytimeCoffeeEntriesFromMeal(log.anytime_coffee));
            }
        }

        // Populate Anytime Snack
        if (log.anytime_snack) {
            setSkipped('anytime_snack', log.anytime_snack.skipped);
            setRemote('anytime_snack', log.anytime_snack.location === 'remote');
            setFoodMoodRating('anytime_snack', log.anytime_snack.moodRating);
            setFoodMoodNote('anytime_snack', log.anytime_snack.moodNote);
            if (!log.anytime_snack.skipped) {
                renderAnytimeSnackEntryRows(getAnytimeSnackEntriesFromMeal(log.anytime_snack));
            }
        }

        // Show summaries
        ['breakfast', 'lunch', 'dinner', 'anytime_coffee', 'anytime_snack'].forEach(meal => {
            if (log[meal]) {
                updateMealSummary(meal, log[meal]);
                toggleMealView(meal, 'summary');
            } else {
                toggleMealView(meal, 'edit');
            }
        });

    } else {
        // No log for today, show forms for all
        ['breakfast', 'lunch', 'dinner', 'anytime_coffee', 'anytime_snack'].forEach(meal => {
            toggleMealView(meal, 'edit');
        });
    }
}

function resetForm() {
    setSkipped('breakfast', false);
    setSkipped('lunch', false);
    setSkipped('dinner', false);
    setSkipped('anytime_coffee', false);
    setSkipped('anytime_snack', false);

    setRemote('breakfast', false);
    setRemote('lunch', false);
    setRemote('dinner', false);
    setRemote('anytime_coffee', false);
    setRemote('anytime_snack', false);
    
    document.querySelectorAll('#view-daily input[type="checkbox"]:not([id^="skip-"]):not([id^="remote-"])').forEach(cb => cb.checked = false);
    document.querySelectorAll('#view-daily select').forEach(sel => sel.value = "");
    const anytimeCoffeeTime = document.getElementById('anytime_coffee-time');
    if (anytimeCoffeeTime) anytimeCoffeeTime.value = formatTimeString();
    const anytimeSnackTime = document.getElementById('anytime_snack-time');
    if (anytimeSnackTime) anytimeSnackTime.value = formatTimeString();
    renderAnytimeCoffeeEntryRows([]);
    renderAnytimeSnackEntryRows([]);
    FOOD_MOOD_MEALS.forEach(meal => setFoodMoodRating(meal, null));
    FOOD_MOOD_MEALS.forEach(meal => setFoodMoodNote(meal, ''));
}

function setSkipped(mealName, isSkipped) {
    const toggle = document.getElementById(`skip-${mealName}`);
    if (toggle) {
        toggle.checked = isSkipped;
        // manually dispatch change to trigger UI disable logic
        toggle.dispatchEvent(new Event('change'));
    }
}

function setRemote(mealName, isRemote) {
    const toggle = document.getElementById(`remote-${mealName}`);
    if (toggle) {
        toggle.checked = isRemote;
    }
}

function checkCheckboxes(containerId, values) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = values.includes(Number(cb.value));
    });
}

function setSelect(selectId, value) {
    const select = document.getElementById(selectId);
    if (select) {
        select.value = value || "";
    }
}

// --- Settings Logic ---

const SETTINGS_FOOD_CATEGORIES = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'soup', label: 'Soup' },
    { key: 'main', label: 'Main Course' },
    { key: 'side', label: 'Side Dish' },
    { key: 'dessert', label: 'Dessert' },
    { key: 'coffee', label: 'Coffee' },
    { key: 'snack', label: 'Snacks' },
    { key: 'drink', label: 'Drinks' },
    { key: 'ingredient', label: 'Ingredients' }
];

const openSettingsFoodCategories = new Set();
const openSettingsListSections = new Set();

function initSettingsForm() {
    const form = document.getElementById('add-food-form');
    const categoryInput = document.getElementById('new-food-category');
    const ingredientsGroup = document.getElementById('new-food-ingredients-group');
    const groupsGroup = document.getElementById('new-food-groups-group');

    if (categoryInput && ingredientsGroup && groupsGroup) {
        categoryInput.addEventListener('change', () => {
            if (categoryInput.value === 'ingredient') {
                ingredientsGroup.style.display = 'none';
                groupsGroup.style.display = 'block';
            } else {
                ingredientsGroup.style.display = 'block';
                groupsGroup.style.display = 'none';
            }
        });
    }

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-food-name');
        
        const name = nameInput.value.trim();
        const category = categoryInput.value;
        const ingredientIds = category === 'ingredient' ? [] : getCheckedValues('new-food-ingredients-container');
        const groupIds = category === 'ingredient' ? getCheckedValues('new-food-groups-container') : [];
        
        if (!name || !category) return;
        
        try {
            await addFood(db, { name, category, ingredientIds, groupIds });
            nameInput.value = ''; // clear
            document.querySelectorAll('#new-food-ingredients-container input[type="checkbox"]').forEach(cb => cb.checked = false);
            document.querySelectorAll('#new-food-groups-container input[type="checkbox"]').forEach(cb => cb.checked = false);
            openSettingsFoodCategories.add(category);
            
            foodDictionary = await getAllFoods(db); // update local cache
            refreshFoodUI();
            await loadDailyLog(currentDate); // Reload to reflect any removed/added items correctly
        } catch (err) {
            console.error('Error adding food:', err);
            alert('Failed to add food.');
        }
    });

    // Edit modal logic
    const editModal = document.getElementById('edit-food-modal');
    const closeEditBtn = document.getElementById('close-edit-modal');
    const editForm = document.getElementById('edit-food-form');
    const editCategoryInput = document.getElementById('edit-food-category');
    const editIngredientsGroup = document.getElementById('edit-food-ingredients-group');
    const editGroupsGroup = document.getElementById('edit-food-groups-group');

    if (closeEditBtn && editModal) {
        closeEditBtn.addEventListener('click', () => {
            editModal.style.display = 'none';
        });
    }

    if (editCategoryInput && editIngredientsGroup && editGroupsGroup) {
        editCategoryInput.addEventListener('change', () => {
            if (editCategoryInput.value === 'ingredient') {
                editIngredientsGroup.style.display = 'none';
                editGroupsGroup.style.display = 'block';
            } else {
                editIngredientsGroup.style.display = 'block';
                editGroupsGroup.style.display = 'none';
            }
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idInput = document.getElementById('edit-food-id');
            const nameInput = document.getElementById('edit-food-name');
            
            const id = Number(idInput.value);
            const name = nameInput.value.trim();
            const category = editCategoryInput.value;
            const ingredientIds = category === 'ingredient' ? [] : getCheckedValues('edit-food-ingredients-container');
            const groupIds = category === 'ingredient' ? getCheckedValues('edit-food-groups-container') : [];
            
            if (!name || !category) return;
            
            try {
                await editFood(db, { id, name, category, ingredientIds, groupIds });
                editModal.style.display = 'none';
                openSettingsFoodCategories.add(category);
                
                foodDictionary = await getAllFoods(db);
                await recalculateGroupStreaks();
                refreshFoodUI();
                await loadDailyLog(currentDate);
            } catch (err) {
                console.error('Error editing food:', err);
                alert('Failed to edit food.');
            }
        });
    }
}

function refreshFoodUI() {
    renderDictionaryList(foodDictionary);
    renderDailyLogForms(foodDictionary);
    renderSearchFoodSelect(foodDictionary);
    renderSearchIngredients(foodDictionary);
    renderStatFoodSelect(foodDictionary);
    renderGroupList(ingredientGroups);
    renderGroupCheckboxes(ingredientGroups);
    updateDailyVitalityTrends();
    renderVitalityView();
    renderMoodView();
}

function renderVitalityView() {
    const list = document.getElementById('vitality-trends-list');
    if (!list) return;

    const states = getVitalityTrendStates();
    if (states.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); margin: 0;">No vitality groups found. Create ingredient groups ending with + to track trends.</p>';
        return;
    }

    list.innerHTML = states.map(state => {
        const lastHitText = state.lastHitDate
            ? `Last hit: ${escapeHtml(state.lastHitDate)}${state.daysSince === 0 ? ' (today)' : ` (${state.daysSince} day${state.daysSince === 1 ? '' : 's'} ago)`}`
            : 'No hit yet';
        const streakText = state.streak > 0 ? `${state.streak} day streak` : 'No active streak';

        return `
            <div class="vitality-trend-row ${state.trend}">
                <div class="vitality-trend-main">
                    <span class="group-label">${escapeHtml(state.label)}</span>
                    <div>
                        <div class="vitality-trend-title">${escapeHtml(state.baseName)}</div>
                        <div class="vitality-trend-meta">${lastHitText} · ${streakText}</div>
                    </div>
                </div>
                ${renderVitalityTrendChip(state)}
            </div>
        `;
    }).join('');
    applyLocalIconFallback(list);
}

function getFoodMoodPercentage(rating) {
    const normalized = normalizeFoodMoodRating(rating);
    return normalized === null ? null : normalized * 20;
}

function getMoodFoodNames(mealName, mealData) {
    const names = [];
    const addName = (id, prefix = '') => {
        const name = getFoodName(id);
        if (name) names.push(prefix ? `${prefix}: ${name}` : name);
    };

    if (mealName === 'breakfast') {
        (mealData.items || []).forEach(id => addName(id));
        (mealData.coffeeIds || []).forEach(id => addName(id, 'Coffee'));
        (mealData.drinkIds || []).forEach(id => addName(id, 'Drink'));
        return names;
    }

    if (mealName === 'anytime_snack') {
        return getAnytimeSnackEntriesFromMeal(mealData)
            .map(entry => {
                const name = getFoodName(entry.id);
                if (!name) return null;
                return entry.time ? `${entry.time} ${name}` : name;
            })
            .filter(Boolean);
    }

    addName(mealData.soupId, 'Soup');
    addName(mealData.mainId, 'Main');
    (mealData.sideIds || []).forEach(id => addName(id, 'Side'));
    addName(mealData.dessertId, 'Dessert');
    (mealData.coffeeIds || []).forEach(id => addName(id, 'Coffee'));
    (mealData.drinkIds || []).forEach(id => addName(id, 'Drink'));
    return names;
}

export function getMoodNoteEntries(logs = []) {
    return logs.flatMap(log => FOOD_MOOD_MEALS.map(mealName => {
        const mealData = log?.[mealName];
        const rating = normalizeFoodMoodRating(mealData?.moodRating);
        const note = rating !== null && !mealData?.skipped ? String(mealData.moodNote || '').trim() : '';
        if (!mealData || mealData.skipped || rating === null || !note) return null;

        return {
            date: log.date,
            mealName,
            mealLabel: FOOD_MOOD_MEAL_LABELS[mealName],
            rating,
            percentage: getFoodMoodPercentage(rating),
            note,
            foods: getMoodFoodNames(mealName, mealData)
        };
    }).filter(Boolean));
}

function initMoodView() {
    ['mood-filter-rating', 'mood-sort-order'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('change', () => renderMoodView());
    });
}

async function renderMoodView() {
    const list = document.getElementById('mood-notes-list');
    if (!list) return;

    const maxPercentage = Number(document.getElementById('mood-filter-rating')?.value || 100);
    const sortOrder = document.getElementById('mood-sort-order')?.value || 'desc';
    const logs = await getCachedDailyLogs();
    const entries = getMoodNoteEntries(logs)
        .filter(entry => maxPercentage === 0 || entry.percentage <= maxPercentage)
        .sort((a, b) => {
            const dateCompare = sortOrder === 'asc'
                ? a.date.localeCompare(b.date)
                : b.date.localeCompare(a.date);
            return dateCompare || a.mealLabel.localeCompare(b.mealLabel);
        });

    if (entries.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); margin: 0;">No Food-Mood notes match the current filter.</p>';
        return;
    }

    list.innerHTML = entries.map(entry => `
        <article class="mood-note-row">
            <div class="mood-note-main">
                <div class="mood-note-title">
                    <span>${escapeHtml(entry.date)}</span>
                    <span class="mood-note-meta">${escapeHtml(entry.mealLabel)}</span>
                    <span class="mood-note-rating">${renderFoodMoodStars(entry.rating)} ${entry.percentage}%</span>
                </div>
                <div class="mood-note-foods">${entry.foods.length ? escapeHtml(entry.foods.join(', ')) : 'No food details logged'}</div>
                <div class="mood-note-text">${escapeHtml(entry.note)}</div>
            </div>
            <button class="btn btn-open-mood-date" type="button" data-date="${escapeHtml(entry.date)}">
                <span class="material-icons">navigate_next</span> Open Day
            </button>
        </article>
    `).join('');

    list.querySelectorAll('.btn-open-mood-date').forEach(btn => {
        btn.addEventListener('click', () => {
            currentDate = parseDateString(btn.dataset.date);
            updateDateDisplay();
            document.getElementById('nav-daily').click();
        });
    });
    applyLocalIconFallback(list);
}

function renderGroupList(groups) {
    const list = document.getElementById('ingredient-groups-list');
    if (!list) return;

    list.innerHTML = '';

    if (groups.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); margin: 0;">No groups found. Add some above!</p>';
        return;
    }

    const details = document.createElement('details');
    details.className = 'settings-list-section';
    details.dataset.section = 'ingredient-groups';
    details.open = openSettingsListSections.has('ingredient-groups');
    details.innerHTML = `
        <summary>
            <span class="settings-list-title">
                Ingredient Groups
                <span class="settings-list-count">${groups.length} ${groups.length === 1 ? 'entry' : 'entries'}</span>
            </span>
            <span class="material-icons expand-icon">expand_more</span>
        </summary>
    `;

    details.addEventListener('toggle', () => {
        if (details.open) {
            openSettingsListSections.add('ingredient-groups');
        } else {
            openSettingsListSections.delete('ingredient-groups');
        }
    });

    const groupList = document.createElement('ul');
    groupList.className = 'material-list';

    groups.forEach(group => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="list-item-content">
                <span class="list-item-title">${escapeHtml(group.name)}</span>
            </div>
            <div style="display: flex; gap: 4px;">
                <button class="btn-icon-small edit-group-btn" data-id="${group.id}" title="Edit">
                    <span class="material-icons">edit</span>
                </button>
                <button class="btn-icon-small delete-group-btn" data-id="${group.id}" title="Delete">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        `;
        groupList.appendChild(li);
    });
    details.appendChild(groupList);
    list.appendChild(details);
    applyLocalIconFallback(list);

    list.querySelectorAll('.edit-group-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = Number(e.currentTarget.getAttribute('data-id'));
            const group = ingredientGroups.find(g => g.id === id);
            if (group) {
                document.getElementById('edit-group-id').value = group.id;
                document.getElementById('edit-group-name').value = group.name;

                // Populate ingredient checkboxes
                const container = document.getElementById('edit-group-ingredients-list-container');
                if (container) {
                    const ingredients = foodDictionary.filter(f => f.category === 'ingredient').sort((a, b) => a.name.localeCompare(b.name));
                    container.innerHTML = ingredients.map(item => `
                        <label class="checkbox-label">
                            <input type="checkbox" value="${item.id}" ${(item.groupIds && item.groupIds.includes(group.id)) ? 'checked' : ''}> ${item.name}
                        </label>
                    `).join('');
                }

                document.getElementById('edit-group-modal').style.display = 'flex';
            }
        });
    });

    list.querySelectorAll('.delete-group-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Delete this group?')) {
                await deleteIngredientGroup(db, id);
                ingredientGroups = await getAllIngredientGroups(db);
                await recalculateGroupStreaks();
                refreshFoodUI();
                await loadDailyLog(currentDate);
            }
        });
    });
}

function renderGroupCheckboxes(groups) {
    const render = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const currentlyChecked = getCheckedValues(containerId);
        container.innerHTML = groups.map(item => `
            <label class="checkbox-label">
                <input type="checkbox" value="${item.id}" ${currentlyChecked.includes(item.id) ? 'checked' : ''}> ${item.name}
            </label>
        `).join('');
    };

    render('new-food-groups-container');
    render('edit-food-groups-container');
}

function initGroupForm() {
    const form = document.getElementById('add-group-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-group-name');
            const name = nameInput.value.trim();
            if (!name) return;

            try {
                await addIngredientGroup(db, { name });
                nameInput.value = '';
                openSettingsListSections.add('ingredient-groups');
                ingredientGroups = await getAllIngredientGroups(db);
                await recalculateGroupStreaks();
                refreshFoodUI();
                await loadDailyLog(currentDate);
            } catch (err) {
                console.error('Error adding group:', err);
                alert('Failed to add group.');
            }
        });
    }

    const editGroupModal = document.getElementById('edit-group-modal');
    const closeEditGroupBtn = document.getElementById('close-edit-group-modal');
    const editGroupForm = document.getElementById('edit-group-form');

    if (closeEditGroupBtn && editGroupModal) {
        closeEditGroupBtn.addEventListener('click', () => {
            editGroupModal.style.display = 'none';
        });
    }

    if (editGroupForm) {
        editGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idInput = document.getElementById('edit-group-id');
            const nameInput = document.getElementById('edit-group-name');

            const groupId = Number(idInput.value);
            const name = nameInput.value.trim();
            if (!name) return;

            try {
                // Update the group itself
                await editIngredientGroup(db, { id: groupId, name });

                // Read checked ingredients
                const checkedIngredientIds = getCheckedValues('edit-group-ingredients-list-container');

                // Iterate through all ingredients to update their groupIds array
                const ingredients = foodDictionary.filter(f => f.category === 'ingredient');
                for (const ing of ingredients) {
                    const groupIds = ing.groupIds || [];
                    const hasGroup = groupIds.includes(groupId);
                    const shouldHaveGroup = checkedIngredientIds.includes(ing.id);

                    if (shouldHaveGroup && !hasGroup) {
                        groupIds.push(groupId);
                        await editFood(db, { ...ing, groupIds });
                    } else if (!shouldHaveGroup && hasGroup) {
                        const newGroupIds = groupIds.filter(id => id !== groupId);
                        await editFood(db, { ...ing, groupIds: newGroupIds });
                    }
                }

                editGroupModal.style.display = 'none';

                ingredientGroups = await getAllIngredientGroups(db);
                foodDictionary = await getAllFoods(db);
                await recalculateGroupStreaks();
                refreshFoodUI();
                await loadDailyLog(currentDate);
            } catch (err) {
                console.error('Error editing group:', err);
                alert('Failed to edit group.');
            }
        });
    }
}
async function recalculateGroupStreaks() {
    computedGroupLabels = {};
    computedGroupLabelDetails = {};
    const allLogs = await getCachedDailyLogs();
    
    // Groups that end with '+'
    const plusGroups = ingredientGroups.filter(g => g.name.endsWith('+'));
    if (plusGroups.length === 0) return;

    // Map ingredients to the plusGroups they belong to
    const foodGroupCache = {};
    foodDictionary.forEach(f => {
        if (f.category === 'ingredient' && f.groupIds) {
            const groupsForFood = f.groupIds.map(gid => plusGroups.find(g => g.id === gid)).filter(Boolean);
            if (groupsForFood.length > 0) {
                foodGroupCache[f.id] = groupsForFood;
            }
        }
    });

    // Helper: given an array of consumed food IDs, return which plusGroups were hit
    const getHitGroups = (foodIds) => {
        if (!foodIds || foodIds.length === 0) return new Set();
        let hits = new Set();
        foodIds.forEach(id => {
            const food = foodDictionary.find(f => f.id === id);
            if (food && food.ingredientIds) {
                food.ingredientIds.forEach(ingId => {
                    if (foodGroupCache[ingId]) {
                        foodGroupCache[ingId].forEach(g => hits.add(g.id));
                    }
                });
            }
        });
        return hits;
    };

    allLogs.sort((a, b) => a.date.localeCompare(b.date));

    let currentStreaks = {}; // groupId -> count
    plusGroups.forEach(g => currentStreaks[g.id] = 0);

    let lastDateObj = null;

    for (const log of allLogs) {
        const currentDateObj = new Date(log.date);
        
        // Reset if gap > 1 day
        if (lastDateObj) {
            const diffTime = Math.abs(currentDateObj - lastDateObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 1) {
                plusGroups.forEach(g => currentStreaks[g.id] = 0);
            }
        }

        let dailyHits = new Set();
        const addHits = (meal, ids) => {
            if (meal && !meal.skipped) {
                const hits = getHitGroups(ids);
                hits.forEach(h => dailyHits.add(h));
            }
        };

        if (log.breakfast) addHits(log.breakfast, [...(log.breakfast.items || []), ...(log.breakfast.coffeeIds || []), ...(log.breakfast.drinkIds || [])]);
        if (log.lunch) addHits(log.lunch, [log.lunch.soupId, log.lunch.mainId, log.lunch.dessertId, ...(log.lunch.sideIds || []), ...(log.lunch.coffeeIds || []), ...(log.lunch.drinkIds || [])].filter(Boolean));
        if (log.dinner) addHits(log.dinner, [log.dinner.soupId, log.dinner.mainId, log.dinner.dessertId, ...(log.dinner.sideIds || []), ...(log.dinner.coffeeIds || []), ...(log.dinner.drinkIds || [])].filter(Boolean));
        if (log.anytime_coffee) addHits(log.anytime_coffee, getAnytimeCoffeeEntriesFromMeal(log.anytime_coffee).map(e => e.id));
        if (log.anytime_snack) addHits(log.anytime_snack, getAnytimeSnackEntriesFromMeal(log.anytime_snack).map(e => e.id));

        let labelsForDay = [];
        let labelDetailsForDay = [];

        plusGroups.forEach(g => {
            if (dailyHits.has(g.id)) {
                currentStreaks[g.id]++;
                const baseName = g.name.substring(0, g.name.length - 1);
                const label = formatGroupLabel(baseName, currentStreaks[g.id]);
                labelsForDay.push(label);
                labelDetailsForDay.push({ groupId: g.id, baseName, streak: currentStreaks[g.id], label });
            } else {
                currentStreaks[g.id] = 0;
            }
        });

        if (labelsForDay.length > 0) {
            computedGroupLabels[log.date] = labelsForDay;
            computedGroupLabelDetails[log.date] = labelDetailsForDay;
        }

        lastDateObj = currentDateObj;
    }
}

function renderDictionaryList(foods) {
    const list = document.getElementById('food-dictionary-list');
    if (!list) return;

    list.innerHTML = '';

    if (foods.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); margin: 0;">No foods found. Add some above!</p>';
        return;
    }

    const foodsByCategory = foods.reduce((grouped, food) => {
        if (!grouped[food.category]) grouped[food.category] = [];
        grouped[food.category].push(food);
        return grouped;
    }, {});

    Object.values(foodsByCategory).forEach(categoryFoods => {
        categoryFoods.sort((a, b) => a.name.localeCompare(b.name));
    });

    const categoryConfigs = [...SETTINGS_FOOD_CATEGORIES];
    Object.keys(foodsByCategory)
        .filter(key => !SETTINGS_FOOD_CATEGORIES.some(category => category.key === key))
        .sort((a, b) => a.localeCompare(b))
        .forEach(key => categoryConfigs.push({ key, label: key }));

    categoryConfigs.forEach(category => {
        const categoryFoods = foodsByCategory[category.key] || [];
        const details = document.createElement('details');
        details.className = 'settings-list-section';
        details.dataset.category = category.key;
        details.open = openSettingsFoodCategories.has(category.key);
        details.innerHTML = `
            <summary>
                <span class="settings-list-title">
                    ${category.label}
                    <span class="settings-list-count">${categoryFoods.length} ${categoryFoods.length === 1 ? 'entry' : 'entries'}</span>
                </span>
                <span class="material-icons expand-icon">expand_more</span>
            </summary>
        `;

        details.addEventListener('toggle', () => {
            if (details.open) {
                openSettingsFoodCategories.add(category.key);
            } else {
                openSettingsFoodCategories.delete(category.key);
            }
        });

        const categoryList = document.createElement('ul');
        categoryList.className = 'material-list';

        if (categoryFoods.length === 0) {
            categoryList.innerHTML = '<li style="color: var(--text-secondary)">No entries in this category.</li>';
        } else {
            categoryFoods.forEach(food => {
                const li = document.createElement('li');
                let ingredientsHtml = '';
                if (food.ingredientIds && food.ingredientIds.length > 0) {
                    const ingredientNames = food.ingredientIds.map(id => {
                        const ing = foods.find(f => f.id === id);
                        return ing ? ing.name : 'Unknown';
                    }).join(', ');
                    ingredientsHtml = `<div class="list-item-ingredients" style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">Ingredients: ${escapeHtml(ingredientNames)}</div>`;
                }

                li.innerHTML = `
                    <div class="list-item-content">
                        <span class="list-item-title">${escapeHtml(food.name)}</span>
                        <span class="list-item-subtitle">${category.label}</span>
                        ${ingredientsHtml}
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn-icon-small edit-food-btn" data-id="${food.id}" title="Edit">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="btn-icon-small delete-food-btn" data-id="${food.id}" title="Delete">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                `;
                categoryList.appendChild(li);
            });
        }

        details.appendChild(categoryList);
        list.appendChild(details);
    });
    applyLocalIconFallback(list);

    list.querySelectorAll('.edit-food-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = Number(e.currentTarget.getAttribute('data-id'));
            const food = foods.find(f => f.id === id);
            if (food) {
                document.getElementById('edit-food-id').value = food.id;
                document.getElementById('edit-food-name').value = food.name;
                document.getElementById('edit-food-category').value = food.category;

                const ingredientsGroup = document.getElementById('edit-food-ingredients-group');
                const groupsGroup = document.getElementById('edit-food-groups-group');
                if (food.category === 'ingredient') {
                    ingredientsGroup.style.display = 'none';
                    if (groupsGroup) {
                        groupsGroup.style.display = 'block';
                        checkCheckboxes('edit-food-groups-container', food.groupIds || []);
                    }
                } else {
                    ingredientsGroup.style.display = 'block';
                    if (groupsGroup) groupsGroup.style.display = 'none';
                    checkCheckboxes('edit-food-ingredients-container', food.ingredientIds || []);
                }

                document.getElementById('edit-food-modal').style.display = 'flex';
            }
        });
    });

    list.querySelectorAll('.delete-food-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Delete this food item?')) {
                await deleteFood(db, id);
                foodDictionary = await getAllFoods(db);
                refreshFoodUI();
                await loadDailyLog(currentDate); // Reload current log to clean up deleted items
            }
        });
    });
}
function renderDailyLogForms(foods) {
    const grouped = { breakfast: [], soup: [], main: [], side: [], dessert: [], coffee: [], snack: [], drink: [], ingredient: [] };
    foods.forEach(f => {
        if (grouped[f.category]) grouped[f.category].push(f);
    });

    Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    const populateCheckboxes = (containerId, items) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const currentlyChecked = getCheckedValues(containerId);

        container.innerHTML = items.map(item => `
            <label class="checkbox-label">
                <input type="checkbox" value="${item.id}" ${currentlyChecked.includes(item.id) ? 'checked' : ''}> ${item.name}
            </label>
        `).join('');
    };

    const populateSelect = (selectId, items) => {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentVal = select.value;

        const noneOption = '<option value="">None</option>';
        select.innerHTML = noneOption + items.map(item => `
            <option value="${item.id}" ${currentVal == item.id ? 'selected' : ''}>${item.name}</option>
        `).join('');
    };

    populateCheckboxes('breakfast-items-container', grouped.breakfast);
    populateCheckboxes('breakfast-coffee-container', grouped.coffee);
    populateCheckboxes('breakfast-drinks-container', grouped.drink);

    populateSelect('lunch-soup', grouped.soup);
    populateSelect('lunch-main', grouped.main);
    populateCheckboxes('lunch-sides-container', grouped.side);
    populateSelect('lunch-dessert', grouped.dessert);
    populateCheckboxes('lunch-coffee-container', grouped.coffee);
    populateCheckboxes('lunch-drinks-container', grouped.drink);

    populateSelect('dinner-soup', grouped.soup);
    populateSelect('dinner-main', grouped.main);
    populateCheckboxes('dinner-sides-container', grouped.side);
    populateSelect('dinner-dessert', grouped.dessert);
    populateCheckboxes('dinner-coffee-container', grouped.coffee);
    populateCheckboxes('dinner-drinks-container', grouped.drink);

    populateSelect('anytime_coffee-select', grouped.coffee);
    renderAnytimeCoffeeEntryRows(getAnytimeCoffeeEntries());
    populateSelect('anytime_snack-select', grouped.snack);
    renderAnytimeSnackEntryRows(getAnytimeSnackEntries());

    populateCheckboxes('new-food-ingredients-container', grouped.ingredient);
    populateCheckboxes('edit-food-ingredients-container', grouped.ingredient);
}
function csvEscape(value) {
    const text = value == null ? '' : String(value);
    if (/[;"\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function parseCsvLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ';' && !inQuotes) {
            fields.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    fields.push(current);
    return fields;
}

function joinIds(ids) {
    return Array.isArray(ids) ? ids.join(',') : '';
}

function parseIds(value) {
    const text = value ? value.trim() : '';
    return text ? text.split(',').map(Number).filter(Number.isFinite) : [];
}

function formatFoodMoodRating(value) {
    return normalizeFoodMoodRating(value) ?? '';
}

function formatFoodMoodNote(meal) {
    return !meal?.skipped && normalizeFoodMoodRating(meal?.moodRating) !== null ? (meal.moodNote || '') : '';
}

function csvRow(fields) {
    return fields.map(csvEscape).join(';') + '\n';
}

export function buildDbBackupCsv(foods = [], groups = [], logs = []) {
    let csvContent = "";

    // Ingredient Groups: G;id;name
    groups.forEach(g => {
        csvContent += csvRow(['G', g.id, g.name]);
    });

    // Foods: F;id;name;category;ingredientIds;groupIds
    foods.forEach(f => {
        csvContent += csvRow(['F', f.id, f.name, f.category, joinIds(f.ingredientIds), joinIds(f.groupIds)]);
    });

    // Logs:
    // Breakfast: LB;date;location;skipped;items;coffeeIds;drinkIds;moodRating;moodNote
    // Lunch: LL;date;location;skipped;soupId;mainId;sideIds;dessertId;coffeeIds;drinkIds;moodRating;moodNote
    // Dinner: LD;date;location;skipped;soupId;mainId;sideIds;dessertId;coffeeIds;drinkIds;moodRating;moodNote
    // Anytime Coffee: LC;date;location;skipped;entries (id@HH:MM,id@HH:MM)
    // Anytime Snack: LS;date;location;skipped;entries (id@HH:MM,id@HH:MM);moodRating;moodNote
    logs.forEach(l => {
        const date = l.date;
        if (l.breakfast) {
            const b = l.breakfast;
            csvContent += csvRow(['LB', date, b.location || 'home', b.skipped ? '1' : '0', joinIds(b.items), joinIds(b.coffeeIds), joinIds(b.drinkIds), formatFoodMoodRating(b.moodRating), formatFoodMoodNote(b)]);
        }
        if (l.lunch) {
            const lu = l.lunch;
            csvContent += csvRow(['LL', date, lu.location || 'home', lu.skipped ? '1' : '0', lu.soupId || '', lu.mainId || '', joinIds(lu.sideIds), lu.dessertId || '', joinIds(lu.coffeeIds), joinIds(lu.drinkIds), formatFoodMoodRating(lu.moodRating), formatFoodMoodNote(lu)]);
        }
        if (l.dinner) {
            const d = l.dinner;
            csvContent += csvRow(['LD', date, d.location || 'home', d.skipped ? '1' : '0', d.soupId || '', d.mainId || '', joinIds(d.sideIds), d.dessertId || '', joinIds(d.coffeeIds), joinIds(d.drinkIds), formatFoodMoodRating(d.moodRating), formatFoodMoodNote(d)]);
        }
        if (l.anytime_coffee) {
            const c = l.anytime_coffee;
            const entries = getAnytimeCoffeeEntriesFromMeal(c).map(entry => `${entry.id}@${entry.time || ''}`).join(',');
            csvContent += csvRow(['LC', date, c.location || 'home', c.skipped ? '1' : '0', entries]);
        }
        if (l.anytime_snack) {
            const s = l.anytime_snack;
            const entries = getAnytimeSnackEntriesFromMeal(s).map(entry => `${entry.id}@${entry.time || ''}`).join(',');
            csvContent += csvRow(['LS', date, s.location || 'home', s.skipped ? '1' : '0', entries, formatFoodMoodRating(s.moodRating), formatFoodMoodNote(s)]);
        }
    });

    return csvContent;
}

export function parseDbBackupCsv(content) {
    const foods = [];
    const groups = [];
    const logsMap = {};

    content.split(/\r?\n/).forEach(line => {
        if (!line.trim()) return;
        const parts = parseCsvLine(line);
        if (parts.length < 2) return;
        const type = parts[0];

        if (type === 'G') {
            groups.push({
                id: Number(parts[1]),
                name: parts[2]
            });
        } else if (type === 'F') {
            foods.push({
                id: Number(parts[1]),
                name: parts[2],
                category: parts[3].trim(),
                ingredientIds: parseIds(parts[4]),
                groupIds: parseIds(parts[5])
            });
        } else if (type === 'LB' || type === 'LL' || type === 'LD' || type === 'LC' || type === 'LS') {
            const date = parts[1];
            if (!logsMap[date]) {
                logsMap[date] = { date: date, breakfast: {}, lunch: {}, dinner: {}, anytime_coffee: {}, anytime_snack: {} };
            }

            const location = parts[2];
            const skipped = parts[3] === '1';

            if (type === 'LB') {
                const meal = {
                    skipped,
                    location,
                    items: parseIds(parts[4]),
                    coffeeIds: parseIds(parts[5]),
                    drinkIds: parseIds(parts[6])
                };
                const moodRating = normalizeFoodMoodRating(parts[7]);
                if (moodRating !== null) {
                    meal.moodRating = moodRating;
                    if (parts[8]) meal.moodNote = parts[8];
                }
                logsMap[date].breakfast = meal;
            } else if (type === 'LC') {
                const entriesStr = parts[4] ? parts[4].trim() : '';
                const entries = entriesStr ? entriesStr.split(',').map(value => {
                    const [id, time = ''] = value.split('@');
                    return { id: Number(id), time };
                }).filter(entry => entry.id) : [];
                logsMap[date].anytime_coffee = { skipped, location, entries };
            } else if (type === 'LS') {
                const entriesStr = parts[4] ? parts[4].trim() : '';
                const entries = entriesStr ? entriesStr.split(',').map(value => {
                    const [id, time = ''] = value.split('@');
                    return { id: Number(id), time };
                }).filter(entry => entry.id) : [];
                const meal = { skipped, location, entries };
                const moodRating = normalizeFoodMoodRating(parts[5]);
                if (moodRating !== null) {
                    meal.moodRating = moodRating;
                    if (parts[6]) meal.moodNote = parts[6];
                }
                logsMap[date].anytime_snack = meal;
            } else {
                const mealName = type === 'LL' ? 'lunch' : 'dinner';
                const meal = {
                    skipped,
                    location,
                    soupId: parts[4] ? Number(parts[4]) : null,
                    mainId: parts[5] ? Number(parts[5]) : null,
                    sideIds: parseIds(parts[6]),
                    dessertId: parts[7] ? Number(parts[7]) : null,
                    coffeeIds: parseIds(parts[8]),
                    drinkIds: parseIds(parts[9])
                };
                const moodRating = normalizeFoodMoodRating(parts[10]);
                if (moodRating !== null) {
                    meal.moodRating = moodRating;
                    if (parts[11]) meal.moodNote = parts[11];
                }
                logsMap[date][mealName] = meal;
            }
        }
    });

    return { foods, groups, logs: Object.values(logsMap) };
}

function initDbBackupRestore() {
    const btnExport = document.getElementById('btn-db-export');
    const btnImport = document.getElementById('btn-db-import');
    const fileInput = document.getElementById('db-import-file');
    const btnCopyExport = document.getElementById('btn-copy-export');
    const btnCloseExportFallback = document.getElementById('btn-close-export-fallback');
    const fallbackContent = document.getElementById('download-fallback-content');
    const fallback = document.getElementById('download-fallback');
    const fallbackLink = document.getElementById('download-fallback-link');

    if (btnCopyExport && fallbackContent) {
        btnCopyExport.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(fallbackContent.value);
                alert('Export copied to clipboard.');
            } catch (err) {
                fallbackContent.focus();
                fallbackContent.select();
                alert('Copy failed. Select the text and copy it manually.');
            }
        });
    }

    if (btnCloseExportFallback && fallback) {
        btnCloseExportFallback.addEventListener('click', () => {
            if (fallbackLink?.dataset.objectUrl) {
                URL.revokeObjectURL(fallbackLink.dataset.objectUrl);
                delete fallbackLink.dataset.objectUrl;
            }
            fallback.style.display = 'none';
        });
    }

    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const format = document.getElementById('db-export-format').value;
            const foods = await getAllFoods(db);
            const groups = await getAllIngredientGroups(db);
            const logs = await getCachedDailyLogs();
            const dbDump = { foods, groups, logs };

            if (format === 'json') {
                const jsonStr = JSON.stringify(dbDump, null, 2);
                downloadFile(jsonStr, 'food4me_db_backup.json', 'application/json');
            } else if (format === 'csv') {
                downloadFile(buildDbBackupCsv(foods, groups, logs), 'food4me_db_backup.csv', 'text/csv;charset=utf-8;');
            }
        });
    }

    if (btnImport && fileInput) {
        btnImport.addEventListener('click', () => {
            const file = fileInput.files[0];
            if (!file) {
                alert("Please select a file to import.");
                return;
            }

            if (!confirm("WARNING: This will erase all current foods, groups, and logs, and replace them with the imported data. Are you sure?")) {
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = e.target.result;
                    let newFoods = [];
                    let newGroups = [];
                    let newLogs = [];

                    if (file.name.endsWith('.json')) {
                        const data = JSON.parse(content);
                        if (data.foods) newFoods = data.foods;
                        if (data.groups) newGroups = data.groups;
                        if (data.ingredientGroups) newGroups = data.ingredientGroups;
                        if (data.logs) newLogs = data.logs;
                    } else if (file.name.endsWith('.csv')) {
                        const data = parseDbBackupCsv(content);
                        newFoods = data.foods;
                        newGroups = data.groups;
                        newLogs = data.logs;
                    }

                    // Perform Restoration
                    await clearDB(db);
                    for (const g of newGroups) await addIngredientGroup(db, g);
                    for (const f of newFoods) await addFood(db, f);
                    for (const l of newLogs) await saveDailyLog(db, l);
                    cachedDailyLogs = null;

                    alert("Database restored successfully!");
                    
                    // Refresh state
                    foodDictionary = await getAllFoods(db);
                    ingredientGroups = await getAllIngredientGroups(db);
                    await recalculateGroupStreaks();
                    refreshFoodUI();
                    await loadDailyLog(currentDate);

                } catch (err) {
                    console.error(err);
                    alert("Failed to parse and import data. Make sure the file format is correct.");
                }
            };
            reader.readAsText(file);
        });
    }

    const btnClearLogs = document.getElementById('btn-clear-logs');
    if (btnClearLogs) {
        btnClearLogs.addEventListener('click', async () => {
            if (confirm("WARNING: This will permanently delete ALL your tracking logs. Your custom foods will be kept. Are you sure?")) {
                try {
                    await clearAllLogs(db);
                    cachedDailyLogs = null;
                    alert("All logs have been cleared.");
                    await loadDailyLog(currentDate);
                } catch (err) {
                    console.error(err);
                    alert("Failed to clear logs.");
                }
            }
        });
    }

    const btnClearDb = document.getElementById('btn-clear-db');
    if (btnClearDb) {
        btnClearDb.addEventListener('click', async () => {
            if (confirm("CRITICAL WARNING: This will permanently delete EVERYTHING (all logs and all custom foods) and restore the app to its initial state. Are you sure?")) {
                try {
                    await clearDB(db);
                    await seedDefaultFoods(db);
                    cachedDailyLogs = null;
                    alert("Database has been completely reset.");
                    foodDictionary = await getAllFoods(db);
                    refreshFoodUI();
                    await loadDailyLog(currentDate);
                } catch (err) {
                    console.error(err);
                    alert("Failed to clear database.");
                }
            }
        });
    }
}

// --- Search Logic ---

function initHelpCollapsibles() {
    const collapsibles = document.querySelectorAll('.collapsible-card');
    
    collapsibles.forEach(card => {
        const header = card.querySelector('.collapsible-header');
        const content = card.querySelector('.collapsible-content');
        if (!header || !content) return;
        
        header.addEventListener('click', () => {
            const isExpanded = card.classList.toggle('expanded');
            content.style.display = isExpanded ? 'block' : 'none';
            header.setAttribute('aria-expanded', isExpanded.toString());
        });
        
        // Add keyboard support for accessibility
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                header.click();
            }
        });
    });
}

function initSearch() {
    const searchSelect = document.getElementById('search-food-select');
    const sortToggle = document.getElementById('search-sort-desc');
    const modeRadios = document.querySelectorAll('input[name="search-mode"]');
    
    if (searchSelect) {
        searchSelect.addEventListener('change', performSearch);
    }
    if (sortToggle) {
        sortToggle.addEventListener('change', performSearch);
    }
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            document.getElementById('search-food-group').style.display = mode === 'food' ? 'block' : 'none';
            document.getElementById('search-ingredients-group').style.display = mode === 'ingredients' ? 'block' : 'none';
            performSearch();
        });
    });

    const scrollTopBtn = document.getElementById('btn-search-scroll-top');
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            const searchView = document.getElementById('view-search');
            if (searchView && searchView.classList.contains('active') && window.scrollY > 300) {
                scrollTopBtn.style.display = 'flex';
            } else {
                scrollTopBtn.style.display = 'none';
            }
        });
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function renderSearchFoodSelect(foods) {
    const select = document.getElementById('search-food-select');
    if (!select) return;
    
    const currentVal = select.value;
    const noneOption = '<option value="">-- Select a food item --</option>';
    
    // Sort foods alphabetically
    const sortedFoods = [...foods].sort((a, b) => a.name.localeCompare(b.name));
    
    select.innerHTML = noneOption + sortedFoods.map(item => `
        <option value="${item.id}" ${currentVal == item.id ? 'selected' : ''}>${item.name} (${item.category})</option>
    `).join('');
}

function renderSearchIngredients(foods) {
    const container = document.getElementById('search-ingredients-container');
    if (!container) return;
    const ingredients = foods.filter(f => f.category === 'ingredient').sort((a, b) => a.name.localeCompare(b.name));
    const currentlyChecked = getCheckedValues('search-ingredients-container');
    container.innerHTML = ingredients.map(item => `
        <label class="checkbox-label">
            <input type="checkbox" value="${item.id}" ${currentlyChecked.includes(item.id) ? 'checked' : ''}> ${item.name}
        </label>
    `).join('');
    
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', performSearch);
    });
}

async function performSearch() {
    const mode = document.querySelector('input[name="search-mode"]:checked')?.value || 'food';
    const sortDesc = document.getElementById('search-sort-desc').checked;
    const container = document.getElementById('search-results-container');
    
    if (!container) return;
    container.innerHTML = '';

    const allLogs = await getCachedDailyLogs();
    
    // Sort
    allLogs.sort((a, b) => {
        if (sortDesc) {
            return b.date.localeCompare(a.date);
        } else {
            return a.date.localeCompare(b.date);
        }
    });

    if (mode === 'food') {
        const select = document.getElementById('search-food-select');
        if (!select) return;
        const foodId = Number(select.value);
        if (!foodId) return;

        let results = [];
        for (const log of allLogs) {
            let foundInMeals = [];
            
            // Check breakfast
            if (log.breakfast && !log.breakfast.skipped && ((log.breakfast.items && log.breakfast.items.includes(foodId)) || (log.breakfast.coffeeIds && log.breakfast.coffeeIds.includes(foodId)) || (log.breakfast.drinkIds && log.breakfast.drinkIds.includes(foodId)))) {
                foundInMeals.push('Breakfast');
            }
            
            // Check lunch
            if (log.lunch && !log.lunch.skipped) {
                if (log.lunch.soupId === foodId || log.lunch.mainId === foodId || log.lunch.dessertId === foodId || (log.lunch.sideIds && log.lunch.sideIds.includes(foodId)) || (log.lunch.coffeeIds && log.lunch.coffeeIds.includes(foodId)) || (log.lunch.drinkIds && log.lunch.drinkIds.includes(foodId))) {
                    foundInMeals.push('Lunch');
                }
            }
            
            // Check dinner
            if (log.dinner && !log.dinner.skipped) {
                if (log.dinner.soupId === foodId || log.dinner.mainId === foodId || log.dinner.dessertId === foodId || (log.dinner.sideIds && log.dinner.sideIds.includes(foodId)) || (log.dinner.coffeeIds && log.dinner.coffeeIds.includes(foodId)) || (log.dinner.drinkIds && log.dinner.drinkIds.includes(foodId))) {
                    foundInMeals.push('Dinner');
                }
            }

            if (log.anytime_coffee && !log.anytime_coffee.skipped) {
                const times = getAnytimeCoffeeEntriesFromMeal(log.anytime_coffee)
                    .filter(entry => entry.id === foodId)
                    .map(entry => entry.time)
                    .filter(Boolean);
                if (times.length > 0) {
                    foundInMeals.push(`Anytime Coffee (${times.join(', ')})`);
                } else if (getAnytimeCoffeeEntriesFromMeal(log.anytime_coffee).some(entry => entry.id === foodId)) {
                    foundInMeals.push('Anytime Coffee');
                }
            }

            if (log.anytime_snack && !log.anytime_snack.skipped) {
                const times = getAnytimeSnackEntriesFromMeal(log.anytime_snack)
                    .filter(entry => entry.id === foodId)
                    .map(entry => entry.time)
                    .filter(Boolean);
                if (times.length > 0) {
                    foundInMeals.push(`Anytime Snack (${times.join(', ')})`);
                } else if (getAnytimeSnackEntriesFromMeal(log.anytime_snack).some(entry => entry.id === foodId)) {
                    foundInMeals.push('Anytime Snack');
                }
            }
            
            if (foundInMeals.length > 0) {
                results.push({
                    date: log.date,
                    meals: foundInMeals.join(', ')
                });
            }
        }
        
        if (results.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: var(--spacing-lg);">No logs found for this item.</p>';
            return;
        }
        
        container.innerHTML = renderSearchResultCards(results);

    } else if (mode === 'ingredients') {
        const selectedIngredientIds = getCheckedValues('search-ingredients-container');
        if (selectedIngredientIds.length === 0) return;

        let exactResults = [];
        let partialResults = [];

        for (const log of allLogs) {
            let foundInMealsExact = [];
            let foundInMealsPartial = [];

            const checkMealForIngredients = (mealName, foodIds) => {
                if (!foodIds || foodIds.length === 0) return;
                let mealIngredientIds = new Set();
                let matchingFoodNames = new Set();
                
                foodIds.forEach(id => {
                    const food = foodDictionary.find(f => f.id === id);
                    if (food && food.ingredientIds) {
                        let foodMatches = false;
                        food.ingredientIds.forEach(ingId => {
                            mealIngredientIds.add(ingId);
                            if (selectedIngredientIds.includes(ingId)) {
                                foodMatches = true;
                            }
                        });
                        if (foodMatches) {
                            matchingFoodNames.add(food.name);
                        }
                    }
                });

                if (mealIngredientIds.size === 0) return;

                const hasAll = selectedIngredientIds.every(id => mealIngredientIds.has(id));
                const hasAny = selectedIngredientIds.some(id => mealIngredientIds.has(id));
                
                let mealLabel = mealName;
                if (matchingFoodNames.size > 0) {
                    mealLabel += ` (${Array.from(matchingFoodNames).join(', ')})`;
                }

                if (hasAll) {
                    foundInMealsExact.push(mealLabel);
                } else if (hasAny) {
                    foundInMealsPartial.push(mealLabel);
                }
            };

            if (log.breakfast && !log.breakfast.skipped) {
                const ids = [...(log.breakfast.items || []), ...(log.breakfast.coffeeIds || []), ...(log.breakfast.drinkIds || [])];
                checkMealForIngredients('Breakfast', ids);
            }
            if (log.lunch && !log.lunch.skipped) {
                const ids = [log.lunch.soupId, log.lunch.mainId, log.lunch.dessertId, ...(log.lunch.sideIds || []), ...(log.lunch.coffeeIds || []), ...(log.lunch.drinkIds || [])].filter(Boolean);
                checkMealForIngredients('Lunch', ids);
            }
            if (log.dinner && !log.dinner.skipped) {
                const ids = [log.dinner.soupId, log.dinner.mainId, log.dinner.dessertId, ...(log.dinner.sideIds || []), ...(log.dinner.coffeeIds || []), ...(log.dinner.drinkIds || [])].filter(Boolean);
                checkMealForIngredients('Dinner', ids);
            }
            if (log.anytime_coffee && !log.anytime_coffee.skipped) {
                const ids = getAnytimeCoffeeEntriesFromMeal(log.anytime_coffee).map(e => e.id);
                checkMealForIngredients('Anytime Coffee', ids);
            }
            if (log.anytime_snack && !log.anytime_snack.skipped) {
                const ids = getAnytimeSnackEntriesFromMeal(log.anytime_snack).map(e => e.id);
                checkMealForIngredients('Anytime Snack', ids);
            }

            if (foundInMealsExact.length > 0) {
                exactResults.push({ date: log.date, meals: foundInMealsExact.join(', ') });
            }
            if (foundInMealsPartial.length > 0 && foundInMealsExact.length === 0) {
                partialResults.push({ date: log.date, meals: foundInMealsPartial.join(', ') });
            } else if (foundInMealsPartial.length > 0 && foundInMealsExact.length > 0) {
                // If a log has both exact and partial matches (e.g. Breakfast exact, Lunch partial),
                // we'll list the partial meals in the partial section as well.
                partialResults.push({ date: log.date, meals: foundInMealsPartial.join(', ') });
            }
        }

        let html = '';
        const hasBoth = exactResults.length > 0 && partialResults.length > 0;

        if (exactResults.length > 0) {
            html += `<div id="search-exact-matches"><h3 style="margin-bottom: var(--spacing-sm); margin-top: var(--spacing-md); color: var(--primary-color);">Exact Matches (All Ingredients)</h3>`;
            if (hasBoth) {
                html += `<div style="margin-bottom: var(--spacing-sm);"><button class="btn btn-jump-to-partial" style="display: flex; align-items: center; gap: 4px; background: transparent; border: 1px solid var(--secondary-color); color: var(--secondary-color); font-size: 0.85rem; padding: 4px 8px; cursor: pointer;"><span class="material-icons" style="font-size: 16px;">arrow_downward</span> Jump to Partial Matches</button></div>`;
            }
            html += renderSearchResultCards(exactResults) + `</div>`;
        }
        if (partialResults.length > 0) {
            html += `<div id="search-partial-matches" style="padding-top: var(--spacing-md);"><h3 style="margin-bottom: var(--spacing-sm); margin-top: var(--spacing-md); color: var(--primary-color);">Partial Matches (Any Ingredient)</h3>`;
            if (hasBoth) {
                html += `<div style="margin-bottom: var(--spacing-sm);"><button class="btn btn-jump-to-exact" style="display: flex; align-items: center; gap: 4px; background: transparent; border: 1px solid var(--secondary-color); color: var(--secondary-color); font-size: 0.85rem; padding: 4px 8px; cursor: pointer;"><span class="material-icons" style="font-size: 16px;">arrow_upward</span> Back to Exact Matches</button></div>`;
            }
            html += renderSearchResultCards(partialResults) + `</div>`;
        }
        
        if (exactResults.length === 0 && partialResults.length === 0) {
            html = '<p style="color: var(--text-secondary); text-align: center; margin-top: var(--spacing-lg);">No logs found containing these ingredients.</p>';
        }

        container.innerHTML = html;

        // Attach jump link listeners
        const btnJumpPartial = container.querySelector('.btn-jump-to-partial');
        if (btnJumpPartial) {
            btnJumpPartial.addEventListener('click', () => {
                document.getElementById('search-partial-matches').scrollIntoView({ behavior: 'smooth' });
            });
        }
        const btnJumpExact = container.querySelector('.btn-jump-to-exact');
        if (btnJumpExact) {
            btnJumpExact.addEventListener('click', () => {
                document.getElementById('search-exact-matches').scrollIntoView({ behavior: 'smooth' });
            });
        }
    }
    
    // Attach click to navigate
    container.querySelectorAll('.search-result-card').forEach(card => {
        card.addEventListener('click', () => {
            const dateStr = card.getAttribute('data-date');
            currentDate = new Date(dateStr);
            updateDateDisplay();
            document.getElementById('nav-daily').click(); 
        });
    });
}

function renderSearchResultCards(results) {
    return results.map(res => {
        const dObj = new Date(res.date);
        const dateStr = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        return `
            <div class="search-result-card" data-date="${res.date}">
                <div class="search-result-date">${dateStr}</div>
                <div class="search-result-details">
                    <span class="material-icons" style="font-size: 16px;">restaurant</span> ${res.meals}
                </div>
            </div>
        `;
    }).join('');
}

// --- Reports & Statistics Logic ---

function initReports() {
    // Stat Range Radio
    const radios = document.querySelectorAll('input[name="stat-range"]');
    radios.forEach(r => r.addEventListener('change', () => {
        const dateInputs = document.getElementById('stat-date-inputs');
        if (r.value === 'daterange') {
            dateInputs.style.display = 'flex';
        } else {
            dateInputs.style.display = 'none';
        }
    }));

    // Dist Range Radio
    const distRadios = document.querySelectorAll('input[name="dist-range"]');
    distRadios.forEach(r => r.addEventListener('change', () => {
        const distDateInputs = document.getElementById('dist-date-inputs');
        if (r.value === 'daterange') {
            distDateInputs.style.display = 'flex';
        } else {
            distDateInputs.style.display = 'none';
        }
    }));

    // Generate Stats Button
    const btnStats = document.getElementById('btn-generate-stats');
    if (btnStats) {
        btnStats.addEventListener('click', generateStatistics);
    }

    // Generate Dist Button
    const btnDist = document.getElementById('btn-generate-dist');
    if (btnDist) {
        btnDist.addEventListener('click', generateDistribution);
    }

    const distLogScale = document.getElementById('dist-log-scale');
    if (distLogScale) {
        distLogScale.addEventListener('change', refreshDistributionScale);
    }
    
    // Export Dist Button
    const btnExportDist = document.getElementById('btn-export-dist');
    if (btnExportDist) {
        btnExportDist.addEventListener('click', exportFullDistributionCSV);
    }

    const btnDistNextTop = document.getElementById('btn-dist-next-top');
    if (btnDistNextTop) {
        btnDistNextTop.addEventListener('click', showNextTopDistributionPage);
    }

    document.querySelectorAll('.btn-dist-next-granular').forEach(btn => {
        btn.addEventListener('click', () => showNextGranularDistributionPage(btn.dataset.category));
    });

    // Export Report Button
    const btnExport = document.getElementById('btn-export-report');
    if (btnExport) {
        btnExport.addEventListener('click', exportDateRangeReport);
    }
}

function renderStatFoodSelect(foods) {
    const select = document.getElementById('stat-food-select');
    if (!select) return;
    
    const currentVal = select.value;
    const noneOption = '<option value="">-- Select a food item --</option>';
    
    const sortedFoods = [...foods].sort((a, b) => a.name.localeCompare(b.name));
    
    select.innerHTML = noneOption + sortedFoods.map(item => `
        <option value="${item.id}" ${currentVal == item.id ? 'selected' : ''}>${item.name} (${item.category})</option>
    `).join('');
}

async function exportDateRangeReport() {
    const startStr = document.getElementById('report-start-date').value;
    const endStr = document.getElementById('report-end-date').value;
    const format = document.getElementById('report-format').value;

    if (!startStr || !endStr) {
        alert("Please select both start and end dates for the report.");
        return;
    }

    if (startStr > endStr) {
        alert("Start date must be before or equal to end date.");
        return;
    }

    const allLogs = await getCachedDailyLogs();
    
    // Filter logs by date range
    const filteredLogs = allLogs.filter(log => log.date >= startStr && log.date <= endStr);
    
    // Sort logs by date asc
    filteredLogs.sort((a, b) => a.date.localeCompare(b.date));

    if (filteredLogs.length === 0) {
        alert("No logs found in the selected date range.");
        return;
    }

    if (format === 'json') {
        const jsonStr = JSON.stringify(filteredLogs, null, 2);
        downloadFile(jsonStr, `food4me_report_${startStr}_to_${endStr}.json`, 'application/json');
    } else if (format === 'csv') {
        // Flatten the data for CSV
        let csvContent = "Date;Meal;Location;Skipped;Item\n";
        
        filteredLogs.forEach(log => {
            const date = log.date;
            
            // Breakfast
            if (log.breakfast) {
                if (log.breakfast.skipped) {
                    csvContent += `${date};Breakfast;${log.breakfast.location};Yes;\n`;
                } else {
                    let hasItems = false;
                    if (log.breakfast.items && log.breakfast.items.length > 0) {
                        log.breakfast.items.forEach(id => {
                            csvContent += `${date};Breakfast;${log.breakfast.location};No;${getFoodName(id)}\n`;
                        });
                        hasItems = true;
                    }
                    if (log.breakfast.coffeeIds && log.breakfast.coffeeIds.length > 0) {
                        log.breakfast.coffeeIds.forEach(id => {
                            csvContent += `${date};Breakfast;${log.breakfast.location};No;${getFoodName(id)} (Coffee)\n`;
                        });
                        hasItems = true;
                    }
                    if (log.breakfast.drinkIds && log.breakfast.drinkIds.length > 0) {
                        log.breakfast.drinkIds.forEach(id => {
                            csvContent += `${date};Breakfast;${log.breakfast.location};No;${getFoodName(id)} (Drink)\n`;
                        });
                        hasItems = true;
                    }
                    if (!hasItems) {
                        csvContent += `${date};Breakfast;${log.breakfast.location};No;Nothing logged\n`;
                    }
                }
            }

            // Lunch
            if (log.lunch) {
                if (log.lunch.skipped) {
                    csvContent += `${date};Lunch;${log.lunch.location};Yes;\n`;
                } else {
                    if (log.lunch.soupId) csvContent += `${date};Lunch;${log.lunch.location};No;${getFoodName(log.lunch.soupId)} (Soup)\n`;
                    if (log.lunch.mainId) csvContent += `${date};Lunch;${log.lunch.location};No;${getFoodName(log.lunch.mainId)} (Main)\n`;
                    if (log.lunch.sideIds) {
                        log.lunch.sideIds.forEach(id => {
                            csvContent += `${date};Lunch;${log.lunch.location};No;${getFoodName(id)} (Side)\n`;
                        });
                    }
                    if (log.lunch.dessertId) csvContent += `${date};Lunch;${log.lunch.location};No;${getFoodName(log.lunch.dessertId)} (Dessert)\n`;
                    if (log.lunch.coffeeIds) {
                        log.lunch.coffeeIds.forEach(id => {
                            csvContent += `${date};Lunch;${log.lunch.location};No;${getFoodName(id)} (Coffee)\n`;
                        });
                    }
                    if (log.lunch.drinkIds) {
                        log.lunch.drinkIds.forEach(id => {
                            csvContent += `${date};Lunch;${log.lunch.location};No;${getFoodName(id)} (Drink)\n`;
                        });
                    }
                }
            }

            // Dinner
            if (log.dinner) {
                if (log.dinner.skipped) {
                    csvContent += `${date};Dinner;${log.dinner.location};Yes;\n`;
                } else {
                    if (log.dinner.soupId) csvContent += `${date};Dinner;${log.dinner.location};No;${getFoodName(log.dinner.soupId)} (Soup)\n`;
                    if (log.dinner.mainId) csvContent += `${date};Dinner;${log.dinner.location};No;${getFoodName(log.dinner.mainId)} (Main)\n`;
                    if (log.dinner.sideIds) {
                        log.dinner.sideIds.forEach(id => {
                            csvContent += `${date};Dinner;${log.dinner.location};No;${getFoodName(id)} (Side)\n`;
                        });
                    }
                    if (log.dinner.dessertId) csvContent += `${date};Dinner;${log.dinner.location};No;${getFoodName(log.dinner.dessertId)} (Dessert)\n`;
                    if (log.dinner.coffeeIds) {
                        log.dinner.coffeeIds.forEach(id => {
                            csvContent += `${date};Dinner;${log.dinner.location};No;${getFoodName(id)} (Coffee)\n`;
                        });
                    }
                    if (log.dinner.drinkIds) {
                        log.dinner.drinkIds.forEach(id => {
                            csvContent += `${date};Dinner;${log.dinner.location};No;${getFoodName(id)} (Drink)\n`;
                        });
                    }
                }
            }

            // Anytime Coffee
            if (log.anytime_coffee) {
                if (log.anytime_coffee.skipped) {
                    csvContent += `${date};Anytime Coffee;${log.anytime_coffee.location};Yes;\n`;
                } else {
                    const coffeeEntries = getAnytimeCoffeeEntriesFromMeal(log.anytime_coffee);
                    if (coffeeEntries.length > 0) {
                        coffeeEntries.forEach(entry => {
                            const timeLabel = entry.time ? `${entry.time} ` : '';
                            csvContent += `${date};Anytime Coffee;${log.anytime_coffee.location};No;${timeLabel}${getFoodName(entry.id)} (Coffee)\n`;
                        });
                    } else {
                        csvContent += `${date};Anytime Coffee;${log.anytime_coffee.location};No;Nothing logged\n`;
                    }
                }
            }

            // Anytime Snack
            if (log.anytime_snack) {
                if (log.anytime_snack.skipped) {
                    csvContent += `${date};Anytime Snack;${log.anytime_snack.location};Yes;\n`;
                } else {
                    const snackEntries = getAnytimeSnackEntriesFromMeal(log.anytime_snack);
                    if (snackEntries.length > 0) {
                        snackEntries.forEach(entry => {
                            const timeLabel = entry.time ? `${entry.time} ` : '';
                            csvContent += `${date};Anytime Snack;${log.anytime_snack.location};No;${timeLabel}${getFoodName(entry.id)} (Snack)\n`;
                        });
                    } else {
                        csvContent += `${date};Anytime Snack;${log.anytime_snack.location};No;Nothing logged\n`;
                    }
                }
            }
        });
        
        downloadFile(csvContent, `food4me_report_${startStr}_to_${endStr}.csv`, 'text/csv;charset=utf-8;');
    }
}

function downloadFile(content, fileName, mimeType) {
    const fallback = document.getElementById('download-fallback');
    const fallbackLink = document.getElementById('download-fallback-link');
    const fallbackContent = document.getElementById('download-fallback-content');
    const a = document.createElement('a');
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    if (fallback && fallbackLink && fallbackContent) {
        const previousUrl = fallbackLink.dataset.objectUrl;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        fallbackLink.href = url;
        fallbackLink.download = fileName;
        fallbackLink.dataset.objectUrl = url;
        fallbackContent.value = content;
        fallbackContent.textContent = content;
        fallback.style.display = 'block';
    }

    const isIOSWebKit = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOSWebKit) {
        return;
    }

    a.setAttribute('href', url);
    a.setAttribute('download', fileName);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();

    if (!fallbackLink) {
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
}

async function generateStatistics() {
    const rangeType = document.querySelector('input[name="stat-range"]:checked').value;
    const foodId = Number(document.getElementById('stat-food-select').value);
    
    if (!foodId) {
        alert("Please select a food item for analysis.");
        return;
    }

    let startStr = null;
    let endStr = null;

    if (rangeType === 'daterange') {
        startStr = document.getElementById('stat-start-date').value;
        endStr = document.getElementById('stat-end-date').value;
        if (!startStr || !endStr || startStr > endStr) {
            alert("Please provide a valid date range.");
            return;
        }
    }

    let allLogs = await getCachedDailyLogs();
    
    // Filter by date range if requested
    if (rangeType === 'daterange') {
        allLogs = allLogs.filter(log => log.date >= startStr && log.date <= endStr);
    }
    
    // Sort logs chronologically to calculate intervals properly
    allLogs.sort((a, b) => a.date.localeCompare(b.date));

    let totalConsumptions = 0;
    let mealCounts = { Breakfast: 0, Lunch: 0, Dinner: 0, 'Anytime Coffee': 0, 'Anytime Snack': 0 };
    let locationCounts = { home: 0, remote: 0 };
    
    // Dates this item was consumed
    let consumptionDates = [];

    const selectedFood = foodDictionary.find(f => f.id === foodId);
    const isIngredient = selectedFood && selectedFood.category === 'ingredient';

    for (const log of allLogs) {
        let eatenToday = false;
        
        const checkMealForStats = (mealName, mealData, foodIds) => {
            if (!foodIds || foodIds.length === 0) return;
            
            let matched = 0;
            if (isIngredient) {
                foodIds.forEach(id => {
                    const food = foodDictionary.find(f => f.id === id);
                    if (food && food.ingredientIds && food.ingredientIds.includes(foodId)) {
                        matched++;
                    }
                });
            } else {
                matched = foodIds.filter(id => id === foodId).length;
            }

            if (matched > 0) {
                // If it's an ingredient inside a meal, we might just want to count the meal once,
                // or count it for each food that contained it. The previous logic for Anytime Coffee 
                // added `matchingEntries.length` to `totalConsumptions`, but for breakfast/lunch/dinner 
                // it just did `totalConsumptions++` (once per meal). Let's stick to adding `matched` 
                // to total and `1` to meal/location for breakfast/lunch/dinner, or `matched` for all 
                // if we want to be exact. Let's just add `matched` to total/meal/location to be consistent.
                
                totalConsumptions += matched;
                mealCounts[mealName] += matched;
                locationCounts[mealData.location] = (locationCounts[mealData.location] || 0) + matched;
                eatenToday = true;
            }
        };

        // Check breakfast
        if (log.breakfast && !log.breakfast.skipped) {
            const ids = [...(log.breakfast.items || []), ...(log.breakfast.coffeeIds || []), ...(log.breakfast.drinkIds || [])];
            checkMealForStats('Breakfast', log.breakfast, ids);
        }
        
        // Check lunch
        if (log.lunch && !log.lunch.skipped) {
            const ids = [log.lunch.soupId, log.lunch.mainId, log.lunch.dessertId, ...(log.lunch.sideIds || []), ...(log.lunch.coffeeIds || []), ...(log.lunch.drinkIds || [])].filter(Boolean);
            checkMealForStats('Lunch', log.lunch, ids);
        }
        
        // Check dinner
        if (log.dinner && !log.dinner.skipped) {
            const ids = [log.dinner.soupId, log.dinner.mainId, log.dinner.dessertId, ...(log.dinner.sideIds || []), ...(log.dinner.coffeeIds || []), ...(log.dinner.drinkIds || [])].filter(Boolean);
            checkMealForStats('Dinner', log.dinner, ids);
        }

        // Check anytime coffee
        if (log.anytime_coffee && !log.anytime_coffee.skipped) {
            const ids = getAnytimeCoffeeEntriesFromMeal(log.anytime_coffee).map(e => e.id);
            checkMealForStats('Anytime Coffee', log.anytime_coffee, ids);
        }

        // Check anytime snack
        if (log.anytime_snack && !log.anytime_snack.skipped) {
            const ids = getAnytimeSnackEntriesFromMeal(log.anytime_snack).map(e => e.id);
            checkMealForStats('Anytime Snack', log.anytime_snack, ids);
        }
        
        if (eatenToday) {
            consumptionDates.push(new Date(log.date));
        }
    }

    // Display Results
    document.getElementById('statistics-results').style.display = 'block';
    document.getElementById('stat-total-count').textContent = totalConsumptions;

    // Meal Distribution
    const mealList = document.getElementById('stat-meal-dist');
    mealList.innerHTML = `
        <li>
            <span class="list-item-title">Breakfast</span>
            <span>${mealCounts.Breakfast}</span>
        </li>
        <li>
            <span class="list-item-title">Lunch</span>
            <span>${mealCounts.Lunch}</span>
        </li>
        <li>
            <span class="list-item-title">Dinner</span>
            <span>${mealCounts.Dinner}</span>
        </li>
        <li>
            <span class="list-item-title">Anytime Coffee</span>
            <span>${mealCounts['Anytime Coffee']}</span>
        </li>
        <li>
            <span class="list-item-title">Anytime Snack</span>
            <span>${mealCounts['Anytime Snack']}</span>
        </li>
    `;

    // Location Distribution (Time of Day context isn't tracked beyond meal, so we show Home/Remote as extra context)
    const timeList = document.getElementById('stat-time-dist');
    timeList.innerHTML = `
        <li>
            <span class="list-item-title">Home 🏠</span>
            <span>${locationCounts.home}</span>
        </li>
        <li>
            <span class="list-item-title">Remote 🌍</span>
            <span>${locationCounts.remote}</span>
        </li>
    `;

    // Interval Distribution
    const intervalList = document.getElementById('stat-interval-dist');
    if (consumptionDates.length < 2) {
        intervalList.innerHTML = `<li><span class="list-item-title" style="color: var(--text-secondary)">Not enough data to calculate intervals.</span></li>`;
    } else {
        let intervals = [];
        for (let i = 1; i < consumptionDates.length; i++) {
            const diffTime = Math.abs(consumptionDates[i] - consumptionDates[i-1]);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            intervals.push(diffDays);
        }
        
        const sum = intervals.reduce((a, b) => a + b, 0);
        const avg = (sum / intervals.length).toFixed(1);
        const min = Math.min(...intervals);
        const max = Math.max(...intervals);
        
        intervalList.innerHTML = `
            <li>
                <span class="list-item-title">Average Interval</span>
                <span>${avg} days</span>
            </li>
            <li>
                <span class="list-item-title">Shortest Interval</span>
                <span>${min} days</span>
            </li>
            <li>
                <span class="list-item-title">Longest Interval</span>
                <span>${max} days</span>
            </li>
        `;
    }
}

let distChart = null;
let distChartLeast = null;
let distributionTopData = [];
let distributionLeastData = [];
let distributionTopOffset = 0;
const DISTRIBUTION_PAGE_SIZE = 10;
const GRANULAR_DISTRIBUTIONS = [
    { key: 'breakfast_food', label: 'Breakfast Foods', topCanvasId: 'distribution-breakfast-food-chart', leastCanvasId: 'distribution-breakfast-food-chart-least' },
    { key: 'breakfast_coffee', label: 'Breakfast Coffees', topCanvasId: 'distribution-breakfast-coffee-chart', leastCanvasId: 'distribution-breakfast-coffee-chart-least' },
    { key: 'breakfast_drink', label: 'Breakfast Drinks', topCanvasId: 'distribution-breakfast-drink-chart', leastCanvasId: 'distribution-breakfast-drink-chart-least' },
    { key: 'soup', label: 'Soups', topCanvasId: 'distribution-soup-chart', leastCanvasId: 'distribution-soup-chart-least' },
    { key: 'main', label: 'Main Courses', topCanvasId: 'distribution-main-chart', leastCanvasId: 'distribution-main-chart-least' },
    { key: 'side', label: 'Side Dishes', topCanvasId: 'distribution-side-chart', leastCanvasId: 'distribution-side-chart-least' },
    { key: 'dessert', label: 'Desserts', topCanvasId: 'distribution-dessert-chart', leastCanvasId: 'distribution-dessert-chart-least' },
    { key: 'coffee', label: 'Coffees', topCanvasId: 'distribution-coffee-chart', leastCanvasId: 'distribution-coffee-chart-least' },
    { key: 'drink', label: 'Drinks', topCanvasId: 'distribution-drink-chart', leastCanvasId: 'distribution-drink-chart-least' }
];
const BREAKFAST_DISTRIBUTIONS = ['breakfast_food', 'breakfast_coffee', 'breakfast_drink'];
const LUNCH_DINNER_DISTRIBUTIONS = ['soup', 'main', 'side', 'dessert', 'coffee', 'drink'];
let granularDistributionState = {};
let granularDistributionCharts = {};

function getChartOptions() {
    const useLogScale = document.getElementById('dist-log-scale')?.checked;
    return {
        responsive: true,
        scales: {
            y: {
                type: useLogScale ? 'logarithmic' : 'linear',
                beginAtZero: !useLogScale,
                ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
                ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                grid: { display: false }
            }
        },
        plugins: {
            legend: { labels: { color: 'rgba(255, 255, 255, 0.87)' } }
        }
    };
}

function renderTopDistributionChart() {
    const ctxTop = document.getElementById('distribution-chart').getContext('2d');
    const topRangeLabel = document.getElementById('distribution-top-range');
    const btnNext = document.getElementById('btn-dist-next-top');
    const topData = distributionTopData.slice(distributionTopOffset, distributionTopOffset + DISTRIBUTION_PAGE_SIZE);
    const startRank = distributionTopOffset + 1;
    const endRank = distributionTopOffset + topData.length;

    if (distChart) distChart.destroy();

    distChart = new Chart(ctxTop, {
        type: 'bar',
        data: {
            labels: topData.map(item => item.name),
            datasets: [{
                label: `Consumption Frequency (Top ${startRank}-${endRank})`,
                data: topData.map(item => item.count),
                backgroundColor: 'rgba(187, 134, 252, 0.5)',
                borderColor: '#BB86FC',
                borderWidth: 1
            }]
        },
        options: getChartOptions()
    });

    if (topRangeLabel) {
        topRangeLabel.textContent = `Top ${startRank}-${endRank} of ${distributionTopData.length}`;
    }

    if (btnNext) {
        btnNext.disabled = distributionTopOffset + DISTRIBUTION_PAGE_SIZE >= distributionTopData.length;
    }
}

function showNextTopDistributionPage() {
    const nextOffset = distributionTopOffset + DISTRIBUTION_PAGE_SIZE;
    if (nextOffset >= distributionTopData.length) return;
    distributionTopOffset = nextOffset;
    renderTopDistributionChart();
}

function renderLeastDistributionChart() {
    const canvas = document.getElementById('distribution-chart-least');
    if (!canvas) return;

    if (distChartLeast) distChartLeast.destroy();

    distChartLeast = createDistributionChart(
        'distribution-chart-least',
        distributionLeastData,
        'Consumption Frequency (Least 10)',
        'rgba(3, 218, 198, 0.5)',
        '#03DAC6'
    );
}

function refreshDistributionScale() {
    const aggregateContainer = document.getElementById('distribution-aggregate-results');
    const granularContainer = document.getElementById('distribution-granular-results');

    if (aggregateContainer?.style.display !== 'none' && distributionTopData.length > 0) {
        renderTopDistributionChart();
        renderLeastDistributionChart();
    }

    if (granularContainer?.style.display !== 'none') {
        Object.keys(granularDistributionState).forEach(renderGranularDistributionChart);
    }
}

function destroyGranularDistributionCharts() {
    Object.values(granularDistributionCharts).forEach(chart => {
        if (chart) chart.destroy();
    });
    granularDistributionCharts = {};
}

function createDistributionChart(canvasId, data, label, backgroundColor, borderColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    if (typeof Chart !== 'function') {
        const host = canvas.parentElement;
        if (host) host.insertAdjacentHTML('beforeend', '<p style="font-size:0.8rem;color:var(--text-secondary);">Chart-Bibliothek lokal nicht verfügbar.</p>');
        return null;
    }
    return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.map(item => item.name),
            datasets: [{
                label,
                data: data.map(item => item.count),
                backgroundColor,
                borderColor,
                borderWidth: 1
            }]
        },
        options: getChartOptions()
    });
}

function renderGranularDistributionChart(categoryKey) {
    const config = GRANULAR_DISTRIBUTIONS.find(item => item.key === categoryKey);
    const state = granularDistributionState[categoryKey];
    if (!config || !state) return;

    const topData = state.data.slice(state.offset, state.offset + DISTRIBUTION_PAGE_SIZE);
    const leastData = state.data.slice(-DISTRIBUTION_PAGE_SIZE).reverse();
    const startRank = state.offset + 1;
    const endRank = state.offset + topData.length;
    const rangeLabel = document.getElementById(`distribution-${categoryKey}-range`);
    const nextButton = document.querySelector(`.btn-dist-next-granular[data-category="${categoryKey}"]`);

    if (granularDistributionCharts[`${categoryKey}Top`]) {
        granularDistributionCharts[`${categoryKey}Top`].destroy();
    }
    if (granularDistributionCharts[`${categoryKey}Least`]) {
        granularDistributionCharts[`${categoryKey}Least`].destroy();
    }

    granularDistributionCharts[`${categoryKey}Top`] = createDistributionChart(
        config.topCanvasId,
        topData,
        `${config.label} Frequency (Top ${startRank}-${endRank})`,
        'rgba(187, 134, 252, 0.5)',
        '#BB86FC'
    );

    granularDistributionCharts[`${categoryKey}Least`] = createDistributionChart(
        config.leastCanvasId,
        leastData,
        `${config.label} Frequency (Least 10)`,
        'rgba(3, 218, 198, 0.5)',
        '#03DAC6'
    );

    if (rangeLabel) {
        rangeLabel.textContent = `${config.label}: Top ${startRank}-${endRank} of ${state.data.length}`;
    }

    if (nextButton) {
        nextButton.disabled = state.offset + DISTRIBUTION_PAGE_SIZE >= state.data.length;
    }
}

function showNextGranularDistributionPage(categoryKey) {
    const state = granularDistributionState[categoryKey];
    if (!state) return;

    const nextOffset = state.offset + DISTRIBUTION_PAGE_SIZE;
    if (nextOffset >= state.data.length) return;

    state.offset = nextOffset;
    renderGranularDistributionChart(categoryKey);
}

function sortedDistributionData(foodCounts) {
    return Object.entries(foodCounts).map(([id, count]) => {
        return { name: getFoodName(Number(id)), count };
    }).sort((a, b) => b.count - a.count);
}

function addFoodCount(counts, id) {
    if (!id) return;
    counts[id] = (counts[id] || 0) + 1;
}

function addLunchDinnerCounts(meal, countsByCategory) {
    if (!meal || meal.skipped) return;

    addFoodCount(countsByCategory.soup, meal.soupId);
    addFoodCount(countsByCategory.main, meal.mainId);
    if (meal.sideIds) meal.sideIds.forEach(id => addFoodCount(countsByCategory.side, id));
    addFoodCount(countsByCategory.dessert, meal.dessertId);
    if (meal.coffeeIds) meal.coffeeIds.forEach(id => addFoodCount(countsByCategory.coffee, id));
    if (meal.drinkIds) meal.drinkIds.forEach(id => addFoodCount(countsByCategory.drink, id));
}

function addAnytimeCoffeeCounts(meal, counts) {
    getAnytimeCoffeeEntriesFromMeal(meal).forEach(entry => addFoodCount(counts, entry.id));
}

function addAnytimeSnackCounts(meal, counts) {
    getAnytimeSnackEntriesFromMeal(meal).forEach(entry => addFoodCount(counts, entry.id));
}

function renderGranularDistributionGroups(countsByCategory, categoryKeys) {
    const aggregateContainer = document.getElementById('distribution-aggregate-results');
    const granularContainer = document.getElementById('distribution-granular-results');

    granularDistributionState = {};
    destroyGranularDistributionCharts();

    let hasData = false;
    GRANULAR_DISTRIBUTIONS.forEach(config => {
        const chartGroup = document.querySelector(`.distribution-chart-group[data-category="${config.key}"]`);
        const data = categoryKeys.includes(config.key) ? sortedDistributionData(countsByCategory[config.key] || {}) : [];

        if (data.length === 0) {
            if (chartGroup) chartGroup.style.display = 'none';
            return;
        }

        hasData = true;
        if (chartGroup) chartGroup.style.display = 'block';
        granularDistributionState[config.key] = { data, offset: 0 };
    });

    if (!hasData) {
        alert("No food consumed in this range.");
        return;
    }

    if (distChart) distChart.destroy();
    if (distChartLeast) distChartLeast.destroy();
    if (aggregateContainer) aggregateContainer.style.display = 'none';
    if (granularContainer) granularContainer.style.display = 'block';
    document.getElementById('distribution-results').style.display = 'block';

    Object.keys(granularDistributionState).forEach(renderGranularDistributionChart);
}

function renderGranularBreakfastDistribution(allLogs) {
    const countsByCategory = { breakfast_food: {}, breakfast_coffee: {}, breakfast_drink: {} };

    for (const log of allLogs) {
        if (!log.breakfast || log.breakfast.skipped) continue;
        if (log.breakfast.items) log.breakfast.items.forEach(id => addFoodCount(countsByCategory.breakfast_food, id));
        if (log.breakfast.coffeeIds) log.breakfast.coffeeIds.forEach(id => addFoodCount(countsByCategory.breakfast_coffee, id));
        if (log.breakfast.drinkIds) log.breakfast.drinkIds.forEach(id => addFoodCount(countsByCategory.breakfast_drink, id));
    }

    renderGranularDistributionGroups(countsByCategory, BREAKFAST_DISTRIBUTIONS);
}

function renderGranularMealDistribution(allLogs, mealNames) {
    const countsByCategory = { soup: {}, main: {}, side: {}, dessert: {}, coffee: {}, drink: {} };

    for (const log of allLogs) {
        mealNames.forEach(mealName => addLunchDinnerCounts(log[mealName], countsByCategory));
    }

    renderGranularDistributionGroups(countsByCategory, LUNCH_DINNER_DISTRIBUTIONS);
}

async function generateDistribution() {
    const rangeType = document.querySelector('input[name="dist-range"]:checked').value;
    const mealFilter = document.querySelector('input[name="dist-meal"]:checked').value;
    
    let startStr = null;
    let endStr = null;

    if (rangeType === 'daterange') {
        startStr = document.getElementById('dist-start-date').value;
        endStr = document.getElementById('dist-end-date').value;
        if (!startStr || !endStr || startStr > endStr) {
            alert("Please provide a valid date range.");
            return;
        }
    }

    let allLogs = await getCachedDailyLogs();
    
    // Filter by date range if requested
    if (rangeType === 'daterange') {
        allLogs = allLogs.filter(log => log.date >= startStr && log.date <= endStr);
    }
    
    if (allLogs.length === 0) {
        alert("No logs found in this range.");
        return;
    }

    if (mealFilter === 'breakfast') {
        renderGranularBreakfastDistribution(allLogs);
        return;
    }

    if (mealFilter === 'lunch') {
        renderGranularMealDistribution(allLogs, ['lunch']);
        return;
    }

    if (mealFilter === 'dinner') {
        renderGranularMealDistribution(allLogs, ['dinner']);
        return;
    }

    if (mealFilter === 'lunch_dinner') {
        renderGranularMealDistribution(allLogs, ['lunch', 'dinner']);
        return;
    }

    if (mealFilter === 'ingredients') {
        let ingredientCounts = {};
        
        const countIngredientsFromFoods = (foodIds) => {
            if (!foodIds || foodIds.length === 0) return;
            foodIds.forEach(id => {
                const food = foodDictionary.find(f => f.id === id);
                if (food && food.ingredientIds) {
                    food.ingredientIds.forEach(ingId => addFoodCount(ingredientCounts, ingId));
                }
            });
        };

        for (const log of allLogs) {
            if (log.breakfast && !log.breakfast.skipped) {
                const ids = [...(log.breakfast.items || []), ...(log.breakfast.coffeeIds || []), ...(log.breakfast.drinkIds || [])];
                countIngredientsFromFoods(ids);
            }
            if (log.lunch && !log.lunch.skipped) {
                const ids = [log.lunch.soupId, log.lunch.mainId, log.lunch.dessertId, ...(log.lunch.sideIds || []), ...(log.lunch.coffeeIds || []), ...(log.lunch.drinkIds || [])].filter(Boolean);
                countIngredientsFromFoods(ids);
            }
            if (log.dinner && !log.dinner.skipped) {
                const ids = [log.dinner.soupId, log.dinner.mainId, log.dinner.dessertId, ...(log.dinner.sideIds || []), ...(log.dinner.coffeeIds || []), ...(log.dinner.drinkIds || [])].filter(Boolean);
                countIngredientsFromFoods(ids);
            }
            if (log.anytime_coffee && !log.anytime_coffee.skipped) {
                const ids = getAnytimeCoffeeEntriesFromMeal(log.anytime_coffee).map(e => e.id);
                countIngredientsFromFoods(ids);
            }
            if (log.anytime_snack && !log.anytime_snack.skipped) {
                const ids = getAnytimeSnackEntriesFromMeal(log.anytime_snack).map(e => e.id);
                countIngredientsFromFoods(ids);
            }
        }

        let sortedData = sortedDistributionData(ingredientCounts);
        
        if (sortedData.length === 0) {
            alert("No ingredients consumed in this range.");
            return;
        }

        distributionTopData = sortedData;
        distributionTopOffset = 0;
        distributionLeastData = sortedData.slice(-10).reverse();

        document.getElementById('distribution-results').style.display = 'block';
        document.getElementById('distribution-aggregate-results').style.display = 'block';
        document.getElementById('distribution-granular-results').style.display = 'none';
        destroyGranularDistributionCharts();
        renderTopDistributionChart();
        renderLeastDistributionChart();
        return;
    }

    // Tally consumptions per food ID
    let foodCounts = {};
    
    for (const log of allLogs) {
        // Breakfast
        if ((mealFilter === 'all' || mealFilter === 'breakfast' || mealFilter === 'coffee') && log.breakfast && !log.breakfast.skipped) {
            if (mealFilter !== 'coffee' && log.breakfast.items) log.breakfast.items.forEach(id => addFoodCount(foodCounts, id));
            if (log.breakfast.coffeeIds) log.breakfast.coffeeIds.forEach(id => addFoodCount(foodCounts, id));
            if (mealFilter !== 'coffee' && log.breakfast.drinkIds) log.breakfast.drinkIds.forEach(id => addFoodCount(foodCounts, id));
        }
        
        // Lunch
        if ((mealFilter === 'all' || mealFilter === 'coffee') && log.lunch && !log.lunch.skipped) {
            if (mealFilter !== 'coffee') {
                addFoodCount(foodCounts, log.lunch.soupId);
                addFoodCount(foodCounts, log.lunch.mainId);
                if (log.lunch.sideIds) log.lunch.sideIds.forEach(id => addFoodCount(foodCounts, id));
                addFoodCount(foodCounts, log.lunch.dessertId);
                if (log.lunch.drinkIds) log.lunch.drinkIds.forEach(id => addFoodCount(foodCounts, id));
            }
            if (log.lunch.coffeeIds) log.lunch.coffeeIds.forEach(id => addFoodCount(foodCounts, id));
        }
        
        // Dinner
        if ((mealFilter === 'all' || mealFilter === 'coffee') && log.dinner && !log.dinner.skipped) {
            if (mealFilter !== 'coffee') {
                addFoodCount(foodCounts, log.dinner.soupId);
                addFoodCount(foodCounts, log.dinner.mainId);
                if (log.dinner.sideIds) log.dinner.sideIds.forEach(id => addFoodCount(foodCounts, id));
                addFoodCount(foodCounts, log.dinner.dessertId);
                if (log.dinner.drinkIds) log.dinner.drinkIds.forEach(id => addFoodCount(foodCounts, id));
            }
            if (log.dinner.coffeeIds) log.dinner.coffeeIds.forEach(id => addFoodCount(foodCounts, id));
        }

        // Anytime Coffee
        if ((mealFilter === 'all' || mealFilter === 'coffee') && log.anytime_coffee && !log.anytime_coffee.skipped) {
            addAnytimeCoffeeCounts(log.anytime_coffee, foodCounts);
        }

        // Anytime Snack
        if ((mealFilter === 'all' || mealFilter === 'snack') && log.anytime_snack && !log.anytime_snack.skipped) {
            addAnytimeSnackCounts(log.anytime_snack, foodCounts);
        }
    }

    // Convert to array and sort
    let sortedData = sortedDistributionData(foodCounts);
    
    if (sortedData.length === 0) {
        alert("No food consumed in this range.");
        return;
    }

    distributionTopData = sortedData;
    distributionTopOffset = 0;

    // Take least 10 (sorted ascending for display)
    distributionLeastData = sortedData.slice(-10).reverse();

    document.getElementById('distribution-results').style.display = 'block';
    document.getElementById('distribution-aggregate-results').style.display = 'block';
    document.getElementById('distribution-granular-results').style.display = 'none';
    destroyGranularDistributionCharts();
    renderTopDistributionChart();
    renderLeastDistributionChart();
}

async function exportFullDistributionCSV() {
    let allLogs = await getCachedDailyLogs();
    
    if (allLogs.length === 0) {
        alert("No logs found to export.");
        return;
    }

    let foodCounts = {};
    
    // Tally all consumptions unconditionally
    for (const log of allLogs) {
        // Breakfast
        if (log.breakfast && !log.breakfast.skipped) {
            if (log.breakfast.items) log.breakfast.items.forEach(id => addFoodCount(foodCounts, id));
            if (log.breakfast.coffeeIds) log.breakfast.coffeeIds.forEach(id => addFoodCount(foodCounts, id));
            if (log.breakfast.drinkIds) log.breakfast.drinkIds.forEach(id => addFoodCount(foodCounts, id));
        }
        
        // Lunch
        if (log.lunch && !log.lunch.skipped) {
            addFoodCount(foodCounts, log.lunch.soupId);
            addFoodCount(foodCounts, log.lunch.mainId);
            if (log.lunch.sideIds) log.lunch.sideIds.forEach(id => addFoodCount(foodCounts, id));
            addFoodCount(foodCounts, log.lunch.dessertId);
            if (log.lunch.coffeeIds) log.lunch.coffeeIds.forEach(id => addFoodCount(foodCounts, id));
            if (log.lunch.drinkIds) log.lunch.drinkIds.forEach(id => addFoodCount(foodCounts, id));
        }
        
        // Dinner
        if (log.dinner && !log.dinner.skipped) {
            addFoodCount(foodCounts, log.dinner.soupId);
            addFoodCount(foodCounts, log.dinner.mainId);
            if (log.dinner.sideIds) log.dinner.sideIds.forEach(id => addFoodCount(foodCounts, id));
            addFoodCount(foodCounts, log.dinner.dessertId);
            if (log.dinner.coffeeIds) log.dinner.coffeeIds.forEach(id => addFoodCount(foodCounts, id));
            if (log.dinner.drinkIds) log.dinner.drinkIds.forEach(id => addFoodCount(foodCounts, id));
        }

        // Anytime Coffee
        if (log.anytime_coffee && !log.anytime_coffee.skipped) {
            addAnytimeCoffeeCounts(log.anytime_coffee, foodCounts);
        }

        // Anytime Snack
        if (log.anytime_snack && !log.anytime_snack.skipped) {
            addAnytimeSnackCounts(log.anytime_snack, foodCounts);
        }
    }

    let sortedData = Object.entries(foodCounts).map(([id, count]) => {
        return { name: getFoodName(Number(id)), count };
    }).sort((a, b) => b.count - a.count);

    if (sortedData.length === 0) {
        alert("No food consumed overall.");
        return;
    }

    let csvContent = "";
    sortedData.forEach(item => {
        csvContent += `${item.name};${item.count}\n`;
    });

    downloadFile(csvContent, 'food4me_overall_distribution.csv', 'text/csv;charset=utf-8;');
}

// --- Suggestions Logic ---

function initSuggestions() {
    const btnSuggestSoup = document.getElementById('btn-generate-lunch-soup-suggestion');
    if (btnSuggestSoup) {
        btnSuggestSoup.addEventListener('click', () => generateSuggestion('soup', 'suggestion-lunch-soup', 'soupId'));
    }
    const btnSuggestMain = document.getElementById('btn-generate-main-suggestion');
    if (btnSuggestMain) {
        btnSuggestMain.addEventListener('click', () => generateSuggestion('main', 'suggestion-main', 'mainId'));
    }
    const btnReshuffleSoup = document.getElementById('btn-reshuffle-lunch-soup');
    if (btnReshuffleSoup) {
        btnReshuffleSoup.addEventListener('click', () => generateSuggestion('soup', 'suggestion-lunch-soup', 'soupId'));
    }
    const btnReshuffleMain = document.getElementById('btn-reshuffle-main');
    if (btnReshuffleMain) {
        btnReshuffleMain.addEventListener('click', () => generateSuggestion('main', 'suggestion-main', 'mainId'));
    }
}

async function generateSuggestion(category, resultIdPrefix, checkField) {
    const items = foodDictionary.filter(f => f.category === category);
    if (items.length === 0) {
        alert(`You don't have any items in the ${category} category to suggest from!`);
        return;
    }

    const allLogs = await getCachedDailyLogs();
    const lastEaten = {};
    const consumptionCounts = {};

    for (const log of allLogs) {
        const dStr = log.date;
        
        const checkMeal = (meal) => {
            if (meal && !meal.skipped && meal[checkField]) {
                const id = meal[checkField];
                consumptionCounts[id] = (consumptionCounts[id] || 0) + 1;
                if (!lastEaten[id] || dStr > lastEaten[id]) {
                    lastEaten[id] = dStr;
                }
            }
        };
        
        checkMeal(log.lunch);
        checkMeal(log.dinner);
    }

    let neverEaten = items.filter(i => !lastEaten[i.id]).map(i => ({ id: i.id, count: 0, lastEaten: null }));
    
    // Shuffle neverEaten so that different ones appear when clicking reshuffle
    for (let i = neverEaten.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [neverEaten[i], neverEaten[j]] = [neverEaten[j], neverEaten[i]];
    }

    // Toggle reshuffle button if there are more than 10 not eaten
    const reshuffleBtn = document.getElementById(`btn-reshuffle-${resultIdPrefix.replace('suggestion-', '')}`);
    if (reshuffleBtn) {
        if (neverEaten.length > 10) {
            reshuffleBtn.style.display = 'inline-flex';
        } else {
            reshuffleBtn.style.display = 'none';
        }
    }
    
    const eatenItems = items.filter(i => lastEaten[i.id]).map(i => ({ 
        id: i.id, 
        count: consumptionCounts[i.id] || 0,
        lastEaten: lastEaten[i.id] 
    }));

    eatenItems.sort((a, b) => a.lastEaten.localeCompare(b.lastEaten)); // oldest first
    const oldest3 = eatenItems.slice(0, 3);
    
    // Random pool
    const poolIds = neverEaten.map(i => i.id).concat(oldest3.map(i => i.id));
    if (poolIds.length === 0) {
        // Fallback if something went wrong, just pick any
        poolIds.push(...items.map(i => i.id));
    }
    
    const randomId = poolIds[Math.floor(Math.random() * poolIds.length)];
    const foodName = getFoodName(randomId);
    
    // Results DOM
    const resultContainer = document.getElementById(`${resultIdPrefix}-result`);
    const resultName = document.getElementById(`${resultIdPrefix}-name`);
    
    if (resultContainer && resultName) {
        resultName.textContent = foodName;
        resultContainer.style.display = 'block';
    }

    // List logic (ranking: least/none occurrence to higher frequency)
    let listItems = neverEaten.concat(eatenItems);
    
    // Sort: count ascending, then lastEaten ascending (oldest) if count is same
    listItems.sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        if (!a.lastEaten && b.lastEaten) return -1;
        if (a.lastEaten && !b.lastEaten) return 1;
        if (!a.lastEaten && !b.lastEaten) return 0;
        return a.lastEaten.localeCompare(b.lastEaten);
    });

    const top10List = listItems.slice(0, 10);
    
    const listContainer = document.getElementById(`${resultIdPrefix}-list-container`);
    const listElement = document.getElementById(`${resultIdPrefix}-list`);
    
    if (listContainer && listElement) {
        listElement.innerHTML = top10List.map(item => {
            const name = getFoodName(item.id);
            const freqStr = item.count === 0 ? "Never tracked" : `Eaten ${item.count} times`;
            const dateStr = item.lastEaten ? `(Last: ${item.lastEaten})` : '';
            return `
                <li>
                    <div class="list-item-content">
                        <span class="list-item-title">${name}</span>
                        <span class="list-item-subtitle">${freqStr} ${dateStr}</span>
                    </div>
                </li>
            `;
        }).join('');
        listContainer.style.display = 'block';
    }
}
