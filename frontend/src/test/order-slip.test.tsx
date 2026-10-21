import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { OrderSlipSection } from '@/components/order-slip-section';
import { demoData } from '@/lib/business';

describe('OrderSlipSection test', () => {
  it('renders without crashing', () => {
    const { container } = render(<OrderSlipSection data={demoData()} userProfile="Sérgio Soares" />);
    expect(container).toBeTruthy();
  });
});
