import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout, type BrandingProps } from './BaseLayout';
import { buttonStyle, headingStyle, mutedTextStyle, textStyle } from './styles';

export interface PasswordResetProps extends BrandingProps {
  recipientName?: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export function PasswordReset({
  recipientName,
  resetUrl,
  expiresInMinutes = 30,
  ...branding
}: PasswordResetProps) {
  return (
    <BaseLayout previewText="Reset your password" {...branding}>
      <Heading style={headingStyle}>Reset your password</Heading>
      <Text style={textStyle}>
        Hi{recipientName ? ` ${recipientName}` : ''}, we received a request to reset your password.
        This link expires in {expiresInMinutes} minutes. If you didn&apos;t request this, you can
        safely ignore this email.
      </Text>
      <Button href={resetUrl} style={buttonStyle(branding.primaryColor ?? '#0f172a')}>
        Reset password
      </Button>
      <Text style={mutedTextStyle}>Or paste this link into your browser: {resetUrl}</Text>
    </BaseLayout>
  );
}

PasswordReset.PreviewProps = {
  recipientName: 'Ada',
  resetUrl: 'https://ventidoc.local/reset-password?token=preview',
  expiresInMinutes: 30,
} satisfies PasswordResetProps;

export default PasswordReset;
