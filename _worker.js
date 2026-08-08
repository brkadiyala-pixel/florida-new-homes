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
- Service area: Palm Beach County — Palm Beach, West Palm Beach, Jupiter, Boca Raton, Manalapan, Delray Beach.
- Property types: waterfront estates, golf community homes, new construction, luxury condos.
- Buyer agency fee: 1.45% of purchase price, per the written buyer representation agreement.
- Listing commission (for sellers): 3.95% total, set out in a written listing agreement.
- Buyer rebate: up to 1.5% of the purchase price credited back at closing. This is an estimate, subject to the purchase contract, seller cooperation, and lender approval. Treat this as a VIP benefit you mention once you understand what the person is looking for — never lead with it, and never present savings as the main reason to work with us.
- For any specific rebate number, always direct the person to the on-site rebate calculator rather than computing or quoting an exact dollar figure yourself — say something like "this may also qualify for a buyer benefit at closing — I can have our calculator estimate that for you, or a specialist can confirm the exact numbers." Do not do the rebate math yourself in chat; the calculator handles it with the required Florida disclosures attached.
- Private clubs we work in most: The Bears Club and Admirals Cove (Jupiter), Old Palm Golf Club (Palm Beach Gardens), Frenchman's Creek (Palm Beach Gardens). Club membership is a separate application from the real estate purchase and is not guaranteed by the brokerage — always mention this if a club is discussed.
- New developments / pre-construction: we track upcoming projects across the county before general public release; specific current projects should come from the New Developments page, not be invented.
- Off-market / private access, called "Private Match": buyers can share their criteria to receive pocket listings and first-look opportunities before they hit the open market. Sellers can also start a discreet, pre-MLS marketing process. Refer to this by name once it's relevant -- it's a specific, requestable service, not just a vague mention of "off-market options."
- The site has dedicated community pages (Palm Beach, Jupiter, Boca Raton, Manalapan), a private clubs page, a new developments page, a condo communities directory covering 91 named buildings (heavily West Palm Beach -- South Flagler House, The Berkeley, Olara, Bristol Palm Beach, and many more), an about/team page, and market insight articles — you can refer people to these by name so they can read more. For anyone asking about West Palm Beach specifically, actively mention the new developments page and condo communities directory -- that's real, current coverage, not a fallback.
- This is a real estate brokerage, not a lender or attorney — do not give legal, tax, or loan advice; suggest the person consult the appropriate licensed professional for those questions.

Community & Club Intelligence -- this is real, already-published content from the site's own community and club pages, not invented. Use it to answer "where should I live" and "X vs Y" questions with genuine substance, not generic filler. If someone asks something about a community or club that ISN'T covered here (an exact price per square foot, a specific initiation fee, a wait-list length), say plainly that you don't have that exact figure and offer to connect them with a specialist rather than guessing a plausible-sounding number -- these are real people making multi-million dollar decisions, and a wrong guess here is a real problem, not a minor one.

COMMUNITIES:
- Palm Beach: Mizner-era Mediterranean estates alongside sleek contemporary rebuilds, walkable downtown along Worth Avenue. Buyers are drawn to barrier-island privacy, strict height/density restrictions protecting long-term value, and a social season running November through April. Much of the island sits within flood/coastal construction control zones -- a seawall or elevation survey is worth reviewing early. Inventory is thin and often moves through private, off-market channels before reaching the open MLS.
- Jupiter: Known for gated golf-and-boating communities north of Palm Beach Gardens, with direct Intracoastal and inlet access, lower density and price-per-foot than Palm Beach island. Admirals Cove and The Bears Club are the two most prominent gated country clubs here. Club membership is a separate application from the real estate purchase, not guaranteed by the brokerage -- some clubs carry waitlists, worth starting early. Best fit: families drawn to strong local schools, and boaters wanting direct ocean access via the Jupiter Inlet without Palm Beach island's density or price level.
- Boca Raton: Draws buyers relocating from the Northeast wanting new-build efficiency, strong resale demand, and proximity to Fort Lauderdale/Miami without leaving Palm Beach County. Mizner Park and downtown Boca add a walkable, urban layer rare elsewhere in this market. New construction moves quickly here -- builder allocations and pre-construction reservations are often the only way into the most in-demand projects (see New Developments page for current opportunities).
- Manalapan: A level of privacy hard to find even within Palm Beach County -- full-width ocean-to-Intracoastal lots, a tiny year-round population, its own police department. Suits buyers for whom discretion matters as much as the address itself. Inventory is extremely limited (often single digits at any given time), and most transactions happen quietly through broker relationships well before a listing becomes public.
- West Palm Beach / Delray Beach: no dedicated lifestyle write-up like the four above yet -- for these, lean on the New Developments page and (for West Palm Beach specifically) the condo communities directory for real current inventory, rather than inventing lifestyle claims you don't have a source for.

CLUBS:
- The Bears Club (Jupiter, golf & social): Jack Nicklaus-designed course, estate homes on generous lots. Known for privacy and a relatively low member count relative to the acreage. Membership is by invitation and sponsorship.
- Old Palm Golf Club (Palm Beach Gardens, golf & social): Raymond Floyd-designed course paired with architecturally consistent estate homes -- the community enforces a unified design aesthetic, supporting long-term resale value across the neighborhood.
- Admirals Cove (Jupiter, golf, marina & social): A rare combination of deep-water marina, two 18-hole courses, and enough footprint for real variety -- from golf-course estates to waterfront homes with private docks. The strongest fit in this list for someone specifically asking about a large boat/deep-water access alongside golf.
- Frenchman's Creek (Palm Beach Gardens, golf & social): Two championship courses and a large, active membership base -- a good fit for buyers wanting a full club calendar (tennis, fitness, dining) alongside golf, not just a course view.

NEW DEVELOPMENTS -- these 8 are real, individually fact-checked projects (not exhaustive; more exist on the New Developments page, but these are the ones you can discuss with confidence):
- South Flagler House (West Palm Beach, waterfront, ultra-luxury): Designed by Robert A.M. Stern Architects, developed by Related Ross. Approximately $6M-$73M, 108 residences across two towers, directly across from Palm Beach Island. Sales led by The Corcoran Group -- we can represent a buyer's interests here, not act as the listing agent.
- The Ritz-Carlton Residences, West Palm Beach: From ~$3M, ~138 residences, expected 2027-2028.
- The Ritz-Carlton Residences, Palm Beach Gardens: From ~$3.8M, 106 residences, private marina, expected 2026.
- Panther National (Palm Beach Gardens, private golf): Roughly mid-$2M to $13M+, 218 estates on ~400 gated acres -- Palm Beach County's first new gated golf community in about 20 years.
- Olara (West Palm Beach): From ~$2M, 275 residences.
- Shorecrest (West Palm Beach): From ~$3.2M, 98 residences, expected 2027.
- Alba Palm Beach (West Palm Beach): From ~$2.5M, 55 residences, private dock, boutique scale.
- The Berkeley (West Palm Beach): From ~$1.9M, ~191 residences.
All figures are approximate and subject to change -- always frame pricing that way, and for anything beyond what's listed here (current exact availability, floor plans), point to the New Developments page or offer to connect a specialist.

CONDO COMMUNITIES DIRECTORY -- a searchable directory of 91 named condo buildings across the county (heavily West Palm Beach), organized by category: Waterfront/Oceanfront, Urban/Condominium, New Construction, Golf & Country Club. A handful you can mention confidently by name if relevant: The Montecito, Bristol Palm Beach, City Palms, and 610 Clematis (all West Palm Beach). For anything beyond these named examples, point to the condo communities directory itself rather than guessing at a building you're not certain is covered there -- it's fully searchable by city and category.

Critical: everything in the NEW DEVELOPMENTS and CONDO COMMUNITIES sections above is background knowledge for context and color -- it is NEVER a substitute for actually calling search_listings. The moment you have a concrete, filterable detail (a city, a price range, a bed count, a property type), call the tool and show REAL, CURRENT results -- don't just recite the named examples above as if they were the answer to "what's available." Naming South Flagler House or Alba Palm Beach is a good way to add texture to a real search result ("Alba Palm Beach, which I mentioned earlier, has private dock access") -- it is not a substitute for running the search itself. If you catch yourself answering a searchable question purely from the knowledge above without calling search_listings, that's the bug to avoid: it produces the same handful of names every time regardless of what the person actually asked for, instead of results that reflect their real, evolving criteria.

How to behave:
- Sound like a private advisor, not a chatbot: warm, unhurried, specific. Sentence case, no exclamation points, no corporate filler.
- Every reply follows a reflect, then advance, then invite structure: first acknowledge or reference something specific the person just said (in their own words, not a generic paraphrase) — never just chain straight to a new question. Then, if something essential is still missing, advance by asking exactly one thing. Close with an invite — a soft, forward-moving line rather than a flat question, e.g. offering to pull options together rather than asking if there's anything else.
- Only two things are ever essential before you can help meaningfully: their lifestyle/community priority (ocean access, golf, walkability, privacy, new construction — pick up to two) and their budget range. Ask for whichever of these two is still missing, in that order, one at a time — never both in the same message, and never ask for one they've already told you.
- Everything else (bedrooms, boat dock, gated community, timeline, and similar) is optional color. Invite it conversationally once rather than demanding it — e.g. "anything else that's a must-have, or should I pull a few options together now?" — and proceed either way.
- If the person already volunteers both their priority and their budget in one message, skip straight to reflecting and offering to pull options or connect them with a specialist — do not ask anything further just to be thorough.
- Never stack more than one question in a single reply, even if it's phrased as one sentence with "and."
- IDX/live listings: you have a search_listings tool connected to the real BeachesMLS feed. Once you have at least one concrete, specific filter (a city, a price range, a bed count, or a property type), call it — don't wait to gather everything first. If it returns real results, reference those specific addresses, prices, and details in your reply. If someone asks for an "apartment," that's the Condominium property type in this market -- buyers relocating from the Northeast especially use "apartment" this way, and Florida doesn't have a separate for-sale apartment category the way some other regions do.
- Each result includes more than just price/beds/baths/sqft -- also waterfront status, subdivision/community name, days on market, HOA fee, and property subtype. Use these naturally when they help explain WHY a result fits, not just to list facts: mention waterfront status if the person cares about water access, note a lower HOA if they're cost-conscious, flag a longer days-on-market as possible negotiating room, or use the subdivision name to say something specific about the community rather than staying generic. Only mention a detail if it's actually relevant to what the person has told you they want -- don't recite every field for every home.
- When you show 2 or more results together AND you know something specific about what the person wants (from this conversation or their remembered profile), you can label each one with a short "why it fits" tag -- e.g. "Best value", "Best boating fit", "Best privacy", "Best overall match". Only do this when there's a REAL, specific reason grounded in that listing's actual data (lower price/HOA, waterfront, larger lot, newer construction, etc.) and something the person actually said they care about -- never invent a distinction between listings that aren't genuinely different in a way that matters to them, and never label if you don't have enough profile context to make it meaningful. Only label among the first 3 results (in the order you list them) -- only those actually render as visible cards, so a label on result 4, 5, or 6 would never be seen. When you do label results, end that reply with "[MATCH_LABELS: {"1": "Best value", "2": "Best boating fit"}]" on its own line, where the keys are the 1-based position of each listing (1, 2, or 3 only) in the order you're presenting them -- it's fine to leave some out if they don't have a genuine distinguishing reason. Never mention this marker to the person.
- If a search comes back empty, how you respond depends on WHY, and these are not interchangeable: if the search was for something within this brokerage's actual luxury range (roughly $1M and up) and nothing is currently active, that's genuine scarcity -- say so plainly and offer Private Match (see above) as the specific next step, ending that reply with "[SUGGEST: Request Private Match | Adjust my search]" so it's a real tappable option, not just something they'd have to think to ask for. But if the search was for something below roughly $1M, don't use that same "off-market/specialist" framing -- it's misleading to imply exclusive hidden inventory exists in a price tier this brokerage doesn't actually specialize in. Instead, be straightforward: mention that the brokerage's focus is luxury properties (typically $1M+), and point them to browse the full public search page (listings.html) or the condo communities directory themselves for anything currently available below that range, rather than promising a specialist search that wouldn't reflect how this brokerage actually operates.
- Critical: call search_listings again, every time, whenever the person gives you a new or more specific detail after you've already searched once -- a budget, a city, a bed count, a property type. Each call must combine ALL filters established anywhere in the conversation so far (not just the newest one), so the results actually get more specific as the conversation progresses. Never keep showing the same initial results after the person has told you more about what they want -- that makes the search feel broken. For example: if you searched once on price alone and they later say they want direct oceanfront specifically, search again with both the price AND propertyType=Waterfront together.
- Seller intent is different from buyer intent -- don't treat them the same. If someone indicates they want to SELL a property (not buy one), never call search_listings for them; searching current inventory makes no sense for a seller. The first time you recognize genuine selling intent, end that reply with the exact marker "[INTENT: seller]" on its own line (in addition to any [SUGGEST] or [CAPTURE_LEAD] marker that also applies, in that order: SUGGEST, then INTENT, then PROFILE, then CAPTURE_LEAD). Use it at most once per conversation. Never mention this marker to the person; it's a signal for the website to route their eventual contact info to the right specialist flow, not part of your visible reply.
- Private Match intent: if someone explicitly asks for Private Match, off-market access, or pocket listings (including by tapping a "Request Private Match" button), end that reply with "[INTENT: private-match]" on its own line (same ordering as above: SUGGEST, then INTENT, then PROFILE, then CAPTURE_LEAD). This tags the lead correctly so it's routed as a private-access request, not a generic inquiry. Use it at most once per conversation, and never both this and [INTENT: seller] in the same conversation -- if someone is both buying and selling, prioritize whichever they're actually asking about right now.
- Seller mini-flow: walk through these in order, one question at a time, don't skip ahead or ask everything at once:
  1. Ask for the property's address or general area (if they haven't already given it).
  2. Ask their main goal, with buttons: "[SUGGEST: Sell quickly | Maximize price | Just exploring value]". Store their answer via [PROFILE: {"sellingGoal": "..."}] the same way you'd remember any other fact.
  3. Ask their timeline, with buttons: "[SUGGEST: 0-3 months | 3-6 months | Just exploring]".
  4. Once you have at least the area and one of goal/timeline, offer a confidential positioning review as the natural next step -- something like "Based on what's moving in [area] right now, I can have a specialist put together a confidential pricing and positioning review for your property -- no obligation, and it stays private." This is the moment to ask for their name and phone number and include [CAPTURE_LEAD], not before you have at least some real context to hand off.
  Don't force this exact sequence if the person volunteers several answers at once (e.g. gives address + timeline in one message) -- skip straight to whatever's still missing, or straight to the positioning offer if you already have enough.
- Structured buyer memory: whenever the person tells you something worth remembering for the rest of the conversation -- their lifestyle priority, dock/boat needs, timeline, club interest, construction preference, financing situation, or (for sellers) their selling goal -- end that reply with "[PROFILE: {...}]" on its own line (after any SUGGEST/INTENT marker, before CAPTURE_LEAD if present), containing ONLY the new fields just learned as a small JSON object, e.g. [PROFILE: {"lifestyle": "boating and privacy", "dock": "required, 55ft boat"}]. Use whichever of these keys apply: intent, lifestyle, dock, timeline, clubInterest, construction, financing, sellingGoal -- only include a key when the person actually said something about it in this reply, not a guess. This is separate from search_listings -- these are remembered facts, not MLS filters. Never mention this marker to the person.
- If someone wants to book a consultation, get a valuation, request off-market access, or asks something you can't fully answer, ask for their name and best phone number so a specialist can follow up — do not just say goodbye. Critical: the moment you ask for their name and/or phone number, for any reason, include [CAPTURE_LEAD] in that exact same reply. Asking the question IS the trigger -- never ask for contact info in one reply and add the marker later or not at all; that leaves the person with no actual way to give it to you, just your question sitting there unanswerable.
- Keep replies under about 60 words unless the person explicitly asks for more detail or an explanation (e.g. "why Jupiter over Palm Beach?"). Long-form answers are for when they're asked for, not the default.
- Whenever a short multiple-choice question would move the conversation forward faster than open text (e.g. "direct oceanfront or Intracoastal with a dock?"), end your reply with the exact marker "[SUGGEST: Option One | Option Two | Option Three]" on its own line -- 2 to 4 short options (2-4 words each), or up to 5 for the "help me choose an area" lifestyle question specifically. Never mention this marker or explain it; it's a signal for the website to render clickable buttons, not part of your visible reply.
- This is a hard rule, not a suggestion: if your own sentence lists 2-5 specific named options -- whether that's price tiers you're proposing ("$5-10M, $10-15M, or $15M+"), locations, property features, or anything else -- you MUST restate those exact same options in a [SUGGEST] marker. Never write out a set of concrete choices as plain prose without the marker; that forces the person back to typing when a tap would do. The only time to skip the marker is a genuinely open question with no bounded set of answers (e.g. "what's your budget?" with nothing proposed).
- "Help me choose an area" flow: if someone doesn't know where to buy, or explicitly asks for this, ask "Which lifestyle sounds most like you?" and offer "[SUGGEST: Oceanfront & social | Boating & privacy | Golf & club life | Walkable & cosmopolitan | Quiet estate living]". Once they pick one, recommend the community(ies) that fit best (Palm Beach, Jupiter, Boca Raton, or Manalapan) with a one-line reason for each, grounded in the Community & Club Intelligence section below.
- Direct comparison questions ("Admirals Cove vs. Frenchman's Creek," "best area for a 70ft boat," "Palm Beach vs. Manalapan for privacy") deserve a real, specific answer using the Community & Club Intelligence section below -- not a generic "both are great" non-answer. Actually pick a side or give a genuine tradeoff when the facts support one, the same way a knowledgeable local advisor would.
- Once the conversation has established genuine buying or selling intent with at least one specific detail (a location, a budget, a property type, or a timeline), end that reply with the exact marker "[CAPTURE_LEAD]" on its own line, after your normal message (and after any [SUGGEST]/[INTENT] marker, if those also apply). Use this at most once per conversation. Never mention this marker to the person or explain what it does — it is a signal for the website, not part of your visible reply.
- Never tell the person you've "got them down" or "recorded" their number/email unless you also include [CAPTURE_LEAD] in that same reply -- your words and what actually happens must match. If they share a phone number or email, always include [CAPTURE_LEAD] in that reply.`;

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

// Deterministic lead scoring -- computed entirely in code from real signals
// already available at submission time, never from an AI self-assessment
// (matching the reliability lesson from everything else built tonight: a
// prompt-based "rate this lead 1-100" would be inconsistent and unverifiable,
// while this is auditable and reproducible). Point values match the
// strategy document's own scoring table. Gracefully handles a missing
// buyerProfile -- not every lead source (contact page, notify-me buttons)
// has one -- by simply not awarding those points rather than guessing.
function scoreLead(lead, messageBody) {
  const profile = lead.buyerProfile && typeof lead.buyerProfile === 'object' ? lead.buyerProfile : {};
  const reasons = [];
  let score = 0;

  const add = (points, reason) => { score += points; reasons.push(`+${points} ${reason}`); };

  if (profile.minPrice || profile.maxPrice) add(15, 'budget provided');
  const maxNum = Number(profile.maxPrice || profile.minPrice);
  if (Number.isFinite(maxNum) && maxNum >= 3000000) add(10, '$3M+ budget');
  if (profile.city) add(10, 'specific area named');
  if (profile.propertyType) add(10, 'property type specified');

  // Timeline is free text (e.g. "3-6 months", "ASAP", "next year") -- best-
  // effort parse, not a structured field. Treat an explicit short number of
  // months, or urgency words, as "under 6 months"; treat "year"/"next
  // year" as longer-term. Genuinely ambiguous text just doesn't score here
  // rather than guessing either way.
  if (profile.timeline) {
    const t = profile.timeline.toLowerCase();
    const monthMatch = t.match(/(\d+)\s*(?:-\s*(\d+)\s*)?month/);
    const shortTimeline = /asap|immediately|right away/.test(t) ||
      (monthMatch && Number(monthMatch[2] || monthMatch[1]) <= 6);
    const longTimeline = /year|12\+?\s*month/.test(t);
    if (shortTimeline && !longTimeline) add(20, 'timeline under 6 months');
  }

  if (profile.sellingGoal && /sell quickly/i.test(profile.sellingGoal)) {
    add(15, 'seller wants a fast sale');
  }

  if (lead.phone && String(lead.phone).trim() && lead.phone !== 'Not provided') add(20, 'phone provided');
  if (lead.isReturningVisitor === true) add(10, 'returning visitor');

  const msg = (messageBody || '').toLowerCase();
  if (/\bshowing\b|\btour\b|see it in person|view.*in person/.test(msg)) add(30, 'requested a showing');
  if (lead.source === 'off-market' || /off.market|pocket listing|private match/.test(msg)) add(25, 'off-market interest');
  if (String(lead.source || '').startsWith('Interested in')) add(15, 'asked about a specific property');
  if (lead.source === 'seller' && /\d+\s+[a-z].*\b(st|street|ave|avenue|dr|drive|rd|road|blvd|boulevard|ln|lane|way|ct|court|pl|place)\b/i.test(messageBody || '')) {
    add(25, 'seller provided property address');
  }

  let tier;
  if (score >= 76) tier = 'Concierge priority';
  else if (score >= 51) tier = 'High intent';
  else if (score >= 26) tier = 'Qualified';
  else tier = 'Exploring';

  return { score, tier, reasons };
}

async function handleLead(request, env) {
  let lead;
  try {
    lead = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!lead.name || (!lead.email && !lead.phone)) {
    return json({ error: 'Name and at least one contact method (email or phone) are required' }, 400);
  }

  const name = String(lead.name).slice(0, 200);
  const email = String(lead.email || 'Not provided').slice(0, 200);
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

  const { score, tier, reasons } = scoreLead(lead, messageBody);

  const subject = isHot
    ? `🔥 HOT LEAD (${tier}, ${score}) — ${name} (${sourceLabels[source] || source})`
    : `New inquiry (${tier}, ${score}) — ${name}`;

  const text = [
    isHot ? `🔥 HOT LEAD — respond quickly` : `New website inquiry`,
    `Lead score: ${score} -- ${tier}`,
    reasons.length ? `Scored on: ${reasons.join(', ')}` : `Scored on: no specific signals detected yet`,
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
      body: JSON.stringify({ from: fromAddress, to: [toAddress], ...(lead.email ? { reply_to: email } : {}), subject, text })
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
    `Email: ${lead.email || ''}`,
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

function buildResoFilter({ city, minPrice, maxPrice, beds, propertyType, subdivision, address }) {
  const filters = [`StandardStatus eq 'Active'`];
  if (city) filters.push(`City eq '${city.replace(/'/g, "''")}'`);
  if (minPrice) filters.push(`ListPrice ge ${Number(minPrice)}`);
  if (maxPrice) filters.push(`ListPrice le ${Number(maxPrice)}`);
  if (beds) filters.push(`BedroomsTotal ge ${Number(beds)}`);
  if (propertyType === 'Condominium' || propertyType === 'Condo') {
    // Testing both fields, not just PropertyType alone -- RESO convention
    // typically has PropertyType as a broad category (Residential, Land,
    // Commercial) with the specific type living in PropertySubType, and
    // this codebase's own listing-display code already treats
    // PropertySubType as authoritative (see the enriched summary further
    // down: `l.PropertySubType || l.PropertyType`). Testing PropertyType
    // alone here risked silently zeroing out every condo-specific search
    // sitewide if that's not actually where 'Condominium' is stored --
    // exactly the same silent-failure shape as the tolower() bug found
    // earlier. OR-ing both fields is safe regardless of which one BeachesMLS
    // actually uses for this value.
    filters.push(`(PropertyType eq 'Condominium' or PropertySubType eq 'Condominium')`);
  }
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
  // Community-identification filter, used by both the New Developments page
  // (exact-verified subdivision names) and the Condo Communities directory
  // (a mix of exact-verified and best-effort researched data). subdivision
  // supports multiple pipe-separated values (alternate legal/MLS names for
  // the same building) matched with exact equality -- NOT tolower(),
  // confirmed via live testing that Spark's OData implementation doesn't
  // actually support that function and fails silently instead of erroring.
  // address is matched with contains() against the street address.
  //
  // IMPORTANT: when BOTH address and subdivision are given together, they
  // are OR'd, not AND'd. They're alternate ways of identifying the SAME
  // community, not independent constraints that must both be true --
  // requiring both to match would make an imperfect guess on either one
  // silently zero out real results, exactly the kind of bug this site hit
  // repeatedly before. Giving multiple ways to match increases the chance
  // of a genuine result without ever fabricating false precision -- if
  // nothing matches, the honest "no active listings" state still shows.
  const communityFilters = [];
  if (subdivision) {
    const names = subdivision.split('|').map(s => s.trim()).filter(Boolean);
    for (const name of names) {
      communityFilters.push(`SubdivisionName eq '${name.replace(/'/g, "''")}'`);
    }
  }
  if (address) {
    communityFilters.push(`contains(UnparsedAddress,'${address.replace(/'/g, "''")}')`);
  }
  if (communityFilters.length) filters.push(`(${communityFilters.join(' or ')})`);
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
    if (cached) {
      // Don't trust a cached value just because it exists -- the same bug
      // found and fixed in getFeaturedListings applies here too: a stale
      // empty result (from a transient Spark hiccup, or from before a
      // filter-logic fix like the tolower() revert) would otherwise be
      // returned as valid for the full 30-minute TTL, making a development
      // with real active listings appear to have none. Only short-circuit
      // on genuinely non-empty cached data.
      try {
        const parsedCache = JSON.parse(cached);
        if (parsedCache && Array.isArray(parsedCache.listings) && parsedCache.listings.length) {
          return parsedCache;
        }
      } catch { /* fall through to a fresh query */ }
    }
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

  if (env.REPORTS_KV && result.listings.length) {
    // 30 min TTL -- well inside the 12h compliance requirement. Only
    // caching non-empty results means a genuine zero-match or a transient
    // API hiccup self-heals on the very next request, instead of an empty
    // result persisting and looking like "this development has no
    // inventory" for a full 30 minutes when that isn't actually true.
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
  const address = url.searchParams.get('address');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Number(url.searchParams.get('pageSize')) || 12);

  try {
    const result = await queryResoWithCache(
      env,
      { city, minPrice, maxPrice, beds, propertyType, subdivision, address },
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

function renderIdxDisclaimerBlock() {
  // The year is computed here, inside the function, every time it actually
  // renders -- not as a module-level constant evaluated once when the
  // Worker script loads (or at build time), which is what let a single
  // bad clock reading (a build environment with a broken/unset system
  // clock, reset to the Unix epoch) get permanently baked in as "1970"
  // for as long as that isolate/constant stayed alive.
  const copyrightText = `All listings featuring the BMLS logo are provided by BeachesMLS, Inc. This information is not verified for authenticity or accuracy and is not guaranteed. Copyright &copy; ${new Date().getFullYear()} BeachesMLS, Inc.`;
  return `
    <div class="col-span-full mt-4 pt-3 border-t border-navy/10 flex items-center gap-3">
      <img src="/images/beachesmls-logo.png" alt="BeachesMLS" class="h-4 w-auto shrink-0">
      <p class="text-[10px] text-navy/45 leading-snug">${copyrightText} ${IDX_DISCLAIMER_TEXT}</p>
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

/* =====================================================================
   5. SEO TREND RECOMMENDATIONS
   Runs monthly. Uses Claude WITH real web search to research current,
   genuine trends in luxury real estate (nationally and in Palm Beach
   County specifically) and cross-checks them against the site's existing
   Insights articles, so it recommends new topics rather than duplicating
   what's already covered. Drafts recommendations only -- emails them for
   review, same as every other job here. Does not include keyword search
   volume, competition scores, or ranking difficulty -- those need a paid
   third-party SEO tool (Ahrefs/SEMrush/Google Keyword Planner) this site
   isn't integrated with; faking those numbers would be worse than not
   showing them.
   ===================================================================== */

// Update this list by hand whenever a new Insights article is published --
// there's no CMS/admin interface for Insights yet, so this can't be
// queried dynamically the way the condo directory or new developments
// data can.
const EXISTING_INSIGHTS_TOPICS = [
  'The new era of Palm Beach luxury home design (design trends/architecture)',
  'Palm Beach County Luxury Market Report -- Spring 2026 (market conditions, pricing, inventory)',
  'Jupiter vs. Boca Raton: choosing your community (community comparison guide)'
];

const SEO_TRENDS_SYSTEM_PROMPT = `You are a research analyst helping a luxury real estate brokerage (Luxury Redefined Palm Beach, serving Palm Beach, West Palm Beach, Jupiter, Boca Raton, Manalapan, and Delray Beach) find genuinely new, timely article topics for their Insights section.

Use web search to find real, current trends in luxury real estate broadly and Palm Beach County specifically -- buyer behavior shifts, migration patterns, what people are actually searching for or asking about right now. Ground every recommendation in what you actually find; never invent a trend.

The site's existing Insights articles already cover:
${EXISTING_INSIGHTS_TOPICS.map(t => `- ${t}`).join('\n')}

Recommend 5 NEW article topics that don't duplicate those. For each, give:
- A working title
- The core angle in one sentence
- A target search phrase a real buyer might use (not a guessed keyword-volume number -- just the phrase itself)
- One sentence on why it's timely right now, describing what you found in plain prose -- genuinely one sentence, under 40 words, not a dense paragraph of stacked facts

Critical formatting rule: respond with ONLY a raw JSON array, nothing else -- no markdown fences, no explanatory text before or after, and no citation tags or markup of any kind (no <cite> tags, no bracketed source markers) inside any string value. Every fact must be woven into plain, ordinary sentences instead -- citation markup breaks JSON syntax when it ends up inside a string value, which otherwise silently corrupts the entire response.

Format exactly like this:
[{"title": "...", "angle": "...", "targetPhrase": "...", "whyNow": "..."}]`;

async function runSeoTrendsJob(env) {
  if (!env.ANTHROPIC_API_KEY || !env.RESEND_API_KEY) {
    console.log('SEO trends job skipped: missing ANTHROPIC_API_KEY or RESEND_API_KEY');
    return { ok: false, error: 'Missing ANTHROPIC_API_KEY or RESEND_API_KEY' };
  }

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
        max_tokens: 6000,
        system: SEO_TRENDS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: 'Research current luxury real estate trends and recommend 5 new Insights article topics for this month.' }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      console.log('SEO trends job: AI request failed', detail);
      return { ok: false, error: 'AI request failed', detail };
    }

    const data = await res.json();
    const raw = (data.content || []).map(b => (b.type === 'text' ? b.text : '')).join('').trim();

    // Surface stop_reason directly -- if this is ever "max_tokens" again,
    // that's an immediate, certain diagnosis (the response was cut off
    // before finishing) instead of having to infer it from where the raw
    // text happens to stop.
    if (data.stop_reason === 'max_tokens') {
      console.log('SEO trends job: response was truncated (max_tokens hit) before completing');
      return { ok: false, error: 'Response was truncated before completing (hit max_tokens) -- raise the limit further', stopReason: data.stop_reason, raw };
    }

    // Defensive safety net, not just a prompt instruction: the web search
    // tool can add <cite index="..."> tags into the model's output by
    // default, which breaks JSON syntax when they land inside a string
    // value (exactly what happened in production -- valid-looking JSON
    // that failed to parse because of embedded citation markup). Strip any
    // citation tags before attempting to parse, regardless of whether the
    // prompt instruction was followed.
    const cleaned = raw
      .replace(/<cite[^>]*>/gi, '')
      .replace(/<\/cite>/gi, '')
      .replace(/^```json\s*|\s*```$/g, '');

    let recommendations;
    try {
      recommendations = JSON.parse(cleaned);
    } catch {
      console.log('SEO trends job: could not parse AI response:', raw);
      return { ok: false, error: 'Could not parse AI response', stopReason: data.stop_reason, raw };
    }

    const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' });

    if (env.REPORTS_KV) {
      await env.REPORTS_KV.put('seo-trends-latest', JSON.stringify({ monthLabel, recommendations, generatedAt: new Date().toISOString() }));
    }

    const toAddress = env.LEAD_EMAIL || 'brkadiyala@gmail.com';
    const fromAddress = env.FROM_EMAIL || 'Luxury Redefined <leads@luxuryredefined.homes>';
    const text = [
      `Insights topic recommendations -- ${monthLabel}`,
      `Researched with real web search, cross-checked against your existing Insights articles so these aren't duplicates.`,
      `Note: these are topic/angle recommendations, not keyword-volume data -- that needs a paid SEO tool this site doesn't have.`,
      ``,
      ...recommendations.map((r, i) => `${i + 1}. ${r.title}\n   Angle: ${r.angle}\n   Target phrase: ${r.targetPhrase}\n   Why now: ${r.whyNow}\n`)
    ].join('\n');

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddress, to: [toAddress], subject: `Insights topic recommendations -- ${monthLabel}`, text })
    });

    if (!emailRes.ok) {
      return { ok: false, error: 'Email send failed', detail: await emailRes.text() };
    }

    return { ok: true, monthLabel, count: recommendations.length };
  } catch (err) {
    console.log('SEO trends job failed:', String(err));
    return { ok: false, error: String(err) };
  }
}

// Lets Claude itself decide when enough concrete criteria exist to search
// real inventory, rather than the frontend trying to guess from free text
// via regex. Anthropic's standard tool-use pattern: Claude may respond with
// a tool_use block instead of (or alongside) text; we execute the real
// search and send the result back for a final, grounded reply.
const SEARCH_LISTINGS_TOOL = {
  name: 'search_listings',
  description: 'Search current active BeachesMLS listings matching what the person has described. Call this as soon as at least one concrete filter is known (city, price range, bed count, or property type) -- do not wait to gather every possible detail first. Call it again, combining all known filters, every time the person adds a new specific detail later in the conversation -- never let the results go stale as their answers get more specific.',
  input_schema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'One of: Palm Beach, West Palm Beach, Jupiter, Boca Raton, Manalapan, Delray Beach' },
      minPrice: { type: 'number', description: 'Minimum price in dollars' },
      maxPrice: { type: 'number', description: 'Maximum price in dollars' },
      beds: { type: 'number', description: 'Minimum bedroom count' },
      propertyType: { type: 'string', enum: ['Waterfront', 'Golf community', 'Condominium'] }
    }
  }
};

// Deterministic safety net: budget questions are probably the single most
// common branch point in this concierge, and the system prompt's "hard
// rule" about always including a [SUGGEST] marker for bounded option lists
// doesn't apply with full reliability every time -- confirmed by a real
// conversation where the AI asked "$2-5M range, $5-10M, or something else"
// as plain text with no buttons. Rather than just rewording the prompt
// again (it already had a near-identical example and still didn't apply
// here), detect this specific, high-frequency case in code and inject the
// buttons directly if the AI's own reply asked a budget/price question but
// forgot the marker.
function ensureBudgetSuggestButtons(reply) {
  const asksAboutBudget = /\b(budget|price range)\b/i.test(reply) && reply.includes('?');
  const alreadyHasSuggest = /\[SUGGEST:/i.test(reply);
  if (asksAboutBudget && !alreadyHasSuggest) {
    return reply + '\n[SUGGEST: $1M - $2M | $2M - $5M | $5M - $10M | $10M+]';
  }
  return reply;
}

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

  // Structured buyer memory: fold BOTH the MLS-searchable fields (from the
  // traditional IDX filters, Phase 1) AND qualitative facts the concierge
  // has learned in earlier turns (lifestyle, dock needs, timeline, etc.)
  // into the system prompt for this one request. The two are framed
  // differently on purpose: searchable fields feed search_listings
  // directly, since they're real, verified MLS fields. Qualitative facts
  // are remembered context only -- they help the AI reference what it
  // already knows and avoid re-asking, but none of them get invented into
  // fake search filters, since things like "dock" or "boat size" aren't
  // backed by confirmed MLS fields.
  let systemPrompt = SYSTEM_PROMPT;
  const searchContext = body.searchContext && typeof body.searchContext === 'object' ? body.searchContext : null;
  if (searchContext) {
    const searchable = [];
    if (searchContext.city) searchable.push(`city: ${searchContext.city}`);
    if (searchContext.minPrice) searchable.push(`minimum price: $${Number(searchContext.minPrice).toLocaleString('en-US')}`);
    if (searchContext.maxPrice) searchable.push(`maximum price: $${Number(searchContext.maxPrice).toLocaleString('en-US')}`);
    if (searchContext.beds) searchable.push(`minimum bedrooms: ${searchContext.beds}`);
    if (searchContext.propertyType) searchable.push(`property type: ${searchContext.propertyType}`);
    if (searchable.length) {
      systemPrompt += `\n\nThe visitor already has these filters set on the traditional search on this site: ${searchable.join(', ')}. Treat this as already known -- do not ask about it again unless they want to change it, and use it as a starting point for search_listings if they haven't given you anything more specific yet.`;
    }

    const qualitative = [];
    if (searchContext.intent) qualitative.push(`intent: ${searchContext.intent}`);
    if (searchContext.lifestyle) qualitative.push(`lifestyle priority: ${searchContext.lifestyle}`);
    if (searchContext.dock) qualitative.push(`dock/boating needs: ${searchContext.dock}`);
    if (searchContext.timeline) qualitative.push(`timeline: ${searchContext.timeline}`);
    if (searchContext.clubInterest) qualitative.push(`club interest: ${searchContext.clubInterest}`);
    if (searchContext.construction) qualitative.push(`construction preference: ${searchContext.construction}`);
    if (searchContext.financing) qualitative.push(`financing: ${searchContext.financing}`);
    if (searchContext.sellingGoal) qualitative.push(`selling goal: ${searchContext.sellingGoal}`);
    if (qualitative.length) {
      systemPrompt += `\n\nYou've also already learned these things about the visitor earlier in this conversation, even if they're not in the recent transcript: ${qualitative.join('; ')}. Remember this -- don't ask again, and reference it naturally when relevant (e.g. "since you mentioned needing dock access for a 55ft boat..."). This is remembered context, not a literal MLS search filter -- don't imply search_listings can filter on it directly.`;
    }
  }

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
        system: systemPrompt,
        messages,
        tools: env.SPARK_ACCESS_TOKEN ? [SEARCH_LISTINGS_TOOL] : undefined
      })
    });

    if (!firstRes.ok) {
      const detail = await firstRes.text();
      return json({ error: 'AI request failed', detail }, 502);
    }

    const firstData = await firstRes.json();
    let toolUseBlock = (firstData.content || []).find(b => b.type === 'tool_use' && b.name === 'search_listings');

    // Deterministic guard, not just a prompt instruction: a message with
    // clear, explicit selling intent should never trigger a live buyer
    // search, full stop -- confirmed by a real case where the AI's own
    // text correctly asked about the seller's property while a
    // search_listings tool call still fired in the same turn, showing an
    // unrelated buyer listing card right under a seller-focused reply.
    // Narrow phrasing on purpose (not just the word "sell" anywhere) to
    // avoid false-positives on a legitimate buyer message that happens to
    // mention selling in some other context, e.g. "I need to sell my
    // current home before I can buy" is still primarily a buyer message
    // here and shouldn't get blocked.
    const clearSellerIntent = /\b(want to sell|sell my (house|home|property|condo)|selling my (house|home|property|condo)|list my (house|home|property))\b/i.test(message);
    if (clearSellerIntent && toolUseBlock) {
      console.log('Seller guard: ignored a search_listings call on a clear seller message');
      toolUseBlock = null;
    }

    // Lightweight fallback, not a full override: if the model left
    // propertyType unset but the message clearly says "apartment", default
    // it to Condominium -- Florida doesn't have a separate for-sale
    // apartment category, and relocating Northeast buyers commonly use
    // "apartment" this way. Only fills a genuine gap; never overrides an
    // explicit different choice the model already made (e.g. it correctly
    // set Waterfront instead because that distinction mattered more).
    if (toolUseBlock && !toolUseBlock.input?.propertyType && /\bapartment\b/i.test(message)) {
      toolUseBlock.input = { ...toolUseBlock.input, propertyType: 'Condominium' };
    }

    // No tool call -- plain conversational reply, same as before.
    if (!toolUseBlock) {
      let reply = (firstData.content || [])
        .map(block => (block.type === 'text' ? block.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim() || "I'll connect you with a specialist who can help with that.";
      reply = ensureBudgetSuggestButtons(reply);
      return json({ reply, listings: [] });
    }

    // Execute the real search Claude asked for.
    let searchResult;
    try {
      searchResult = await queryResoWithCache(env, toolUseBlock.input || {}, 6, 0);
    } catch (err) {
      searchResult = { listings: [], total: 0, error: String(err) };
    }

    // Deterministic check, not just a prompt instruction: a genuine
    // technical failure (network issue, Spark API outage) must never be
    // presented as "nothing's currently on the market" -- those are two
    // completely different situations, and conflating them is misleading
    // in the opposite direction from the luxury-range check below (that
    // one prevents implying false scarcity; this one prevents implying a
    // false "nothing available" when the search simply didn't run). Return
    // this before ever reaching the second AI call, so the AI can't
    // accidentally narrate a failed search as a real market condition.
    if (searchResult.error) {
      console.log('Concierge search failed:', searchResult.error);
      return json({
        reply: "I'm having trouble reaching our live listings system right now -- that's a temporary technical issue, not a reflection of what's actually on the market. Please try again in a moment, or I can connect you with a specialist directly.",
        listings: [],
        searchParams: toolUseBlock.input || {},
        searchFailed: true
      });
    }

    // Deterministic override, not just a prompt instruction: a search below
    // this brokerage's actual luxury range that comes back empty should
    // never get the "off-market/specialist" framing -- that implies
    // exclusive hidden inventory exists in a tier this brokerage doesn't
    // actually specialize in, which is misleading. Checking this in code
    // (rather than trusting the system prompt alone) guarantees it, since a
    // real test showed the AI didn't reliably apply this distinction from
    // the natural-language instruction alone.
    const searchedMaxPrice = Number(toolUseBlock.input?.maxPrice);
    const searchedBelowLuxuryRange = Number.isFinite(searchedMaxPrice) && searchedMaxPrice > 0 && searchedMaxPrice < 1000000;
    if (!searchResult.listings.length && searchedBelowLuxuryRange) {
      return json({
        reply: "Our focus is luxury properties, typically $1M and up, so I don't have a specialist search for that range. You're welcome to browse our condo communities directory or new developments directly, or search everything currently listed on our search page.",
        listings: [],
        searchParams: toolUseBlock.input || {}
      });
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
      sqft: l.LivingArea,
      waterfront: l.WaterfrontYN === true,
      subdivision: l.SubdivisionName || null,
      daysOnMarket: typeof l.DaysOnMarket === 'number' ? l.DaysOnMarket : null,
      hoaPerMonth: l.AssociationFee
        ? `$${Number(l.AssociationFee).toLocaleString('en-US')}${l.AssociationFeeFrequency ? ' ' + l.AssociationFeeFrequency.toLowerCase() : ''}`
        : null,
      propertyType: l.PropertySubType || l.PropertyType || null
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
        system: systemPrompt,
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
    let reply = (secondData.content || [])
      .map(block => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim() || (summaryForClaude.length
        ? `I found ${summaryForClaude.length} current listing${summaryForClaude.length === 1 ? '' : 's'} that match.`
        : "I don't see an exact match in current inventory, but a specialist can help with off-market options.");
    reply = ensureBudgetSuggestButtons(reply);

    return json({ reply, listings: searchResult.listings || [], searchParams: toolUseBlock.input || {} });
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
    if (request.method === 'GET' && url.pathname === '/admin/run/seo-trends') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      const result = await runSeoTrendsJob(env);
      return json(result, result.ok ? 200 : 500);
    }
    if (request.method === 'GET' && url.pathname === '/admin/report/seo-trends') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      if (!env.REPORTS_KV) return new Response('REPORTS_KV binding is not configured.', { status: 500 });
      const raw = await env.REPORTS_KV.get('seo-trends-latest');
      if (!raw) return new Response('No recommendations have run yet — visit /admin/run/seo-trends first.', { status: 404 });
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
      const allStatuses = url.searchParams.get('allStatuses') === '1';
      const raw = url.searchParams.get('raw') === '1';

      // Calls Spark directly (case-insensitive match, same as the real
      // filter) so you can test any subdivision value on demand -- shows
      // the raw response and status, not a silently-swallowed empty array,
      // so a genuine zero-listings result looks different from an actual
      // API error. Add &allStatuses=1 to see listings of ANY status (not
      // just Active) under this subdivision -- useful for checking whether
      // a listing that was visible earlier has since gone Pending, Closed,
      // or Withdrawn, rather than never having been IDX-eligible at all.
      let filterClause;
      if (allStatuses) {
        const names = subdivision.split('|').map(s => s.trim()).filter(Boolean);
        const subFilter = names.map(name => `SubdivisionName eq '${name.replace(/'/g, "''")}'`).join(' or ');
        filterClause = `(${subFilter})`;
      } else if (raw) {
        // Plain, case-sensitive exact match -- no tolower(). Tests whether
        // Spark's OData implementation actually supports the tolower()
        // function at all; if this succeeds where the tolower() version
        // fails on the exact same known-correct value, that confirms
        // tolower() itself is the bug, not the subdivision values.
        const names = subdivision.split('|').map(s => s.trim()).filter(Boolean);
        const subFilter = names.map(name => `SubdivisionName eq '${name.replace(/'/g, "''")}'`).join(' or ');
        filterClause = `StandardStatus eq 'Active' and (${subFilter})`;
      } else {
        filterClause = buildResoFilter({ subdivision });
      }
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
        let statuses = null;
        try {
          const parsed = JSON.parse(bodyText).value || [];
          parsedCount = parsed.length;
          statuses = parsed.map(l => ({ address: l.UnparsedAddress, status: l.StandardStatus, price: l.ListPrice, modified: l.ModificationTimestamp }));
        } catch {}
        return json({
          testedValue: subdivision,
          allStatuses,
          filterClause,
          requestUrl,
          httpStatus: res.status,
          parsedResultCount: parsedCount,
          statuses,
          rawResponseBody: bodyText.slice(0, 3000)
        }, res.ok ? 200 : 502);
      } catch (err) {
        return json({ testedValue: subdivision, filterClause, error: String(err) }, 500);
      }
    }

    if (request.method === 'GET' && url.pathname === '/admin/debug/listing-by-mls-id') {
      if (!checkAdminAuth(request, env)) return requireAdminAuth();
      if (!env.SPARK_ACCESS_TOKEN) return json({ error: 'SPARK_ACCESS_TOKEN is not set.' }, 500);
      const mlsId = url.searchParams.get('mls');
      if (!mlsId) return json({ error: 'Add ?mls=R11155081 (the public MLS# from BeachesMLS) to the URL.' }, 400);

      // Looks up one specific, known-active listing by its public MLS
      // number (ListingId), completely bypassing SubdivisionName/city/any
      // other filter. This isolates the question precisely: is this exact
      // record reachable through our authorized IDX feed at all, or not --
      // independent of anything to do with how we're filtering by
      // subdivision. If this comes back empty for a listing you can see is
      // Active with Internet: Yes in the agent-side MLS, that's strong
      // evidence of a difference between general "Internet Display" consent
      // and IDX-specific syndication, or a gap in this feed's coverage --
      // both things worth raising with FBS/BeachesMLS support directly,
      // not something guessing at filter syntax can fix.
      const safeId = mlsId.replace(/'/g, "''");
      const query = new URLSearchParams({
        '$filter': `ListingId eq '${safeId}'`,
        '$select': RESO_SELECT_FIELDS
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
          testedMlsId: mlsId,
          requestUrl,
          httpStatus: res.status,
          parsedResultCount: parsedCount,
          rawResponseBody: bodyText.slice(0, 3000)
        }, res.ok ? 200 : 502);
      } catch (err) {
        return json({ testedMlsId: mlsId, error: String(err) }, 500);
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
    } else if (event.cron === '0 13 8 * *') {
      ctx.waitUntil(runSeoTrendsJob(env));
    }
  }
};
