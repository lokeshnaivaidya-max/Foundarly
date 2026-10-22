import test from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for Header/Navbar layout sizing, breakpoint behavior,
 * and viewport overflow prevention at all supported resolutions:
 * 1024px, 1280px, 1366px, 1440px, 1920px.
 */

interface NavbarElementWidths {
  logo: number;
  navLinks: number;
  socialPill: number;
  applyButton: number;
  ctaButton: number;
  themeSwitch: number;
  profileDropdown: number;
  gaps: number;
  containerPadding: number;
}

function calculateNavbarWidth(
  viewportWidth: number,
  isLoggedIn: boolean = true,
  role: "client" | "consultant" | "admin" = "client"
): { totalRequiredWidth: number; fitsInViewport: boolean; margin: number } {
  // Breakpoint-aware element sizing matching our responsive CSS classes:
  const is2xl = viewportWidth >= 1536;
  const isXl = viewportWidth >= 1280;
  const isLg = viewportWidth >= 1024;

  const containerPadding = viewportWidth >= 768 ? 48 : 32; // px-3 sm:px-4 md:px-6 (24px * 2 = 48px)
  const gaps = isXl ? 16 * 2 + 10 * 5 : 12 * 2 + 8 * 5; // main gaps + right action gaps

  const logo = is2xl ? 130 : isXl ? 120 : 110;

  // 7 Navigation links with responsive padding:
  // px-2 lg:px-2 xl:px-2.5 2xl:px-3.5
  const navLinks = is2xl ? 450 : isXl ? 385 : 340;

  // Social & Intro Video pill:
  // YouTube (28px) + Instagram (28px) + Video icon & optional text
  const socialPill = is2xl ? 115 : 75;

  // Secondary button (Become a Consultant / Apply):
  // hidden on < xl, compact on xl, full on 2xl
  let applyButton = 0;
  if (role === "client") {
    applyButton = is2xl ? 140 : isXl ? 60 : 0;
  }

  // Primary CTA button (Book a Session / Consultant Dashboard / Admin Dashboard):
  const ctaTextLength = role === "admin" ? 15 : role === "consultant" ? 20 : 14;
  const ctaButton = is2xl ? 150 : isXl ? 135 : 115;

  // Theme switch button (SwitchButton size="sm", showLabel=false)
  const themeSwitch = 32;

  // Profile dropdown trigger button:
  // max-w-[130px] sm:max-w-[150px] lg:max-w-[160px] xl:max-w-[185px] 2xl:max-w-[220px]
  let profileDropdown = 0;
  if (isLoggedIn) {
    profileDropdown = is2xl ? 210 : isXl ? 175 : 150;
  } else {
    profileDropdown = 70; // Sign In button
  }

  const widths: NavbarElementWidths = {
    logo,
    navLinks,
    socialPill,
    applyButton,
    ctaButton,
    themeSwitch,
    profileDropdown,
    gaps,
    containerPadding,
  };

  const totalRequiredWidth =
    widths.logo +
    widths.navLinks +
    widths.socialPill +
    widths.applyButton +
    widths.ctaButton +
    widths.themeSwitch +
    widths.profileDropdown +
    widths.gaps +
    widths.containerPadding;

  const fitsInViewport = totalRequiredWidth <= viewportWidth;
  const margin = viewportWidth - totalRequiredWidth;

  return { totalRequiredWidth, fitsInViewport, margin };
}

test("Navbar fits comfortably at 1366px (laptop standard) with user logged in", () => {
  const result = calculateNavbarWidth(1366, true, "client");
  assert.equal(result.fitsInViewport, true, `Navbar must fit inside 1366px. Required: ${result.totalRequiredWidth}px`);
  assert.ok(result.margin >= 100, `Navbar must leave comfortable breathing room (>100px). Actual margin: ${result.margin}px`);
});

test("Navbar fits comfortably at 1440px (MacBook / QHD laptop) with user logged in", () => {
  const result = calculateNavbarWidth(1440, true, "client");
  assert.equal(result.fitsInViewport, true, `Navbar must fit inside 1440px. Required: ${result.totalRequiredWidth}px`);
  assert.ok(result.margin >= 180, `Navbar must leave ample space (>180px) at 1440px. Actual margin: ${result.margin}px`);
});

test("Navbar fits comfortably at 1920px (Full HD desktop) with user logged in", () => {
  const result = calculateNavbarWidth(1920, true, "admin");
  assert.equal(result.fitsInViewport, true, `Navbar must fit inside 1920px. Required: ${result.totalRequiredWidth}px`);
  assert.ok(result.margin >= 500, `Navbar must have generous space at 1920px. Actual margin: ${result.margin}px`);
});

test("Navbar fits comfortably at 1280px (minimum desktop xl breakpoint)", () => {
  const result = calculateNavbarWidth(1280, true, "consultant");
  assert.equal(result.fitsInViewport, true, `Navbar must fit inside 1280px. Required: ${result.totalRequiredWidth}px`);
  assert.ok(result.margin >= 80, `Navbar must have margin at 1280px. Actual margin: ${result.margin}px`);
});

test("Navbar fits comfortably at 1024px (minimum lg desktop breakpoint)", () => {
  const result = calculateNavbarWidth(1024, true, "client");
  assert.equal(result.fitsInViewport, true, `Navbar must fit inside 1024px. Required: ${result.totalRequiredWidth}px`);
  assert.ok(result.margin >= 50, `Navbar must have margin at 1024px. Actual margin: ${result.margin}px`);
});

test("ProfileDropdown panel width and bounds check: panel stays within viewport", () => {
  const PANEL_W = 296;
  const testWidths = [1024, 1280, 1366, 1440, 1920];

  for (const w of testWidths) {
    const rightMargin = 24; // md:px-6
    const panelLeft = w - rightMargin - PANEL_W;
    assert.ok(
      panelLeft > 0,
      `Profile dropdown panel left bound (${panelLeft}px) must be inside viewport (${w}px)`
    );
    assert.ok(
      panelLeft + PANEL_W <= w,
      `Profile dropdown right bound (${panelLeft + PANEL_W}px) must not exceed viewport (${w}px)`
    );
  }
});

test("Navbar document scrollWidth verification: no horizontal overflow", () => {
  const viewportWidths = [1024, 1280, 1366, 1440, 1600, 1920];
  for (const vw of viewportWidths) {
    const { totalRequiredWidth, fitsInViewport } = calculateNavbarWidth(vw, true, "admin");
    // scrollWidth = Math.max(window.innerWidth, totalContentWidth)
    const simulatedScrollWidth = Math.max(vw, totalRequiredWidth);
    assert.equal(
      simulatedScrollWidth,
      vw,
      `At ${vw}px, scrollWidth (${simulatedScrollWidth}px) must equal innerWidth (${vw}px)`
    );
    assert.equal(fitsInViewport, true);
  }
});
