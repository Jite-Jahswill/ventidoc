import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import type {
  BusinessInviteProps,
  GenericNotificationProps,
  TemplateName,
  TemplateRegistry,
  WelcomeProps,
} from './templates';
import { templateComponents } from './templates';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function subjectFor<Name extends TemplateName>(name: Name, props: TemplateRegistry[Name]): string {
  switch (name) {
    case 'VerifyEmail':
      return 'Verify your email address';
    case 'PasswordReset':
      return 'Reset your password';
    case 'Welcome':
      return `Welcome to ${(props as WelcomeProps).appName ?? 'Ventidoc'}`;
    case 'BusinessInvite': {
      const invite = props as BusinessInviteProps;
      return `${invite.inviterName} invited you to join ${invite.businessName}`;
    }
    case 'GenericNotification':
      return (props as GenericNotificationProps).title;
    default: {
      const exhaustive: never = name;
      throw new Error(`Unknown template: ${String(exhaustive)}`);
    }
  }
}

/** Renders a template to a subject line plus HTML and plain-text bodies. */
export async function renderTemplate<Name extends TemplateName>(
  name: Name,
  props: TemplateRegistry[Name],
): Promise<RenderedEmail> {
  const Component = templateComponents[name];
  const element = Component(props) as ReactElement;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: subjectFor(name, props), html, text };
}
