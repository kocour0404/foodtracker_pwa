# Food4Me

## 1. Overview
**Food4Me** is a pure HTML, CSS, and JavaScript web application designed to track daily food intake. It features a responsive, dark-themed Material Design interface and operates entirely client-side without a backend server, utilizing local storage (IndexedDB) for data persistence. 

## 2. Core Features
*   **Daily Logging:**
    *   **Breakfast:** Multiple choice selection from breakfast items and coffees.
    *   **Lunch & Dinner:** Both use the same structure:
        *   Soup (Single selection list)
        *   Main Course (Single selection list)
        *   Side Dish (Multiple selection list)
        *   Dessert (Single selection list)
        *   Coffee (Multiple selection list)
    *   **Anytime Coffee:** A dedicated, always-visible card for tracking coffees consumed throughout the day independent of meals.
    *   **Anytime Snack:** A matching card for tracking snack-category items throughout the day with multiple time-stamped entries.
    *   **Skip Meal:** Checkbox/Toggle to mark a meal as skipped for the day.
    *   **Location:** Toggle whether the meal was eaten at Home 🏠 or Remote 🌍.
    *   **Food-Mood:** Optional 1-5 star mood rating plus internal note for Breakfast, Lunch, Dinner, and Anytime Snack, with a daily average shown in stars and percent.
    *   **Time-Aware Logging:** The UI dynamically shows or hides meals based on the current time of day.
    *   **Meal Summaries:** Once saved, meals are presented in a clean, read-only summary card with options to edit or delete.
    *   **Inline Date Navigation:** Quick previous and next day navigation directly from the daily view.
*   **Calendar View:** A calendar interface to navigate through days, see which days have entries, and select a date to view/edit its log.
*   **Vitality View:**
    *   Tracks ingredient groups ending in `+`, such as `G+`.
    *   Shows group vitality labels in the Calendar, Daily header, and next to the matching foods in meal summaries.
    *   Displays increasing, decreasing, or neutral trend states per group.
    *   Includes a dedicated Vitality page listing all tracked groups, latest hit date, and current streak details.
*   **Search functionality:**
    *   By distinct food item (e.g., finding all dates where "Tomato Soup" was eaten), replacing the need for direct date search by utilizing the robust Calendar view.
    *   By selected ingredients, with exact and partial match sections.
*   **Data Management:**
    *   **Food Dictionary Management:** Users can add and delete custom foods categorized by meal type.
    *   **Ingredient Groups:** Users can create ingredient groups and assign ingredients to them for vitality tracking.
    *   Import/Export functionality for all food lists and daily logs (JSON format & Custom CSV).
    *   Clear All Logs and Clear Entire Database options.
*   **Reporting & Statistics:**
    *   Date-range reports exportable as JSON and CSV.
    *   Statistical reports (most frequently eaten meals, meal distribution, time distribution, intervals).
    *   Cumulative food distribution charts with pagination (Top 10 / Next 10) and granular breakdowns by category (Soups, Main Courses, Side Dishes, Desserts).

## 3. Architecture & Tech Stack
*   **Frontend UI:** Vanilla HTML5 and CSS3. Uses a custom Material Design dark theme with CSS Variables for easy maintenance. No heavy frameworks (like React/Angular).
*   **Responsive UI:** Desktop top navigation switches to a labeled burger menu on small screens. Cards, forms, calendar cells, vitality chips, and report controls adapt for phone-sized layouts.
*   **Logic:** Vanilla JavaScript (ES6+ modules). Chart.js is vendored locally for distribution graphs; no CDN resources are required.
*   **Storage:** **IndexedDB** handles structured data, has a large storage limit, and allows for efficient querying (like searching for specific food items across all dates), which is necessary for the search and reporting features.
*   **Offline Shell:** A service worker caches the application shell for repeat visits.

## 4. License
This project is licensed under the Apache License 2.0. See [`LICENSE`](LICENSE) for details.

---

## Changelog & Implementation History

### ✅ Phase 0: Project Setup
*   Initialized Git repository.
*   Created standard `.gitignore`.
*   Drafted initial `food4me_plan.md`.

### ✅ Phase 1: Setup & UI Prototyping
*   Created core project structure (`index.html`, `css/style.css`, `js/app.js`).
*   Implemented custom Material Design dark theme using CSS variables.
*   Built daily logging layout with cards for Breakfast, Lunch, and Dinner.
*   Implemented "Skip Meal" UI toggle logic (disables form inputs).
*   **Phase 1.5:** Upgraded multi-select lists to use native HTML `<details>` and `<summary>` for collapsible behavior with animated expand icons.

### ✅ Phase 2: Database Initialization & Data Management
*   Created `js/db.js` wrapper for **IndexedDB** (`Food4MeDB`).
*   Implemented database initialization with object stores for `Foods` and `DailyLogs`.
*   Added auto-seeding for default food items on first launch.
*   Built the **Settings View** for managing the Food Dictionary (Add/Delete).
*   Implemented dynamic data binding: Daily Log dropdowns and checkboxes auto-populate directly from the database without page reloads.

### ✅ Phase 3: Core Application Logic
*   Bound the daily logging UI to the IndexedDB for saving and loading logs.
*   Implemented Date Navigation (Next/Prev day) with automatic log loading.
*   **Phase 3.5 (Time-Aware Logging):** 
    *   Added time-based visibility rules for the current day: Breakfast (< 11:00), Lunch (11:00 - 14:30), Dinner (> 14:30).
    *   Replaced the global Save FAB with individual meal "Save" buttons inside each card.
*   **Phase 3.7 (Meal Summary View):**
    *   Implemented a read-only summary view that replaces the form upon saving.
    *   Added meal-specific Material icons (breakfast_dining, lunch_dining, dinner_dining) to the summary.
    *   Added an "Edit" button to toggle back to the form view for adjustments.
    *   Added a "Delete" button adjacent to the Edit button to clear the meal's data and reset the form.

### ✅ Phase 4: Navigation & Views
*   Implemented the Calendar component for date selection.
*   Calendar auto-highlights today's date and shows a marker for days that have logged data.
*   Clicking a date in the calendar switches to the Daily Log view for that date.

### ✅ Phase 4.1: Meal Location
*   Added a "Remote" toggle to the header of each meal card in the Daily Log.
*   Allows classifying meals as "home" or "remote" (e.g., restaurant, vacation).
*   Extended the `DailyLogs` data model to persistently store the location state per meal.
*   Updated the Meal Summary view to display whether the meal was eaten at 🏠 (Home) or 🌍 (Remote).

### ✅ Phase 5: Search & Reporting
*   Built Search View (accessible via new Search icon in nav bar).
*   Users can select any atomic food item from the dictionary to query all logged occurrences.
*   Results indicate the date and the specific meal (e.g., Breakfast, Lunch) where the item was consumed.
*   Added a custom toggle to sort search results by date either ascending (Oldest First) or descending (Newest First).
*   Clicking a search result automatically navigates to that specific date in the Daily Log view.
*   Built Date-Range Report View (in Reports tab). Exports CSV (semicolon separated, no text qualifiers) and JSON formats based on user-selected date ranges.
*   Built Statistics View (in Reports tab). Users can select a specific food item and an analysis range (Overall or specific Date Range). Displays total consumptions, distribution across meals (Breakfast/Lunch/Dinner), location distribution (Home/Remote), and calculates intervals between consumptions (Average/Shortest/Longest).
*   Added "Cumulative Food Distribution" card. Generates bar charts using Chart.js showing the most and least frequently consumed food items overall or within a selected date range. Includes pagination (Top/Next 10) and granular category breakdowns (Soups, Main Courses, Sides, Desserts) when filtering by Lunch/Dinner. Also features a "Download Full CSV" button that exports the frequency of all logged items (no headers, semicolon delimited).

### ✅ Phase 5.5: Meal Suggestions
*   Built a dedicated Suggestions View (accessible via lightbulb icon in nav bar).
*   Contains generators for Lunch/Dinner Soups and Main Courses.
*   The suggestion algorithm selects an item dynamically from a pool consisting of items never eaten before, combined with the 3 least recently eaten items.
*   Below the random suggestion, displays a ranked list of 10 further suggestions ordered by least frequent/oldest first.
*   Added a "Reshuffle" button next to the "Further Suggestions" header. This button automatically appears if there are more than 10 untracked items, allowing the user to randomize and regenerate the top 10 list.

### ✅ Phase 5.7: Coffee Tracking
*   Introduced a new "Coffee" category.
*   Added Coffee selection lists directly inside the Breakfast, Lunch, and Dinner cards.
*   Created a dedicated "Anytime Coffee" card that is always visible in the Daily Log.

### ✅ Phase 5.8: Snack Tracking
*   Introduced a new "Snacks" category.
*   Created a dedicated "Anytime Snack" card for multi-entry snack logging with optional times.
*   Updated summary views, reports, statistics, and backup/restore logic to fully support granular coffee tracking across all meals and standalone consumptions.

### ✅ Phase 6: Import / Export & Polish
*   Implemented Database Backup & Restore in the Settings view.
*   Users can export the entire database (Food Dictionary + Daily Logs) to a single JSON or CSV file.
*   The CSV format is structured specifically (without headers, semicolon separated, no text qualifiers) to encapsulate both the food dictionary rows and the individual meal logs compactly.
*   Users can import either the JSON or CSV files to completely restore the database state.
*   Added a "Danger Zone" to Settings containing functions to "Clear All Logs" (deletes history, keeps foods) and "Clear Entire Database" (full factory reset including custom foods).

### ✅ Phase 7: Data Migration Tools
*   Created `scripts/convert-old-foodtracker-backup.js` as an offline utility.
*   The script safely parses legacy backup structures, maps old food names to the new dictionary structure using normalized aliases, and resolves category slot conflicts.
*   Generates a fully compliant Food4Me JSON backup file ready for immediate browser import, alongside a detailed migration report.

### ✅ Phase 8: Ingredients System
*   **Data Management:** Added the ability to define foods as "Ingredients" and assign them to other food items. Introduced an Edit Modal to update existing items.
*   **Search by Ingredients:** Enhanced the Search view with a toggle to search by multiple ingredients simultaneously. Results are split into "Exact Matches" (meals containing ALL selected ingredients) and "Partial Matches" (meals containing ANY selected ingredient), complete with auto-scroll anchor links and a floating scroll-to-top button.
*   **Statistics Integration:** Updated the Food Statistics view to extract and count ingredient consumptions dynamically from logged meals. Added a "Top Ingredients" chart to the Cumulative Distribution view.

### Completed: Ingredient Groups & Vitality
*   Added Ingredient Groups in Settings, including create, delete, edit, and ingredient assignment flows.
*   Added `groupIds` support for ingredients.
*   Added `+` group vitality labels in Calendar and Daily views.
*   Added inline vitality labels next to matching foods in Daily meal summaries.
*   Added Daily header trend chips for increasing, decreasing, or neutral vitality trends.
*   Added a dedicated Vitality page for all tracked `+` groups.

### Completed: Responsive Mobile UI
*   Converted the top navigation into a labeled burger menu on small screens.
*   Improved wrapping and spacing for Daily cards, summaries, vitality chips, Calendar labels, Reports controls, and chart containers.
*   Added mobile-focused CSS breakpoints while keeping the desktop layout intact.

### Completed: Food-Mood Ratings
*   Added optional 1-5 star Food-Mood ratings to Breakfast, Lunch, Dinner, and Anytime Snack.
*   Added a Daily header average that only includes captured ratings and shows stars plus percentage.
*   Added optional internal notes connected to rated Food-Mood entries and a Mood Notes page with rating and date filters.
*   Extended database backup CSV export/import to preserve Food-Mood ratings and notes while keeping older CSV files compatible.

### Completed: Licensing
*   Added Apache License 2.0.
