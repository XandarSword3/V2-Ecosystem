import { View, ViewProps } from 'react-native';
import { cn } from '../../lib/utils';

interface CardProps extends ViewProps {
  variant?: 'default' | 'glass' | 'outline' | 'filled';
  className?: string;
}

export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  const variants = {
    default: 'bg-card border border-border shadow-sm',
    glass: 'bg-slate-900/95 border border-white/30 shadow-lg',
    outline: 'bg-transparent border border-border',
    filled: 'bg-secondary',
  };

  return (
    <View
      className={cn('rounded-xl', variants[variant], className)}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardContent({ className, children, ...props }: ViewProps & { className?: string }) {
  return (
    <View className={cn('p-4', className)} {...props}>
      {children}
    </View>
  );
}

export function CardHeader({ className, children, ...props }: ViewProps & { className?: string }) {
    return (
      <View className={cn('p-4 pb-0', className)} {...props}>
        {children}
      </View>
    );
}

export function CardTitle({ className, children, ...props }: ViewProps & { className?: string }) {
    return (
        // Assuming we would export a Text component, but for now using View wrapper concept or just plain View
        // Actually CardTitle should probably wrap a Text
        <View className={cn('', className)} {...props}>
             {children} 
        </View>
    ); 
    // Note: Children of CardTitle usually are Text, so checking if I should import Text. 
    // In React Native <View><Text>...</Text></View> is fine.
}

export function CardDescription({ className, children, ...props }: ViewProps & { className?: string }) {
    return (
      <View className={cn('pt-1', className)} {...props}>
        {children}
      </View>
    );
}
