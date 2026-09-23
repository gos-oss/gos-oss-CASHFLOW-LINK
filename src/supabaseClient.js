import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://kbmbdvcawbhumlyjxkam.supabase.co';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtibWJkdmNhd2JodW1seWp4a2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzM4ODYsImV4cCI6MjEwMTk0OTg4Nn0.b75eLNTYpyby27jBh6IdblZo1RiUi4_zdAKMT-b6hZY';

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

// Tablas virtuales respaldadas centralmente en la tabla 'cashflow_plan' de Supabase
// Permiten sincronización multiusuario en la nube sin requerir DDL adicional en PostgreSQL
const VIRTUAL_PLAN_TABLES = {
  cf_indice_link: {
    planId: 'cf_indice_link',
    arrayKey: 'records',
    idKey: 'id_mes',
    localKey: 'cf_indice_link_data',
  },
  stock_units: {
    planId: 'stock_units',
    arrayKey: 'units',
    idKey: 'id',
    localKey: 'cf_stock_unidades_v2',
  },
};

function createVirtualPlanBuilder(tableConfig, client) {
  const { planId, arrayKey, idKey, localKey } = tableConfig;

  const readLocal = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(localKey);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return memoryStore[localKey] || [];
  };

  const writeLocal = (list) => {
    memoryStore[localKey] = list;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(localKey, JSON.stringify(list));
      } catch {}
    }
  };

  return {
    select(_columns = '*') {
      const fetchList = async (sortCol, ascending = true) => {
        let items = [];
        if (client) {
          try {
            const { data, error } = await client
              .from('cashflow_plan')
              .select('*')
              .eq('id', planId);

            if (!error && data && data.length > 0 && data[0].data && Array.isArray(data[0].data[arrayKey])) {
              items = data[0].data[arrayKey];
            }

            // Si en Supabase todavía no hay registros pero el usuario que entra tiene datos
            // guardados localmente en su navegador, los subimos de inmediato a Supabase
            // para que todos los demás usuarios en sus computadoras los puedan ver.
            if (items.length === 0) {
              const localItems = readLocal();
              if (localItems && localItems.length > 0) {
                console.info(`[AI Studio] Subiendo ${localItems.length} registros existentes de ${planId} a Supabase...`);
                try {
                  await client.from('cashflow_plan').upsert({
                    id: planId,
                    data: { [arrayKey]: localItems },
                    updated_at: new Date().toISOString(),
                  });
                  items = localItems;
                } catch (err) {
                  console.warn(`[AI Studio] Error al migrar ${planId} a Supabase:`, err);
                  items = localItems;
                }
              }
            } else {
              // Mantener réplica local actualizada
              writeLocal(items);
            }
          } catch (e) {
            console.warn(`[AI Studio] Error de red consultando ${planId} en Supabase:`, e);
            items = readLocal();
          }
        } else {
          items = readLocal();
        }

        const sorted = [...items];
        if (sortCol) {
          sorted.sort((a, b) => {
            const va = a[sortCol] ?? '';
            const vb = b[sortCol] ?? '';
            if (va < vb) return ascending ? -1 : 1;
            if (va > vb) return ascending ? 1 : -1;
            return 0;
          });
        }
        return { data: sorted, error: null };
      };

      const promise = Promise.resolve().then(() => fetchList());
      promise.order = (col, { ascending = true } = {}) => {
        return Promise.resolve().then(() => fetchList(col, ascending));
      };
      return promise;
    },

    async upsert(records) {
      const list = Array.isArray(records) ? records : [records];
      let currentItems = [];

      if (client) {
        try {
          const { data } = await client.from('cashflow_plan').select('*').eq('id', planId);
          if (data && data.length > 0 && data[0].data && Array.isArray(data[0].data[arrayKey])) {
            currentItems = data[0].data[arrayKey];
          }
        } catch {}
      }
      if (currentItems.length === 0) {
        currentItems = readLocal();
      }

      // Merge por clave primaria
      const merged = [...currentItems];
      for (const rec of list) {
        const idx = merged.findIndex((x) => rec[idKey] && x[idKey] === rec[idKey]);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], ...rec };
        } else {
          merged.push(rec);
        }
      }

      if (client) {
        try {
          await client.from('cashflow_plan').upsert({
            id: planId,
            data: { [arrayKey]: merged },
            updated_at: new Date().toISOString(),
          });
        } catch (err) {
          console.warn(`[AI Studio] Error al guardar ${planId} en Supabase:`, err);
        }
      }

      writeLocal(merged);
      return { data: merged, error: null };
    },

    async setAll(newList) {
      const list = Array.isArray(newList) ? newList : [];
      if (client) {
        try {
          await client.from('cashflow_plan').upsert({
            id: planId,
            data: { [arrayKey]: list },
            updated_at: new Date().toISOString(),
          });
        } catch (err) {
          console.warn(`[AI Studio] Error al sobrescribir ${planId} en Supabase:`, err);
        }
      }
      writeLocal(list);
      return { data: list, error: null };
    },

    delete() {
      return {
        async eq(col, val) {
          let currentItems = [];
          if (client) {
            try {
              const { data } = await client.from('cashflow_plan').select('*').eq('id', planId);
              if (data && data.length > 0 && data[0].data && Array.isArray(data[0].data[arrayKey])) {
                currentItems = data[0].data[arrayKey];
              }
            } catch {}
          }
          if (currentItems.length === 0) {
            currentItems = readLocal();
          }

          const filtered = currentItems.filter((item) => item[col] !== val);
          if (client) {
            try {
              await client.from('cashflow_plan').upsert({
                id: planId,
                data: { [arrayKey]: filtered },
                updated_at: new Date().toISOString(),
              });
            } catch {}
          }
          writeLocal(filtered);
          return { data: null, error: null };
        },

        async neq() {
          // Vaciar todos los registros
          if (client) {
            try {
              await client.from('cashflow_plan').upsert({
                id: planId,
                data: { [arrayKey]: [] },
                updated_at: new Date().toISOString(),
              });
            } catch {}
          }
          writeLocal([]);
          return { data: null, error: null };
        },
      };
    },
  };
}

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
        async lt(col, val) {
          const existing = getTableData(table);
          const filtered = existing.filter((item) => (item[col] ?? '') >= val);
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
    if (VIRTUAL_PLAN_TABLES[table]) {
      return createVirtualPlanBuilder(VIRTUAL_PLAN_TABLES[table], realClient);
    }
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
          async lt(col, val) {
            if (!delObj) return createMockQueryBuilder(table).delete().lt(col, val);
            try {
              const res = await delObj.lt(col, val);
              if (res.error) return createMockQueryBuilder(table).delete().lt(col, val);
              return res;
            } catch {
              return createMockQueryBuilder(table).delete().lt(col, val);
            }
          },
        };
      },
    };
  },
};
