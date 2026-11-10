import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout, type BrandingProps } from './BaseLayout';
import { buttonStyle, headingStyle, mutedTextStyle, textStyle } from './styles';

export interface VerifyEmailProps extends BrandingProps {
  recipientName?: string;
  verifyUrl: string;
}

export function VerifyEmail({ recipientName, verifyUrl, ...branding }: VerifyEmailProps) {
  return (
    <BaseLayout previewText="Verify your email address" {...branding}>
      <Heading style={headingStyle}>Verify your email</Heading>
      <Text style={textStyle}>
        Hi{recipientName ? ` ${recipientName}` : ''}, confirm this is your email address to finish
        setting up your account.
      </Text>
      <Button href={verifyUrl} style={buttonStyle(branding.primaryColor ?? '#0f172a')}>
        Verify email
      </Button>
      <Text style={mutedTextStyle}>Or paste this link into your browser: {verifyUrl}</Text>
    </BaseLayout>
  );
}

VerifyEmail.PreviewProps = {
  recipientName: 'Ada',
  verifyUrl: 'https://ventidoc.local/verify?token=preview',
} satisfies VerifyEmailProps;

export default VerifyEmail;
