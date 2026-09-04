import { cn } from '../../utils'

interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: 'default' | 'ghost'
  size?: 'default' | 'sm' | 'icon'
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none',
        variant === 'default' && 'text-white',
        variant === 'ghost' && 'hover:opacity-70 bg-transparent',
        size === 'default' && 'h-9 px-4 py-2',
        size === 'sm' && 'h-8 px-3',
        size === 'icon' && 'h-10 w-10 p-0',
        className,
      )}
      {...props}
    />
  )
}
