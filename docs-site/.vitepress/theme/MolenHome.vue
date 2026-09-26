<script setup lang="ts">
// The landing page's top half, drawn from the `intro`, `showcase` and `pillars` frontmatter of
// docs-site/index.md. It replaces VitePress's hero and feature cards with the gallery's language:
// serif headings, ruled surfaces on paper, one accent. The page's markdown renders below it.
import { useData } from 'vitepress';
import { computed } from 'vue';

interface Action {
  theme?: 'brand' | 'alt';
  text: string;
  link: string;
}

interface Pillar {
  title: string;
  details: string;
  link: string;
  linkText: string;
}

const { frontmatter } = useData();
const intro = computed(
  () =>
    frontmatter.value.intro as
      | { name: string; text: string; tagline: string; actions?: Action[] }
      | undefined,
);
const showcase = computed(
  () =>
    frontmatter.value.showcase as
      | { image: string; alt: string; title: string; caption: string; link: string }
      | undefined,
);
const pillars = computed(() => (frontmatter.value.pillars ?? []) as Pillar[]);

/** /play/ and /packs/ are staged beside the site, not pages: load them in full (see config.mts). */
const target = (link: string) => (/^\/(?:play|packs)(?:[/?#]|$)/.test(link) ? '_self' : undefined);
</script>

<template>
  <div v-if="intro" class="MolenHome">
    <section class="intro">
      <div class="copy">
        <h1>
          <span class="name">{{ intro.name }}</span>
          <span class="text">{{ intro.text }}</span>
        </h1>
        <p class="tagline">{{ intro.tagline }}</p>
        <div v-if="intro.actions" class="actions">
          <a
            v-for="action in intro.actions"
            :key="action.link"
            class="button"
            :class="action.theme ?? 'alt'"
            :href="action.link"
            :target="target(action.link)"
            >{{ action.text }}</a
          >
        </div>
      </div>

      <figure v-if="showcase" class="showcase">
        <a :href="showcase.link" :target="target(showcase.link)" tabindex="-1">
          <img :src="showcase.image" :alt="showcase.alt" width="1280" height="800" />
        </a>
        <figcaption>
          <strong>{{ showcase.title }}</strong> — {{ showcase.caption }}
          <a :href="showcase.link" :target="target(showcase.link)">Play it <span aria-hidden="true">→</span></a>
        </figcaption>
      </figure>
    </section>

    <ul v-if="pillars.length > 0" class="pillars">
      <li v-for="pillar in pillars" :key="pillar.title">
        <h2>{{ pillar.title }}</h2>
        <p>{{ pillar.details }}</p>
        <a :href="pillar.link">{{ pillar.linkText }} <span aria-hidden="true">→</span></a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.MolenHome {
  margin: 0 auto;
  max-width: 1280px;
  padding: 0 24px;
}

@media (min-width: 640px) {
  .MolenHome {
    padding: 0 48px;
  }
}

@media (min-width: 960px) {
  .MolenHome {
    padding: 0 64px;
  }
}

.intro {
  display: grid;
  gap: 40px;
  padding: 48px 0 40px;
}

@media (min-width: 960px) {
  .intro {
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
    align-items: center;
    gap: 56px;
    padding: 80px 0 64px;
  }
}

h1 {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  font-family: var(--molen-font-heading);
  font-weight: 400;
}

.name {
  color: var(--molen-accent);
  font-size: 52px;
  line-height: 1.05;
}

.text {
  color: var(--vp-c-text-1);
  font-size: 34px;
  line-height: 1.2;
}

@media (min-width: 640px) {
  .name {
    font-size: 64px;
  }

  .text {
    font-size: 42px;
  }
}

.tagline {
  max-width: 34em;
  margin: 20px 0 0;
  color: var(--vp-c-text-2);
  font-size: 19px;
  line-height: 1.6;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 32px;
}

.button {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: var(--molen-radius);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.button.brand {
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
}

.button.brand:hover {
  background: var(--vp-button-brand-hover-bg);
}

.button.alt {
  border-color: var(--vp-button-alt-border);
  background: var(--vp-button-alt-bg);
  color: var(--vp-button-alt-text);
}

.button.alt:hover {
  border-color: var(--vp-button-alt-hover-border);
  background: var(--vp-button-alt-hover-bg);
}

.showcase {
  margin: 0;
}

.showcase img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--molen-radius);
  box-shadow: var(--molen-shadow);
}

.showcase figcaption {
  margin-top: 14px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.55;
}

.showcase figcaption strong {
  color: var(--vp-c-text-1);
  font-weight: 600;
}

.showcase figcaption a,
.pillars a {
  color: var(--vp-c-brand-1);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.showcase figcaption a:hover,
.pillars a:hover {
  color: var(--vp-c-brand-2);
  text-decoration: underline;
  text-underline-offset: 4px;
}

.pillars {
  display: grid;
  margin: 0;
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--molen-radius);
  background: var(--molen-surface);
  list-style: none;
}

@media (min-width: 640px) {
  .pillars {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .pillars {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.pillars li {
  display: flex;
  flex-direction: column;
  padding: 24px;
  border-top: 1px solid var(--vp-c-divider);
}

.pillars li:first-child {
  border-top: 0;
}

@media (min-width: 640px) {
  .pillars li:nth-child(-n + 2) {
    border-top: 0;
  }

  .pillars li:nth-child(2n) {
    border-left: 1px solid var(--vp-c-divider);
  }
}

@media (min-width: 1100px) {
  .pillars li {
    border-top: 0;
  }

  .pillars li + li {
    border-left: 1px solid var(--vp-c-divider);
  }
}

.pillars h2 {
  margin: 0;
  font-family: var(--molen-font-heading);
  font-size: 20px;
  font-weight: 400;
  line-height: 1.35;
}

.pillars p {
  flex-grow: 1;
  margin: 10px 0 18px;
  color: var(--vp-c-text-2);
  font-size: 14.5px;
  line-height: 1.6;
}

.pillars a {
  font-size: 14px;
}
</style>
