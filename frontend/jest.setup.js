// jest.setup.js
import '@testing-library/jest-dom';
// import { clearApiCache } from '@/lib/api';




// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isFallback: false,
  }),
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock window.matchMedia in browser-oriented suites only.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock recharts to avoid module loading issues
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  const React = require('react');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }) => React.createElement('div', null, children),
    BarChart: ({ children }) => React.createElement('div', null, children),
    Bar: () => React.createElement('div', null),
    XAxis: () => React.createElement('div', null),
    YAxis: () => React.createElement('div', null),
    CartesianGrid: () => React.createElement('div', null),
    Tooltip: () => React.createElement('div', null),
    Legend: () => React.createElement('div', null),
    LineChart: ({ children }) => React.createElement('div', null, children),
    Line: () => React.createElement('div', null),
    AreaChart: ({ children }) => React.createElement('div', null, children),
    Area: () => React.createElement('div', null),
    PieChart: ({ children }) => React.createElement('div', null, children),
    Pie: () => React.createElement('div', null),
    Cell: () => React.createElement('div', null),
  };
});

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const React = require('react');
  const mockComponent = (name) => (props) => React.createElement('div', { 'data-testid': `icon-${name}`, ...props });
  return new Proxy({}, {
    get: (target, name) => {
      if (name === '__esModule') return true;
      return mockComponent(name);
    }
  });
});

afterEach(() => {
  jest.clearAllTimers();
  try {
    const { clearApiCache } = require('@/lib/api');
    clearApiCache();
  } catch (e) {
    // Ignore if module not found
  }
  try {
    const { resetProjectsStore } = require('./src/hooks/useProjects');

    resetProjectsStore();
  } catch (e) {
    // Ignore if module not found or other issues
  }
  if (jest.isMockFunction(setTimeout)) {
    jest.runOnlyPendingTimers();
  }
});





