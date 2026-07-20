import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatReason } from './ChatReason';

describe('ChatReason', () => {
  it('preserves hook ownership across active and completed states', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(
      <ChatReason status="active" content="Working" />,
    );

    rerender(<ChatReason status="done" content="Finished" />);
    rerender(<ChatReason status="active" content="Working again" />);

    expect(consoleError).not.toHaveBeenCalled();
  });
});
