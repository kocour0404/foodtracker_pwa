const DB_NAME = 'Food4MeDB';
const DB_VERSION = 2;

export const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Create Foods dictionary store
            if (!db.objectStoreNames.contains('Foods')) {
                const foodStore = db.createObjectStore('Foods', { keyPath: 'id', autoIncrement: true });
                foodStore.createIndex('category', 'category', { unique: false });
            }
            // Create DailyLogs store
            if (!db.objectStoreNames.contains('DailyLogs')) {
                db.createObjectStore('DailyLogs', { keyPath: 'date' });
            }
            // Create IngredientGroups store
            if (!db.objectStoreNames.contains('IngredientGroups')) {
                db.createObjectStore('IngredientGroups', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

export const seedDefaultFoods = async (db) => {
    const defaultFoods = [
        { name: 'Pancakes', category: 'breakfast' },
        { name: 'Oatmeal', category: 'breakfast' },
        { name: 'Eggs', category: 'breakfast' },
        { name: 'Toast', category: 'breakfast' },
        { name: 'Cereal', category: 'breakfast' },
        { name: 'Tomato Soup', category: 'soup' },
        { name: 'Chicken Noodle Soup', category: 'soup' },
        { name: 'Grilled Chicken', category: 'main' },
        { name: 'Pasta', category: 'main' },
        { name: 'Salad', category: 'side' },
        { name: 'Rice', category: 'side' },
        { name: 'Potatoes', category: 'side' },
        { name: 'Bread', category: 'side' },
        { name: 'Ice Cream', category: 'dessert' },
        { name: 'Fruit', category: 'dessert' },
        { name: 'Espresso', category: 'coffee' },
        { name: 'Mokka', category: 'coffee' },
        { name: 'Türkisch', category: 'coffee' },
        { name: 'Cappuccino', category: 'coffee' },
        { name: 'Filter', category: 'coffee' },
        { name: 'Instant', category: 'coffee' },
        { name: 'Nuts', category: 'snack' },
        { name: 'Chips', category: 'snack' },
        { name: 'Crackers', category: 'snack' },
        { name: 'O-Saft', category: 'drink' },
        { name: 'Bier', category: 'drink' },
        { name: 'Sekt', category: 'drink' },
        { name: 'Wein', category: 'drink' },
        { name: 'Ayran', category: 'drink' },
        { name: 'Ziegenmilch', category: 'drink' },
        { name: 'Kefir', category: 'drink' },
    ];

    const tx = db.transaction('Foods', 'readwrite');
    const store = tx.objectStore('Foods');
    const countRequest = store.count();

    return new Promise((resolve, reject) => {
        countRequest.onsuccess = () => {
            if (countRequest.result === 0) {
                defaultFoods.forEach(food => store.add(food));
                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => reject(e.target.error);
            } else {
                resolve(false); // Already seeded
            }
        };
        countRequest.onerror = (e) => reject(e.target.error);
    });
};

export const getAllFoods = async (db) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('Foods', 'readonly');
        const store = tx.objectStore('Foods');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const addFood = async (db, food) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('Foods', 'readwrite');
        const store = tx.objectStore('Foods');
        const request = store.add(food);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const editFood = async (db, food) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('Foods', 'readwrite');
        const store = tx.objectStore('Foods');
        const request = store.put(food);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const deleteFood = async (db, id) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('Foods', 'readwrite');
        const store = tx.objectStore('Foods');
        const request = store.delete(Number(id));

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
};

// Future use for saving daily logs
export const saveDailyLog = async (db, logData) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('DailyLogs', 'readwrite');
        const store = tx.objectStore('DailyLogs');
        const request = store.put(logData);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getDailyLog = async (db, date) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('DailyLogs', 'readonly');
        const store = tx.objectStore('DailyLogs');
        const request = store.get(date);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const deleteDailyLog = async (db, date) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('DailyLogs', 'readwrite');
        const store = tx.objectStore('DailyLogs');
        const request = store.delete(date);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getAllLoggedDates = async (db) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('DailyLogs', 'readonly');
        const store = tx.objectStore('DailyLogs');
        const request = store.getAllKeys();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getAllDailyLogs = async (db) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('DailyLogs', 'readonly');
        const store = tx.objectStore('DailyLogs');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getAllIngredientGroups = async (db) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('IngredientGroups', 'readonly');
        const store = tx.objectStore('IngredientGroups');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const addIngredientGroup = async (db, group) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('IngredientGroups', 'readwrite');
        const store = tx.objectStore('IngredientGroups');
        const request = store.add(group);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const editIngredientGroup = async (db, group) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('IngredientGroups', 'readwrite');
        const store = tx.objectStore('IngredientGroups');
        const request = store.put(group);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const deleteIngredientGroup = async (db, id) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('IngredientGroups', 'readwrite');
        const store = tx.objectStore('IngredientGroups');
        const request = store.delete(Number(id));

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const clearDB = async (db) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['Foods', 'DailyLogs', 'IngredientGroups'], 'readwrite');
        const foodsStore = tx.objectStore('Foods');
        const logsStore = tx.objectStore('DailyLogs');
        const groupsStore = tx.objectStore('IngredientGroups');
        foodsStore.clear();
        logsStore.clear();
        groupsStore.clear();
        
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
    });
};

export const clearAllLogs = async (db) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('DailyLogs', 'readwrite');
        const store = tx.objectStore('DailyLogs');
        store.clear();

        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
    });
};
