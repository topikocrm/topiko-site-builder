# Section Guidelines for Topiko Themes

This document explains how to add new section components and configure section ordering in Topiko.

## Adding a New Section Component

### 1. Create the Section Component

Create a new `.astro` file in the appropriate theme folder (e.g., `/themes/salon/MySection.astro`):

```astro
---
export interface Props {
  siteConfig: any;
  section?: any;
}

const { siteConfig, section } = Astro.props;
const sectionProps = section?.props || {};

// Use sectionProps for configuration
const title = sectionProps.title || "Default Title";
const limit = sectionProps.limit ?? 3;
---

<section class="py-16 px-4">
  <!-- Your section content here -->
  <h2>{title}</h2>
</section>
```

### 2. Register in Theme Registry

Add your new component to `/src/theme-registry.ts`:

```typescript
import MySection from '../themes/salon/MySection.astro';

export const sectionRegistry = {
  hero: Hero,
  about: About,
  services: Services,
  mySection: MySection,  // Add here
  gallery: Gallery,
  footer: Footer,
} as const;
```

### 3. Component Requirements

- **Props Interface**: Always accept `siteConfig` and optional `section`
- **Section Props**: Use `section?.props || {}` to access configuration
- **Error Handling**: Handle missing or invalid props gracefully
- **Responsive Design**: Use TailwindCSS classes for mobile-first design
- **Color Variables**: Use CSS variables from the color preset system

## Using Section Props in siteConfig

### Simple Section Array
```json
{
  "sections": ["hero", "about", "services", "footer"]
}
```

### Rich Section Array with Props
```json
{
  "sections": [
    { "type": "hero" },
    { "type": "services", "props": { "limit": 2, "title": "Featured Services" } },
    { "type": "gallery", "props": { "columns": 4 } },
    { "type": "footer" }
  ]
}
```

## Section Props Examples

### Common Props Patterns

- **`limit`**: Number of items to display (e.g., services, gallery items)
- **`title`**: Override default section title
- **`subtitle`**: Override default section subtitle
- **`variant`**: Different visual styles ("minimal", "featured", etc.)
- **`columns`**: Grid column count for layout
- **`showCta`**: Boolean to show/hide call-to-action buttons

### Example: Services Section with Limit
```json
{
  "type": "services",
  "props": {
    "limit": 2,
    "title": "Featured Services",
    "showCta": false
  }
}
```

## Best Practices

1. **Fallback Values**: Always provide sensible defaults for props
2. **Type Safety**: Use TypeScript interfaces for better development experience
3. **Performance**: Only import components that are actually used
4. **Validation**: The registry validates section types and logs warnings for invalid ones
5. **Graceful Degradation**: If a section fails to render, it's skipped without breaking the page

## Testing Your Sections

### Manual Validation Steps:

1. **Update siteConfig.json** with your new section:
   ```json
   {
     "sections": [
       { "type": "hero" },
       { "type": "mySection", "props": { "limit": 5 } }
     ]
   }
   ```

2. **Run build** to check for errors:
   ```bash
   npm run build
   ```

3. **Check console** for registry warnings about missing components

4. **Verify order** in the built HTML matches your sections array

5. **Test props** by changing values and rebuilding

## Integration with CMS

When building a CMS interface for section management:

- Provide drag-and-drop ordering for the `sections` array
- Create forms for each section type's specific props
- Validate section types against the registry
- Offer preset configurations for common section combinations
- Allow toggling sections on/off without removing configuration

This system enables flexible page layouts while maintaining type safety and component reusability.