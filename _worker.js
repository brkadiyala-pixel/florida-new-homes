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
- IDX/live listings: when the person describes what they're looking for (city, price range, beds, property type), the website will query the real MLS feed via /api/listings and may pass you matching results as JSON. If you receive real listing data, you may reference those specific addresses, prices, and details. If no listing data is provided to you, or the feed is empty for that search, continue to speak in ranges and generalities and offer to connect them with a specialist for exact inventory — never invent a specific address, price, or listing that wasn't given to you.
- If someone wants to book a consultation, get a valuation, request off-market access, or asks something you can't fully answer, ask for their name and best phone number so a specialist can follow up — do not just say goodbye.
- Keep replies to 2-4 sentences unless the person asks for more detail.
- Once the conversation has established genuine buying or selling intent with at least one specific detail (a location, a budget, a property type, or a timeline), end that reply with the exact marker "[CAPTURE_LEAD]" on its own line, after your normal message. Use this at most once per conversation. Never mention this marker to the person or explain what it does — it is a signal for the website, not part of your visible reply.`;

function json(body, status = 200, noStore = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (noStore) headers['Cache-Control'] = 'no-store';
  return new Response(JSON.stringify(body), { status, headers });
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
 * Queries BeachesMLS listing data via the Spark® Platform API (FBS/Flexmls
 * Datamart), the RESO Web API-compliant feed BeachesMLS actually uses —
 * requested via sparkplatform.com/register/developers, enrolled through
 * the "BeachesMLS Agent/Broker Licensed Feed – IDX" Datamart plan.
 *
 * IMPORTANT — Spark's auth is NOT a simple bearer token. It uses a signed
 * key/secret exchange that returns a short-lived session token:
 *   1. Sign a request with your developer key + secret (MD5-based signature
 *      per Spark's auth docs) to obtain a session token.
 *   2. Session tokens last up to 24h, with a 1h idle timeout — expired
 *      tokens must be re-authenticated.
 *   3. Every data request must include the current session token.
 * The placeholder below assumes RESO_API_TOKEN is already a valid, current
 * session token for simplicity — swap in the real key+secret→session-token
 * exchange (see sparkplatform.com/docs/authentication/spark_api_authentication)
 * once you're actually enrolled and can see the exact request-signing format
 * Spark expects. This is the one piece that still needs finishing once your
 * BeachesMLS enrollment is approved.
 *
 * RESO_API_BASE_URL should be the specific resource endpoint Spark gives
 * you post-approval (typically something under replication.sparkapi.com or
 * similar — confirm the exact URL in your Datamart enrollment details).
 */
async function handleListings(request, env) {
  if (!env.RESO_API_BASE_URL || !env.RESO_API_TOKEN) {
    return json({
      error: 'IDX feed is not configured yet.',
      detail: 'Set RESO_API_BASE_URL and RESO_API_TOKEN once your BeachesMLS/Spark API enrollment is approved.'
    }, 501);
  }

  const url = new URL(request.url);
  const city = url.searchParams.get('city');
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');
  const beds = url.searchParams.get('beds');
  const propertyType = url.searchParams.get('propertyType');

  // Build a RESO Data Dictionary-style OData $filter clause.
  const filters = [`StandardStatus eq 'Active'`];
  if (city) filters.push(`City eq '${city.replace(/'/g, "''")}'`);
  if (minPrice) filters.push(`ListPrice ge ${Number(minPrice)}`);
  if (maxPrice) filters.push(`ListPrice le ${Number(maxPrice)}`);
  if (beds) filters.push(`BedroomsTotal ge ${Number(beds)}`);
  if (propertyType === 'Condominium') filters.push(`PropertyType eq 'Condominium'`);
  if (propertyType === 'Waterfront') filters.push(`WaterfrontYN eq true`);
  if (propertyType === 'Golf community') {
    // No standard MLS field marks "golf community" directly. Best-effort
    // approximation: match against known golf club subdivision names from
    // the site's own concierge system prompt. Revisit once real field
    // names/values come back from Spark — some MLSs expose a cleaner
    // community/subdivision list that would make this exact rather than
    // approximate.
    const golfCommunities = ['Bears Club', 'Admirals Cove', 'Old Palm', "Frenchman's Creek"];
    const golfFilter = golfCommunities
      .map(name => `contains(SubdivisionName,'${name.replace(/'/g, "''")}')`)
      .join(' or ');
    filters.push(`(${golfFilter})`);
  }

  const query = new URLSearchParams({
    '$filter': filters.join(' and '),
    '$top': '12',
    '$select': 'ListingKey,UnparsedAddress,City,ListPrice,BedroomsTotal,BathroomsTotalInteger,LivingArea,PropertyType,WaterfrontYN,SubdivisionName,Media'
  });

  try {
    const res = await fetch(`${env.RESO_API_BASE_URL}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${env.RESO_API_TOKEN}` }
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: 'IDX provider rejected the request', detail }, 502);
    }

    const data = await res.json();
    return json({ listings: data.value || [] });
  } catch (err) {
    return json({ error: 'Unexpected error contacting IDX feed', detail: String(err) }, 500);
  }
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

  const messages = [...history, { role: 'user', content: message }];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, system: SYSTEM_PROMPT, messages })
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: 'AI request failed', detail }, 502);
    }

    const data = await res.json();
    const reply = (data.content || [])
      .map(block => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim() || "I'll connect you with a specialist who can help with that.";

    return json({ reply });
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

    // Everything else: serve the static site files as before.
    return env.ASSETS.fetch(request);
  }
};
