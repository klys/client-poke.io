import { createElement, type ReactNode } from 'react';
import { Navigate, createHashRouter, type RouteObject } from 'react-router-dom';
import AdminPage from './components/admin/AdminPage';
import ModeratorPage from './components/admin/ModeratorPage';
import Game from './components/game/Game';
import Login from './components/ux/auth';
import NewPlayerForm from './components/ux/auth/NewPlayerForm';
import RecoverPassword from './components/ux/auth/RecoverPassword';
import RecoverUsername from './components/ux/auth/RecoverUsername';
import RequireAuth from './components/ux/auth/RequireAuth';
import ValidateEmail from './components/ux/auth/ValidateEmail';
import Frame from './components/gameFrame/Frame';
import LevelingCurvePage from './components/designer/LevelingCurvePage';
import Main from './components/designer/Main';
import MapEditorPage from './components/designer/MapEditorPage';
import Section from './components/designer/Section';
import type { RolePermission } from './context/authContext';

const withAuth = (element: ReactNode, requiredPermission?: RolePermission) =>
  createElement(RequireAuth, { requiredPermission }, element);

export type RuntimeConfig = {
  backendUrl: string
}

export const createEndpoints = (config: RuntimeConfig): RouteObject[] => [
  {
    path: '/login',
    element: createElement(Login)
  },
  {
    path: '/new-user',
    element: createElement(NewPlayerForm)
  },
  {
    path: '/recover-password',
    element: createElement(RecoverPassword)
  },
  {
    path: '/recover-username',
    element: createElement(RecoverUsername)
  },
  {
    path: '/validate-email',
    element: createElement(ValidateEmail)
  },
  {
    path: '/',
    element: withAuth(createElement(Game, { socketUrl: config.backendUrl }), 'game.access')
  },
  {
    path: '/map',
    element: withAuth(createElement(Frame, { socketUrl: config.backendUrl }), 'game.access')
  },
  {
    path:"/designer",
    element: withAuth(createElement(Main), 'designer.access')
  },
  {
    path: "/designer/maps-editor",
    element: withAuth(createElement(Section, { sectionKey: "mapsEditor" }), 'designer.access')
  },
  {
    path: "/designer/maps-editor/:mapId",
    element: withAuth(createElement(MapEditorPage), 'designer.access')
  },
  {
    path: "/designer/leveling-curve",
    element: withAuth(createElement(LevelingCurvePage), 'designer.access')
  },
  {
    path: "/designer/skills-gfx",
    element: withAuth(createElement(Section, { sectionKey: "skillsGfx" }), 'designer.access')
  },
  {
    path: "/designer/pokemons",
    element: withAuth(createElement(Section, { sectionKey: "pokemons" }), 'designer.access')
  },
  {
    path: "/designer/objects",
    element: withAuth(createElement(Section, { sectionKey: "objects" }), 'designer.access')
  },
  {
    path: "/designer/items",
    element: withAuth(createElement(Section, { sectionKey: "items" }), 'designer.access')
  },
  {
    path: "/designer/skills",
    element: withAuth(createElement(Section, { sectionKey: "skills" }), 'designer.access')
  },
  {
    path: "/designer/passive-states",
    element: withAuth(createElement(Section, { sectionKey: "passiveStates" }), 'designer.access')
  },
  {
    path: "/designer/players",
    element: withAuth(createElement(Section, { sectionKey: "players" }), 'designer.access')
  },
  {
    path: "/designer/regions",
    element: withAuth(createElement(Section, { sectionKey: "regions" }), 'designer.access')
  },
  {
    path: "/designer/npcs",
    element: withAuth(createElement(Section, { sectionKey: "npcs" }), 'designer.access')
  },
  {
    path: '/moderator',
    element: withAuth(createElement(ModeratorPage), 'moderator.access')
  },
  {
    path: '/admin',
    element: withAuth(createElement(Navigate, { to: '/admin/users', replace: true }), 'admin.access')
  },
  {
    path: '/admin/users',
    element: withAuth(createElement(AdminPage, { section: 'users' }), 'admin.access')
  },
  {
    path: '/admin/maps',
    element: withAuth(createElement(AdminPage, { section: 'maps' }), 'admin.access')
  },
  {
    path: '/admin/roles',
    element: withAuth(createElement(AdminPage, { section: 'roles' }), 'admin.access')
  },
  {
    path: '*',
    element: createElement(Navigate, { to: '/', replace: true })
  },
  
];

export const createAppRouter = (config: RuntimeConfig) =>
  createHashRouter(createEndpoints(config));
