import { createElement } from 'react';
import { Navigate, createHashRouter, type RouteObject } from 'react-router-dom';
import Game from './components/game/Game';
import Login from './components/ux/auth';
import NewPlayerForm from './components/ux/auth/NewPlayerForm';
import RecoverPassword from './components/ux/auth/RecoverPassword';
import RecoverUsername from './components/ux/auth/RecoverUsername';
import RequireAuth from './components/ux/auth/RequireAuth';
import ValidateEmail from './components/ux/auth/ValidateEmail';

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
    element: createElement(
      RequireAuth,
      undefined,
      createElement(Game, { socketUrl: config.backendUrl })
    )
  },
  {
    path: '*',
    element: createElement(Navigate, { to: '/', replace: true })
  },
  
];

export const createAppRouter = (config: RuntimeConfig) =>
  createHashRouter(createEndpoints(config));
