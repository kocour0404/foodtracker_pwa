# Food4Me - Project Plan

## 1. Overview
**Food4Me** is a pure HTML, CSS, and JavaScript web application designed to track daily food intake. It will feature a responsive, dark-themed Material Design interface and operate entirely client-side without a backend server, utilizing local storage (IndexedDB) for data persistence. 

## 2. Core Features
*   **Daily Logging:**
    *   **Breakfast:** Multiple choice selection from breakfast items.
    *   **Lunch & Dinner:** Both use the same structure:
        *   Soup (Single selection list)
        *   Main Course (Single selection list)
        *   Side Dish (Multiple selection list)
        *   Dessert (Single selection list)
    *   **Skip Meal:** Checkbox/Toggle to mark a meal as skipped for the day.
*   **Calendar View:** A calendar interface to navigate through days, see which days have entries, and select a date to view/edit its log.
*   **Search functionality:**
    *   By distinct food item (e.g., finding all dates where "Tomato Soup" was eaten).
    *   By date directly.
*   **Data Management:**
    *   Import/Export functionality for all food lists and daily logs (JSON format).
*   **Reporting:**
    *   Date-range reports showing detailed logs over a specified period.
    *   Statistical reports (e.g., most frequently eaten meals, percentage of skipped meals, favorite sides).

## 3. Architecture & Tech Stack
*   **Frontend UI:** Vanilla HTML5 and CSS3. We will implement a custom Material Design dark theme using CSS Variables for easy maintenance. No heavy frameworks (like React/Angular).
*   **Logic:** Vanilla JavaScript (ES6+ modules).
*   **Storage:** **IndexedDB** is chosen over `sessionStorage` or `localStorage`. 
    *   *Why IndexedDB?* It handles structured data better, has a larger storage limit, and allows for efficient querying (like searching for specific food items across all dates), which is necessary for the search and reporting features.

## 4. Data Model Design (IndexedDB)
The database will consist of two primary object stores:

**1. `Foods` (Food Dictionary)**
*   `id`: (Auto-incremented key)
*   `name`: String (e.g., "Pancakes", "Chicken Soup")
*   `category`: String (`breakfast`, `soup`, `main`, `side`, `dessert`)

**2. `DailyLogs` (Meal Tracking)**
*   `date`: String (Primary Key, format: "YYYY-MM-DD")
*   `breakfast`: Array of Food IDs (or `{ skipped: true }`)
*   `lunch`: Object `{ soupId, mainId, sideIds: [], dessertId, skipped: boolean }`
*   `dinner`: Object `{ soupId, mainId, sideIds: [], dessertId, skipped: boolean }`

## 5. UI/UX Design (Material Dark Theme)
*   **Colors:** Deep grays/blacks for backgrounds (`#121212`), elevated surfaces (`#1E1E1E`), with a primary accent color (e.g., Material Teal or Purple) for active states, buttons, and FABs (Floating Action Buttons).
*   **Typography:** Roboto or a clean sans-serif system font.
*   **Components:** Material design style cards for each meal section, floating labels for select dropdowns, toggles for "Skip Meal", and a grid-based responsive calendar.

## 6. Implementation Phases

### Phase 1: Setup & UI Prototyping
*   Set up project structure (`index.html`, `css/style.css`, `js/app.js`).
*   Implement the base dark Material theme (colors, typography, common components like buttons, inputs, cards).
*   Create the static HTML layout for the daily logging view.

### Phase 2: Database Initialization & Data Management
*   Implement the IndexedDB wrapper (handling open, upgrade, read, write).
*   Create a UI for managing food lists (Add/Edit/Delete distinct food items per category).
*   Pre-populate the database with some default placeholder foods.

### Phase 3: Core Application Logic
*   Bind the daily logging UI to the IndexedDB.
*   Implement loading a specific date's data into the form.
*   Implement saving the form data back to the database.
*   Implement the "Skip Meal" logic (disabling fields when checked).

### Phase 4: Navigation & Views
*   Implement the Calendar component for date selection.
*   Implement basic navigation between views (Daily Log, Calendar, Reports, Settings/Food Lists).

### Phase 5: Search & Reporting
*   Build the Search View: Query logs by food item ID.
*   Build the Date-Range Report View: Aggregate data between two dates.
*   Build the Statistics View: Calculate top items and meal skip frequencies.

### Phase 6: Import / Export & Polish
*   Implement JSON file generation for Export.
*   Implement file reading and IndexedDB population for Import.
*   Final responsive design tweaks, bug fixing, and transition animations.