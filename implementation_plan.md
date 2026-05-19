# Food4Me - Implementation Plan & Progress

This document tracks the implemented features and the overall progress of the Food4Me project.

## ✅ Phase 0: Project Setup
*   Initialized Git repository.
*   Created standard `.gitignore`.
*   Drafted initial `food4me_plan.md`.

## ✅ Phase 1: Setup & UI Prototyping
*   Created core project structure (`index.html`, `css/style.css`, `js/app.js`).
*   Implemented custom Material Design dark theme using CSS variables.
*   Built daily logging layout with cards for Breakfast, Lunch, and Dinner.
*   Implemented "Skip Meal" UI toggle logic (disables form inputs).
*   **Phase 1.5:** Upgraded multi-select lists to use native HTML `<details>` and `<summary>` for collapsible behavior with animated expand icons.

## ✅ Phase 2: Database Initialization & Data Management
*   Created `js/db.js` wrapper for **IndexedDB** (`Food4MeDB`).
*   Implemented database initialization with object stores for `Foods` and `DailyLogs`.
*   Added auto-seeding for default food items on first launch.
*   Built the **Settings View** for managing the Food Dictionary (Add/Delete).
*   Implemented dynamic data binding: Daily Log dropdowns and checkboxes auto-populate directly from the database without page reloads.

## ✅ Phase 3: Core Application Logic
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

## ✅ Phase 4: Navigation & Views
*   Implemented the Calendar component for date selection.
*   Calendar auto-highlights today's date and shows a marker for days that have logged data.
*   Clicking a date in the calendar switches to the Daily Log view for that date.

## ✅ Phase 4.1: Meal Location
*   Added a "Remote" toggle to the header of each meal card in the Daily Log.
*   Allows classifying meals as "home" or "remote" (e.g., restaurant, vacation).
*   Extended the `DailyLogs` data model to persistently store the location state per meal.
*   Updated the Meal Summary view to display whether the meal was eaten at 🏠 (Home) or 🌍 (Remote).

## ✅ Phase 5: Search & Reporting
*   Built Search View (accessible via new Search icon in nav bar).
*   Users can select any atomic food item from the dictionary to query all logged occurrences.
*   Results indicate the date and the specific meal (e.g., Breakfast, Lunch) where the item was consumed.
*   Added a custom toggle to sort search results by date either ascending (Oldest First) or descending (Newest First).
*   Clicking a search result automatically navigates to that specific date in the Daily Log view.
*   Built Date-Range Report View (in Reports tab). Exports CSV (semicolon separated, no text qualifiers) and JSON formats based on user-selected date ranges.
*   Built Statistics View (in Reports tab). Users can select a specific food item and an analysis range (Overall or specific Date Range). Displays total consumptions, distribution across meals (Breakfast/Lunch/Dinner), location distribution (Home/Remote), and calculates intervals between consumptions (Average/Shortest/Longest).
*   Added "Cumulative Food Distribution" card. Generates two bar charts using Chart.js showing the Top 10 and Least 10 most frequently consumed food items overall or within a selected date range. Includes a Meal Filter (All, Breakfast, Lunch/Dinner) to isolate distribution calculations. Also features a "Download Full CSV" button that exports the frequency of all logged items (no headers, semicolon delimited).

## ✅ Phase 5.7: Coffee Tracking
*   Introduced a new "Coffee" category in the food dictionary.
*   Added Coffee selection lists directly inside the Breakfast, Lunch, and Dinner cards for meal-context tracking.
*   Created a dedicated "Anytime Coffee" card that is always visible in the Daily Log for standalone consumption.

## ✅ Phase 5.8: Snack Tracking
*   Introduced a new "Snacks" category in the food dictionary.
*   Added a dedicated "Anytime Snack" card that mirrors the multi-entry, time-aware standalone logging pattern.
*   Updated summary views, reports, statistics, and backup/restore logic to fully support coffee tracking.

## ✅ Phase 6: Import / Export & Polish
*   Implemented Database Backup & Restore in the Settings view.
*   Users can export the entire database (Food Dictionary + Ingredient Groups + Daily Logs) to a single JSON or CSV file.
*   The CSV format is structured specifically (without headers, semicolon separated) to encapsulate ingredient group rows, food dictionary rows with ingredient/group mappings, and individual meal logs compactly.
*   Users can import either the JSON or CSV files to completely restore the database state, including ingredient groups and vitality mappings.
*   Added a "Danger Zone" to Settings containing functions to "Clear All Logs" (deletes history, keeps foods) and "Clear Entire Database" (full factory reset including custom foods).

## ✅ Phase 8: Ingredients System
*   **Data Management:** Added the ability to define foods as "Ingredients" and assign them to other food items. Introduced an Edit Modal to update existing items.
*   **Search by Ingredients:** Enhanced the Search view with a toggle to search by multiple ingredients simultaneously. Results are split into "Exact Matches" (meals containing ALL selected ingredients) and "Partial Matches" (meals containing ANY selected ingredient), complete with auto-scroll anchor links and a floating scroll-to-top button.
*   **Statistics Integration:** Updated the Food Statistics view to extract and count ingredient consumptions dynamically from logged meals. Added a "Top Ingredients" chart to the Cumulative Distribution view.

## Completed: Ingredient Groups & Vitality
*   Added Ingredient Groups as a dedicated Settings section, including group creation, deletion, editing, and ingredient assignment.
*   Extended ingredient records with `groupIds` so ingredients can belong to one or more groups such as `G+`.
*   Added vitality labels for `+` groups in the Calendar and Daily views.
*   Added inline vitality labels next to matching foods in Daily meal summaries, so users can see which food caused a group hit.
*   Added a Daily Header vitality trend indicator per `+` group:
    *   Hit on the selected day: increasing trend.
    *   Last hit exactly one day before the selected day: decreasing trend.
    *   Last hit two or more days before the selected day, or no hit yet: neutral trend.
*   Capped Calendar vitality labels at `++` for compact display while preserving the full streak count for Daily and Vitality trend state.
*   Updated trend colors: increasing `+`/`++` and all decreasing states are yellow, increasing `+++` and above is red, and neutral is green.
*   Added a dedicated Vitality view listing all tracked `+` groups with trend state, latest hit date, and streak details.

## Completed: Responsive Mobile UI
*   Reworked the top navigation into a burger menu on small screens.
*   Added labeled mobile navigation items so the menu remains usable without hover tooltips.
*   Tightened spacing and wrapping for Daily cards, meal summaries, vitality chips, Calendar labels, Reports controls, and chart containers.
*   Added responsive CSS breakpoints for phone-sized layouts while preserving the desktop navigation and card layout.
*   Bumped the service worker cache versions across UI changes to ensure updated HTML/CSS/JS assets are delivered.

## Completed: Licensing
*   Added an Apache License 2.0 project license.
