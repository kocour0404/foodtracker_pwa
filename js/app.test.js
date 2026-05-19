import { describe, test, expect } from "bun:test";
import { buildDbBackupCsv, capGroupLabel, formatGroupLabel, isMealEmpty, parseDbBackupCsv } from "./app.js";

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
                breakfast: { location: "home", skipped: false, items: [1], coffeeIds: [], drinkIds: [] },
                lunch: { location: "remote", skipped: false, soupId: null, mainId: 1, sideIds: [], dessertId: null, coffeeIds: [], drinkIds: [] }
            }
        ];

        const parsed = parseDbBackupCsv(buildDbBackupCsv(foods, groups, logs));

        expect(parsed.groups).toEqual(groups);
        expect(parsed.foods).toEqual(foods);
        expect(parsed.logs).toEqual([
            {
                date: "2026-05-19",
                breakfast: { location: "home", skipped: false, items: [1], coffeeIds: [], drinkIds: [] },
                lunch: { location: "remote", skipped: false, soupId: null, mainId: 1, sideIds: [], dessertId: null, coffeeIds: [], drinkIds: [] },
                dinner: {},
                anytime_coffee: {},
                anytime_snack: {}
            }
        ]);
    });
});

describe("vitality labels", () => {
    test("caps calendar labels without changing the source streak", () => {
        expect(formatGroupLabel("G", 4)).toBe("G++++");
        expect(formatGroupLabel("G", 4, 2)).toBe("G++");
        expect(capGroupLabel("G++++", 2)).toBe("G++");
        expect(capGroupLabel("Neutral", 2)).toBe("Neutral");
    });
});
