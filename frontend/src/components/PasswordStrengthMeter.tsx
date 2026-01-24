'use client';

import { useState, useMemo, useCallback } from 'react';
import { z } from 'zod';
import { Check, X, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  value: string;
  onChange: (value: string) => void;
  onStrengthChange?: (strength: PasswordStrength) => void;
  showRequirements?: boolean;
  minStrength?: 'weak' | 'fair' | 'good' | 'strong';
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export interface PasswordStrength {
  score: number; // 0-100
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  label: string;
  color: string;
  requirements: PasswordRequirement[];
}

interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

// Password validation rules
const REQUIREMENTS = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (password: string) => password.length >= 8
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    test: (password: string) => /[A-Z]/.test(password)
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    test: (password: string) => /[a-z]/.test(password)
  },
  {
    id: 'number',
    label: 'One number',
    test: (password: string) => /\d/.test(password)
  },
  {
    id: 'special',
    label: 'One special character (!@#$%^&*)',
    test: (password: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  },
  {
    id: 'noCommon',
    label: 'Not a common password',
    test: (password: string) => !isCommonPassword(password)
  }
];

// Common passwords to reject
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '12345678', 'qwerty123', 'abc12345',
  'letmein', 'welcome', 'monkey123', 'dragon123', 'master123',
  'login123', 'admin123', 'passw0rd', 'p@ssword', 'p@ssw0rd'
]);

function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

function calculateStrength(password: string): PasswordStrength {
  const requirements = REQUIREMENTS.map(req => ({
    id: req.id,
    label: req.label,
    met: req.test(password)
  }));

  const metCount = requirements.filter(r => r.met).length;
  const totalCount = requirements.length;
  
  // Base score from requirements
  let score = (metCount / totalCount) * 60;
  
  // Bonus for length
  if (password.length >= 12) score += 15;
  else if (password.length >= 10) score += 10;
  
  // Bonus for variety
  const hasUpperAndLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumberAndSpecial = /\d/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  if (hasUpperAndLower && hasNumberAndSpecial) score += 15;
  else if (hasUpperAndLower || hasNumberAndSpecial) score += 10;

  // Penalty for repeated characters
  if (/(.)\1{2,}/.test(password)) score -= 10;
  
  // Penalty for sequential characters
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  let level: PasswordStrength['level'];
  let label: string;
  let color: string;

  if (score < 20) {
    level = 'very-weak';
    label = 'Very Weak';
    color = 'bg-red-600';
  } else if (score < 40) {
    level = 'weak';
    label = 'Weak';
    color = 'bg-orange-500';
  } else if (score < 60) {
    level = 'fair';
    label = 'Fair';
    color = 'bg-yellow-500';
  } else if (score < 80) {
    level = 'good';
    label = 'Good';
    color = 'bg-lime-500';
  } else {
    level = 'strong';
    label = 'Strong';
    color = 'bg-green-500';
  }

  return {
    score,
    level,
    label,
    color,
    requirements
  };
}

export function PasswordStrengthMeter({
  value,
  onChange,
  onStrengthChange,
  showRequirements = true,
  minStrength = 'fair',
  className,
  placeholder = 'Enter password',
  disabled = false
}: PasswordStrengthMeterProps) {
  const [showPassword, setShowPassword] = useState(false);

  const strength = useMemo(() => {
    const result = calculateStrength(value);
    onStrengthChange?.(result);
    return result;
  }, [value, onStrengthChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const toggleVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Password Input */}
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
        />
        <button
          type="button"
          onClick={toggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Strength Bar */}
      {value && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Password strength:</span>
            <span
              className={cn('font-medium', {
                'text-red-600': strength.level === 'very-weak',
                'text-orange-500': strength.level === 'weak',
                'text-yellow-600': strength.level === 'fair',
                'text-lime-600': strength.level === 'good',
                'text-green-600': strength.level === 'strong',
              })}
            >
              {strength.label}
            </span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all duration-300', strength.color)}
              style={{ width: `${strength.score}%` }}
            />
          </div>
        </div>
      )}

      {/* Requirements List */}
      {showRequirements && value && (
        <div className="grid grid-cols-2 gap-2">
          {strength.requirements.map(req => (
            <div
              key={req.id}
              className={cn(
                'flex items-center gap-2 text-sm transition-colors',
                req.met ? 'text-green-600' : 'text-muted-foreground'
              )}
            >
              {req.met ? (
                <Check className="h-4 w-4 flex-shrink-0" />
              ) : (
                <X className="h-4 w-4 flex-shrink-0" />
              )}
              <span>{req.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Zod schema for password validation
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    'Password must contain at least one special character'
  )
  .refine(
    (password) => !isCommonPassword(password),
    'Password is too common. Please choose a stronger password.'
  );

// Hook for password validation
export function usePasswordValidation(password: string) {
  const strength = useMemo(() => calculateStrength(password), [password]);
  
  const isValid = useMemo(() => {
    const result = passwordSchema.safeParse(password);
    return result.success;
  }, [password]);

  const errors = useMemo(() => {
    const result = passwordSchema.safeParse(password);
    if (result.success) return [];
    return result.error.errors.map(e => e.message);
  }, [password]);

  return {
    strength,
    isValid,
    errors,
    meetsMinimum: (minLevel: PasswordStrength['level']) => {
      const levels = ['very-weak', 'weak', 'fair', 'good', 'strong'];
      return levels.indexOf(strength.level) >= levels.indexOf(minLevel);
    }
  };
}

export default PasswordStrengthMeter;
