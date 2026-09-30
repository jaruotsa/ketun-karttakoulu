// Fox pawprints: which signs have been learned. Stored only in this browser.
const STORAGE_KEY = 'ketun-karttakoulu.pawprints';

export function all(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') || [];
  } catch {
    return [];
  }
}

export function add(id: string) {
  const pawprints = all();
  if (pawprints.includes(id)) return;
  pawprints.push(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pawprints));
  } catch {
    // Private browsing etc.: the pawprints just are not saved.
  }
}
