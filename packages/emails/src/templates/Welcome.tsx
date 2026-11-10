import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout, type BrandingProps } from './BaseLayout';
import { buttonStyle, headingStyle, textStyle } from './styles';

export interface WelcomeProps extends BrandingProps {
  recipientName?: string;
  appUrl: string;
}

export function Welcome({ recipientName, appUrl, ...branding }: WelcomeProps) {
  const appName = branding.appName ?? 'Ventidoc';
  return (
    <BaseLayout previewText={`Welcome to ${appName}`} {...branding}>
      <Heading style={headingStyle}>Welcome{recipientName ? `, ${recipientName}` : ''}!</Heading>
      <Text style={textStyle}>
        Your account is ready. Sign in to set up your shops, invite your team, and start tracking
        inventory and sales.
      </Text>
      <Button href={appUrl} style={buttonStyle(branding.primaryColor ?? '#0f172a')}>
        Go to {appName}
      </Button>
    </BaseLayout>
  );
}

Welcome.PreviewProps = {
  recipientName: 'Ada',
  appUrl: 'https://ventidoc.local/app',
} satisfies WelcomeProps;

export default Welcome;
