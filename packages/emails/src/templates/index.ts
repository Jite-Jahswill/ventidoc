import type { ReactElement } from 'react';
import { BusinessInvite, type BusinessInviteProps } from './BusinessInvite';
import { GenericNotification, type GenericNotificationProps } from './GenericNotification';
import { PasswordReset, type PasswordResetProps } from './PasswordReset';
import { VerifyEmail, type VerifyEmailProps } from './VerifyEmail';
import { Welcome, type WelcomeProps } from './Welcome';

export { BaseLayout, DEFAULT_BRANDING } from './BaseLayout';
export type { BaseLayoutProps, BrandingProps } from './BaseLayout';
export { BusinessInvite } from './BusinessInvite';
export type { BusinessInviteProps } from './BusinessInvite';
export { GenericNotification } from './GenericNotification';
export type { GenericNotificationProps } from './GenericNotification';
export { PasswordReset } from './PasswordReset';
export type { PasswordResetProps } from './PasswordReset';
export { VerifyEmail } from './VerifyEmail';
export type { VerifyEmailProps } from './VerifyEmail';
export { Welcome } from './Welcome';
export type { WelcomeProps } from './Welcome';

export interface TemplateRegistry {
  VerifyEmail: VerifyEmailProps;
  PasswordReset: PasswordResetProps;
  Welcome: WelcomeProps;
  BusinessInvite: BusinessInviteProps;
  GenericNotification: GenericNotificationProps;
}

export type TemplateName = keyof TemplateRegistry;

type TemplateComponent<Name extends TemplateName> = (props: TemplateRegistry[Name]) => ReactElement;

export const templateComponents: { [Name in TemplateName]: TemplateComponent<Name> } = {
  VerifyEmail,
  PasswordReset,
  Welcome,
  BusinessInvite,
  GenericNotification,
};
