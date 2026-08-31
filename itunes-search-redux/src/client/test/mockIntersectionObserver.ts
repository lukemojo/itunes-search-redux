import { vi } from 'vitest';

/**
 * Manual-trigger IntersectionObserver stub — jsdom has no real one. Tests call
 * install() in beforeEach, grab the latest instance, and trigger() it to
 * simulate the sentinel scrolling into view.
 */
export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  constructor(private callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  /** Simulates the observed sentinel entering the viewport. */
  trigger() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  static reset() {
    MockIntersectionObserver.instances = [];
  }

  static install() {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  }
}
