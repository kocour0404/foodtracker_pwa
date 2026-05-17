const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NEW_BACKUP = path.join(ROOT, 'food4me_db_backup.json');
const OLD_BACKUP = path.join(ROOT, 'foodtracker-backup-2026-05-08.json');
const OUTPUT = path.join(ROOT, 'food4me_migrated_from_foodtracker_2026-05-08.json');
const REPORT = path.join(ROOT, 'food4me_migration_report_2026-05-08.json');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeName(value) {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u00df/g, 'ss')
        .replace(/\s+/g, ' ')
        .replace(/\s*\/\s*/g, '/')
        .replace(/[.,]/g, '')
        .trim();
}

const aliasByNormalizedName = {
    brot: 'chleba',
    brotchen: 'pecivo (bile)',
    musli: 'musli',
    sussgeback: 'buchta',
    curckela: 'churchela',
    'doner kebab': 'kebab',
    'hamburger/fastfood': 'fastfood',
    housticky: 'housticky zapecene',
    'pecene nudle/maso': 'pecene nudle',
    spargel: 'spargle',
    'frutti di mare/etc': 'frutti di mare',
    'zampiony ryze': 'ryze zampiony',
    'klare bruhe': 'bujon'
};

function emptyMeal(mealType) {
    if (mealType === 'breakfast') {
        return { skipped: true, location: 'home', items: [] };
    }

    return {
        skipped: true,
        location: 'home',
        soupId: null,
        mainId: null,
        sideIds: [],
        dessertId: null
    };
}

function createEmptyLog(date) {
    return {
        date,
        breakfast: emptyMeal('breakfast'),
        lunch: emptyMeal('lunch'),
        dinner: emptyMeal('dinner')
    };
}

function countSkippedMeals(log) {
    return ['breakfast', 'lunch', 'dinner'].filter((mealType) => log[mealType].skipped).length;
}

function main() {
    const newBackup = readJson(NEW_BACKUP);
    const oldBackup = readJson(OLD_BACKUP);

    const foodByCategoryAndName = new Map();
    for (const food of newBackup.foods) {
        foodByCategoryAndName.set(`${food.category}:${normalizeName(food.name)}`, food);
    }

    const oldCategoryByName = new Map();
    for (const list of oldBackup.lists || []) {
        for (const item of list.items || []) {
            oldCategoryByName.set(item, list.type);
        }
    }

    const skippedItems = [];
    const skippedSlotConflicts = [];
    const mappedItems = [];
    const logsByDate = new Map();

    function resolveFood(item) {
        const category = oldCategoryByName.get(item);
        if (!category) return null;

        const normalized = normalizeName(item);
        const targetName = aliasByNormalizedName[normalized] || normalized;
        return foodByCategoryAndName.get(`${category}:${targetName}`) || null;
    }

    for (const meal of oldBackup.meals || []) {
        if (!logsByDate.has(meal.date)) {
            logsByDate.set(meal.date, createEmptyLog(meal.date));
        }

        const log = logsByDate.get(meal.date);
        const mealType = meal.mealType;
        const targetMeal = mealType === 'breakfast'
            ? { skipped: false, location: 'home', items: [] }
            : {
                skipped: false,
                location: 'home',
                soupId: null,
                mainId: null,
                sideIds: [],
                dessertId: null
            };

        let mappedInMeal = 0;

        for (const item of meal.items || []) {
            const food = resolveFood(item);
            if (!food) {
                skippedItems.push({
                    date: meal.date,
                    mealType,
                    item,
                    reason: 'no matching food in new dictionary'
                });
                continue;
            }

            if (mealType === 'breakfast') {
                targetMeal.items.push(food.id);
                mappedInMeal += 1;
                mappedItems.push({ date: meal.date, mealType, item, foodId: food.id, foodName: food.name });
                continue;
            }

            if (food.category === 'soup') {
                if (targetMeal.soupId) {
                    skippedSlotConflicts.push({ date: meal.date, mealType, item, foodId: food.id, reason: 'additional soup cannot fit target format' });
                    continue;
                }
                targetMeal.soupId = food.id;
            } else if (food.category === 'main') {
                if (targetMeal.mainId) {
                    skippedSlotConflicts.push({ date: meal.date, mealType, item, foodId: food.id, reason: 'additional main cannot fit target format' });
                    continue;
                }
                targetMeal.mainId = food.id;
            } else if (food.category === 'side') {
                targetMeal.sideIds.push(food.id);
            } else if (food.category === 'dessert') {
                if (targetMeal.dessertId) {
                    skippedSlotConflicts.push({ date: meal.date, mealType, item, foodId: food.id, reason: 'additional dessert cannot fit target format' });
                    continue;
                }
                targetMeal.dessertId = food.id;
            } else {
                skippedItems.push({
                    date: meal.date,
                    mealType,
                    item,
                    reason: `category ${food.category} cannot be placed in ${mealType}`
                });
                continue;
            }

            mappedInMeal += 1;
            mappedItems.push({ date: meal.date, mealType, item, foodId: food.id, foodName: food.name });
        }

        if (mappedInMeal > 0) {
            log[mealType] = targetMeal;
        }
    }

    const logs = Array.from(logsByDate.values())
        .filter((log) => countSkippedMeals(log) < 3)
        .sort((a, b) => a.date.localeCompare(b.date));

    const migrated = {
        foods: newBackup.foods,
        logs
    };

    const skippedByItem = {};
    for (const skipped of skippedItems) {
        skippedByItem[skipped.item] = (skippedByItem[skipped.item] || 0) + 1;
    }

    const report = {
        source: path.basename(OLD_BACKUP),
        targetDictionary: path.basename(NEW_BACKUP),
        output: path.basename(OUTPUT),
        foodCount: newBackup.foods.length,
        oldMealCount: oldBackup.meals.length,
        migratedLogCount: logs.length,
        mappedItemCount: mappedItems.length,
        skippedUnmappedItemCount: skippedItems.length,
        skippedSlotConflictCount: skippedSlotConflicts.length,
        skippedByItem,
        skippedItems,
        skippedSlotConflicts
    };

    fs.writeFileSync(OUTPUT, JSON.stringify(migrated, null, 2) + '\n', 'utf8');
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8');

    console.log(JSON.stringify({
        output: path.basename(OUTPUT),
        report: path.basename(REPORT),
        foodCount: report.foodCount,
        oldMealCount: report.oldMealCount,
        migratedLogCount: report.migratedLogCount,
        mappedItemCount: report.mappedItemCount,
        skippedUnmappedItemCount: report.skippedUnmappedItemCount,
        skippedSlotConflictCount: report.skippedSlotConflictCount
    }, null, 2));
}

main();
