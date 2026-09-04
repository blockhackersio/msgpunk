import { cn } from '../../utils'

interface ProgressProps {
  value: number
  className?: string
  indicatorClassName?: string
  indicatorStyle?: React.CSSProperties
}

export function Progress({ className, value, indicatorClassName, indicatorStyle }: ProgressProps) {
  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-full', className)}
    >
      <div
        className={cn('h-full w-full flex-1 transition-all', indicatorClassName)}
        style={{
          transform: `translateX(-${100 - (value || 0)}%)`,
          ...indicatorStyle,
        }}
      />
    </div>
  )
}
