import { Text, Pressable, View, ActivityIndicator } from 'react-native';
import { cn } from '../../lib/utils';

interface ButtonProps {
  onPress?: () => void;
  title?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass' | 'destructive';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  textClassName?: string;
  disabled?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'default',
  className,
  textClassName,
  disabled,
  isLoading,
  icon,
  children,
}: ButtonProps) {
  
  const baseStyles = 'flex-row items-center justify-center rounded-xl transition-all';
  
  const variants = {
    primary: 'bg-primary active:bg-primary/90 shadow-sm',
    secondary: 'bg-secondary active:bg-secondary/80',
    outline: 'border border-input bg-transparent active:bg-accent',
    ghost: 'bg-transparent active:bg-accent',
    glass: 'bg-black/80 border border-white/20 shadow-sm',
    destructive: 'bg-destructive active:bg-destructive/90',
  };

  const sizes = {
    sm: 'px-3 py-2',
    default: 'px-4 py-3',
    lg: 'px-8 py-4',
  };

  const textVariants = {
    primary: 'text-primary-foreground font-medium',
    secondary: 'text-secondary-foreground font-medium',
    outline: 'text-foreground font-medium',
    ghost: 'text-foreground font-medium',
    glass: 'text-white font-medium',
    destructive: 'text-destructive-foreground font-medium',
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        disabled && 'opacity-50',
        className
      )}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#0f172a' : '#fff'} />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          {title ? (
            <Text className={cn(textVariants[variant], textClassName)}>
              {title}
            </Text>
          ) : (
             // If children acts as text, we might want to wrap it or just render it.
             // But for custom children (like complex layout), we just render it.
             // If the user passes text as children, it needs a Text wrapper if not already wrapped.
             // However, consumers of this Button usually passed Text inside?
             // Actually, usually <Button><Text>Foo</Text></Button> or <Button title="Foo" />
             // We can check if children is a string but React Native children are complex.
             // Let's assume if children is provided, the user handles the text content or we wrap it contextually?
             // No, standard RN practice: if strict text, user wraps in Text. 
             // But here we want to apply styles.
             // Let's wrap children in Text only if it's likely text? No, too risky.
             // simpler: Just render children. If user wants styled text they use title prop or pass styled Text.
             children
          )}
        </>
      )}
    </Pressable>
  );
}

