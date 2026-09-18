import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('http')
);
export const configuredSupabaseUrl = supabaseUrl || null;

const hasValidEnv = isSupabaseConfigured;

// Fallback in-memory & localStorage mock storage
const memoryStore = {};

export function getLocalStoreData(table) {
  return getTableData(table);
}

export function saveLocalStoreData(table, data) {
  setTableData(table, data);
}

function getTableData(table) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const item = window.localStorage.getItem(`cf_mock_${table}`);
      if (item) return JSON.parse(item);
    } catch {
      // ignore
    }
  }
  return memoryStore[table] || [];
}

function setTableData(table, data) {
  memoryStore[table] = data;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`cf_mock_${table}`, JSON.stringify(data));
    } catch {
      // ignore
    }
  }
}

function createMockQueryBuilder(table) {
  return {
    select(_columns = '*') {
      const runQuery = (sortCol, ascending = true) => {
        let rows = [...getTableData(table)];
        if (sortCol) {
          rows.sort((a, b) => {
            const va = a[sortCol] ?? '';
            const vb = b[sortCol] ?? '';
            if (va < vb) return ascending ? -1 : 1;
            if (va > vb) return ascending ? 1 : -1;
            return 0;
          });
        }
        return { data: rows, error: null };
      };

      const promise = Promise.resolve().then(() => runQuery());

      promise.order = (col, { ascending = true } = {}) => {
        return Promise.resolve().then(() => runQuery(col, ascending));
      };

      return promise;
    },

    async upsert(records) {
      const list = Array.isArray(records) ? records : [records];
      const existing = [...getTableData(table)];

      for (const rec of list) {
        const matchIdx = existing.findIndex((item) => {
          if (rec.id && item.id) return item.id === rec.id;
          if (rec.week_start && item.week_start) return item.week_start === rec.week_start;
          if (rec.indicador && item.indicador) return item.indicador === rec.indicador;
          if (rec.id_mes && item.id_mes) return item.id_mes === rec.id_mes;
          return false;
        });

        if (matchIdx >= 0) {
          existing[matchIdx] = { ...existing[matchIdx], ...rec };
        } else {
          existing.push(rec);
        }
      }

      setTableData(table, existing);
      return { data: list, error: null };
    },

    delete() {
      return {
        async eq(col, val) {
          const existing = getTableData(table);
          const filtered = existing.filter((item) => item[col] !== val);
          setTableData(table, filtered);
          return { data: null, error: null };
        },
        async not(col, op, val) {
          const existing = getTableData(table);
          let filtered = existing;
          if (op === 'is' && val === null) {
            filtered = existing.filter((item) => item[col] === null || item[col] === undefined);
          } else {
            filtered = [];
          }
          setTableData(table, filtered);
          return { data: null, error: null };
        },
      };
    },
  };
}

let realClient = null;
if (hasValidEnv) {
  try {
    realClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn('[AI Studio] Could not initialize Supabase client, using local store:', err);
  }
} else {
  console.info('[AI Studio] Running with persistent local storage mock for Supabase.');
}

export const supabase = {
  from(table) {
    if (!realClient) {
      return createMockQueryBuilder(table);
    }
    const realTable = realClient.from(table);
    return {
      select(...args) {
        const query = realTable.select(...args);
        const originalOrder = query.order ? query.order.bind(query) : null;

        const wrapPromise = (p) =>
          p.then(async (res) => {
            if (res.error) {
              console.warn(`[AI Studio] Supabase query failed for ${table}, falling back to local:`, res.error);
              return createMockQueryBuilder(table).select(...args);
            }
            
            // Si la base de datos de Supabase está vacía pero el usuario ya tenía datos
            // cargados en su navegador (localStorage), recuperamos los locales y los
            // subimos automáticamente a Supabase para sincronizarlos en la nube sin perder nada.
            const localData = getTableData(table);
            if ((!res.data || res.data.length === 0) && localData && localData.length > 0) {
              console.info(`[AI Studio] Subiendo ${localData.length} registros existentes de ${table} a Supabase...`);
              try {
                await realTable.upsert(localData);
              } catch (upErr) {
                console.warn(`[AI Studio] No se pudo migrar automáticamente a Supabase:`, upErr);
              }
              return { data: localData, error: null };
            }

            // Si hay datos en Supabase, además los respaldamos en local
            if (res.data && res.data.length > 0) {
              setTableData(table, res.data);
            }

            return res;
          }).catch((err) => {
            console.warn(`[AI Studio] Supabase network error on ${table}:`, err);
            return createMockQueryBuilder(table).select(...args);
          });

        const wrapped = wrapPromise(query);
        if (originalOrder) {
          wrapped.order = (...orderArgs) => wrapPromise(originalOrder(...orderArgs));
        }
        return wrapped;
      },

      async upsert(...args) {
        try {
          const res = await realTable.upsert(...args);
          if (res.error) {
            console.warn(`[AI Studio] Supabase upsert error on ${table}:`, res.error);
            return createMockQueryBuilder(table).upsert(...args);
          }
          return res;
        } catch (err) {
          console.warn(`[AI Studio] Supabase upsert network error on ${table}:`, err);
          return createMockQueryBuilder(table).upsert(...args);
        }
      },

      delete() {
        const delObj = realTable.delete ? realTable.delete() : null;
        return {
          async eq(col, val) {
            if (!delObj) return createMockQueryBuilder(table).delete().eq(col, val);
            try {
              const res = await delObj.eq(col, val);
              if (res.error) return createMockQueryBuilder(table).delete().eq(col, val);
              return res;
            } catch {
              return createMockQueryBuilder(table).delete().eq(col, val);
            }
          },
          async not(col, op, val) {
            if (!delObj) return createMockQueryBuilder(table).delete().not(col, op, val);
            try {
              const res = await delObj.not(col, op, val);
              if (res.error) return createMockQueryBuilder(table).delete().not(col, op, val);
              return res;
            } catch {
              return createMockQueryBuilder(table).delete().not(col, op, val);
            }
          },
        };
      },
    };
  },
};
