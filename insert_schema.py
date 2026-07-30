import sys

snippet = '''<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  "name": "Bharath Kadiyala",
  "alternateName": "Luxury Redefined Palm Beach",
  "url": "https://luxuryredefined.homes/",
  "image": "https://luxuryredefined.homes/DaltonWade_Logo.png",
  "telephone": "+1-813-400-0620",
  "email": "brkadiyala@gmail.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "1st Ave S, Ste 200",
    "addressLocality": "St. Petersburg",
    "addressRegion": "FL",
    "postalCode": "33701",
    "addressCountry": "US"
  },
  "areaServed": [
    { "@type": "City", "name": "Palm Beach" },
    { "@type": "City", "name": "Jupiter" },
    { "@type": "City", "name": "Boca Raton" },
    { "@type": "City", "name": "Manalapan" },
    { "@type": "City", "name": "Delray Beach" }
  ],
  "worksFor": {
    "@type": "RealEstateAgent",
    "name": "Dalton Wade Real Estate Group",
    "url": "https://luxuryredefined.homes/"
  }
}
</script>
'''

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'application/ld+json' in content:
    print(f"SKIPPED (already has schema): {path}")
else:
    content = content.replace('</head>', snippet + '</head>', 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"UPDATED: {path}")
