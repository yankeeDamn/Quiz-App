/**
 * Class string for CTA links/buttons: a 1px lift on hover and a press on
 * :active, using CSS transitions only (per the motion guidelines, buttons
 * don't need JS animation). Append to an existing className, e.g.
 *
 *   <Link className={cn('...', buttonMotion)} />
 *
 * Works on <a>, <button> and shadcn <Button asChild>.
 */
export const buttonMotion =
  'transition-[transform,background-color,box-shadow] duration-150 ease-out ' +
  'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0';
