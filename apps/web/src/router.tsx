import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Shell } from './shell.js';
import { Invite, Login, Onboarding, Register, Reset, ResetConfirm } from './screens/auth.js';
import { NewProjectScreen, PlaceholderScreen, ProjectsScreen } from './screens/app.js';
import { KitchenSink } from './screens/kitchen-sink.js';

const rootRoute = createRootRoute({ component: Shell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ProjectsScreen,
});
const myWorkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/my-work',
  component: () => (
    <PlaceholderScreen
      title="My work"
      note="Issues assigned to you land here with the S6 issue surface."
    />
  ),
});
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: () => (
    <PlaceholderScreen
      title="Search"
      note="Full-text issue search lands with the S6 issue surface."
    />
  ),
});
const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notifications',
  component: () => (
    <PlaceholderScreen
      title="Notifications"
      note="Activity notifications arrive in a later slice."
    />
  ),
});
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: () => (
    <PlaceholderScreen
      title="Admin"
      note="Workspace, members, and workflow settings arrive in a later slice."
    />
  ),
});
const newProjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/new',
  component: NewProjectScreen,
});
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: Register,
});
const resetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset',
  component: Reset,
});
const resetConfirmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset/$token',
  component: ResetConfirm,
});
const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invites/$token',
  component: Invite,
});
const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: Onboarding,
});
const kitchenSinkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/kitchen-sink',
  component: KitchenSink,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  myWorkRoute,
  searchRoute,
  notificationsRoute,
  adminRoute,
  newProjectRoute,
  loginRoute,
  registerRoute,
  resetRoute,
  resetConfirmRoute,
  inviteRoute,
  onboardingRoute,
  ...(import.meta.env.DEV ? [kitchenSinkRoute] : []),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
