import { TextInput, View, Text, TextInputProps } from 'react-native';
import { cn } from '../../lib/utils';
import { useColorScheme } from 'nativewind';

export interface InputProps extends TextInputProps {
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
        <Text className="text-white text-sm font-medium ml-1 mb-2">
          {label}
        </Text>
      )}
      <View className={cn(
        'flex-row items-center w-full rounded-xl border px-3',
        error ? 'border-destructive bg-red-500/10' : 'border-slate-500 bg-slate-800/80',
        'h-14' // Fixed height for consistency
      )}>
        {leftIcon && <View className="mr-2">{leftIcon}</View>}
        <TextInput
          className={cn(
            'flex-1 text-base',
            'h-full', // Take full height of container
            className
          )}
          style={{ color: '#ffffff' }}
          placeholderTextColor="#6b7280"
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
