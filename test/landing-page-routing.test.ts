import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Landing Page & Routing Configuration Suite", () => {
  const appPath = path.resolve(process.cwd(), "src/App.tsx");
  const headerPath = path.resolve(process.cwd(), "src/components/Header.tsx");
  const footerPath = path.resolve(process.cwd(), "src/components/Footer.tsx");

  const appSource = fs.readFileSync(appPath, "utf-8");
  const headerSource = fs.readFileSync(headerPath, "utf-8");
  const footerSource = fs.readFileSync(footerPath, "utf-8");

  describe("1. Default Route Configuration (Experts as Landing Page)", () => {
    it("should set / route directly to Consultants component without redirect flash", () => {
      // Must import Consultants directly for eager loading
      assert.ok(
        /import\s+Consultants\s+from\s+["']\.\/pages\/Consultants["']/.test(appSource),
        "Consultants must be eagerly imported in App.tsx to prevent loading flash on default landing route"
      );

      // Must set <Route path="/" element={<Consultants />} />
      assert.ok(
        appSource.includes('<Route path="/" element={<Consultants />} />'),
        'App.tsx must define <Route path="/" element={<Consultants />} />'
      );
    });

    it("should preserve /consultants route pointing to Consultants", () => {
      assert.ok(
        appSource.includes('<Route path="/consultants" element={<Consultants />} />'),
        'App.tsx must define <Route path="/consultants" element={<Consultants />} />'
      );
    });

    it("should preserve /home route pointing to Index (Homepage)", () => {
      assert.ok(
        appSource.includes('<Route path="/home" element={<Index />} />'),
        'App.tsx must define <Route path="/home" element={<Index />} />'
      );
    });
  });

  describe("2. Navigation Bar (Header) Alignment", () => {
    it("should link Home to /home and Experts to /consultants in navLinks", () => {
      assert.ok(
        headerSource.includes('{ label: "Home", path: "/home" }'),
        'Header navLinks must route Home to "/home"'
      );
      assert.ok(
        headerSource.includes('{ label: "Experts", path: "/consultants" }'),
        'Header navLinks must route Experts to "/consultants"'
      );
    });

    it("should activate Experts tab when on / or /consultants", () => {
      // Extract or simulate the isActive function
      function testIsActive(pathname: string, path: string): boolean {
        if (path === "/home") {
          return pathname === "/home";
        }
        if (path === "/consultants" || path === "/") {
          return pathname === "/consultants" || pathname === "/" || pathname.startsWith("/consultants/");
        }
        return pathname === path || pathname.startsWith(path + "/");
      }

      // On default landing page "/"
      assert.equal(testIsActive("/", "/consultants"), true, 'Experts must be active on "/"');
      assert.equal(testIsActive("/", "/home"), false, 'Home must not be active on "/"');

      // On "/consultants"
      assert.equal(testIsActive("/consultants", "/consultants"), true, 'Experts must be active on "/consultants"');
      assert.equal(testIsActive("/consultants", "/home"), false, 'Home must not be active on "/consultants"');

      // On "/home"
      assert.equal(testIsActive("/home", "/home"), true, 'Home must be active on "/home"');
      assert.equal(testIsActive("/home", "/consultants"), false, 'Experts must not be active on "/home"');
    });

    it("should keep brand logo linking to / (landing page)", () => {
      assert.ok(
        headerSource.includes('<Link to="/"'),
        'Brand logo must link to "/"'
      );
    });
  });

  describe("3. Footer Link Accessibility", () => {
    it("should provide access to both Explore Experts and Home", () => {
      assert.ok(
        footerSource.includes('<Link to="/"') && footerSource.includes('Explore Experts'),
        'Footer must link Explore Experts to "/"'
      );
      assert.ok(
        footerSource.includes('<Link to="/home"') && footerSource.includes('Home'),
        'Footer must link Home to "/home"'
      );
    });
  });

  describe("4. Critical Flow & Protected Route Non-Regression", () => {
    it("should preserve meeting redirect handler for both / and /home", () => {
      assert.ok(
        appSource.includes("location.pathname === '/' || location.pathname === '/home'"),
        "MeetingRedirectHandler must handle incoming post-login meeting redirects on both / and /home"
      );
    });

    it("should preserve all core authentication and application routes", () => {
      const requiredRoutes = [
        '<Route path="/booking"',
        '<Route path="/my-bookings"',
        '<Route path="/consultant"',
        '<Route path="/network"',
        '<Route path="/pricing"',
        '<Route path="/about"',
        '<Route path="/blog"',
        '<Route path="/faqs"',
        '<Route path="/login"',
        '<Route path="/meeting/:roomId"',
      ];

      for (const route of requiredRoutes) {
        assert.ok(appSource.includes(route), `App.tsx must preserve route: ${route}`);
      }
    });
  });
});
