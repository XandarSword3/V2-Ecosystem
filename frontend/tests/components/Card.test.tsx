import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/Card';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
  HTMLMotionProps: {},
}));

describe('Card Component', () => {
  describe('Rendering', () => {
    it('should render children', () => {
      render(<Card hover={false}>Card Content</Card>);
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(<Card hover={false} className="custom-card">Content</Card>);
      const cardDiv = container.querySelector('.custom-card');
      expect(cardDiv).toBeInTheDocument();
    });

    it('should render nested content', () => {
      render(
        <Card hover={false}>
          <div data-testid="nested">Nested Content</div>
        </Card>
      );
      expect(screen.getByTestId('nested')).toBeInTheDocument();
    });
  });

  describe('Padding', () => {
    it('should apply no padding', () => {
      render(<Card hover={false} padding="none" data-testid="card">Content</Card>);
      // Check that p-4, p-6, p-8 are NOT present
      const element = screen.getByText('Content');
      expect(element.className).not.toContain('p-4');
      expect(element.className).not.toContain('p-6');
      expect(element.className).not.toContain('p-8');
    });

    it('should apply small padding', () => {
      render(<Card hover={false} padding="sm">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('p-4');
    });

    it('should apply medium padding (default)', () => {
      render(<Card hover={false} padding="md">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('p-6');
    });

    it('should apply large padding', () => {
      render(<Card hover={false} padding="lg">Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('p-8');
    });
  });

  describe('Variants', () => {
    it('should apply glass variant', () => {
      render(<Card hover={false} variant="glass">Content</Card>);
      const card = screen.getByText('Content');
      expect(card).toHaveClass('backdrop-blur-xl');
    });

    it('should apply gradient variant', () => {
      render(<Card hover={false} variant="gradient">Content</Card>);
      const card = screen.getByText('Content');
      expect(card.className).toContain('bg-gradient-to-br');
    });

    it('should apply frosted variant', () => {
      render(<Card hover={false} variant="frosted">Content</Card>);
      const card = screen.getByText('Content');
      expect(card).toHaveClass('backdrop-blur-2xl');
    });

    it('should apply premium variant', () => {
      render(<Card hover={false} variant="premium">Content</Card>);
      const card = screen.getByText('Content');
      expect(card.className).toContain('bg-gradient-to-br');
      expect(card).toHaveClass('backdrop-blur-xl');
    });
  });

  describe('Props', () => {
    it('should apply glass prop', () => {
      render(<Card hover={false} glass>Content</Card>);
      const card = screen.getByText('Content');
      expect(card).toHaveClass('backdrop-blur-xl');
    });

    it('should apply gradient prop', () => {
      render(<Card hover={false} gradient>Content</Card>);
      const card = screen.getByText('Content');
      expect(card.className).toContain('bg-gradient-to-br');
    });

    it('should apply glow effect', () => {
      render(<Card hover={false} glow>Content</Card>);
      const card = screen.getByText('Content');
      expect(card.className).toContain('ring-1');
    });
  });

  describe('Base Styles', () => {
    it('should have rounded corners', () => {
      render(<Card hover={false}>Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('rounded-2xl');
    });

    it('should have overflow hidden', () => {
      render(<Card hover={false}>Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('overflow-hidden');
    });

    it('should have transition', () => {
      render(<Card hover={false}>Content</Card>);
      expect(screen.getByText('Content')).toHaveClass('transition-all');
    });
  });
});

describe('CardHeader Component', () => {
  it('should render children', () => {
    render(<CardHeader>Header Content</CardHeader>);
    expect(screen.getByText('Header Content')).toBeInTheDocument();
  });

  it('should have border bottom', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText('Header')).toHaveClass('border-b');
  });

  it('should apply gradient style', () => {
    render(<CardHeader gradient>Header</CardHeader>);
    const header = screen.getByText('Header');
    expect(header.className).toContain('bg-gradient-to-r');
  });

  it('should accept custom className', () => {
    render(<CardHeader className="custom-header">Header</CardHeader>);
    expect(screen.getByText('Header')).toHaveClass('custom-header');
  });
});

describe('CardTitle Component', () => {
  it('should render children', () => {
    render(<CardTitle>Card Title</CardTitle>);
    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('should have appropriate typography', () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByText('Title');
    expect(title).toHaveClass('font-bold');
  });

  it('should accept custom className', () => {
    render(<CardTitle className="custom-title">Title</CardTitle>);
    expect(screen.getByText('Title')).toHaveClass('custom-title');
  });
});

describe('CardDescription Component', () => {
  it('should render children', () => {
    render(<CardDescription>Description text</CardDescription>);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('should have muted text color', () => {
    render(<CardDescription>Description</CardDescription>);
    const desc = screen.getByText('Description');
    expect(desc.className).toContain('text-slate');
  });

  it('should accept custom className', () => {
    render(<CardDescription className="custom-desc">Desc</CardDescription>);
    expect(screen.getByText('Desc')).toHaveClass('custom-desc');
  });
});

describe('CardContent Component', () => {
  it('should render children', () => {
    render(<CardContent>Content here</CardContent>);
    expect(screen.getByText('Content here')).toBeInTheDocument();
  });

  it('should accept custom className', () => {
    render(<CardContent className="custom-content">Content</CardContent>);
    expect(screen.getByText('Content')).toHaveClass('custom-content');
  });
});

describe('CardFooter Component', () => {
  it('should render children', () => {
    render(<CardFooter>Footer content</CardFooter>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('should have border top', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText('Footer')).toHaveClass('border-t');
  });

  it('should accept custom className', () => {
    render(<CardFooter className="custom-footer">Footer</CardFooter>);
    expect(screen.getByText('Footer')).toHaveClass('custom-footer');
  });
});

describe('Card Composition', () => {
  it('should compose all card parts correctly', () => {
    render(
      <Card hover={false}>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
          <CardDescription>A description</CardDescription>
        </CardHeader>
        <CardContent>Main content</CardContent>
        <CardFooter>Footer actions</CardFooter>
      </Card>
    );

    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('A description')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByText('Footer actions')).toBeInTheDocument();
  });
});
