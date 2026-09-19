/**
 * Ambient type declarations for CDN-loaded libraries in ABot.
 * These scripts are loaded in index.html.
 */
declare const firebase: any;
declare const marked: any;
declare const hljs: any;
declare const google: any;
declare const VANTA: any;

interface Window {
  ABOT_BUILD?: string;
  __abotErrors?: string[];
  google?: any;
  firebase?: any;
  marked?: any;
  hljs?: any;
}
