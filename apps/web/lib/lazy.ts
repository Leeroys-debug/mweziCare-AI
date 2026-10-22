/**
 * Defers constructing `factory()`'s result until the first property
 * access, returning a Proxy with the same shape in the meantime. Needed
 * because Next's build-time page-data collection imports every route
 * module just to inspect its exports, without handling a real request —
 * so module-level singletons that read env vars (db clients, Better Auth)
 * must not construct themselves at import time or that build-time import
 * throws for missing env vars that are only ever needed at request time.
 */
export function lazy<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  const get = () => (instance ??= factory());
  return new Proxy({} as T, {
    get(_target, prop, _receiver) {
      const real = get();
      const value = Reflect.get(real, prop, real);
      return typeof value === "function" ? value.bind(real) : value;
    },
    has(_target, prop) {
      return Reflect.has(get(), prop);
    },
  });
}
