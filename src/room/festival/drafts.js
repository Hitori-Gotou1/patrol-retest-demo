import { shallowRef, ref, readonly } from 'vue';
import { saveLocal } from '../storage.js';

const drafts = new Map();
let assessedStorage = false;

function assessStorage() {
  if (assessedStorage) return true;
  try {
    const key = 'hitori-room:festival:storage-probe';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    assessedStorage = true;
    return true;
  } catch {
    return false;
  }
}
export const snapshot = value => JSON.parse(JSON.stringify(value));
export const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useFestivalDraft(name, create) {
  if (drafts.has(name)) return drafts.get(name);
  const key = `hitori-room:festival:${name}:v1`;
  const state = shallowRef(create());
  const status = ref('new');
  let raw = null;
  let pending = false;

  function read(value) {
    raw = value;
    try {
      if (value === null) {
        state.value = create();
        status.value = 'new';
      } else {
        const record = JSON.parse(value);
        if (record.version !== 1 || !record.data || typeof record.data !== 'object') throw new Error();
        state.value = record.data;
        status.value = 'saved';
      }
    } catch {
      status.value = 'unreadable';
    }
  }
  try {
    read(localStorage.getItem(key));
    if (status.value !== 'unreadable' && !assessStorage()) status.value = 'unavailable';
  } catch {
    status.value = 'unavailable';
  }

  // Read the latest saved version before applying an edit across tabs.
  function edit(update) {
    let conflict = false;
    try {
      const current = localStorage.getItem(key);
      if (current !== raw) {
        if (pending) conflict = true;
        else read(current);
      }
    } catch {
      if (status.value !== 'unreadable') status.value = 'unavailable';
    }
    const data = snapshot(state.value);
    update(data);
    state.value = data;
    if (conflict) status.value = 'conflict';
    if (status.value === 'unreadable' || conflict) {
      pending = true;
      return false;
    }
    const record = { version: 1, data };
    const saved = saveLocal(key, record);
    pending = !saved;
    if (saved) raw = JSON.stringify(record);
    status.value = saved ? 'saved' : 'unavailable';
    return saved;
  }
  window.addEventListener('storage', event => {
    if ((event.key === key || event.key === null) && !pending) read(event.newValue);
  });

  const result = { state: readonly(state), status: readonly(status), edit };
  drafts.set(name, result);
  return result;
}

export const storageLabels = {
  new: '修改后保存在此浏览器',
  saved: '草稿已保存到此浏览器',
  unavailable: '本机存储不可用 · 本次仍可编辑和下载',
  unreadable: '原草稿无法读取 · 本次仍可编辑和下载',
  conflict: '另一标签页也保存了草稿 · 本页仍可编辑和下载'
};

const editionNames = { patch: '布章', animation: '动画', soundcheck: '试声单' };

export function useFestivalEditions(kind) {
  const store = useFestivalDraft(`editions-${kind}`, () => ({ items: [] }));
  function add(data, name) {
    const edition = { id: newId(), name, data: snapshot(data) };
    const saved = store.edit(record => {
      edition.number = (record.items.at(-1)?.number ?? 0) + 1;
      record.items.push(edition);
    });
    return { edition, saved };
  }
  return { ...store, add };
}

export function editionLabel(kind, edition) {
  return `${editionNames[kind]}第 ${edition.number} 版 · ${edition.name}`;
}
