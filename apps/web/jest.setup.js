// Optional: Configure Jest to work with custom CSS modules or other global setups
// import '@testing-library/jest-dom'

// Mock Web APIs
Object.defineProperty(window, "Request", {
  writable: true,
  value: class Request {
    constructor(input, init = {}) {
      this.url = input;
      this.method = init.method || "GET";
      this.headers = init.headers || {};
      this.body = init.body;
    }
  },
});

Object.defineProperty(window, "Response", {
  writable: true,
  value: class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || "OK";
      this.headers = init.headers || {};
    }

    static json(data) {
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    }

    async json() {
      return JSON.parse(this.body);
    }
  },
});

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock environment variables
process.env.NODE_ENV = "test";
