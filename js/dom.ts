// Finds an element that must be on the page. It throws if the element is missing, so a wrong
// selector shows up at once.
export function $<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`No element matches ${selector}`);
  return element;
}
