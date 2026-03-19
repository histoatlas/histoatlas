import { ogLayout } from './shared';

export function blogTemplate(title: string, description?: string) {
  const truncated =
    description && description.length > 120 ? description.slice(0, 117) + '...' : description;

  return ogLayout({
    title,
    subtitle: truncated,
  });
}
