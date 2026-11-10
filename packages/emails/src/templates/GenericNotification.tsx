import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout, type BrandingProps } from './BaseLayout';
import { buttonStyle, headingStyle, textStyle } from './styles';

export interface GenericNotificationProps extends BrandingProps {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

export function GenericNotification({
  title,
  message,
  actionUrl,
  actionLabel = 'View details',
  ...branding
}: GenericNotificationProps) {
  return (
    <BaseLayout previewText={title} {...branding}>
      <Heading style={headingStyle}>{title}</Heading>
      <Text style={textStyle}>{message}</Text>
      {actionUrl ? (
        <Button href={actionUrl} style={buttonStyle(branding.primaryColor ?? '#0f172a')}>
          {actionLabel}
        </Button>
      ) : null}
    </BaseLayout>
  );
}

GenericNotification.PreviewProps = {
  title: 'Your weekly report is ready',
  message: 'Sales, inventory and staff activity for the past 7 days are ready to view.',
  actionUrl: 'https://ventidoc.local/reports/preview',
  actionLabel: 'View report',
} satisfies GenericNotificationProps;

export default GenericNotification;
