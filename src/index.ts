import { ApiMocker } from './mocker';
import type { MockConfig } from './types';

export { ApiMocker };
export * from './types';

export function createMocker(config?: MockConfig) {
  return new ApiMocker(config);
}
