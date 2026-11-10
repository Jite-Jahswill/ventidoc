import type { CSSProperties } from 'react';

export const bodyStyle: CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: 'Helvetica, Arial, sans-serif',
  margin: 0,
  padding: '24px 0',
};

export const containerStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px',
};

export const headingStyle: CSSProperties = {
  fontSize: '20px',
  margin: '0 0 16px',
};

export const textStyle: CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#27272a',
};

export const mutedTextStyle: CSSProperties = {
  fontSize: '12px',
  color: '#71717a',
};

export function buttonStyle(primaryColor: string): CSSProperties {
  return {
    backgroundColor: primaryColor,
    borderRadius: '6px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '14px',
    fontWeight: 600,
    padding: '12px 24px',
    textDecoration: 'none',
    margin: '16px 0',
  };
}
