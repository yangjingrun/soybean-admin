declare module 'svg-captcha' {
  interface CaptchaOptions {
    size?: number;
    noise?: number;
    color?: boolean;
    background?: string;
    ignoreChars?: string;
    charPreset?: string;
  }

  interface Captcha {
    text: string;
    data: string;
  }

  export function create(options?: CaptchaOptions): Captcha;
}
