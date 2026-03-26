import { axe } from 'vitest-axe';
import type { AxeCore } from 'vitest-axe';

declare module '@vitest/expect' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<T> {
    toHaveNoViolations(): void;
  }
}

/**
 * Runs axe-core accessibility audit on the provided container element.
 * Asserts zero violations at the critical and serious impact levels (WCAG 2.1 AA).
 *
 * @param container - The DOM element to audit (typically from RTL `render().container`).
 * @returns The full axe results for further inspection if needed.
 *
 * @example
 * ```ts
 * const { container } = renderWithProviders(<MyPage />);
 * await checkA11y(container);
 * ```
 */
export async function checkA11y(container: Element): Promise<AxeCore.AxeResults> {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
  return results;
}
