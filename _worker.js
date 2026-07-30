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
- Ask about lifestyle and priorities before jumping to inventory — ocean access, golf, privacy, new construction, timeline — the way a real advisor would before recommending anything.
- Never invent a specific property address, price, exact listing, or specific pre-construction project name you have not been given — speak in ranges and generalities about the market instead, and offer to connect them with a specialist for exact inventory.
- If someone wants to book a consultation, get a valuation, request off-market access, or asks something you can't fully answer, ask for their name and best phone number so a specialist can follow up — do not just say goodbye.
- Keep replies to 2-4 sentences unless the person asks for more detail.
- Once the conversation has established genuine buying or selling intent with at least one specific detail (a location, a budget, a property type, or a timeline), end that reply with the exact marker "[CAPTURE_LEAD]" on its own line, after your normal message. Use this at most once per conversation. Never mention this marker to the person or explain what it does — it is a signal for the website, not part of your visible reply.`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
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

    // Push to BoldTrail too, if configured. This never blocks or fails the
    // response to the visitor — email is the reliable path; BoldTrail sync
    // is a bonus that degrades gracefully if the token or endpoint ever
    // need adjusting.
    if (env.BOLDTRAIL_API_TOKEN) {
      try {
        await pushToBoldTrail({ name, email, phone, source, sourceLabel: sourceLabels[source] || source, messageBody }, env);
      } catch (err) {
        console.log('BoldTrail push failed (non-fatal):', String(err));
      }
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected error sending email', detail: String(err) }, 500);
  }
}

/* Pushes a new contact into BoldTrail (formerly kvCORE) using the vendor
   API token generated from Lead Engine > Lead Dropbox > My API Tokens.
   Built against the standard pattern used by other BoldTrail vendor
   integrations (Listings-to-Leads, myPlusLeads, API Nation) since
   BoldTrail's own Postman docs are JS-rendered and not directly
   inspectable here. If BoldTrail ever changes their schema, this is the
   one place to adjust — check the response detail logged above first. */
async function pushToBoldTrail(lead, env) {
  const [firstName, ...rest] = lead.name.trim().split(' ');
  const lastName = rest.join(' ') || '-';

  const res = await fetch('https://api.kvcore.com/v2/public/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.BOLDTRAIL_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email: lead.email,
      phone: lead.phone && lead.phone !== 'Not provided' ? lead.phone : undefined,
      source: 'Luxury Redefined Palm Beach website',
      tags: [lead.source, 'website-lead'],
      notes: [lead.sourceLabel, lead.messageBody].filter(Boolean).join('\n\n')
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`BoldTrail rejected the request (${res.status}): ${detail}`);
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
    if (request.method === 'POST' && url.pathname === '/api/concierge') {
      return handleConcierge(request, env);
    }

    // Everything else: serve the static site files as before.
    return env.ASSETS.fetch(request);
  }
};

