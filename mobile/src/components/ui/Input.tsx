import { TextInput, View, Text, TextInputProps } from 'react-native';
import { cn } from '../../lib/utils';
import { useColorScheme } from 'nativewind';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  className,
  containerClassName,
  ...props
}: InputProps) {
  const { colorScheme } = useColorScheme();
  
  return (
    <View className={cn('w-full', containerClassName)}>
      {label && (
        <Text className="text-foreground text-sm font-medium ml-1 mb-2">
          {label}
        </Text>
      )}
      <View className={cn(
        'flex-row items-center w-full rounded-xl border bg-input/50 px-3',
        error ? 'border-destructive' : 'border-input focus:border-ring',
        'h-12' // Fixed height for consistency
      )}>
        {leftIcon && <View className="mr-2">{leftIcon}</View>}
        <TextInput
          className={cn(
            'flex-1 text-foreground text-base',
            'h-full', // Take full height of container
            className
          )}
          placeholderTextColor="#9ca3af"
          {...props}
        />
        {rightIcon && <View className="ml-2">{rightIcon}</View>}
      </View>
      {error && (
        <Text className="text-destructive text-xs ml-1 mt-1">
          {error}
        </Text>
      )}
    </View>
  );
}
