import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout, type BrandingProps } from './BaseLayout';
import { buttonStyle, headingStyle, mutedTextStyle, textStyle } from './styles';

export interface BusinessInviteProps extends BrandingProps {
  inviterName: string;
  businessName: string;
  inviteUrl: string;
  role?: string;
}

export function BusinessInvite({
  inviterName,
  businessName,
  inviteUrl,
  role,
  ...branding
}: BusinessInviteProps) {
  return (
    <BaseLayout previewText={`${inviterName} invited you to join ${businessName}`} {...branding}>
      <Heading style={headingStyle}>You&apos;re invited to {businessName}</Heading>
      <Text style={textStyle}>
        {inviterName} invited you to join <strong>{businessName}</strong>
        {role ? ` as ${role}` : ''} on {branding.appName ?? 'Ventidoc'}.
      </Text>
      <Button href={inviteUrl} style={buttonStyle(branding.primaryColor ?? '#0f172a')}>
        Accept invitation
      </Button>
      <Text style={mutedTextStyle}>Or paste this link into your browser: {inviteUrl}</Text>
    </BaseLayout>
  );
}

BusinessInvite.PreviewProps = {
  inviterName: 'Ada',
  businessName: 'Lagos Fashion Co',
  inviteUrl: 'https://ventidoc.local/invites/preview',
  role: 'Shop manager',
} satisfies BusinessInviteProps;

export default BusinessInvite;
