import React from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

const RECAPTCHA_SITE_KEY =
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"

interface ReCaptchaProps {
  onChange: (value: string | null) => void;
}

export const ReCaptcha: React.FC<ReCaptchaProps> = ({ onChange }) => {
  return <ReCAPTCHA sitekey={RECAPTCHA_SITE_KEY} onChange={onChange}/>;
};
