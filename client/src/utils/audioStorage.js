// Sistema de Persistencia en Disco Local (IndexedDB) para grabaciones de ProActur
// Actúa como "Caja Negra": guarda cada segundo de audio para recuperación ante fallos o refrescos.

const CURRENT_DB = 'ProActurRecordingDB';
const LEGACY_DBS = ['ProactorRecordingDB'];
const DB_VERSION = 1;
const STORE_CHUNKS = 'chunks';
const STORE_META = 'metadata';

function openSpecificDB(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        db.createObjectStore(STORE_CHUNKS, { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDB() {
  return openSpecificDB(CURRENT_DB);
}

export async function initEmergencyRecording(title = '', sessionId = null) {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
    tx.objectStore(STORE_CHUNKS).clear();
    tx.objectStore(STORE_META).delete('liveSnapshot');
    tx.objectStore(STORE_META).put({
      id: sessionId || ('meet_live_' + Date.now()),
      startTime: Date.now(),
      title,
      recovered: false
    }, 'activeSession');
    return true;
  } catch (err) {
    console.warn('[Storage] Error iniciando caja negra:', err);
    return false;
  }
}

export async function saveLiveSessionSnapshot(snapshot) {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_META], 'readwrite');
    tx.objectStore(STORE_META).put({
      ...snapshot,
      updatedAt: Date.now()
    }, 'liveSnapshot');
    // Backup ligero adicional en localStorage por redundancia extrema
    try {
      localStorage.setItem('proactur_live_snapshot_backup', JSON.stringify({
        ...snapshot,
        updatedAt: Date.now()
      }));
    } catch (_) {}
    return true;
  } catch (err) {
    console.warn('[Storage] Error guardando snapshot en vivo:', err);
    return false;
  }
}

export async function getLiveSessionSnapshot() {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_META)) return null;
    const tx = db.transaction([STORE_META], 'readonly');
    const req = tx.objectStore(STORE_META).get('liveSnapshot');
    const res = await new Promise((resolve) => {
      tx.oncomplete = () => resolve(req.result || null);
      tx.onerror = () => resolve(null);
    });
    if (res) return res;
  } catch (_) {}
  try {
    const raw = localStorage.getItem('proactur_live_snapshot_backup');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function appendAudioChunk(chunkBlob) {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
    const store = tx.objectStore(STORE_CHUNKS);
    store.add(chunkBlob);
    tx.objectStore(STORE_META).put({ lastUpdated: Date.now() }, 'lastPing');

    // Ventana rodante de hasta 1800 chunks (~30 min de audio crudo reciente) para evitar saturar disco en jornadas de 8-12h
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > 1800) {
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (cursor) cursor.delete();
        };
      }
    };
  } catch (err) {
    console.warn('[Storage] Error guardando fragmento:', err);
  }
}

// Comprueba la base de datos actual y cualquier base de datos previa (Proactor / ProActur)
export async function checkUnfinalizedRecording() {
  const dbsToCheck = [CURRENT_DB, ...LEGACY_DBS];

  for (const dbName of dbsToCheck) {
    try {
      const db = await openSpecificDB(dbName);
      if (!db.objectStoreNames.contains(STORE_CHUNKS) || !db.objectStoreNames.contains(STORE_META)) {
        continue;
      }

      const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readonly');
      const chunksStore = tx.objectStore(STORE_CHUNKS);
      const metaStore = tx.objectStore(STORE_META);

      const metaReq = metaStore.get('activeSession');
      const snapReq = metaStore.get('liveSnapshot');
      const countReq = chunksStore.count();

      const result = await new Promise((resolve) => {
        tx.oncomplete = () => {
          const count = countReq.result || 0;
          const meta = metaReq.result;
          const snapshot = snapReq.result;
          const hasSnapshotText = Boolean(snapshot && ((snapshot.transcript || '').trim().length > 20 || (snapshot.summary || '').trim().length > 20));
          if ((count > 2 && meta) || hasSnapshotText) {
            resolve({
              hasUnfinalized: true,
              chunkCount: count,
              meta,
              snapshot,
              hasSnapshotText,
              dbSource: dbName
            });
          } else {
            resolve({ hasUnfinalized: false });
          }
        };
        tx.onerror = () => resolve({ hasUnfinalized: false });
      });

      if (result.hasUnfinalized) {
        return result;
      }
    } catch (_) {}
  }

  return { hasUnfinalized: false };
}

export async function recoverUnfinalizedAudio() {
  const dbsToCheck = [CURRENT_DB, ...LEGACY_DBS];

  for (const dbName of dbsToCheck) {
    try {
      const db = await openSpecificDB(dbName);
      if (!db.objectStoreNames.contains(STORE_CHUNKS) || !db.objectStoreNames.contains(STORE_META)) {
        continue;
      }

      const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readonly');
      const chunksStore = tx.objectStore(STORE_CHUNKS);
      const metaStore = tx.objectStore(STORE_META);

      const getAllChunks = chunksStore.getAll();
      const metaReq = metaStore.get('activeSession');
      const snapReq = metaStore.get('liveSnapshot');

      const recovery = await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          const chunks = getAllChunks.result || [];
          const meta = metaReq.result || {};
          const snapshot = snapReq.result || null;
          if (chunks.length === 0 && !snapshot) {
            resolve(null);
            return;
          }
          const combinedBlob = chunks.length > 0 ? new Blob(chunks, { type: 'audio/webm' }) : null;
          resolve({
            blob: combinedBlob,
            snapshot,
            title: snapshot?.title || meta.title || 'Reunión Recuperada de Caja Negra',
            startTime: meta.startTime
          });
        };
        tx.onerror = () => reject(tx.error);
      });

      if (recovery && (recovery.blob || recovery.snapshot)) {
        return recovery;
      }
    } catch (err) {
      console.warn('[Storage] Error verificando ' + dbName, err);
    }
  }

  return null;
}

export async function clearEmergencyRecording() {
  try {
    localStorage.removeItem('proactur_live_snapshot_backup');
  } catch (_) {}
  const dbsToClear = [CURRENT_DB, ...LEGACY_DBS];
  for (const dbName of dbsToClear) {
    try {
      const db = await openSpecificDB(dbName);
      if (db.objectStoreNames.contains(STORE_CHUNKS) && db.objectStoreNames.contains(STORE_META)) {
        const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
        tx.objectStore(STORE_CHUNKS).clear();
        tx.objectStore(STORE_META).clear();
      }
    } catch (_) {}
  }
}
