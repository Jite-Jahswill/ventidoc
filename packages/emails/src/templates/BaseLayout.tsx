import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { bodyStyle, containerStyle, mutedTextStyle } from './styles';

export interface BrandingProps {
  appName?: string;
  logoUrl?: string;
  primaryColor?: string;
  footerText?: string;
  supportEmail?: string;
}

/**
 * Branding will come from the database in Stage 5 (the platform-admin CMS);
 * for now every template falls back to these Ventidoc defaults.
 */
export const DEFAULT_BRANDING: Required<BrandingProps> = {
  appName: 'Ventidoc',
  logoUrl: 'https://ventidoc.local/logo.png',
  primaryColor: '#0f172a',
  footerText: 'Ventidoc. All rights reserved.',
  supportEmail: 'support@ventidoc.local',
};

export interface BaseLayoutProps extends BrandingProps {
  previewText: string;
  children: ReactNode;
}

export function BaseLayout({
  previewText,
  children,
  appName = DEFAULT_BRANDING.appName,
  logoUrl = DEFAULT_BRANDING.logoUrl,
  primaryColor = DEFAULT_BRANDING.primaryColor,
  footerText = DEFAULT_BRANDING.footerText,
  supportEmail = DEFAULT_BRANDING.supportEmail,
}: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Img src={logoUrl} alt={appName} width="40" height="40" />
            <Text
              style={{ fontSize: '18px', fontWeight: 700, color: primaryColor, margin: '8px 0 0' }}
            >
              {appName}
            </Text>
          </Section>
          {children}
          <Hr style={{ borderColor: '#e4e4e7', margin: '24px 0' }} />
          <Text style={mutedTextStyle}>
            {footerText} Need help? Contact us at {supportEmail}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default BaseLayout;
