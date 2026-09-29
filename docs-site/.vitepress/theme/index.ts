// Without VitePress's bundled Inter: the site sets Hanken Grotesk and PT Serif (custom.css).
import DefaultTheme from 'vitepress/theme-without-fonts';
import { h } from 'vue';
import MolenHome from './MolenHome.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  // The landing page (layout: home) draws its top half itself; see MolenHome.vue.
  Layout: () => h(DefaultTheme.Layout, null, { 'home-hero-before': () => h(MolenHome) }),
};
