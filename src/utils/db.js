const DB_NAME = 'HtmlEditorDB';
const STORE_NAME = 'files';
const DB_VERSION = 1;

const openDB = () =>
  new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Tab blocked (close other tabs)'));
  });

export const getAllFilesDB = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error('DB Error:', err);
    return [];
  }
};


export const saveFileDBStrict = async (file) => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    let tx;

    try {
      tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(file);
    } catch (err) {
      db.close();
      reject(err);
      return;
    }

    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('DB write failed.'));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('Write operation aborted (storage might be full)'));
    };
  });
};


export const saveFileDB = async (file) => {
  try {
    return await saveFileDBStrict(file);
  } catch (err) {
    console.error('Save DB Error:', err);
    return false;
  }
};

export const deleteFileDB = async (id) => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.error('Delete DB Error:', err);
    return false;
  }
};