/**
 * _worker.js
 *
 * This is the entry point for the Cloudflare Worker deployment of this site
 * (created via `wrangler deploy`, as opposed to a Cloudflare Pages deployment).
 *
 * Why this file exists: a plain Worker with static assets does NOT
 * automatically turn a /functions/api/*.js folder into live routes —
 * that convention only exists on Cloudflare Pages. Since this project was
 * deployed as a Worker, this file manually does that job: it handles
 * /api/lead and /api/concierge directly, and passes every other request
 * through to the static site files (env.ASSETS).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const SYSTEM_PROMPT = `You are the Palm Beach Private Concierge for "Luxury Redefined Palm Beach," a website operated by licensed agents of Dalton Wade Real Estate Group (Broker: Bharath Kadiyala, License #BK3462426, Florida Firm License #CQ1047837, 1st Ave S Ste 200, St. Petersburg, FL 33701). You represent a private, high-touch real estate advisory practice, not a discount brokerage — lead with expertise and discretion, not price.

Facts you can rely on:
- Service area: Palm Beach County — Palm Beach, Jupiter, Boca Raton, Manalapan, Delray Beach.
- Property types: waterfront estates, golf community homes, new construction, luxury condos.
- Buyer agency fee: 1.45% of purchase price, per the written buyer representation agreement.
- Listing commission (for sellers): 3.95% total, set out in a written listing agreement.
- Buyer rebate: up to 1.5% of the purchase price credited back at closing. This is an estimate, subject to the purchase contract, seller cooperation, and lender approval. Treat this as a VIP benefit you mention once you understand what the person is looking for — never lead with it, and never present savings as the main reason to work with us.
- For any specific rebate number, always direct the person to the on-site rebate calculator rather than computing or quoting an exact dollar figure yourself — say something like "this may also qualify for a buyer benefit at closing — I can have our calculator estimate that for you, or a specialist can confirm the exact numbers." Do not do the rebate math yourself in chat; the calculator handles it with the required Florida disclosures attached.
- Private clubs we work in most: The Bears Club and Admirals Cove (Jupiter), Old Palm Golf Club (Palm Beach Gardens), Frenchman's Creek (Palm Beach Gardens). Club membership is a separate application from the real estate purchase and is not guaranteed by the brokerage — always mention this if a club is discussed.
- New developments / pre-construction: we track upcoming projects across the county before general public release; specific current projects should come from the New Developments page, not be invented.
- Off-market / private access: buyers can share their criteria to receive pocket listings and first-look opportunities before they hit the open market. Sellers can also start a discreet, pre-MLS marketing process.
- The site has dedicated community pages (Palm Beach, Jupiter, Boca Raton, Manalapan), a private clubs page, a new developments page, an about/team page, and market insight articles — you can refer people to these by name so they can read more.
- This is a real estate brokerage, not a lender or attorney — do not give legal, tax, or loan advice; suggest the person consult the appropriate licensed professional for those questions.

How to behave:
- Sound like a private advisor, not a chatbot: warm, unhurried, specific. Sentence case, no exclamation points, no corporate filler.
- Every reply follows a reflect, then advance, then invite structure: first acknowledge or reference something specific the person just said (in their own words, not a generic paraphrase) — never just chain straight to a new question. Then, if something essential is still missing, advance by asking exactly one thing. Close with an invite — a soft, forward-moving line rather than a flat question, e.g. offering to pull options together rather than asking if there's anything else.
- Only two things are ever essential before you can help meaningfully: their lifestyle/community priority (ocean access, golf, walkability, privacy, new construction — pick up to two) and their budget range. Ask for whichever of these two is still missing, in that order, one at a time — never both in the same message, and never ask for one they've already told you.
- Everything else (bedrooms, boat dock, gated community, timeline, and similar) is optional color. Invite it conversationally once rather than demanding it — e.g. "anything else that's a must-have, or should I pull a few options together now?" — and proceed either way.
- If the person already volunteers both their priority and their budget in one message, skip straight to reflecting and offering to pull options or connect them with a specialist — do not ask anything further just to be thorough.
- Never stack more than one question in a single reply, even if it's phrased as one sentence with "and."
- IDX/live listings: you have a search_listings tool connected to the real BeachesMLS feed. Once you have at least one concrete, specific filter (a city, a price range, a bed count, or a property type), call it — don't wait to gather everything first. If it returns real results, reference those specific addresses, prices, and details in your reply. If it returns nothing, say so plainly and offer to connect them with a specialist for off-market options rather than inventing a listing.
- If someone wants to book a consultation, get a valuation, request off-market access, or asks something you can't fully answer, ask for their name and best phone number so a specialist can follow up — do not just say goodbye.
- Keep replies under about 60 words unless the person explicitly asks for more detail or an explanation (e.g. "why Jupiter over Palm Beach?"). Long-form answers are for when they're asked for, not the default.
- Whenever a short multiple-choice question would move the conversation forward faster than open text (e.g. "direct oceanfront or Intracoastal with a dock?"), end your reply with the exact marker "[SUGGEST: Option One | Option Two | Option Three]" on its own line -- 2 to 4 short options (2-4 words each), or up to 5 for the "help me choose an area" lifestyle question specifically. Never mention this marker or explain it; it's a signal for the website to render clickable buttons, not part of your visible reply.
- This is a hard rule, not a suggestion: if your own sentence lists 2-5 specific named options -- whether that's price tiers you're proposing ("$5-10M, $10-15M, or $15M+"), locations, property features, or anything else -- you MUST restate those exact same options in a [SUGGEST] marker. Never write out a set of concrete choices as plain prose without the marker; that forces the person back to typing when a tap would do. The only time to skip the marker is a genuinely open question with no bounded set of answers (e.g. "what's your budget?" with nothing proposed).
- "Help me choose an area" flow: if someone doesn't know where to buy, or explicitly asks for this, ask "Which lifestyle sounds most like you?" and offer "[SUGGEST: Oceanfront & social | Boating & privacy | Golf & club life | Walkable & cosmopolitan | Quiet estate living]". Once they pick one, recommend the community(ies) that fit best (Palm Beach, Jupiter, Boca Raton, or Manalapan) with a one-line reason for each, grounded in the facts above.
- Once the conversation has established genuine buying or selling intent with at least one specific detail (a location, a budget, a property type, or a timeline), end that reply with the exact marker "[CAPTURE_LEAD]" on its own line, after your normal message (and after any [SUGGEST] marker, if both apply). Use this at most once per conversation. Never mention this marker to the person or explain what it does — it is a signal for the website, not part of your visible reply.`;

function json(body, status = 200, noStore = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (noStore) headers['Cache-Control'] = 'no-store';
  return new Response(JSON.stringify(body), { status, headers });
}

/* Simple HTTP Basic Auth gate for the internal content-agent tools below
   (listing description writer admin form + its API). Username can be
   anything; only the password is checked, against the ADMIN_PASSWORD
   secret. Browsers cache Basic Auth credentials per-origin after the first
   successful prompt, so the admin form's fetch() calls don't need to
   re-send credentials manually. */
function checkAdminAuth(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Basic ')) return false;
  try {
    const decoded = atob(auth.slice(6));
    const password = decoded.split(':').slice(1).join(':');
    return password === env.ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

function requireAdminAuth() {
  return new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Luxury Redefined admin tools"' }
  });
}

async function handleLead(request, env) {
  let lead;
  try {
    lead = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!lead.name || !lead.email) {
    return json({ error: 'Name and email are required' }, 400);
  }

  const name = String(lead.name).slice(0, 200);
  const email = String(lead.email).slice(0, 200);
  const phone = String(lead.phone || 'Not provided').slice(0, 60);
  const source = String(lead.source || 'buyer').slice(0, 60);
  const site = String(lead.site || 'luxuryredefined.homes').slice(0, 200);
  const referral = String(lead.referral || '').slice(0, 60);
  const messageBody = String(lead.message || '').slice(0, 2000);

  const toAddress = env.LEAD_EMAIL || 'brkadiyala@gmail.com';
  const fromAddress = env.FROM_EMAIL || 'Luxury Redefined <leads@luxuryredefined.homes>';

  if (!env.RESEND_API_KEY) {
    return json({ error: 'Email service is not configured yet (missing RESEND_API_KEY).' }, 500);
  }

  const sourceLabels = {
    seller: 'Seller — Request a valuation',
    buyer: 'Buyer — Concierge / consultation',
    'off-market': 'Buyer — Off-market / private access request',
    club: 'Buyer — Private club community inquiry',
    'new-development': 'Buyer — New development / pre-construction inquiry',
    'rebate-calculator': 'Buyer — Requested exact rebate number from calculator',
    'contact-page': 'Contact page — general inquiry',
    'get-matched': 'Buyer — Completed guided wizard, requesting a match',
    'concierge-inline': 'Buyer — Captured mid-conversation with AI concierge'
  };

  // High-intent sources get flagged as HOT LEAD — these are people who took a
  // specific buying/selling action, not just a general inquiry.
  const hotSources = ['seller', 'off-market', 'club', 'new-development', 'rebate-calculator', 'get-matched', 'concierge-inline'];
  const isHot = hotSources.includes(source);

  const now = new Date();
  const submittedAt = now.toLocaleString('en-US', {
    timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short'
  }) + ' ET';

  const subject = isHot
    ? `🔥 HOT LEAD — ${name} (${sourceLabels[source] || source})`
    : `New inquiry — ${name}`;

  const text = [
    isHot ? `🔥 HOT LEAD — respond quickly` : `New website inquiry`,
    `Submitted: ${submittedAt}`,
    `Source: ${sourceLabels[source] || source}`,
    ``,
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Phone:   ${phone}`,
    referral ? `Found us via: ${referral}` : null,
    messageBody ? `\nWhat they're looking for:\n${messageBody}` : null,
    ``,
    `Reply directly to this email to reach the lead at ${email}.`
  ].filter(line => line !== null).join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: fromAddress, to: [toAddress], reply_to: email, subject, text })
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: 'Email provider rejected the request', detail }, 502);
    }

    // Push to kvCORE too, if configured. This never blocks or fails the
    // response to the visitor — the primary notification email above is the
    // reliable path; the kvCORE sync is a bonus that degrades gracefully if
    // the address or format ever need adjusting.
    console.log('kvCORE env var check:', env.KVCORE_LEAD_EMAIL ? `SET to ${env.KVCORE_LEAD_EMAIL}` : 'NOT SET');
    if (env.KVCORE_LEAD_EMAIL) {
      try {
        console.log('Attempting kvCORE push now...');
        await pushToKvCore({ name, email, phone, source, sourceLabel: sourceLabels[source] || source, messageBody, submittedAt }, env);
        console.log('kvCORE push succeeded.');
      } catch (err) {
        console.log('kvCORE push failed (non-fatal):', String(err));
      }
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected error sending email', detail: String(err) }, 500);
  }
}

/* Sends a new lead straight to kvCORE (BoldTrail) using its built-in
   email-to-lead address (found in kvCORE under Lead Engine > Lead Dropbox
   > Creating New Leads). kvCORE's parser requires a strict template:
   - Subject line MUST literally say "Add Contact"
   - Fields must be labeled First Name / Last Name / Email / Phone /
     Deal Type, each on its own line
   Deviating from this format (as an earlier version of this code did)
   causes the email to deliver successfully but get silently dropped by
   kvCORE's parser — no error, no contact created. If kvCORE ever changes
   this template, check BoldTrail's help article "Lead Dropbox Email
   Import Template" for the current required format. */
async function pushToKvCore(lead, env) {
  const [firstName, ...rest] = lead.name.trim().split(' ');
  const lastName = rest.join(' ') || '-';

  // kvCORE's Deal Type field expects Buyer or Seller specifically.
  const dealType = lead.source === 'seller' ? 'Seller' : 'Buyer';

  const subject = 'Add Contact';

  const text = [
    `First Name: ${firstName}`,
    `Last Name: ${lastName}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone && lead.phone !== 'Not provided' ? lead.phone : ''}`,
    `Deal Type: ${dealType}`,
    `Source: Luxury Redefined Palm Beach website`,
    `Notes: ${lead.sourceLabel || lead.source}${lead.messageBody ? ' — ' + lead.messageBody : ''}`
  ].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'Luxury Redefined <leads@luxuryredefined.homes>',
      to: [env.KVCORE_LEAD_EMAIL],
      reply_to: lead.email,
      subject,
      text
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`kvCORE email push rejected (${res.status}): ${detail}`);
  }
}

/**
 * Queries BeachesMLS listing data via the Spark® Platform API (FBS/Flexmls),
 * enrolled under "BeachesMLS Agent/Broker Licensed Feed – IDX." Confirmed
 * against FBS's own documentation (sparkplatform.com/docs) rather than
 * guessed: the credential type issued for this kind of feed is a
 * non-expiring access token used as a plain Bearer token — not the older
 * signed key/secret session-token exchange some Spark integrations use.
 *
 * Base endpoint confirmed current as of the Version 3 RESO Web API:
 *   https://replication.sparkapi.com/Version/3/Reso/OData/Property
 *
 * IMPORTANT COMPLIANCE NOTE (BeachesMLS IDX Rules and Regulations, Section
 * 20): this function deliberately does NOT filter on any "internet display
 * opt-out" field (e.g. InternetEntireListingDisplayYN), because that exact
 * field name has not been verified against BeachesMLS's actual feed
 * metadata yet -- filtering on a field name that turns out to be wrong
 * would make the ENTIRE query fail, not just skip the filter. Many MLSs
 * already exclude opted-out listings before they ever reach an IDX data
 * plan, so this may be a non-issue -- but confirm with FBS/BeachesMLS
 * support (api-support@fbsdata.com) before relying on that assumption at
 * scale. $500-per-occurrence fines apply per the rules doc for IDX
 * violations, so this is worth a real answer, not a guess.
 */
const RESO_BASE_URL = 'https://replication.sparkapi.com/Version/3/Reso/OData/Property';

// Fields required to satisfy BeachesMLS's own display rules (Section 20.3.3:
// listing firm + contact; 20.3.1: only MLS-designated public fields; never
// showing instructions, private remarks, or seller/occupant info).
const RESO_SELECT_FIELDS = [
  'ListingKey', 'ListingId', 'UnparsedAddress', 'City', 'StateOrProvince', 'PostalCode',
  'ListPrice', 'BedroomsTotal', 'BathroomsTotalInteger', 'LivingArea',
  'PropertyType', 'PropertySubType', 'WaterfrontYN', 'SubdivisionName',
  'StandardStatus', 'ListOfficeName', 'ListAgentEmail', 'ListAgentDirectPhone',
  'ListOfficePhone', 'ModificationTimestamp', 'DaysOnMarket',
  'AssociationFee', 'AssociationFeeFrequency'
].join(',');

function buildResoFilter({ city, minPrice, maxPrice, beds, propertyType, subdivision }) {
  const filters = [`StandardStatus eq 'Active'`];
  if (city) filters.push(`City eq '${city.replace(/'/g, "''")}'`);
  if (minPrice) filters.push(`ListPrice ge ${Number(minPrice)}`);
  if (maxPrice) filters.push(`ListPrice le ${Number(maxPrice)}`);
  if (beds) filters.push(`BedroomsTotal ge ${Number(beds)}`);
  if (propertyType === 'Condominium' || propertyType === 'Condo') filters.push(`PropertyType eq 'Condominium'`);
  if (propertyType === 'Waterfront') filters.push(`WaterfrontYN eq true`);
  if (propertyType === 'Golf community') {
    // No standard MLS field marks "golf community" directly. Best-effort
    // approximation: match against known golf club subdivision names from
    // the site's own concierge system prompt. Revisit once real field
    // names/values come back from Spark -- some MLSs expose a cleaner
    // community/subdivision list that would make this exact rather than
    // approximate.
    const golfCommunities = ['Bears Club', 'Admirals Cove', 'Old Palm', "Frenchman's Creek"];
    const golfFilter = golfCommunities
      .map(name => `contains(SubdivisionName,'${name.replace(/'/g, "''")}')`)
      .join(' or ');
    filters.push(`(${golfFilter})`);
  }
  // Exact-match subdivision filter, used by the new-developments page CTAs to
  // link straight to that specific development's real active inventory.
  // Supports multiple pipe-separated values (e.g. a development whose
  // listings might be tagged under either of two legal plat names) --
  // exact match rather than contains() since these come from real,
  // human-verified MLS subdivision values, not a guessed keyword.
  if (subdivision) {
    const names = subdivision.split('|').map(s => s.trim()).filter(Boolean);
    const subFilter = names
      .map(name => `tolower(SubdivisionName) eq '${name.replace(/'/g, "''").toLowerCase()}'`)
      .join(' or ');
    if (subFilter) filters.push(`(${subFilter})`);
  }
  return filters.join(' and ');
}

/* Thin wrapper around the actual Spark request, with KV caching.
   Compliance note: Section 20.2.5 requires refreshing at least every 12
   hours -- this caches for 30 minutes, comfortably inside that requirement
   while keeping the site fast and avoiding hammering the MLS feed on every
   visitor. Cache key is a hash of the query itself, so different searches
   don't collide. */
async function queryResoWithCache(env, filterParams, top, skip) {
  const filterClause = buildResoFilter(filterParams);
  const cacheKey = `idx-cache:${filterClause}:top${top}:skip${skip}`;

  if (env.REPORTS_KV) {
    const cached = await env.REPORTS_KV.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const query = new URLSearchParams({
    '$filter': filterClause,
    '$select': RESO_SELECT_FIELDS,
    '$expand': 'Media',
    '$top': String(top),
    '$skip': String(skip),
    '$count': 'true'
  });

  const res = await fetch(`${RESO_BASE_URL}?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${env.SPARK_ACCESS_TOKEN}`,
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Spark API rejected the request (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const result = { listings: data.value || [], total: data['@odata.count'] ?? null };

  if (env.REPORTS_KV) {
    // 30 min TTL -- well inside the 12h compliance requirement.
    await env.REPORTS_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 1800 });
  }

  return result;
}

async function handleListings(request, env) {
  if (!env.SPARK_ACCESS_TOKEN) {
    return json({
      error: 'IDX feed is not configured yet.',
      detail: 'SPARK_ACCESS_TOKEN secret is not set on this Worker.'
    }, 501);
  }

  const url = new URL(request.url);
  const city = url.searchParams.get('city');
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');
  const beds = url.searchParams.get('beds');
  const propertyType = url.searchParams.get('propertyType');
  const subdivision = url.searchParams.get('subdivision');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Number(url.searchParams.get('pageSize')) || 12);

  try {
    const result = await queryResoWithCache(
      env,
      { city, minPrice, maxPrice, beds, propertyType, subdivision },
      pageSize,
      (page - 1) * pageSize
    );
    return json({ listings: result.listings, total: result.total, page, pageSize });
  } catch (err) {
    return json({ error: 'Unexpected error contacting IDX feed', detail: String(err) }, 500);
  }
}

/* Featured listings for the homepage -- 3 highest-priced active listings
   across the brokerage's core service area, refreshed via the same cache. */
async function getFeaturedListings(env) {
  if (!env.SPARK_ACCESS_TOKEN) return [];
  try {
    const cities = ['Palm Beach', 'Jupiter', 'Boca Raton', 'Manalapan', 'Delray Beach'];
    const cacheKey = `idx-cache:featured`;
    if (env.REPORTS_KV) {
      const cached = await env.REPORTS_KV.get(cacheKey);
      if (cached) {
        // Don't trust a cached value just because it exists -- a stale
        // empty array ("[]") written before this check existed would
        // otherwise be treated as valid and returned indefinitely until
        // its TTL happened to expire. Only short-circuit on genuinely
        // non-empty cached data; anything else falls through to a fresh
        // live query below.
        try {
          const parsedCache = JSON.parse(cached);
          if (Array.isArray(parsedCache) && parsedCache.length) return parsedCache;
        } catch { /* fall through to a fresh query */ }
      }
    }

    const cityFilter = cities.map(c => `City eq '${c}'`).join(' or ');
    const query = new URLSearchParams({
      '$filter': `StandardStatus eq 'Active' and (${cityFilter})`,
      '$select': RESO_SELECT_FIELDS,
      '$expand': 'Media',
      '$orderby': 'ListPrice desc',
      '$top': '3'
    });

    const res = await fetch(`${RESO_BASE_URL}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${env.SPARK_ACCESS_TOKEN}`, Accept: 'application/json' }
    });

    if (!res.ok) {
      console.log('getFeaturedListings failed:', await res.text());
      return [];
    }

    const data = await res.json();
    const listings = data.value || [];
    // Only cache genuinely successful, non-empty results for the full 30
    // minutes. Caching an empty result the same way meant one transient
    // hiccup (a momentary Spark error, a zero-match instant) would make the
    // homepage fall back to placeholder content for a full 30 minutes
    // afterward, instead of self-healing on the next request.
    if (env.REPORTS_KV && listings.length) {
      await env.REPORTS_KV.put(cacheKey, JSON.stringify(listings), { expirationTtl: 1800 });
    }
    return listings;
  } catch (err) {
    console.log('getFeaturedListings error:', String(err));
    return [];
  }
}

/* Shared HTML card renderer -- used both for server-side rendering the
   homepage (via HTMLRewriter, see below) and could be reused for any other
   listing display. Bakes in the BeachesMLS-required compliance elements
   directly into the markup rather than as an afterthought:
     - Section 20.2.7: brokerage name in a visible color/typeface
     - Section 20.3.3: listing firm + contact, same size as other listing text
     - Section 20.3.6: BeachesMLS logo as source attribution
   Section 20.3.7's sitewide disclaimer text lives once near the listings
   section (see renderIdxDisclaimer), not repeated per-card. */
// Shared across all three card renderers (server here, and the two client
// copies in index.html / listings.html): Media arrays from Spark can
// include non-photo entries (e.g. "Unbranded Virtual Tour" pointing to a
// propertypanorama.com link, not an image) mixed in alongside actual
// photos -- filtering to MediaCategory === 'Photo' avoids a broken image
// showing up mid-carousel.
function getListingPhotos(raw) {
  return (raw.Media || [])
    .filter(m => m.MediaCategory === 'Photo')
    .sort((a, b) => (a.Order || 0) - (b.Order || 0));
}

function formatHoaFee(raw) {
  if (!raw.AssociationFee) return null;
  const freqMap = { Monthly: '/mo', Annually: '/yr', Quarterly: '/qtr', 'Semi-Annually': '/6mo' };
  const freq = freqMap[raw.AssociationFeeFrequency] || '';
  return `$${Number(raw.AssociationFee).toLocaleString('en-US')}${freq}`;
}

/* Fetches one listing's full detail (including PublicRemarks -- the public,
   MLS-sanctioned description field, distinct from PrivateRemarks which is
   agent-only and must never be displayed) for the per-listing detail page. */
async function getListingByKey(env, listingKey) {
  const cacheKey = `idx-cache:detail:${listingKey}`;
  if (env.REPORTS_KV) {
    const cached = await env.REPORTS_KV.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const safeKey = listingKey.replace(/'/g, "''");
  const query = new URLSearchParams({
    '$filter': `ListingKey eq '${safeKey}'`,
    '$select': RESO_SELECT_FIELDS + ',PublicRemarks',
    '$expand': 'Media',
    '$top': '1'
  });

  const res = await fetch(`${RESO_BASE_URL}?${query.toString()}`, {
    headers: { Authorization: `Bearer ${env.SPARK_ACCESS_TOKEN}`, Accept: 'application/json' }
  });

  if (!res.ok) throw new Error(`Spark API rejected the detail request (${res.status}): ${await res.text()}`);

  const data = await res.json();
  const listing = (data.value && data.value[0]) || null;

  if (listing && env.REPORTS_KV) {
    await env.REPORTS_KV.put(cacheKey, JSON.stringify(listing), { expirationTtl: 1800 });
  }
  return listing;
}

function renderPropertyDetailPage(raw) {
  const addr = raw.UnparsedAddress || [raw.City, raw.StateOrProvince].filter(Boolean).join(', ') || 'Address available on request';
  const price = raw.ListPrice ? `$${Number(raw.ListPrice).toLocaleString('en-US')}` : 'Price on request';
  const beds = raw.BedroomsTotal ?? '—';
  const baths = raw.BathroomsTotalInteger ?? '—';
  const sqft = raw.LivingArea ? Number(raw.LivingArea).toLocaleString('en-US') : '—';
  const officeName = raw.ListOfficeName || 'Listing office not provided';
  const officeContact = raw.ListAgentEmail || raw.ListAgentDirectPhone || raw.ListOfficePhone || '';
  const mlsNum = raw.ListingId || raw.ListingKey || '—';
  const hoaFee = formatHoaFee(raw);
  const photos = getListingPhotos(raw);
  const remarks = raw.PublicRemarks ? raw.PublicRemarks.replace(/[<>]/g, '') : '';

  const photoHtml = photos.length
    ? photos.map((p, i) => `<img src="${p.MediaURL}" alt="${addr} photo ${i + 1}" class="w-full h-auto rounded-sm mb-3" loading="${i === 0 ? 'eager' : 'lazy'}">`).join('')
    : `<div class="h-64 bg-navy/5 rounded-sm flex items-center justify-center text-navy/30 text-sm">No photos available</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${addr} | Luxury Redefined Palm Beach</title>
<meta name="description" content="${price} -- ${beds} beds, ${baths} baths, ${sqft} sq ft at ${addr}.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = { theme: { extend: {
    colors: { navy: { DEFAULT: '#0f1720', deep: '#0a0f16', card: '#1a2532', line: '#2a3644' }, gold: { DEFAULT: '#c9a86a', light: '#e8d9b8', dim: '#8b7847' }, sand: '#f4ede1' },
    fontFamily: { serif: ['Playfair Display', 'serif'], sans: ['Inter', 'sans-serif'] }
  } } }
</script>
<style>
  body { font-family: 'Inter', sans-serif; }
  h1, h2, h3, .font-serif { font-family: 'Playfair Display', serif; }
</style>
</head>
<body class="bg-[#f8f6f1] text-navy">
<nav class="bg-navy-deep px-6 py-4">
  <div class="max-w-5xl mx-auto flex items-center justify-between">
    <a href="/" class="font-serif text-gold text-lg">Luxury Redefined</a>
    <a href="/listings.html" class="text-sand/70 text-sm hover:text-gold transition">← Back to search</a>
  </div>
</nav>

<div class="max-w-5xl mx-auto px-6 py-10">
  <div class="grid md:grid-cols-3 gap-10">
    <div class="md:col-span-2">
      ${photoHtml}
    </div>
    <div>
      <p class="font-serif text-3xl text-gold-dim">${price}</p>
      <p class="text-lg mt-1">${addr}</p>
      <p class="text-sm font-medium text-navy mt-3">${beds} bd &nbsp;|&nbsp; ${baths} ba &nbsp;|&nbsp; ${sqft} sqft</p>
      ${hoaFee ? `<p class="text-sm text-navy/60 mt-1">HOA: ${hoaFee}</p>` : ''}
      ${raw.DaysOnMarket != null ? `<p class="text-sm text-navy/60">${raw.DaysOnMarket} days on market</p>` : ''}

      <button onclick="window.parent.postMessage||null; document.getElementById('contact-modal').classList.remove('hidden')" class="w-full mt-5 bg-navy text-sand font-medium py-3 rounded-sm hover:bg-navy-card transition">Contact us about this home</button>

      ${remarks ? `<div class="mt-6 pt-6 border-t border-navy/10"><h2 class="font-serif text-lg mb-2">About this home</h2><p class="text-sm text-navy/70 leading-relaxed">${remarks}</p></div>` : ''}

      <div class="mt-6 pt-6 border-t border-navy/10">
        <img src="/images/beachesmls-logo.png" alt="BeachesMLS" class="h-6 w-auto mb-3">
        <p class="text-xs text-navy/70">Listing courtesy of: ${officeName}${officeContact ? ' &middot; ' + officeContact : ''}</p>
        <p class="text-[11px] text-navy/40 mt-2">MLS# ${mlsNum}</p>
        <p class="text-[11px] text-navy/40 mt-2 leading-snug">All listings featuring the BMLS logo are provided by BeachesMLS, Inc. This information is not verified for authenticity or accuracy and is not guaranteed. Copyright &copy; ${new Date().getFullYear()} BeachesMLS, Inc. IDX information is provided exclusively for consumers' personal, non-commercial use and may not be used for any purpose other than to identify prospective properties consumers may be interested in purchasing. Data is deemed reliable but is not guaranteed accurate by BeachesMLS.</p>
      </div>
    </div>
  </div>
</div>

<div id="contact-modal" class="hidden fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
  <div class="bg-sand rounded-sm p-8 max-w-md w-full relative">
    <button onclick="document.getElementById('contact-modal').classList.add('hidden')" class="absolute top-4 right-4 text-navy/50 hover:text-navy" aria-label="Close">✕</button>
    <h3 class="font-serif text-2xl mb-2">Contact us about this home</h3>
    <p class="text-sm text-navy/60 mb-5">${addr} -- ${price}. Tell us how to reach you and a specialist will follow up.</p>
    <div class="space-y-3">
      <input id="lead-name" type="text" placeholder="Full name" class="w-full border border-navy/20 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-gold">
      <input id="lead-email" type="email" placeholder="Email address" class="w-full border border-navy/20 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-gold">
      <input id="lead-phone" type="tel" placeholder="Phone number" class="w-full border border-navy/20 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-gold">
      <button onclick="submitDetailLead()" class="w-full bg-navy text-sand py-3 rounded-sm text-sm font-medium hover:bg-navy-card transition">Submit</button>
      <p id="lead-status" class="text-xs text-navy/50 text-center"></p>
    </div>
  </div>
</div>

<footer class="bg-navy-deep text-sand/60 px-6 py-8 mt-10 text-center text-xs">
  <p>Bharath Kadiyala, Broker &nbsp;·&nbsp; License #BK3462426 &nbsp;·&nbsp; Dalton Wade Real Estate Group</p>
</footer>

<script>
async function submitDetailLead() {
  const name = document.getElementById('lead-name').value;
  const email = document.getElementById('lead-email').value;
  const phone = document.getElementById('lead-phone').value;
  const status = document.getElementById('lead-status');
  if (!name || !email) { status.textContent = 'Please enter your name and email.'; return; }
  status.textContent = 'Submitting...';
  try {
    const res = await fetch('/api/lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, source: 'property-detail', site: 'luxuryredefined.homes', message: 'Interested in: ${addr.replace(/'/g, "\\'")} (${price})' })
    });
    if (!res.ok) throw new Error();
    status.textContent = "Thank you -- a specialist will reach out shortly.";
  } catch (e) {
    status.textContent = 'Something went wrong. Please call (813) 550-6772.';
  }
}
</script>
</body>
</html>`;
}

function renderIdxListingCard(raw) {
  const addr = raw.UnparsedAddress || [raw.City, raw.StateOrProvince].filter(Boolean).join(', ') || 'Address available on request';
  const price = raw.ListPrice ? `$${Number(raw.ListPrice).toLocaleString('en-US')}` : 'Price on request';
  const beds = raw.BedroomsTotal ?? '—';
  const baths = raw.BathroomsTotalInteger ?? '—';
  const sqft = raw.LivingArea ? Number(raw.LivingArea).toLocaleString('en-US') : '—';
  const officeName = raw.ListOfficeName || 'Listing office not provided';
  const officeContact = raw.ListAgentEmail || raw.ListAgentDirectPhone || raw.ListOfficePhone || '';
  const mlsNum = raw.ListingId || raw.ListingKey || '—';
  const key = raw.ListingKey;

  const photos = getListingPhotos(raw);
  const firstPhoto = photos.length ? photos[0].MediaURL : null;
  const hoaFee = formatHoaFee(raw);

  const statusBadge = raw.StandardStatus
    ? `<span class="absolute top-3 left-3 z-10 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-sm ${raw.StandardStatus === 'Active' ? 'bg-emerald-600 text-white' : 'bg-navy/70 text-sand'}">${raw.StandardStatus}</span>`
    : '';

  const carouselArrows = photos.length > 1
    ? `<button onclick="cycleCarousel('${key}', -1, event)" aria-label="Previous photo" class="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-navy/60 text-sand flex items-center justify-center hover:bg-navy transition">‹</button>
       <button onclick="cycleCarousel('${key}', 1, event)" aria-label="Next photo" class="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-navy/60 text-sand flex items-center justify-center hover:bg-navy transition">›</button>`
    : '';

  const dots = photos.length > 1
    ? `<div class="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">${photos.slice(0, 8).map((_, i) =>
        `<span class="dot-${key} w-1.5 h-1.5 rounded-full bg-white" style="opacity:${i === 0 ? '1' : '0.4'}"></span>`
      ).join('')}</div>`
    : '';

  const media = firstPhoto
    ? `<div class="photo-block tagged h-52 relative">${statusBadge}<img id="carousel-img-${key}" src="${firstPhoto}" alt="${addr}" class="w-full h-full object-cover" loading="lazy">${carouselArrows}${dots}</div>`
    : `<div class="photo-block h-52 relative flex items-center justify-center text-sand/30 text-xs">${statusBadge}Photo unavailable</div>`;

  return `
    <div class="border border-navy/10 rounded-sm overflow-hidden hover:shadow-lg transition bg-white">
      ${media}
      <div class="p-4">
        <p class="font-serif text-2xl text-navy font-semibold">${price}</p>
        <p class="text-sm text-navy/70 mt-1">${addr}</p>
        <p class="text-sm font-medium text-navy mt-2">${beds} bd &nbsp;|&nbsp; ${baths} ba &nbsp;|&nbsp; ${sqft} sqft</p>
        ${hoaFee ? `<p class="text-xs text-navy/50 mt-1">HOA: ${hoaFee}</p>` : ''}
        ${raw.DaysOnMarket != null ? `<p class="text-xs text-navy/50">${raw.DaysOnMarket} days on market</p>` : ''}
        <button onclick="contactAboutListing('${key}')" class="w-full mt-3 bg-navy text-sand text-xs font-medium py-2 rounded-sm hover:bg-navy-card transition">Contact us about this home</button>
        <div class="flex items-center justify-between mt-2 pt-2 border-t border-navy/10">
          <p class="text-[11px] text-navy/40">MLS# ${mlsNum}</p>
          <a href="/property/${encodeURIComponent(key)}" class="text-[11px] text-navy/50 hover:text-gold-dim transition">View Details →</a>
        </div>
      </div>
    </div>`;
}

// Required verbatim per BeachesMLS IDX Rules Section 20.3.7.
const IDX_DISCLAIMER_TEXT = 'IDX information is provided exclusively for consumers\' personal, non-commercial use. It may not be used for any purpose other than to identify prospective properties consumers may be interested in purchasing. Data is deemed reliable but is not guaranteed accurate by BeachesMLS.';
// Required substantially per Section 20.3.7 / 21.17 (copyright + logo notice).
const IDX_COPYRIGHT_TEXT = `All listings featuring the BMLS logo are provided by BeachesMLS, Inc. This information is not verified for authenticity or accuracy and is not guaranteed. Copyright © ${new Date().getFullYear()} BeachesMLS, Inc.`;

function renderIdxDisclaimerBlock() {
  return `
    <div class="mt-6 pt-6 border-t border-navy/10 flex flex-col md:flex-row items-start md:items-center gap-4">
      <img src="/images/beachesmls-logo.png" alt="BeachesMLS" class="h-6 w-auto">
      <p class="text-[11px] text-navy/50 leading-snug max-w-2xl">${IDX_COPYRIGHT_TEXT} ${IDX_DISCLAIMER_TEXT}</p>
    </div>`;
}

/* =====================================================================
   CONTENT & MARKETING AGENTS
   Three internal tools that reuse the same ANTHROPIC_API_KEY and
   RESEND_API_KEY already configured for the concierge and lead emails:
     1. Listing Description Writer — admin form, triggered on demand
     2. Market Report Generator     — runs monthly via Cron Trigger
     3. Social Post Generator       — runs weekly via Cron Trigger
   None of these publish to the live site automatically — every one
   emails a draft to LEAD_EMAIL for a human to review first.
   ===================================================================== */

const LISTING_COPY_SYSTEM_PROMPT = `You write real estate copy for "Luxury Redefined Palm Beach," a private, high-touch brokerage (Dalton Wade Real Estate Group). Voice: warm, unhurried, specific — sentence case, no exclamation points, no corporate filler, never generic ("stunning," "must-see," "won't last").

Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{"mlsDescription": "...", "socialCaption": "..."}

- mlsDescription: 150-200 words, MLS-ready. Lead with the single most distinctive feature, then move through the property's story (setting, architecture, standout rooms/features), close with a line about the lifestyle or location. Do not invent features not given to you.
- socialCaption: 40-60 words for Instagram/Facebook. Punchier and more visual than the MLS copy, still zero exclamation points, ends with 3-5 relevant real estate hashtags (e.g. #PalmBeachRealEstate, #LuxuryHomes, plus one for the specific city/community given).`;

async function handleListingDescription(request, env) {
  if (!checkAdminAuth(request, env)) return requireAdminAuth();
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'Not configured yet (missing ANTHROPIC_API_KEY).' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const address = String(body.address || '').slice(0, 200);
  const price = String(body.price || '').slice(0, 60);
  const beds = String(body.beds || '').slice(0, 20);
  const baths = String(body.baths || '').slice(0, 20);
  const sqft = String(body.sqft || '').slice(0, 20);
  const tag = String(body.tag || '').slice(0, 60);
  const features = String(body.features || '').slice(0, 2000);

  if (!address || !price) {
    return json({ error: 'Address and price are required.' }, 400);
  }

  const userPrompt = `Write copy for this listing:
Address: ${address}
Price: ${price}
Beds: ${beds || 'not given'}
Baths: ${baths || 'not given'}
Square footage: ${sqft || 'not given'}
Category: ${tag || 'not given'}
Notable features: ${features || 'none given beyond the above'}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 800,
        system: LISTING_COPY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: 'AI request failed', detail }, 502);
    }

    const data = await res.json();
    const raw = (data.content || []).map(b => (b.type === 'text' ? b.text : '')).join('').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      return json({ error: 'Could not parse AI response', raw }, 502);
    }

    // Email the draft for review — this never blocks returning the result
    // to the admin page itself.
    if (env.RESEND_API_KEY) {
      const toAddress = env.LEAD_EMAIL || 'brkadiyala@gmail.com';
      const fromAddress = env.FROM_EMAIL || 'Luxury Redefined <leads@luxuryredefined.homes>';
      const text = [
        `Listing description draft — ${address}`,
        ``,
        `MLS DESCRIPTION:`,
        parsed.mlsDescription,
        ``,
        `SOCIAL CAPTION:`,
        parsed.socialCaption,
        ``,
        `— Generated by the listing description writer. Review before publishing.`
      ].join('\n');

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromAddress, to: [toAddress], subject: `Listing description ready — ${address}`, text })
        });
      } catch (err) {
        console.log('Listing description email failed (non-fatal):', String(err));
      }
    }

    return json({ ok: true, ...parsed });
  } catch (err) {
    return json({ error: 'Unexpected error contacting the AI service', detail: String(err) }, 500);
  }
}

function adminListingFormPage() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Listing Description Writer</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; color: #0f1720; }
  h1 { font-size: 22px; }
  label { display: block; margin-top: 14px; font-size: 13px; font-weight: 600; }
  input, textarea, select { width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
  textarea { min-height: 90px; }
  button { margin-top: 20px; background: #c9a86a; color: #0f1720; border: none; padding: 10px 20px; border-radius: 4px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  #result { margin-top: 24px; white-space: pre-wrap; background: #f4ede1; padding: 16px; border-radius: 4px; display: none; }
  #status { margin-top: 10px; font-size: 13px; color: #666; }
</style></head>
<body>
  <h1>Listing Description Writer</h1>
  <p style="color:#666; font-size:13px;">Fill in what you have — the draft also gets emailed to you automatically.</p>
  <label>Address *</label><input id="address" placeholder="1230 N Ocean Blvd, Palm Beach, FL">
  <label>Price *</label><input id="price" placeholder="$18,750,000">
  <label>Category</label>
  <select id="tag"><option value="">—</option><option>Waterfront</option><option>Golf community</option><option>New construction</option><option>Condo</option></select>
  <label>Beds</label><input id="beds" placeholder="6">
  <label>Baths</label><input id="baths" placeholder="7.5">
  <label>Square footage</label><input id="sqft" placeholder="7,200">
  <label>Notable features</label><textarea id="features" placeholder="Private dock, wine cellar, resort-style pool, impact glass throughout..."></textarea>
  <button id="submitBtn" onclick="submitListing()">Generate description</button>
  <div id="status"></div>
  <div id="result"></div>
<script>
async function submitListing() {
  const btn = document.getElementById('submitBtn');
  const status = document.getElementById('status');
  const result = document.getElementById('result');
  const address = document.getElementById('address').value.trim();
  const price = document.getElementById('price').value.trim();
  if (!address || !price) { status.textContent = 'Address and price are required.'; return; }
  btn.disabled = true; status.textContent = 'Generating...'; result.style.display = 'none';
  try {
    const res = await fetch('/api/agent/listing-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address, price,
        tag: document.getElementById('tag').value,
        beds: document.getElementById('beds').value,
        baths: document.getElementById('baths').value,
        sqft: document.getElementById('sqft').value,
        features: document.getElementById('features').value
      })
    });
    const data = await res.json();
    if (!res.ok) { status.textContent = data.error || 'Something went wrong.'; btn.disabled = false; return; }
    status.textContent = 'Done — also emailed to you.';
    result.style.display = 'block';
    result.textContent = 'MLS DESCRIPTION:\\n' + data.mlsDescription + '\\n\\nSOCIAL CAPTION:\\n' + data.socialCaption;
  } catch (e) {
    status.textContent = 'Network error — please try again.';
  }
  btn.disabled = false;
}
</script>
</body></html>`;
}

const MARKET_REPORT_SYSTEM_PROMPT = `You write the "Palm Beach County luxury real estate insights" market report for "Luxury Redefined Palm Beach," a private brokerage (Dalton Wade Real Estate Group). Voice: measured, specific, sentence case, no exclamation points — an experienced advisor briefing a client, not a hype-driven market newsletter.

Use web search to find current news and data on the Palm Beach County (and nearby South Florida) luxury real estate market — inventory levels, notable sales, interest rate context, migration trends, new development activity.

Write a report with this EXACT structure (use "## " at the start of each header line, nothing else on that line):
## Where the market stands
## What's moving
## What to watch

400-600 words total, in short paragraphs (2-4 sentences each). Cite what you found in your own words (no direct quotes). Do not include a title, byline, or the month/year anywhere — that's added separately. Do not include any closing note or disclaimer — that's added separately too. End your response right after the "What to watch" section's last paragraph.`;

/* Splits the raw "## Header" formatted draft into a title + array of
   {heading, paragraphs[]} sections, shared by both the HTML and PDF
   renderers below so the two stay in sync. */
function parseReportSections(draft) {
  const lines = draft.split('\n').map(l => l.trim());
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), paragraphs: [] };
      sections.push(current);
    } else if (current) {
      current.paragraphs.push(line);
    }
  }
  return sections;
}

const REPORT_DISCLAIMER = 'This draft was AI-researched from public sources and has not been verified against BeachesMLS data. Confirm all figures before publishing or sharing with clients.';

function renderReportHTML(monthLabel, sections) {
  const sectionsHtml = sections.map(s => `
    <h2 style="font-family: 'Playfair Display', serif; font-size: 22px; color: #0f1720; margin: 32px 0 12px;">${s.heading}</h2>
    ${s.paragraphs.map(p => `<p style="font-size: 15px; line-height: 1.7; color: #1a2532; margin: 0 0 14px;">${p}</p>`).join('')}
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Palm Beach County Luxury Market Report — ${monthLabel}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Inter', sans-serif; margin: 0; background: #f4ede1; }
  .header { background: #0a0f16; padding: 56px 40px 44px; }
  .header p.eyebrow { color: #c9a86a; font-size: 12px; letter-spacing: 0.25em; text-transform: uppercase; margin: 0 0 12px; }
  .header h1 { font-family: 'Playfair Display', serif; color: #f4ede1; font-size: 34px; margin: 0 0 8px; }
  .header p.month { color: #8b95a3; font-size: 14px; margin: 0; }
  .body { max-width: 720px; margin: 0 auto; padding: 40px; background: #ffffff; }
  .disclaimer { margin-top: 40px; padding: 16px 20px; background: #f4ede1; border-left: 3px solid #c9a86a; font-size: 13px; color: #5a6472; }
</style></head>
<body>
  <div class="header">
    <p class="eyebrow">Market Update · Draft</p>
    <h1>Palm Beach County Luxury Market Report</h1>
    <p class="month">${monthLabel}</p>
  </div>
  <div class="body">
    ${sectionsHtml}
    <div class="disclaimer">${REPORT_DISCLAIMER}</div>
  </div>
</body></html>`;
}

/* Builds a simple, branded single/multi-page PDF using pdf-lib (pure JS,
   no filesystem needed — works fine under Workers' nodejs_compat flag).
   pdf-lib has no built-in text wrapping, so wrapText() below measures
   each word against the embedded font at the target size and breaks
   lines manually. */
async function buildReportPDF(monthLabel, sections) {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612, PAGE_H = 792, MARGIN = 56;
  const NAVY = rgb(0.06, 0.09, 0.125);
  const GOLD = rgb(0.788, 0.659, 0.416);
  const GRAY = rgb(0.4, 0.44, 0.5);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function newPageIfNeeded(neededHeight) {
    if (y - neededHeight < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function wrapText(text, font, size, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawParagraph(text, { font, size, color, lineHeight, gapAfter }) {
    const lines = wrapText(text, font, size, PAGE_W - MARGIN * 2);
    for (const line of lines) {
      newPageIfNeeded(lineHeight);
      page.drawText(line, { x: MARGIN, y, size, font, color });
      y -= lineHeight;
    }
    y -= gapAfter;
  }

  // Title block
  page.drawText('PALM BEACH COUNTY', { x: MARGIN, y, size: 10, font: fontBold, color: GOLD });
  y -= 30;
  page.drawText('Luxury Market Report', { x: MARGIN, y, size: 26, font: fontBold, color: NAVY });
  y -= 26;
  page.drawText(monthLabel, { x: MARGIN, y, size: 12, font: fontRegular, color: GRAY });
  y -= 36;

  for (const section of sections) {
    newPageIfNeeded(28);
    page.drawText(section.heading, { x: MARGIN, y, size: 15, font: fontBold, color: NAVY });
    y -= 22;
    for (const para of section.paragraphs) {
      drawParagraph(para, { font: fontRegular, size: 10.5, color: NAVY, lineHeight: 15, gapAfter: 8 });
    }
    y -= 10;
  }

  newPageIfNeeded(60);
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 70, y }, thickness: 2, color: GOLD });
  y -= 18;
  drawParagraph(REPORT_DISCLAIMER, { font: fontRegular, size: 9, color: GRAY, lineHeight: 12, gapAfter: 0 });

  return doc.save();
}

async function runMarketReportJob(env) {
  if (!env.ANTHROPIC_API_KEY || !env.RESEND_API_KEY) {
    console.log('Market report job skipped: missing ANTHROPIC_API_KEY or RESEND_API_KEY');
    return { ok: false, error: 'Missing ANTHROPIC_API_KEY or RESEND_API_KEY' };
  }
  if (!env.REPORTS_KV) {
    console.log('Market report job skipped: missing REPORTS_KV binding');
    return { ok: false, error: 'Missing REPORTS_KV binding — see setup instructions' };
  }

  const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: MARKET_REPORT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Write this month's report: ${monthLabel}.` }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      console.log('Market report job: AI request failed', detail);
      return { ok: false, error: 'AI request failed', detail };
    }

    const data = await res.json();
    // Join with '' (not '\n'): when the web search tool is used, Claude's
    // response often arrives as several separate 'text' blocks split around
    // citation boundaries. Joining with a newline was inserting fake
    // paragraph breaks mid-sentence at every citation. The blocks are meant
    // to be concatenated directly to reconstruct the original flowing text;
    // any real paragraph breaks the model intended are already present as
    // '\n\n' inside the block text itself.
    const draft = (data.content || []).map(b => (b.type === 'text' ? b.text : '')).join('').trim();

    if (!draft) {
      // No text content came back at all — most likely max_tokens was hit
      // while Claude was still searching/reading results, before it wrote
      // any final text. Surface stop_reason and the block types actually
      // returned, so this is diagnosable from the JSON response alone
      // rather than needing to dig through Worker logs.
      const blockTypes = (data.content || []).map(b => b.type);
      return {
        ok: false,
        error: 'AI returned no text content',
        stopReason: data.stop_reason,
        blockTypes,
        hint: data.stop_reason === 'max_tokens'
          ? 'Hit the token limit before writing any text — try increasing max_tokens further.'
          : 'Unexpected — check blockTypes and stopReason above.'
      };
    }

    const sections = parseReportSections(draft);

    if (!sections.length) {
      return { ok: false, error: 'AI response had no parseable sections', raw: draft };
    }

    const html = renderReportHTML(monthLabel, sections);
    const pdfBytes = await buildReportPDF(monthLabel, sections);

    await env.REPORTS_KV.put('market-report-html', html);
    await env.REPORTS_KV.put('market-report-pdf', pdfBytes);
    await env.REPORTS_KV.put('market-report-meta', JSON.stringify({ monthLabel, generatedAt: new Date().toISOString() }));

    const toAddress = env.LEAD_EMAIL || 'brkadiyala@gmail.com';
    const fromAddress = env.FROM_EMAIL || 'Luxury Redefined <leads@luxuryredefined.homes>';
    const siteUrl = env.SITE_URL || 'https://luxuryredefined.homes';
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress,
        to: [toAddress],
        subject: `Market report ready — ${monthLabel} (review before publishing)`,
        text: [
          `This month's market report draft is ready:`,
          ``,
          `View: ${siteUrl}/admin/report/market-report`,
          `Download PDF: ${siteUrl}/admin/report/market-report.pdf`,
          ``,
          `Both links require the admin password. ${REPORT_DISCLAIMER}`
        ].join('\n')
      })
    });

    if (!emailRes.ok) {
      const detail = await emailRes.text();
      return { ok: false, error: 'Email send failed', detail };
    }

    return { ok: true, monthLabel, sections: sections.length };
  } catch (err) {
    console.log('Market report job failed:', String(err));
    return { ok: false, error: String(err) };
  }
}

/* Hardcoded snapshot of current listings + insight articles for the
   social post generator. This duplicates the \`listings\` array and the
   insight cards in index.html, since there's no shared data store (KV/D1)
   yet — once the real IDX feed is live via handleListings(), swap this
   for a live query instead of hand-maintaining this list. */
const CURRENT_CONTENT_SNAPSHOT = [
  { type: 'listing', tag: 'Waterfront', price: '$18,750,000', addr: '1230 N Ocean Blvd, Palm Beach, FL' },
  { type: 'listing', tag: 'Golf community', price: '$6,950,000', addr: '215 Bears Club Dr, Jupiter, FL' },
  { type: 'listing', tag: 'New construction', price: '$9,995,000', addr: '3107 S Ocean Blvd, Highland Beach, FL' },
  { type: 'insight', title: 'Palm Beach County Luxury Market Report — Spring 2026' },
  { type: 'insight', title: "Jupiter vs. Boca Raton: choosing your community" },
  { type: 'insight', title: 'The new era of Palm Beach luxury home design' }
];

const SOCIAL_POST_SYSTEM_PROMPT = `You write Instagram/Facebook captions for "Luxury Redefined Palm Beach," a private brokerage (Dalton Wade Real Estate Group). Voice: warm, confident, sentence case, no exclamation points, no corporate filler.

For each item given, write one caption, 40-60 words, ending with 3-5 relevant hashtags. Respond with ONLY a JSON array, no markdown fences, no commentary, in this shape:
[{"item": "<repeat the address or title given>", "caption": "..."}]`;

async function runSocialPostJob(env) {
  if (!env.ANTHROPIC_API_KEY || !env.RESEND_API_KEY) {
    console.log('Social post job skipped: missing ANTHROPIC_API_KEY or RESEND_API_KEY');
    return { ok: false, error: 'Missing ANTHROPIC_API_KEY or RESEND_API_KEY' };
  }

  const itemsList = CURRENT_CONTENT_SNAPSHOT
    .map(i => i.type === 'listing' ? `Listing (${i.tag}): ${i.addr}, ${i.price}` : `Article: ${i.title}`)
    .join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1200,
        system: SOCIAL_POST_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: itemsList }]
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      console.log('Social post job: AI request failed', detail);
      return { ok: false, error: 'AI request failed', detail };
    }

    const data = await res.json();
    const raw = (data.content || []).map(b => (b.type === 'text' ? b.text : '')).join('').trim();

    let captions;
    try {
      captions = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      console.log('Social post job: could not parse AI response:', raw);
      return { ok: false, error: 'Could not parse AI response', raw };
    }

    const weekLabel = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
    const text = [
      `This week's social captions (week of ${weekLabel})`,
      `Reminder: this pulls from a hardcoded listings snapshot in _worker.js, not a live feed — update CURRENT_CONTENT_SNAPSHOT once IDX is connected.`,
      ``,
      ...captions.map(c => `— ${c.item} —\n${c.caption}\n`)
    ].join('\n');

    const toAddress = env.LEAD_EMAIL || 'brkadiyala@gmail.com';
    const fromAddress = env.FROM_EMAIL || 'Luxury Redefined <leads@luxuryredefined.homes>';
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddress, to: [toAddress], subject: `Social captions ready — week of ${weekLabel}`, text })
    });

    if (!emailRes.ok) {
      const detail = await emailRes.text();
      return { ok: false, error: 'Email send failed', detail };
    }

    return { ok: true, weekLabel, count: captions.length };
  } catch (err) {
    console.log('Social post job failed:', String(err));
    return { ok: false, error: String(err) };
  }
}

/* =====================================================================
   4. CITATION MONITOR
   Runs monthly (15th, offset from the market report on the 1st). Asks
   Claude, WITH real web search enabled, the same kinds of questions a
   prospective buyer might actually ask an AI assistant -- then checks
   whether this brokerage's name or site gets mentioned in the answer.
   This is a real, measurable GEO feedback loop, not a guess.
   ===================================================================== */

const CITATION_TEST_QUERIES = [
  'Who is the best luxury real estate agent in Palm Beach, Florida?',
  'Who is the best luxury real estate agent in Jupiter, Florida?',
  'Who is the best luxury real estate agent in Boca Raton, Florida?',
  'Best real estate brokerage for waterfront homes in Palm Beach County, Florida',
  'Where can I find off-market luxury real estate listings in Palm Beach County?'
];

// Any of these appearing in the answer counts as a citation/mention.
const CITATION_MARKERS = [
  'luxury redefined',
  'luxuryredefined.homes',
  'dalton wade',
  'bharath kadiyala'
];

async function runCitationMonitorJob(env) {
  if (!env.ANTHROPIC_API_KEY || !env.RESEND_API_KEY) {
    console.log('Citation monitor skipped: missing ANTHROPIC_API_KEY or RESEND_API_KEY');
    return { ok: false, error: 'Missing ANTHROPIC_API_KEY or RESEND_API_KEY' };
  }

  const results = [];

  for (const query of CITATION_TEST_QUERIES) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 1024,
          messages: [{ role: 'user', content: query }],
          tools: [{ type: 'web_search_20250305', name: 'web_search' }]
        })
      });

      if (!res.ok) {
        results.push({ query, ok: false, error: await res.text() });
        continue;
      }

      const data = await res.json();
      const answer = (data.content || []).map(b => (b.type === 'text' ? b.text : '')).join('').trim();
      const lower = answer.toLowerCase();
      const cited = CITATION_MARKERS.some(marker => lower.includes(marker));

      results.push({ query, ok: true, cited, answerPreview: answer.slice(0, 400) });
    } catch (err) {
      results.push({ query, ok: false, error: String(err) });
    }
  }

  const citedCount = results.filter(r => r.cited).length;
  const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' });

  if (env.REPORTS_KV) {
    await env.REPORTS_KV.put('citation-monitor-latest', JSON.stringify({ monthLabel, results, generatedAt: new Date().toISOString() }));
  }

  const toAddress = env.LEAD_EMAIL || 'brkadiyala@gmail.com';
  const fromAddress = env.FROM_EMAIL || 'Luxury Redefined <leads@luxuryredefined.homes>';
  const text = [
    `AI citation check — ${monthLabel}`,
    `Cited in ${citedCount} of ${results.length} test queries.`,
    ``,
    ...results.map(r => r.ok
      ? `[${r.cited ? 'CITED' : 'not cited'}] "${r.query}"\n  ${r.answerPreview}\n`
      : `[ERROR] "${r.query}" -- ${r.error}\n`
    ),
    `Full history: ${env.SITE_URL || 'https://luxuryredefined.homes'}/admin/report/citation-monitor`
  ].join('\n');

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddress, to: [toAddress], subject: `AI citation check — ${citedCount}/${results.length} — ${monthLabel}`, text })
  });

  if (!emailRes.ok) {
    return { ok: false, error: 'Email send failed', detail: await emailRes.text() };
  }

  return { ok: true, monthLabel, citedCount, total: results.length };
}

// Lets Claude itself decide when enough concrete criteria exist to search
// real inventory, rather than the frontend trying to guess from free text
// via regex. Anthropic's standard tool-use pattern: Claude may respond with
// a tool_use block instead of (or alongside) text; we execute the real
// search and send the result back for a final, grounded reply.
const SEARCH_LISTINGS_TOOL = {
  name: 'search_listings',
  description: 'Search current active BeachesMLS listings matching what the person has described. Call this as soon as at least one concrete filter is known (city, price range, bed count, or property type) -- do not wait to gather every possible detail first.',
  input_schema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'One of: Palm Beach, Jupiter, Boca Raton, Manalapan, Delray Beach' },
      minPrice: { type: 'number', description: 'Minimum price in dollars' },
      maxPrice: { type: 'number', description: 'Maximum price in dollars' },
      beds: { type: 'number', description: 'Minimum bedroom count' },
      propertyType: { type: 'string', enum: ['Waterfront', 'Golf community', 'Condominium'] }
    }
  }
};

async function handleConcierge(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'Concierge is not configured yet (missing ANTHROPIC_API_KEY).' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const message = String(body.message || '').slice(0, 2000);
  if (!message) return json({ error: 'Message is required' }, 400);

  const history = Array.isArray(body.history)
    ? body.history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    : [];

  const messages = [...history, { role: 'user', content: message }];

  try {
    const firstRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages,
        tools: env.SPARK_ACCESS_TOKEN ? [SEARCH_LISTINGS_TOOL] : undefined
      })
    });

    if (!firstRes.ok) {
      const detail = await firstRes.text();
      return json({ error: 'AI request failed', detail }, 502);
    }

    const firstData = await firstRes.json();
    const toolUseBlock = (firstData.content || []).find(b => b.type === 'tool_use' && b.name === 'search_listings');

    // No tool call -- plain conversational reply, same as before.
    if (!toolUseBlock) {
      const reply = (firstData.content || [])
        .map(block => (block.type === 'text' ? block.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim() || "I'll connect you with a specialist who can help with that.";
      return json({ reply, listings: [] });
    }

    // Execute the real search Claude asked for.
    let searchResult;
    try {
      searchResult = await queryResoWithCache(env, toolUseBlock.input || {}, 6, 0);
    } catch (err) {
      searchResult = { listings: [], total: 0, error: String(err) };
    }

    // Send Claude a compact summary (not full Media arrays / raw payloads)
    // so it can reference real specifics without bloating token usage --
    // the full raw listings go back to the frontend separately, for
    // rendering actual photo cards via the existing renderIdxCard().
    const summaryForClaude = searchResult.listings.slice(0, 6).map(l => ({
      address: l.UnparsedAddress || [l.City, l.StateOrProvince].filter(Boolean).join(', '),
      price: l.ListPrice,
      beds: l.BedroomsTotal,
      baths: l.BathroomsTotalInteger,
      sqft: l.LivingArea
    }));

    const secondRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        tools: [SEARCH_LISTINGS_TOOL],
        messages: [
          ...messages,
          { role: 'assistant', content: firstData.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: JSON.stringify({ count: summaryForClaude.length, listings: summaryForClaude }) }] }
        ]
      })
    });

    if (!secondRes.ok) {
      const detail = await secondRes.text();
      return json({ error: 'AI request failed', detail }, 502);
    }

    const secondData = await secondRes.json();
    const reply = (secondData.content || [])
      .map(block => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim() || (summaryForClaude.length
        ? `I found ${summaryForClaude.length} current listing${summaryForClaude.length === 1 ? '' : 's'} that match.`
        : "I don't see an exact match in current inventory, but a specialist can help with off-market options.");

    return json({ reply, listings: searchResult.listings || [] });
  } catch (err) {
    return json({ error: 'Unexpected error contacting the AI service', detail: String(err) }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/lead') {
      return handleLead(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/api/listings') {
      return handleListings(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/concierge') {
      return handleConcierge(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/admin/listing') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      return new Response(adminListingFormPage(), { headers: { 'Content-Type': 'text/html' } });
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/listing-description') {
      return handleListingDescription(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/admin/run/market-report') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      const result = await runMarketReportJob(env);
      return json(result, result.ok ? 200 : 500);
    }
    if (request.method === 'GET' && url.pathname === '/admin/report/market-report') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      if (!env.REPORTS_KV) return new Response('REPORTS_KV binding is not configured.', { status: 500 });
      const html = await env.REPORTS_KV.get('market-report-html');
      if (!html) return new Response('No report has been generated yet — visit /admin/run/market-report first.', { status: 404 });
      return new Response(html, { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } });
    }
    if (request.method === 'GET' && url.pathname === '/admin/report/market-report.pdf') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      if (!env.REPORTS_KV) return new Response('REPORTS_KV binding is not configured.', { status: 500 });
      const pdfBytes = await env.REPORTS_KV.get('market-report-pdf', 'arrayBuffer');
      if (!pdfBytes) return new Response('No report has been generated yet — visit /admin/run/market-report first.', { status: 404 });
      return new Response(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="palm-beach-market-report.pdf"',
          'Cache-Control': 'no-store'
        }
      });
    }
    if (request.method === 'GET' && url.pathname === '/admin/run/social-post') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      const result = await runSocialPostJob(env);
      return json(result, result.ok ? 200 : 500);
    }
    if (request.method === 'GET' && url.pathname === '/admin/run/citation-monitor') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      const result = await runCitationMonitorJob(env);
      return json(result, result.ok ? 200 : 500);
    }
    if (request.method === 'GET' && url.pathname === '/admin/report/citation-monitor') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      if (!env.REPORTS_KV) return new Response('REPORTS_KV binding is not configured.', { status: 500 });
      const raw = await env.REPORTS_KV.get('citation-monitor-latest');
      if (!raw) return new Response('No citation check has run yet — visit /admin/run/citation-monitor first.', { status: 404 });
      const data = JSON.parse(raw);
      return json(data);
    }
    if (request.method === 'GET' && url.pathname === '/admin/debug/featured-listings') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      // Bypasses the cache entirely so you can see the actual, current
      // Spark query result, not whatever's cached -- useful for confirming
      // the homepage's featured listings are really pulling live data.
      if (env.REPORTS_KV) await env.REPORTS_KV.delete('idx-cache:featured');
      const featured = await getFeaturedListings(env);
      return json({ count: featured.length, listings: featured });
    }

    if (request.method === 'GET' && url.pathname === '/admin/debug/subdivision') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      if (!env.SPARK_ACCESS_TOKEN) return json({ error: 'SPARK_ACCESS_TOKEN is not set.' }, 500);
      const subdivision = url.searchParams.get('name');
      if (!subdivision) return json({ error: 'Add ?name=SUBDIVISION_NAME to the URL.' }, 400);

      // Calls Spark directly (case-insensitive match, same as the real
      // filter) so you can test any subdivision value on demand -- shows
      // the raw response and status, not a silently-swallowed empty array,
      // so a genuine zero-listings result looks different from an actual
      // API error.
      const filterClause = buildResoFilter({ subdivision });
      const query = new URLSearchParams({
        '$filter': filterClause,
        '$select': RESO_SELECT_FIELDS,
        '$top': '10'
      });
      const requestUrl = `${RESO_BASE_URL}?${query.toString()}`;
      try {
        const res = await fetch(requestUrl, {
          headers: { Authorization: `Bearer ${env.SPARK_ACCESS_TOKEN}`, Accept: 'application/json' }
        });
        const bodyText = await res.text();
        let parsedCount = null;
        try { parsedCount = (JSON.parse(bodyText).value || []).length; } catch {}
        return json({
          testedValue: subdivision,
          filterClause,
          requestUrl,
          httpStatus: res.status,
          parsedResultCount: parsedCount,
          rawResponseBody: bodyText.slice(0, 3000)
        }, res.ok ? 200 : 502);
      } catch (err) {
        return json({ testedValue: subdivision, filterClause, error: String(err) }, 500);
      }
    }

    // Server-render real IDX listings into the homepage at request time --
    // both AI crawlers (no JS execution) and real visitors see live data
    // in the raw HTML, not just after client-side JS runs. Falls back to
    // whatever's already in the static HTML (the SEO-phase sample listings)
    // if the feed isn't configured yet or errors, so this never breaks
    // the page -- it only upgrades it when real data is available.
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const assetResponse = await env.ASSETS.fetch(request);
      const noStore = (resp) => {
        const r = new Response(resp.body, resp);
        r.headers.set('Cache-Control', 'no-store');
        return r;
      };
      if (!env.SPARK_ACCESS_TOKEN) return noStore(assetResponse);

      try {
        const featured = await getFeaturedListings(env);
        if (!featured.length) return noStore(assetResponse);

        const cardsHtml = featured.map(renderIdxListingCard).join('');
        const disclaimerHtml = renderIdxDisclaimerBlock();
        // HTMLRewriter rewrites the actual HTML stream before it reaches the
        // browser -- this is a real <script> tag in the parsed document, not
        // a DOM innerHTML assignment, so it executes normally. Seeds the
        // client-side cache so each SSR'd card's "Contact us" button has the
        // address/price to work with immediately, before any client-side
        // search has run.
        const cacheSeedScript = `<script>window.idxListingsCache = window.idxListingsCache || {}; ${featured.map(l => `window.idxListingsCache[${JSON.stringify(l.ListingKey)}] = ${JSON.stringify(l)};`).join(' ')}</script>`;

        class ListingGridHandler {
          element(el) {
            el.setInnerContent(cardsHtml + disclaimerHtml + cacheSeedScript, { html: true });
          }
        }

        const rewritten = new HTMLRewriter()
          .on('#listing-grid', new ListingGridHandler())
          .transform(assetResponse);

        // Explicitly disable caching on every path through this handler.
        // Without this, the response inherits whatever Cache-Control the
        // static asset came with, which can cause Cloudflare's edge (or the
        // browser) to keep serving an old snapshot of the homepage --
        // including old "Loading current listings..." fallback states --
        // even after the underlying data or code is fixed.
        return noStore(rewritten);
      } catch (err) {
        console.log('Homepage SSR listing injection failed (non-fatal):', String(err));
        return noStore(assetResponse);
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/property/')) {
      const listingKey = decodeURIComponent(url.pathname.replace('/property/', '').replace(/\/$/, ''));
      if (!listingKey || !env.SPARK_ACCESS_TOKEN) {
        return new Response('Listing not found.', { status: 404 });
      }
      try {
        const listing = await getListingByKey(env, listingKey);
        if (!listing) {
          return new Response('This listing may no longer be available. <a href="/listings.html">Back to search</a>', {
            status: 404,
            headers: { 'Content-Type': 'text/html' }
          });
        }
        return new Response(renderPropertyDetailPage(listing), { headers: { 'Content-Type': 'text/html' } });
      } catch (err) {
        console.log('Property detail page failed:', String(err));
        return new Response('Something went wrong loading this listing. <a href="/listings.html">Back to search</a>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }

    // Everything else: serve the static site files as before.
    return env.ASSETS.fetch(request);
  },

  // Cloudflare Cron Triggers (configured in wrangler.jsonc under "triggers").
  // All jobs email a draft/summary to LEAD_EMAIL -- none publish automatically.
  async scheduled(event, env, ctx) {
    if (event.cron === '0 13 1 * *') {
      ctx.waitUntil(runMarketReportJob(env));
    } else if (event.cron === '0 13 * * 1') {
      ctx.waitUntil(runSocialPostJob(env));
    } else if (event.cron === '0 13 15 * *') {
      ctx.waitUntil(runCitationMonitorJob(env));
    }
  }
};
