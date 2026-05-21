import { describe, test, expect } from "bun:test";
import { buildDbBackupCsv, calculateDailyFoodMoodRating, capGroupLabel, formatGroupLabel, getMoodNoteEntries, isMealEmpty, normalizeFoodMoodRating, parseDbBackupCsv } from "./app.js";

describe("isMealEmpty", () => {
    test("should return true if meal is null or undefined", () => {
        expect(isMealEmpty("breakfast", null, true)).toBe(true);
        expect(isMealEmpty("breakfast", undefined, true)).toBe(true);
    });

    test("should return false if meal is explicitly skipped", () => {
        const meal = { skipped: true };
        expect(isMealEmpty("breakfast", meal, true)).toBe(false);
    });

    describe("anytime_coffee", () => {
        test("should return true if anytime_coffee has no entries", () => {
            const meal = { entries: [] };
            expect(isMealEmpty("anytime_coffee", meal, false)).toBe(true);
        });

        test("should return true if anytime_coffee has invalid entries", () => {
            const meal = { entries: [ { id: null } ] };
            expect(isMealEmpty("anytime_coffee", meal, false)).toBe(true);
        });

        test("should return false if anytime_coffee has entries", () => {
            const meal = { entries: [{ id: 1, time: "10:00" }] };
            expect(isMealEmpty("anytime_coffee", meal, false)).toBe(false);
        });

        test("should return true if anytime_coffee is an empty object", () => {
            const meal = {};
            expect(isMealEmpty("anytime_coffee", meal, false)).toBe(true);
        });
    });

    describe("anytime_snack", () => {
        test("should return true if anytime_snack has no entries", () => {
            const meal = { entries: [] };
            expect(isMealEmpty("anytime_snack", meal, false)).toBe(true);
        });

        test("should return true if anytime_snack has invalid entries", () => {
            const meal = { entries: [ { id: null } ] };
            expect(isMealEmpty("anytime_snack", meal, false)).toBe(true);
        });

        test("should return false if anytime_snack has entries", () => {
            const meal = { entries: [{ id: 1, time: "15:00" }] };
            expect(isMealEmpty("anytime_snack", meal, false)).toBe(false);
        });
    });

    describe("breakfast", () => {
        test("should return true if breakfast has no items, coffeeIds, or drinkIds", () => {
            const meal = { items: [], coffeeIds: [], drinkIds: [] };
            expect(isMealEmpty("breakfast", meal, true)).toBe(true);
        });

        test("should return true if breakfast properties are missing", () => {
            const meal = {};
            expect(isMealEmpty("breakfast", meal, true)).toBe(true);
        });

        test("should return false if breakfast has items", () => {
            const meal = { items: [1] };
            expect(isMealEmpty("breakfast", meal, true)).toBe(false);
        });

        test("should return false if breakfast has coffeeIds", () => {
            const meal = { coffeeIds: [1] };
            expect(isMealEmpty("breakfast", meal, true)).toBe(false);
        });

        test("should return false if breakfast has drinkIds", () => {
            const meal = { drinkIds: [1] };
            expect(isMealEmpty("breakfast", meal, true)).toBe(false);
        });
    });

    describe("lunch/dinner", () => {
        test("should return true if lunch has no ids", () => {
            const meal = {
                soupId: "",
                mainId: "",
                sideIds: [],
                dessertId: "",
                coffeeIds: [],
                drinkIds: []
            };
            expect(isMealEmpty("lunch", meal, false)).toBe(true);
        });

        test("should return true if lunch properties are missing", () => {
            const meal = {};
            expect(isMealEmpty("lunch", meal, false)).toBe(true);
        });

        test("should return false if lunch has soupId", () => {
            const meal = { soupId: 1 };
            expect(isMealEmpty("lunch", meal, false)).toBe(false);
        });

        test("should return false if lunch has mainId", () => {
            const meal = { mainId: 1 };
            expect(isMealEmpty("lunch", meal, false)).toBe(false);
        });

        test("should return false if lunch has sideIds", () => {
            const meal = { sideIds: [1] };
            expect(isMealEmpty("lunch", meal, false)).toBe(false);
        });

        test("should return false if lunch has dessertId", () => {
            const meal = { dessertId: 1 };
            expect(isMealEmpty("lunch", meal, false)).toBe(false);
        });

        test("should return false if lunch has coffeeIds", () => {
            const meal = { coffeeIds: [1] };
            expect(isMealEmpty("lunch", meal, false)).toBe(false);
        });

        test("should return false if lunch has drinkIds", () => {
            const meal = { drinkIds: [1] };
            expect(isMealEmpty("lunch", meal, false)).toBe(false);
        });
    });
});

describe("database backup CSV", () => {
    test("round-trips groups and food relationships", () => {
        const foods = [
            { id: 1, name: "Lunch; Item", category: "main", ingredientIds: [10, 11], groupIds: [] },
            { id: 10, name: "Ingredient A", category: "ingredient", ingredientIds: [], groupIds: [100] },
            { id: 11, name: "Ingredient B", category: "ingredient", ingredientIds: [], groupIds: [100, 101] }
        ];
        const groups = [
            { id: 100, name: "G+" },
            { id: 101, name: "Quoted \"Group\"" }
        ];
        const logs = [
            {
                date: "2026-05-19",
                breakfast: { location: "home", skipped: false, items: [1], coffeeIds: [], drinkIds: [], moodRating: 4, moodNote: "Good start; light" },
                lunch: { location: "remote", skipped: false, soupId: null, mainId: 1, sideIds: [], dessertId: null, coffeeIds: [], drinkIds: [], moodRating: 5, moodNote: "Main was right" },
                anytime_snack: { location: "home", skipped: false, entries: [{ id: 1, time: "15:30" }], moodRating: 3, moodNote: "Too dry" }
            }
        ];

        const parsed = parseDbBackupCsv(buildDbBackupCsv(foods, groups, logs));

        expect(parsed.groups).toEqual(groups);
        expect(parsed.foods).toEqual(foods);
        expect(parsed.logs).toEqual([
            {
                date: "2026-05-19",
                breakfast: { location: "home", skipped: false, items: [1], coffeeIds: [], drinkIds: [], moodRating: 4, moodNote: "Good start; light" },
                lunch: { location: "remote", skipped: false, soupId: null, mainId: 1, sideIds: [], dessertId: null, coffeeIds: [], drinkIds: [], moodRating: 5, moodNote: "Main was right" },
                dinner: {},
                anytime_coffee: {},
                anytime_snack: { location: "home", skipped: false, entries: [{ id: 1, time: "15:30" }], moodRating: 3, moodNote: "Too dry" }
            }
        ]);
    });

    test("parses older CSV rows without mood ratings", () => {
        const parsed = parseDbBackupCsv("LB;2026-05-20;home;0;1;;\n");

        expect(parsed.logs[0].breakfast).toEqual({
            skipped: false,
            location: "home",
            items: [1],
            coffeeIds: [],
            drinkIds: []
        });
    });
});

describe("food mood ratings", () => {
    test("normalizes only 1-5 integer ratings", () => {
        expect(normalizeFoodMoodRating(1)).toBe(1);
        expect(normalizeFoodMoodRating("5")).toBe(5);
        expect(normalizeFoodMoodRating(0)).toBe(null);
        expect(normalizeFoodMoodRating(6)).toBe(null);
        expect(normalizeFoodMoodRating(3.5)).toBe(null);
        expect(normalizeFoodMoodRating("")).toBe(null);
    });

    test("averages only captured non-skipped food mood ratings", () => {
        expect(calculateDailyFoodMoodRating({
            breakfast: { skipped: false, moodRating: 5 },
            lunch: { skipped: false },
            dinner: { skipped: true, moodRating: 1 },
            anytime_snack: { skipped: false, moodRating: 3 },
            anytime_coffee: { skipped: false, moodRating: 1 }
        })).toEqual({
            average: 4,
            stars: 4,
            percentage: 80,
            count: 2
        });
    });

    test("returns null when no food mood rating was captured", () => {
        expect(calculateDailyFoodMoodRating({
            breakfast: { skipped: false },
            lunch: { skipped: true, moodRating: 4 }
        })).toBe(null);
    });

    test("lists only rated entries with notes", () => {
        const entries = getMoodNoteEntries([
            {
                date: "2026-05-21",
                breakfast: { skipped: false, items: [1], moodRating: 4, moodNote: "Nice" },
                lunch: { skipped: false, moodRating: 5 },
                dinner: { skipped: true, moodRating: 1, moodNote: "Ignored" },
                anytime_snack: { skipped: false, entries: [], moodRating: 2, moodNote: "Snack note" }
            }
        ]);

        expect(entries.map(entry => ({
            date: entry.date,
            mealName: entry.mealName,
            rating: entry.rating,
            percentage: entry.percentage,
            note: entry.note
        }))).toEqual([
            { date: "2026-05-21", mealName: "breakfast", rating: 4, percentage: 80, note: "Nice" },
            { date: "2026-05-21", mealName: "anytime_snack", rating: 2, percentage: 40, note: "Snack note" }
        ]);
    });
});

describe("vitality labels", () => {
    test("caps calendar labels without changing the source streak", () => {
        expect(formatGroupLabel("G", 4)).toBe("G++++");
        expect(formatGroupLabel("G", 5)).toBe("G+[5]");
        expect(formatGroupLabel("G", 12)).toBe("G+[12]");
        expect(formatGroupLabel("G", 4, 2)).toBe("G++");
        expect(formatGroupLabel("G", 12, 2)).toBe("G++");
        expect(capGroupLabel("G++++", 2)).toBe("G++");
        expect(capGroupLabel("G+[12]", 2)).toBe("G++");
        expect(capGroupLabel("Neutral", 2)).toBe("Neutral");
    });
});
