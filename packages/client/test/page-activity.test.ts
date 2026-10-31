import { afterEach, describe, expect, it, vi } from 'vitest';
import { observePageActivity } from '../src/page-activity';

afterEach(() => vi.unstubAllGlobals());

describe('page activity', () => {
  it('requires visibility and window focus, deduplicates events and cleans up', () => {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), {
      hidden: false,
      hasFocus: () => focused,
      defaultView: win,
    });
    let focused = false;
    vi.stubGlobal('document', doc);
    const changed = vi.fn();
    const dispose = observePageActivity(changed);
    expect(changed.mock.calls).toEqual([[false]]);
    focused = true;
    win.dispatchEvent(new Event('focus'));
    win.dispatchEvent(new Event('focus'));
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('focus'));
    focused = false;
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(changed.mock.calls).toEqual([[false], [true], [false]]);
    focused = true;
    win.dispatchEvent(new Event('focus'));
    win.dispatchEvent(new Event('blur'));
    expect(changed.mock.calls).toEqual([[false], [true], [false], [true], [false]]);
    dispose();
    win.dispatchEvent(new Event('focus'));
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(changed).toHaveBeenCalledTimes(5);
  });
});
