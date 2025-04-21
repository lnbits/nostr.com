import Link from 'next/link'
import clsx from 'clsx'

const styles = {
  primary:
    'rounded-full dark:bg-white bg-teal-600 text-sm  hover:bg-teal-500 font-medium py-2 px-4 dark:text-teal-700 text-white dark:hover:bg-teal-100',
  secondary:
    'rounded-full bg-slate-800 py-2 px-4 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 active:text-slate-400'
}

export function Button({variant = 'primary', className, href, ...props}) {
  className = clsx(styles[variant], className)

  return href ? (
    <Link href={href} className={className} {...props} />
  ) : (
    <button className={className} {...props} />
  )
}
