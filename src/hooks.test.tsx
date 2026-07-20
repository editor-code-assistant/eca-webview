import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKeyPressedListener, useWebviewListener } from './hooks';

interface ListenerHarnessProps {
  label: string;
  onMessage: (label: string, value: boolean) => void;
}

function ListenerHarness({ label, onMessage }: ListenerHarnessProps) {
  useWebviewListener('server/setTrust', (value) => {
    onMessage(label, value);
  });
  return null;
}

interface KeyboardHarnessProps {
  label: string;
  onKey: (label: string, key: string) => void;
}

function KeyboardHarness({ label, onKey }: KeyboardHarnessProps) {
  useKeyPressedListener((event) => {
    onKey(label, event.key);
  });
  return null;
}

describe('webview event hooks', () => {
  it('keeps one message subscription while invoking the latest callback', () => {
    const onMessage = vi.fn();
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { rerender, unmount } = render(
      <ListenerHarness label="first" onMessage={onMessage} />,
    );

    rerender(<ListenerHarness label="second" onMessage={onMessage} />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'server/setTrust', data: true },
      }));
    });

    expect(onMessage).toHaveBeenCalledExactlyOnceWith('second', true);
    expect(addListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(1);

    unmount();
    expect(removeListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(1);
  });

  it('keeps one keyboard subscription while invoking the latest callback', () => {
    const onKey = vi.fn();
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const { rerender, unmount } = render(
      <KeyboardHarness label="first" onKey={onKey} />,
    );

    rerender(<KeyboardHarness label="second" onKey={onKey} />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });

    expect(onKey).toHaveBeenCalledExactlyOnceWith('second', 'Enter');
    expect(addListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);

    unmount();
    expect(removeListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
  });
});
