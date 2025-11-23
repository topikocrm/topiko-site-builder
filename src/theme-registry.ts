/**
 * Theme Registry System for Topiko
 * 
 * This registry maps section type keys to their corresponding Astro components
 * for each theme. It supports dynamic section ordering and configuration.
 */

import Hero from '../themes/salon/Hero.astro';
import About from '../themes/salon/About.astro';
import Services from '../themes/salon/Services.astro';
import Gallery from '../themes/salon/Gallery.astro';
import Footer from '../themes/salon/Footer.astro';

// Type definitions for section configuration
export interface SectionConfig {
  type: string;
  props?: Record<string, any>;
}

export type SectionDefinition = string | SectionConfig;

// Registry mapping section types to components
export const sectionRegistry = {
  hero: Hero,
  about: About,
  services: Services,
  gallery: Gallery,
  footer: Footer,
} as const;

// Type for available section types
export type SectionType = keyof typeof sectionRegistry;

/**
 * Get a section component by type
 * @param type - The section type key
 * @returns The Astro component or null if not found
 */
export function getSectionComponent(type: string) {
  const component = sectionRegistry[type as SectionType];
  
  if (!component) {
    console.warn(`[Theme Registry] Section type "${type}" not found in registry. Available types: ${Object.keys(sectionRegistry).join(', ')}`);
    return null;
  }
  
  return component;
}

/**
 * Normalize section definition to consistent format
 * @param section - Either a string or SectionConfig object
 * @returns Normalized SectionConfig
 */
export function normalizeSectionConfig(section: SectionDefinition): SectionConfig {
  if (typeof section === 'string') {
    return { type: section };
  }
  return section;
}

/**
 * Get default sections order for fallback
 */
export function getDefaultSections(): SectionDefinition[] {
  return ['hero', 'about', 'services', 'footer'];
}

/**
 * Validate sections array
 * @param sections - Array of section definitions
 * @returns Array of valid sections with warnings for invalid ones
 */
export function validateSections(sections: SectionDefinition[]): SectionConfig[] {
  return sections
    .map(normalizeSectionConfig)
    .filter(section => {
      const isValid = getSectionComponent(section.type) !== null;
      if (!isValid) {
        console.warn(`[Theme Registry] Skipping invalid section: ${section.type}`);
      }
      return isValid;
    });
}