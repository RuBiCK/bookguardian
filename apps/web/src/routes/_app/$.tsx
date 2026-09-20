import { createFileRoute } from '@tanstack/react-router';
import { NotFound } from '../__root';

/** Unknown paths render the not-found screen inside the shell (tab bar included). */
export const Route = createFileRoute('/_app/$')({
  component: NotFound,
});
