import { clearAllAuth } from './auth';
import { clearApiCache } from './api';

export function clearClientSession(): void {
  clearApiCache();
  clearAllAuth();
}
