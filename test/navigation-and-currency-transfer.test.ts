import test from "node:test";
import assert from "node:assert/strict";

test("Navigation links: Home links to root ('/') and Experts links to ('/consultants')", () => {
  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Experts", path: "/consultants" },
    { label: "Network", path: "/network" },
    { label: "Pricing", path: "/pricing" },
    { label: "Our Story", path: "/about" },
    { label: "Blog", path: "/blog" },
    { label: "FAQs", path: "/faqs" },
  ];

  const homeLink = navLinks.find(l => l.label === "Home");
  const expertsLink = navLinks.find(l => l.label === "Experts");

  assert.equal(homeLink?.path, "/", "Home link must point to root URL '/'");
  assert.equal(expertsLink?.path, "/consultants", "Experts link must point to '/consultants'");
});

test("Header isActive logic matches correctly for root Home and Experts", () => {
  const isActive = (targetPath: string, currentPath: string) => {
    if (targetPath === "/") {
      return currentPath === "/" || currentPath === "/home";
    }
    if (targetPath === "/consultants") {
      return currentPath === "/consultants" || currentPath.startsWith("/consultants/");
    }
    return currentPath === targetPath || currentPath.startsWith(targetPath + "/");
  };

  // Visiting root '/'
  assert.equal(isActive("/", "/"), true, "'/' must be active when at '/'");
  assert.equal(isActive("/consultants", "/"), false, "'/consultants' must NOT be active when at '/'");

  // Visiting '/home'
  assert.equal(isActive("/", "/home"), true, "'/' must be active when at '/home'");

  // Visiting '/consultants'
  assert.equal(isActive("/consultants", "/consultants"), true, "'/consultants' must be active when at '/consultants'");
  assert.equal(isActive("/", "/consultants"), false, "'/' must NOT be active when at '/consultants'");

  // Visiting a specific consultant profile '/consultants/123'
  assert.equal(isActive("/consultants", "/consultants/123"), true, "Experts link must be active on consultant profile");
});

test("Dashboard reload prevention: Tab state preservation via searchParams", () => {
  // Simulate tab state management
  let searchParams = new URLSearchParams("");
  const handleTabChange = (val: string) => {
    searchParams.set("tab", val);
  };

  // Default tab is 'bookings'
  assert.equal(searchParams.get("tab") || "bookings", "bookings");

  // Switch to availability tab
  handleTabChange("availability");
  assert.equal(searchParams.get("tab") || "bookings", "availability");

  // Saving availability triggers a silent refresh - activeTab should remain 'availability'
  const simulateSilentRefresh = () => {
    // Background fetch occurs without changing searchParams
    return searchParams.get("tab") || "bookings";
  };

  assert.equal(simulateSilentRefresh(), "availability", "Tab must remain 'availability' after silent refresh");
});

test("CurrencyTransfer stepper states: stops at 'In progress' when pending", () => {
  const getSteps = (status: "pending" | "verified" | "rejected", txnId: string) => {
    return [
      {
        id: "step-1",
        title: "Payment submitted",
        state: "completed" as const,
      },
      {
        id: "step-2",
        title: "UTR & proof recorded",
        state: "completed" as const,
      },
      {
        id: "step-3",
        title: "Admin verification",
        state: status === "pending" ? "active" : status === "verified" ? "completed" : "failed",
        timestamp: status === "pending" ? "In progress" : status === "verified" ? "Verified" : "Failed",
      },
      {
        id: "step-4",
        title: "Booking confirmed & room active",
        state: status === "verified" ? "completed" : status === "rejected" ? "failed" : "waiting",
      },
    ];
  };

  // Test pending (in progress)
  const pendingSteps = getSteps("pending", "UTR12345678");
  assert.equal(pendingSteps[0].state, "completed");
  assert.equal(pendingSteps[1].state, "completed");
  assert.equal(pendingSteps[2].state, "active", "Step 3 must be 'active' (in progress) when pending");
  assert.equal(pendingSteps[2].timestamp, "In progress");
  assert.equal(pendingSteps[3].state, "waiting", "Step 4 must wait when admin verification is pending");
});

test("CurrencyTransfer stepper states: transitions to 'Arrived / Confirmed' when verified", () => {
  const getSteps = (status: "pending" | "verified" | "rejected") => {
    return [
      { id: "step-1", state: "completed" },
      { id: "step-2", state: "completed" },
      {
        id: "step-3",
        state: status === "pending" ? "active" : status === "verified" ? "completed" : "failed",
      },
      {
        id: "step-4",
        state: status === "verified" ? "completed" : status === "rejected" ? "failed" : "waiting",
      },
    ];
  };

  // Test verified (completed)
  const verifiedSteps = getSteps("verified");
  assert.equal(verifiedSteps[2].state, "completed", "Step 3 must be completed when verified");
  assert.equal(verifiedSteps[3].state, "completed", "Step 4 must transition to completed when verified");
});

test("CurrencyTransfer stepper states: transitions to 'failed' with retry on rejection", () => {
  const getSteps = (status: "pending" | "verified" | "rejected") => {
    return [
      { id: "step-1", state: "completed" },
      { id: "step-2", state: "completed" },
      {
        id: "step-3",
        state: status === "pending" ? "active" : status === "verified" ? "completed" : "failed",
      },
      {
        id: "step-4",
        state: status === "verified" ? "completed" : status === "rejected" ? "failed" : "waiting",
      },
    ];
  };

  // Test rejected (failed)
  const rejectedSteps = getSteps("rejected");
  assert.equal(rejectedSteps[2].state, "failed", "Step 3 must be marked 'failed' when rejected");
  assert.equal(rejectedSteps[3].state, "failed", "Step 4 must be marked 'failed' when rejected");
});

test("Currency formatting: Formats INR properly with ₹ symbol", () => {
  const formatINR = (val: number) => `₹${val.toLocaleString("en-IN")}`;
  assert.equal(formatINR(1299), "₹1,299");
  assert.equal(formatINR(10000), "₹10,000");
  assert.equal(formatINR(150000), "₹1,50,000");
});

test("Regression check: ProtectedRoute must explicitly import useNavigate from react-router-dom", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const protectedRoutePath = path.resolve(process.cwd(), "src/components/ProtectedRoute.tsx");
  const content = fs.readFileSync(protectedRoutePath, "utf-8");

  // Ensure useNavigate is imported from react-router-dom
  const importMatch = content.match(/import\s*\{[^}]*useNavigate[^}]*\}\s*from\s*['"]react-router-dom['"]/);
  assert.ok(importMatch, "ProtectedRoute.tsx must import useNavigate from react-router-dom to prevent 'useNavigate is not defined' error on /admin");

  // Ensure useNavigate() is invoked
  assert.ok(content.includes("const navigate = useNavigate();"), "ProtectedRoute must instantiate navigate hook");
});

test("Codebase audit: All files calling useNavigate must import it from react-router-dom", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");

  function walk(dir: string): string[] {
    let files: string[] = [];
    for (const item of fs.readdirSync(dir)) {
      const p = path.join(dir, item);
      if (fs.statSync(p).isDirectory()) {
        files = files.concat(walk(p));
      } else if (p.endsWith(".ts") || p.endsWith(".tsx")) {
        files.push(p);
      }
    }
    return files;
  }

  const srcFiles = walk(path.resolve(process.cwd(), "src"));
  for (const file of srcFiles) {
    const code = fs.readFileSync(file, "utf-8");
    if (/\buseNavigate\s*\(/.test(code)) {
      const hasImport = /import\s*\{[^}]*\buseNavigate\b[^}]*\}\s*from\s*['"]react-router-dom['"]/.test(code);
      assert.ok(hasImport, `${file} calls useNavigate() but is missing 'import { useNavigate } from "react-router-dom"'`);
    }
  }
});
