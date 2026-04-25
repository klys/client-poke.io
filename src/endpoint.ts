import { createElement, type ReactNode } from 'react';
import { Navigate, createHashRouter, type RouteObject } from 'react-router-dom';
import Game from './components/game/Game';
import Login from './components/ux/auth';
import NewPlayerForm from './components/ux/auth/NewPlayerForm';
import RecoverPassword from './components/ux/auth/RecoverPassword';
import RecoverUsername from './components/ux/auth/RecoverUsername';
import RequireAuth from './components/ux/auth/RequireAuth';
import ValidateEmail from './components/ux/auth/ValidateEmail';
import Frame from './components/gameFrame/Frame';
import Main from './components/designer/Main';
import MapEditorPage from './components/designer/MapEditorPage';
import Section from './components/designer/Section';

const withAuth = (element: ReactNode) =>
  createElement(RequireAuth, undefined, element);

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
    element: withAuth(createElement(Game, { socketUrl: config.backendUrl }))
  },
  {
    path: '/map',
    element: withAuth(createElement(Frame, { socketUrl: config.backendUrl }))
  },
  {
    path:"/designer",
    element: withAuth(createElement(Main))
  },
  {
    path: "/designer/maps-editor",
    element: withAuth(createElement(Section, { sectionKey: "mapsEditor" }))
  },
  {
    path: "/designer/maps-editor/:mapId",
    element: withAuth(createElement(MapEditorPage))
  },
  {
    path: "/designer/skills-gfx",
    element: withAuth(createElement(Section, { sectionKey: "skillsGfx" }))
  },
  {
    path: "/designer/pokemons",
    element: withAuth(createElement(Section, { sectionKey: "pokemons" }))
  },
  {
    path: "/designer/objects",
    element: withAuth(createElement(Section, { sectionKey: "objects" }))
  },
  {
    path: "/designer/items",
    element: withAuth(createElement(Section, { sectionKey: "items" }))
  },
  {
    path: "/designer/skills",
    element: withAuth(createElement(Section, { sectionKey: "skills" }))
  },
  {
    path: "/designer/passive-states",
    element: withAuth(createElement(Section, { sectionKey: "passiveStates" }))
  },
  {
    path: "/designer/players",
    element: withAuth(createElement(Section, { sectionKey: "players" }))
  },
  {
    path: "/designer/regions",
    element: withAuth(createElement(Section, { sectionKey: "regions" }))
  },
  {
    path: "/designer/npcs",
    element: withAuth(createElement(Section, { sectionKey: "npcs" }))
  },
  {
    path: '*',
    element: createElement(Navigate, { to: '/', replace: true })
  },
  
];

export const createAppRouter = (config: RuntimeConfig) =>
  createHashRouter(createEndpoints(config));
