import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { Shell } from './shell.js';
import { Invite, Login, Onboarding, Register, Reset, ResetConfirm } from './screens/auth.js';
import { NewProjectScreen, PlaceholderScreen } from './screens/app.js';
import { KitchenSink } from './screens/kitchen-sink.js';
import { BoardScreen } from './issues/board.js';
import { IssueDetailScreen } from './issues/detail.js';
import { IssueListScreen } from './issues/list.js';
import { MyWorkScreen, ProjectsScreen, SearchScreen } from './issues/screens.js';
import {
  AdminLabelsScreen,
  AdminMembersScreen,
  AdminProjectsScreen,
  AdminTeamsScreen,
  AdminWorkflowsScreen,
  AdminWorkspaceScreen,
} from './admin/screens.js';

const rootRoute = createRootRoute({ component: Shell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ProjectsScreen,
});
const myWorkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/my-work',
  component: MyWorkScreen,
});
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: SearchScreen,
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
  beforeLoad: () => {
    throw redirect({ to: '/admin/members' });
  },
});
const adminMembersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/members',
  component: AdminMembersScreen,
});
const adminTeamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/teams',
  component: AdminTeamsScreen,
});
const adminWorkflowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/workflows',
  component: AdminWorkflowsScreen,
});
const adminLabelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/labels',
  component: AdminLabelsScreen,
});
const adminProjectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/projects',
  component: AdminProjectsScreen,
});
const adminWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/workspace',
  component: AdminWorkspaceScreen,
});
const newProjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/new',
  component: NewProjectScreen,
});
const projectIssuesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectKey',
  component: function ProjectIssues() {
    const { projectKey } = projectIssuesRoute.useParams();
    return <IssueListScreen projectKey={projectKey} />;
  },
});
const projectBoardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectKey/board',
  component: function ProjectBoard() {
    const { projectKey } = projectBoardRoute.useParams();
    return <BoardScreen projectKey={projectKey} />;
  },
});
const issueDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/issues/$issueId',
  component: function IssueDetail() {
    const { issueId } = issueDetailRoute.useParams();
    return <IssueDetailScreen issueId={issueId} />;
  },
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
  adminMembersRoute,
  adminTeamsRoute,
  adminWorkflowsRoute,
  adminLabelsRoute,
  adminProjectsRoute,
  adminWorkspaceRoute,
  newProjectRoute,
  projectBoardRoute,
  projectIssuesRoute,
  issueDetailRoute,
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
